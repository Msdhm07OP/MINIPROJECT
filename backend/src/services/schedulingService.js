import { db } from '../config/database.js';
import { validateBookingRequest } from './validationService.js';
import {
  calculateReservedInterval,
  checkIntervalOverlap
} from '../utils/timeHelpers.js';

/**
 * Find available hall using the required algorithm
 * @param {object} request - Booking request
 * @returns {object|null} { hallId, venueId, venueName, hallName } or null
 */
const findAvailableHall = (request) => {
  const {
    event_date,
    event_start,
    event_end,
    attendees,
    preferred_venue_id,
    projectors_requested = 0,
    audio_systems_requested = 0,
    staff_requested = 0,
    exclude_booking_id = null // For rescheduling
  } = request;

  const { reservedStart, reservedEnd } = calculateReservedInterval(
    event_date,
    event_start,
    event_end
  );

  // Step 1: Try preferred venue first
  const result = tryVenue(
    preferred_venue_id,
    event_date,
    reservedStart,
    reservedEnd,
    attendees,
    projectors_requested,
    audio_systems_requested,
    staff_requested,
    exclude_booking_id
  );

  if (result) {
    return result;
  }

  // Step 2: Try other venues in deterministic order (ascending venue ID)
  const otherVenues = db.prepare(`
    SELECT id FROM venues WHERE id != ? ORDER BY id ASC
  `).all(preferred_venue_id);

  for (const venue of otherVenues) {
    const result = tryVenue(
      venue.id,
      event_date,
      reservedStart,
      reservedEnd,
      attendees,
      projectors_requested,
      audio_systems_requested,
      staff_requested,
      exclude_booking_id
    );

    if (result) {
      return result;
    }
  }

  return null; // No feasible allocation found
};

/**
 * Try to find a suitable hall and resources at a specific venue
 * @param {number} venueId
 * @param {string} eventDate
 * @param {string} reservedStart
 * @param {string} reservedEnd
 * @param {number} attendees
 * @param {number} projectorsRequested
 * @param {number} audioSystemsRequested
 * @param {number} staffRequested
 * @param {number|null} excludeBookingId
 * @returns {object|null}
 */
const tryVenue = (
  venueId,
  eventDate,
  reservedStart,
  reservedEnd,
  attendees,
  projectorsRequested,
  audioSystemsRequested,
  staffRequested,
  excludeBookingId
) => {
  // Get halls with sufficient capacity, ordered by capacity ascending then id ascending
  const halls = db.prepare(`
    SELECT h.id, h.name, h.capacity, v.name as venue_name
    FROM halls h
    JOIN venues v ON h.venue_id = v.id
    WHERE h.venue_id = ? AND h.capacity >= ?
    ORDER BY h.capacity ASC, h.id ASC
  `).all(venueId, attendees);

  if (halls.length === 0) {
    return null; // No hall with sufficient capacity
  }

  // Check each hall (smallest first)
  for (const hall of halls) {
    // Check hall availability
    if (isHallAvailable(hall.id, eventDate, reservedStart, reservedEnd, excludeBookingId)) {
      // Check resource availability at this venue
      if (areResourcesAvailable(
        venueId,
        eventDate,
        reservedStart,
        reservedEnd,
        projectorsRequested,
        audioSystemsRequested,
        staffRequested,
        excludeBookingId
      )) {
        return {
          hallId: hall.id,
          venueId: venueId,
          venueName: hall.venue_name,
          hallName: hall.name,
          hallCapacity: hall.capacity
        };
      }
    }
  }

  return null; // No feasible hall and resource combination at this venue
};

/**
 * Check if a hall is available during the reserved interval
 * @param {number} hallId
 * @param {string} eventDate
 * @param {string} reservedStart
 * @param {string} reservedEnd
 * @param {number|null} excludeBookingId
 * @returns {boolean}
 */
const isHallAvailable = (hallId, eventDate, reservedStart, reservedEnd, excludeBookingId) => {
  let query = `
    SELECT id, reserved_start, reserved_end
    FROM bookings
    WHERE hall_id = ?
      AND event_date = ?
      AND status = 'confirmed'
  `;

  const params = [hallId, eventDate];

  if (excludeBookingId) {
    query += ` AND id != ?`;
    params.push(excludeBookingId);
  }

  const conflictingBookings = db.prepare(query).all(...params);

  // Check for overlap with any confirmed booking
  for (const booking of conflictingBookings) {
    if (checkIntervalOverlap(
      eventDate,
      reservedStart,
      reservedEnd,
      booking.reserved_start,
      booking.reserved_end
    )) {
      return false; // Conflict found
    }
  }

  return true; // No conflicts
};

