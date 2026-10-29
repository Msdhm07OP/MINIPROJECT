import { query, transaction, withRetry } from '../database/config.js';
import logger from '../utils/logger/index.js';

/**
 * Repository for booking database operations with concurrency safety
 */
class BookingRepository {
  /**
   * Acquire advisory lock for venue/date/resource allocation
   * Uses PostgreSQL advisory locks to serialize booking attempts
   * @param {Object} client - Database client (must be in transaction)
   * @param {number} venueId
   * @param {string} eventDate
   * @returns {Promise<boolean>} Lock acquired
   */
  async acquireAllocationLock(client, venueId, eventDate) {
    // Convert venue_id and date to lock keys
    // Advisory lock key: hash(venue_id + date_string)
    const dateNum = new Date(eventDate).getTime() % 2147483647;
    const lockKey1 = venueId;
    const lockKey2 = dateNum;

    const result = await client.query(
      'SELECT pg_try_advisory_xact_lock($1, $2) as acquired',
      [lockKey1, lockKey2]
    );

    return result.rows[0].acquired;
  }

  /**
   * Check if hall is available during reserved interval
   * @param {Object} client
   * @param {number} hallId
   * @param {string} eventDate
   * @param {string} reservedStart
   * @param {string} reservedEnd
   * @param {number} excludeBookingId
   * @returns {Promise<boolean>}
   */
  async isHallAvailable(client, hallId, eventDate, reservedStart, reservedEnd, excludeBookingId = null) {
    const sql = `
      SELECT COUNT(*) as conflict_count
      FROM bookings
      WHERE hall_id = $1
        AND event_date = $2
        AND status = 'confirmed'
        AND ($3::integer IS NULL OR id != $3)
        AND tsrange(
          ($2::date + reserved_start::time)::timestamp,
          ($2::date + reserved_end::time)::timestamp
        ) && tsrange(
          ($2::date + $4::time)::timestamp,
          ($2::date + $5::time)::timestamp
        )
    `;

    const result = await client.query(sql, [hallId, eventDate, excludeBookingId, reservedStart, reservedEnd]);
    return parseInt(result.rows[0].conflict_count) === 0;
  }

  /**
   * Get overlapping bookings for resource calculation
   * @param {Object} client
   * @param {number} venueId
   * @param {string} eventDate
   * @param {string} reservedStart
   * @param {string} reservedEnd
   * @param {number} excludeBookingId
   * @returns {Promise<Array>}
   */
  async getOverlappingBookings(client, venueId, eventDate, reservedStart, reservedEnd, excludeBookingId = null) {
    const sql = `
      SELECT
        b.id,
        b.reserved_start,
        b.reserved_end,
        json_agg(
          json_build_object(
            'resource_type', rt.name,
            'resource_type_id', rt.id,
            'quantity', bra.quantity_allocated
          )
        ) as resources
      FROM bookings b
      LEFT JOIN booking_resource_allocations bra ON b.id = bra.booking_id
      LEFT JOIN resource_types rt ON bra.resource_type_id = rt.id
      WHERE b.venue_id = $1
        AND b.event_date = $2
        AND b.status = 'confirmed'
        AND ($3::integer IS NULL OR b.id != $3)
        AND tsrange(
          ($2::date + b.reserved_start::time)::timestamp,
          ($2::date + b.reserved_end::time)::timestamp
        ) && tsrange(
          ($2::date + $4::time)::timestamp,
          ($2::date + $5::time)::timestamp
        )
      GROUP BY b.id, b.reserved_start, b.reserved_end
    `;

    const result = await client.query(sql, [venueId, eventDate, excludeBookingId, reservedStart, reservedEnd]);
    return result.rows;
  }

  /**
   * Get venue resource capacity
   * @param {Object} client
   * @param {number} venueId
   * @returns {Promise<Object>} Resource capacities by type
   */
  async getVenueResourceCapacity(client, venueId) {
    const sql = `
      SELECT
        rt.id,
        rt.name,
        vrc.capacity
      FROM venue_resource_capacity vrc
      JOIN resource_types rt ON vrc.resource_type_id = rt.id
      WHERE vrc.venue_id = $1
    `;

    const result = await client.query(sql, [venueId]);

    const capacity = {};
    result.rows.forEach(row => {
      capacity[row.name] = {
        id: row.id,
        capacity: row.capacity
      };
    });

    return capacity;
  }