/**
 * Check if shared resources are available at a venue during the reserved interval
 * Uses sweep-line algorithm to calculate concurrent resource usage
 * @param {number} venueId
 * @param {string} eventDate
 * @param {string} reservedStart
 * @param {string} reservedEnd
 * @param {number} projectorsRequested
 * @param {number} audioSystemsRequested
 * @param {number} staffRequested
 * @param {number|null} excludeBookingId
 * @returns {boolean}
 */
const areResourcesAvailable = (
  venueId,
  eventDate,
  reservedStart,
  reservedEnd,
  projectorsRequested,
  audioSystemsRequested,
  staffRequested,
  excludeBookingId
) => {
  // Get venue resource capacity
  const venueResources = db.prepare(`
    SELECT projectors, audio_systems, support_staff
    FROM venue_resources
    WHERE venue_id = ?
  `).get(venueId);

  if (!venueResources) {
    return false;
  }

  // Get all confirmed bookings at this venue on this date that overlap with our interval
  let query = `
    SELECT
      reserved_start,
      reserved_end,
      projectors_requested,
      audio_systems_requested,
      staff_requested
    FROM bookings
    WHERE venue_id = ?
      AND event_date = ?
      AND status = 'confirmed'
  `;

  const params = [venueId, eventDate];

  if (excludeBookingId) {
    query += ` AND id != ?`;
    params.push(excludeBookingId);
  }

  const existingBookings = db.prepare(query).all(...params);

  // Filter to only overlapping bookings
  const overlappingBookings = existingBookings.filter(booking =>
    checkIntervalOverlap(
      eventDate,
      reservedStart,
      reservedEnd,
      booking.reserved_start,
      booking.reserved_end
    )
  );

  // Sweep-line algorithm: create events for all interval boundaries
  const events = [];

  // Add candidate booking
  events.push({
    time: reservedStart,
    type: 'start',
    projectors: projectorsRequested,
    audio: audioSystemsRequested,
    staff: staffRequested
  });
  events.push({
    time: reservedEnd,
    type: 'end',
    projectors: projectorsRequested,
    audio: audioSystemsRequested,
    staff: staffRequested
  });

  // Add existing bookings
  for (const booking of overlappingBookings) {
    events.push({
      time: booking.reserved_start,
      type: 'start',
      projectors: booking.projectors_requested,
      audio: booking.audio_systems_requested,
      staff: booking.staff_requested
    });
    events.push({
      time: booking.reserved_end,
      type: 'end',
      projectors: booking.projectors_requested,
      audio: booking.audio_systems_requested,
      staff: booking.staff_requested
    });
  }

  // Sort events by time, with 'end' events before 'start' events at same time
  events.sort((a, b) => {
    if (a.time === b.time) {
      return a.type === 'end' ? -1 : 1;
    }
    return a.time.localeCompare(b.time);
  });

  // Sweep through events and track concurrent usage
  let currentProjectors = 0;
  let currentAudio = 0;
  let currentStaff = 0;

  for (const event of events) {
    if (event.type === 'start') {
      currentProjectors += event.projectors;
      currentAudio += event.audio;
      currentStaff += event.staff;

      // Check if capacity is exceeded
      if (currentProjectors > venueResources.projectors ||
          currentAudio > venueResources.audio_systems ||
          currentStaff > venueResources.support_staff) {
        return false;
      }
    } else {
      currentProjectors -= event.projectors;
      currentAudio -= event.audio;
      currentStaff -= event.staff;
    }
  }

  return true; // Resources are available
};

/**
 * Generate detailed rejection reason
 * @param {object} request
 * @returns {string}
 */