  /**
   * Get halls with sufficient capacity at venue
   * @param {Object} client
   * @param {number} venueId
   * @param {number} minCapacity
   * @returns {Promise<Array>}
   */
  async getHallsByCapacity(client, venueId, minCapacity) {
    const sql = `
      SELECT id, name, capacity
      FROM halls
      WHERE venue_id = $1
        AND capacity >= $2
        AND is_active = true
      ORDER BY capacity ASC, id ASC
    `;

    const result = await client.query(sql, [venueId, minCapacity]);
    return result.rows;
  }

  /**
   * Create booking with allocations atomically
   * @param {Object} client
   * @param {Object} bookingData
   * @param {Array} resourceAllocations
   * @returns {Promise<Object>} Created booking
   */
  async createBookingWithAllocations(client, bookingData, resourceAllocations = []) {
    // Insert booking
    const bookingSql = `
      INSERT INTO bookings (
        client_id, hall_id, venue_id, event_name, event_date,
        event_start, event_end, reserved_start, reserved_end,
        attendees, status, rejection_reason, rejection_code,
        correlation_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const bookingResult = await client.query(bookingSql, [
      bookingData.client_id,
      bookingData.hall_id,
      bookingData.venue_id,
      bookingData.event_name,
      bookingData.event_date,
      bookingData.event_start,
      bookingData.event_end,
      bookingData.reserved_start,
      bookingData.reserved_end,
      bookingData.attendees,
      bookingData.status,
      bookingData.rejection_reason || null,
      bookingData.rejection_code || null,
      bookingData.correlation_id || null,
      bookingData.created_by || null
    ]);

    const booking = bookingResult.rows[0];

    // Insert resource allocations for confirmed bookings
    if (booking.status === 'confirmed' && resourceAllocations.length > 0) {
      const allocationSql = `
        INSERT INTO booking_resource_allocations (booking_id, resource_type_id, quantity_allocated)
        VALUES ($1, $2, $3)
      `;

      for (const allocation of resourceAllocations) {
        await client.query(allocationSql, [
          booking.id,
          allocation.resource_type_id,
          allocation.quantity
        ]);
      }
    }

    // Log audit event
    await this.createAuditEvent(client, {
      event_type: booking.status === 'confirmed' ? 'booking_confirmed' : 'booking_rejected',
      booking_id: booking.id,
      client_id: booking.client_id,
      correlation_id: booking.correlation_id,
      event_data: {
        venue_id: booking.venue_id,
        hall_id: booking.hall_id,
        event_date: booking.event_date,
        rejection_reason: booking.rejection_reason
      }
    });

    return booking;
  }

  /**
   * Update booking (for rescheduling)
   * @param {Object} client
   * @param {number} bookingId
   * @param {Object} updates
   * @param {Array} newAllocations
   * @returns {Promise<Object>}
   */
  async updateBooking(client, bookingId, updates, newAllocations = []) {
    // Update booking
    const sql = `
      UPDATE bookings
      SET
        hall_id = COALESCE($2, hall_id),
        venue_id = COALESCE($3, venue_id),
        event_name = COALESCE($4, event_name),
        event_date = COALESCE($5, event_date),
        event_start = COALESCE($6, event_start),
        event_end = COALESCE($7, event_end),
        reserved_start = COALESCE($8, reserved_start),
        reserved_end = COALESCE($9, reserved_end),
        attendees = COALESCE($10, attendees),
        updated_at = NOW()
      WHERE id = $1 AND status = 'confirmed'
      RETURNING *
    `;

    const result = await client.query(sql, [
      bookingId,
      updates.hall_id,
      updates.venue_id,
      updates.event_name,
      updates.event_date,
      updates.event_start,
      updates.event_end,
      updates.reserved_start,
      updates.reserved_end,
      updates.attendees
    ]);

    if (result.rows.length === 0) {
      throw new Error('Booking not found or not in confirmed status');
    }

    // Update resource allocations if provided
    if (newAllocations.length > 0) {
      // Delete old allocations
      await client.query('DELETE FROM booking_resource_allocations WHERE booking_id = $1', [bookingId]);

      // Insert new allocations
      const allocationSql = `
        INSERT INTO booking_resource_allocations (booking_id, resource_type_id, quantity_allocated)
        VALUES ($1, $2, $3)
      `;

      for (const allocation of newAllocations) {
        await client.query(allocationSql, [
          bookingId,
          allocation.resource_type_id,
          allocation.quantity
        ]);
      }
    }

    return result.rows[0];
  }

  /**
   * Cancel booking
   * @param {Object} client
   * @param {number} bookingId
   * @param {string} reason
   * @returns {Promise<Object>}
   */
  async cancelBooking(client, bookingId, reason = null) {
    const sql = `
      UPDATE bookings
      SET status = 'cancelled', rejection_reason = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'confirmed'
      RETURNING *
    `;

    const result = await client.query(sql, [bookingId, reason]);

    if (result.rows.length === 0) {
      throw new Error('Booking not found or not in confirmed status');
    }

    await this.createAuditEvent(client, {
      event_type: 'booking_cancelled',
      booking_id: bookingId,
      event_data: { reason }
    });

    return result.rows[0];
  }

  /**
   * Get booking by ID with full details
   * @param {number} bookingId
   * @returns {Promise<Object>}
   */
  async getBookingById(bookingId) {
    const sql = `
      SELECT
        b.*,
        h.name as hall_name,
        h.capacity as hall_capacity,
        v.name as venue_name,
        c.name as client_name,
        c.organization as client_organization,
        json_agg(
          json_build_object(
            'resource_type', rt.name,
            'quantity', bra.quantity_allocated
          ) ORDER BY rt.name
        ) FILTER (WHERE rt.id IS NOT NULL) as resource_allocations
      FROM bookings b
      JOIN venues v ON b.venue_id = v.id
      JOIN clients c ON b.client_id = c.id
      LEFT JOIN halls h ON b.hall_id = h.id
      LEFT JOIN booking_resource_allocations bra ON b.id = bra.booking_id
      LEFT JOIN resource_types rt ON bra.resource_type_id = rt.id
      WHERE b.id = $1
      GROUP BY b.id, h.name, h.capacity, v.name, c.name, c.organization
    `;

    const result = await query(sql, [bookingId]);
    return result.rows[0] || null;
  }

  /**
   * Get bookings with filters
   * @param {Object} filters
   * @returns {Promise<Array>}
   */
  async getBookings(filters = {}) {
    let sql = `
      SELECT
        b.*,
        h.name as hall_name,
        v.name as venue_name,
        c.name as client_name
      FROM bookings b
      JOIN venues v ON b.venue_id = v.id
      JOIN clients c ON b.client_id = c.id
      LEFT JOIN halls h ON b.hall_id = h.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (filters.status) {
      sql += ` AND b.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.venue_id) {
      sql += ` AND b.venue_id = $${paramCount}`;
      params.push(filters.venue_id);
      paramCount++;
    }

    if (filters.client_id) {
      sql += ` AND b.client_id = $${paramCount}`;
      params.push(filters.client_id);
      paramCount++;
    }

    if (filters.event_date) {
      sql += ` AND b.event_date = $${paramCount}`;
      params.push(filters.event_date);
      paramCount++;
    }

    if (filters.date_from) {
      sql += ` AND b.event_date >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      sql += ` AND b.event_date <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    sql += ' ORDER BY b.event_date DESC, b.event_start DESC';

    if (filters.limit) {
      sql += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
      paramCount++;
    }

    if (filters.offset) {
      sql += ` OFFSET $${paramCount}`;
      params.push(filters.offset);
    }

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Create audit event
   * @param {Object} client
   * @param {Object} eventData
   */
  async createAuditEvent(client, eventData) {
    const sql = `
      INSERT INTO audit_events (event_type, booking_id, client_id, correlation_id, actor, event_data)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await client.query(sql, [
      eventData.event_type,
      eventData.booking_id || null,
      eventData.client_id || null,
      eventData.correlation_id || null,
      eventData.actor || null,
      eventData.event_data ? JSON.stringify(eventData.event_data) : null
    ]);
  }
}

export default new BookingRepository();