const generateRejectionReason = (request) => {
  const {
    event_date,
    event_start,
    event_end,
    attendees,
    preferred_venue_id,
    projectors_requested = 0,
    audio_systems_requested = 0,
    staff_requested = 0
  } = request;

  const { reservedStart, reservedEnd } = calculateReservedInterval(
    event_date,
    event_start,
    event_end
  );

  // Check all venues for detailed feedback
  const venues = db.prepare('SELECT id, name FROM venues ORDER BY id ASC').all();

  const reasons = [];

  for (const venue of venues) {
    const venueResources = db.prepare(`
      SELECT projectors, audio_systems, support_staff
      FROM venue_resources
      WHERE venue_id = ?
    `).get(venue.id);

    const halls = db.prepare(`
      SELECT id, name, capacity
      FROM halls
      WHERE venue_id = ? AND capacity >= ?
      ORDER BY capacity ASC
    `).all(venue.id, attendees);

    if (halls.length === 0) {
      reasons.push(`${venue.name}: No hall with sufficient capacity for ${attendees} attendees`);
      continue;
    }

    let hallAvailable = false;
    let resourcesAvailable = false;

    for (const hall of halls) {
      if (isHallAvailable(hall.id, event_date, reservedStart, reservedEnd, null)) {
        hallAvailable = true;
        break;
      }
    }

    if (!hallAvailable) {
      reasons.push(`${venue.name}: All suitable halls are booked during ${reservedStart} - ${reservedEnd}`);
      continue;
    }

    if (areResourcesAvailable(
      venue.id,
      event_date,
      reservedStart,
      reservedEnd,
      projectors_requested,
      audio_systems_requested,
      staff_requested,
      null
    )) {
      resourcesAvailable = true;
    } else {
      // Determine which resource is the bottleneck
      const bottlenecks = [];
      if (!areResourcesAvailable(venue.id, event_date, reservedStart, reservedEnd, projectors_requested, 0, 0, null)) {
        bottlenecks.push(`projectors (available: ${venueResources.projectors}, needed: ${projectors_requested})`);
      }
      if (!areResourcesAvailable(venue.id, event_date, reservedStart, reservedEnd, 0, audio_systems_requested, 0, null)) {
        bottlenecks.push(`audio systems (available: ${venueResources.audio_systems}, needed: ${audio_systems_requested})`);
      }
      if (!areResourcesAvailable(venue.id, event_date, reservedStart, reservedEnd, 0, 0, staff_requested, null)) {
        bottlenecks.push(`support staff (available: ${venueResources.support_staff}, needed: ${staff_requested})`);
      }

      reasons.push(`${venue.name}: Insufficient ${bottlenecks.join(', ')} during the requested time`);
    }
  }

  if (reasons.length === 0) {
    return 'No suitable venue, hall, and resource combination available';
  }

  const preferredVenue = venues.find(v => v.id === preferred_venue_id);
  return `Cannot accommodate request. ${preferredVenue?.name} (preferred): ${reasons.find(r => r.startsWith(preferredVenue?.name)) || 'Not available'}. Other venues: ${reasons.filter(r => !r.startsWith(preferredVenue?.name)).join('; ')}`;
};

/**
 * Confirm a booking
 * @param {object} request
 * @returns {object} { success: boolean, booking: object|null, message: string }
 */
export const confirmBooking = (request) => {
  // Validate request
  const validation = validateBookingRequest(request);
  if (!validation.valid) {
    return {
      success: false,
      booking: null,
      message: validation.errors.join('; ')
    };
  }

  // Calculate reserved interval
  const { reservedStart, reservedEnd } = calculateReservedInterval(
    request.event_date,
    request.event_start,
    request.event_end
  );

  // Find available hall
  const allocation = findAvailableHall(request);

  if (!allocation) {
    // Create rejected booking record
    const rejectionReason = generateRejectionReason(request);

    const stmt = db.prepare(`
      INSERT INTO bookings (
        client_id, venue_id, event_name, event_date,
        event_start, event_end, reserved_start, reserved_end,
        attendees, projectors_requested, audio_systems_requested,
        staff_requested, status, rejection_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rejected', ?)
    `);

    const result = stmt.run(
      request.client_id,
      request.preferred_venue_id,
      request.event_name,
      request.event_date,
      request.event_start,
      request.event_end,
      reservedStart,
      reservedEnd,
      request.attendees,
      request.projectors_requested || 0,
      request.audio_systems_requested || 0,
      request.staff_requested || 0,
      rejectionReason
    );

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);

    return {
      success: false,
      booking,
      message: rejectionReason
    };
  }

  // Create confirmed booking
  const stmt = db.prepare(`
    INSERT INTO bookings (
      client_id, hall_id, venue_id, event_name, event_date,
      event_start, event_end, reserved_start, reserved_end,
      attendees, projectors_requested, audio_systems_requested,
      staff_requested, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
  `);

  const result = stmt.run(
    request.client_id,
    allocation.hallId,
    allocation.venueId,
    request.event_name,
    request.event_date,
    request.event_start,
    request.event_end,
    reservedStart,
    reservedEnd,
    request.attendees,
    request.projectors_requested || 0,
    request.audio_systems_requested || 0,
    request.staff_requested || 0
  );

  const booking = db.prepare(`
    SELECT b.*, h.name as hall_name, v.name as venue_name, c.name as client_name
    FROM bookings b
    LEFT JOIN halls h ON b.hall_id = h.id
    JOIN venues v ON b.venue_id = v.id
    JOIN clients c ON b.client_id = c.id
    WHERE b.id = ?
  `).get(result.lastInsertRowid);

  return {
    success: true,
    booking,
    message: `Event confirmed at ${allocation.venueName} - ${allocation.hallName}`
  };
};

/**
 * Cancel a booking
 * @param {number} bookingId
 * @returns {object} { success: boolean, message: string }
 */
export const cancelBooking = (bookingId) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

  if (!booking) {
    return {
      success: false,
      message: 'Booking not found'
    };
  }

  if (booking.status === 'cancelled') {
    return {
      success: false,
      message: 'Booking is already cancelled'
    };
  }

  if (booking.status !== 'confirmed') {
    return {
      success: false,
      message: 'Only confirmed bookings can be cancelled'
    };
  }

  // Update booking status to cancelled
  db.prepare(`
    UPDATE bookings
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(bookingId);

  return {
    success: true,
    message: 'Booking cancelled successfully. Resources have been released.'
  };
};

/**
 * Reschedule a booking (atomic operation)
 * @param {number} bookingId
 * @param {object} newRequest - New booking details
 * @returns {object} { success: boolean, booking: object|null, message: string }
 */
export const rescheduleBooking = (bookingId, newRequest) => {
  const originalBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

  if (!originalBooking) {
    return {
      success: false,
      booking: null,
      message: 'Booking not found'
    };
  }

  if (originalBooking.status !== 'confirmed') {
    return {
      success: false,
      booking: null,
      message: 'Only confirmed bookings can be rescheduled'
    };
  }

  // Validate new request
  const validation = validateBookingRequest(newRequest);
  if (!validation.valid) {
    return {
      success: false,
      booking: originalBooking,
      message: validation.errors.join('; ')
    };
  }

  // Calculate new reserved interval
  const { reservedStart, reservedEnd } = calculateReservedInterval(
    newRequest.event_date,
    newRequest.event_start,
    newRequest.event_end
  );

  // Find available hall (excluding current booking from conflict check)
  const allocation = findAvailableHall({
    ...newRequest,
    exclude_booking_id: bookingId
  });

  if (!allocation) {
    const rejectionReason = generateRejectionReason(newRequest);
    return {
      success: false,
      booking: originalBooking,
      message: `Cannot reschedule: ${rejectionReason}`
    };
  }

  // Update booking atomically
  db.prepare(`
    UPDATE bookings
    SET
      hall_id = ?,
      venue_id = ?,
      event_name = ?,
      event_date = ?,
      event_start = ?,
      event_end = ?,
      reserved_start = ?,
      reserved_end = ?,
      attendees = ?,
      projectors_requested = ?,
      audio_systems_requested = ?,
      staff_requested = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    allocation.hallId,
    allocation.venueId,
    newRequest.event_name,
    newRequest.event_date,
    newRequest.event_start,
    newRequest.event_end,
    reservedStart,
    reservedEnd,
    newRequest.attendees,
    newRequest.projectors_requested || 0,
    newRequest.audio_systems_requested || 0,
    newRequest.staff_requested || 0,
    bookingId
  );

  const updatedBooking = db.prepare(`
    SELECT b.*, h.name as hall_name, v.name as venue_name, c.name as client_name
    FROM bookings b
    LEFT JOIN halls h ON b.hall_id = h.id
    JOIN venues v ON b.venue_id = v.id
    JOIN clients c ON b.client_id = c.id
    WHERE b.id = ?
  `).get(bookingId);

  return {
    success: true,
    booking: updatedBooking,
    message: `Booking rescheduled successfully to ${allocation.venueName} - ${allocation.hallName}`
  };
};

/**
 * Get alternative time slots and venues (Innovation feature)
 * @param {object} request
 * @returns {array} Array of alternative suggestions
 */
export const getAlternatives = (request) => {
  const alternatives = [];
  const { event_date, event_start, event_end } = request;

  // Try same day, different times (±1 hour, ±2 hours)
  const timeOffsets = [60, -60, 120, -120, 180, -180];

  for (const offset of timeOffsets) {
    const testRequest = { ...request };
    const [startHour, startMin] = event_start.split(':').map(Number);
    const [endHour, endMin] = event_end.split(':').map(Number);

    const newStartHour = startHour + Math.floor(offset / 60);
    const newEndHour = endHour + Math.floor(offset / 60);

    if (newStartHour >= 0 && newStartHour < 24 && newEndHour >= 0 && newEndHour < 24) {
      testRequest.event_start = `${String(newStartHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
      testRequest.event_end = `${String(newEndHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

      const allocation = findAvailableHall(testRequest);
      if (allocation) {
        const { reservedStart, reservedEnd } = calculateReservedInterval(
          testRequest.event_date,
          testRequest.event_start,
          testRequest.event_end
        );

        alternatives.push({
          type: 'time_change',
          event_date: testRequest.event_date,
          event_start: testRequest.event_start,
          event_end: testRequest.event_end,
          venue_id: allocation.venueId,
          venue_name: allocation.venueName,
          hall_name: allocation.hallName,
          reason: `Available at ${testRequest.event_start} - ${testRequest.event_end} (${offset > 0 ? '+' : ''}${offset / 60}h shift)`
        });

        if (alternatives.length >= 5) break;
      }
    }
  }

  return alternatives;
};
