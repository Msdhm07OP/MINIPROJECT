import bookingRepo from '../repositories/BookingRepository.js';
import { withRetry, transaction } from '../database/config.js';
import { calculateReservedInterval, isWithinOperatingHours } from '../utils/timeHelpers.js';
import { bookingRequestSchema } from './validation/schemas.js';
import logger from '../utils/logger/index.js';

/**
 * Core scheduling service with concurrency-safe booking allocation
 */
class SchedulingService {
  /**
   * Confirm a booking with full concurrency safety
   * @param {object} request - Booking request
   * @param {string} correlationId - Request correlation ID
   * @returns {Promise<object>} { success: boolean, booking: object, message: string }
   */
  async confirmBooking(request, correlationId = null) {
    // Validate request
    const validated = bookingRequestSchema.parse(request);

    // Additional validation
    const validationErrors = await this.validateBookingRequest(validated);
    if (validationErrors.length > 0) {
      return {
        success: false,
        booking: null,
        message: validationErrors.join('; '),
        errors: validationErrors
      };
    }

    // Execute booking with retry logic for serialization failures
    return await withRetry(async () => {
      return await transaction(async (client) => {
        // CRITICAL: Acquire advisory lock for this venue/date
        const locked = await bookingRepo.acquireAllocationLock(
          client,
          validated.preferred_venue_id,
          validated.event_date
        );

        if (!locked) {
          logger.warn('Failed to acquire allocation lock', {
            venueId: validated.preferred_venue_id,
            eventDate: validated.event_date,
            correlationId
          });
          throw new Error('Unable to acquire resource lock. Please retry.');
        }

        // Calculate reserved interval
        const { reservedStart, reservedEnd } = calculateReservedInterval(
          validated.event_date,
          validated.event_start,
          validated.event_end
        );

        // Find available hall using required algorithm
        const allocation = await this.findAvailableHall(client, {
          ...validated,
          reservedStart,
          reservedEnd
        });

        if (!allocation) {
          // No feasible allocation - create rejected booking
          const rejectionReason = await this.generateRejectionReason(client, validated);

          const booking = await bookingRepo.createBookingWithAllocations(
            client,
            {
              client_id: validated.client_id,
              hall_id: null,
              venue_id: validated.preferred_venue_id,
              event_name: validated.event_name,
              event_date: validated.event_date,
              event_start: validated.event_start,
              event_end: validated.event_end,
              reserved_start: reservedStart,
              reserved_end: reservedEnd,
              attendees: validated.attendees,
              status: 'rejected',
              rejection_reason: rejectionReason,
              rejection_code: 'NO_AVAILABILITY',
              correlation_id: correlationId
            },
            []
          );

          logger.info('Booking rejected', {
            bookingId: booking.id,
            reason: rejectionReason,
            correlationId
          });

          return {
            success: false,
            booking,
            message: rejectionReason
          };
        }

        // Create confirmed booking with resource allocations
        const resourceAllocations = await this.buildResourceAllocations(client, {
          projectors_requested: validated.projectors_requested,
          audio_systems_requested: validated.audio_systems_requested,
          staff_requested: validated.staff_requested
        });

        const booking = await bookingRepo.createBookingWithAllocations(
          client,
          {
            client_id: validated.client_id,
            hall_id: allocation.hallId,
            venue_id: allocation.venueId,
            event_name: validated.event_name,
            event_date: validated.event_date,
            event_start: validated.event_start,
            event_end: validated.event_end,
            reserved_start: reservedStart,
            reserved_end: reservedEnd,
            attendees: validated.attendees,
            status: 'confirmed',
            correlation_id: correlationId
          },
          resourceAllocations
        );

        logger.info('Booking confirmed', {
          bookingId: booking.id,
          venueId: allocation.venueId,
          hallId: allocation.hallId,
          correlationId
        });

        return {
          success: true,
          booking,
          message: `Event confirmed at ${allocation.venueName} - ${allocation.hallName}`,
          allocation
        };
      }, { isolationLevel: 'READ COMMITTED' });
    }, { maxRetries: 3 });
  }

  /**
   * Find available hall using required algorithm
   * @param {object} client - Database client
   * @param {object} request - Validated request with reserved times
   * @returns {Promise<object|null>} Allocation details or null
   */
  async findAvailableHall(client, request) {
    const {
      preferred_venue_id,
      event_date,
      reservedStart,
      reservedEnd,
      attendees,
      projectors_requested,
      audio_systems_requested,
      staff_requested,
      exclude_booking_id = null
    } = request;

    // Step 1: Try preferred venue first
    const preferredResult = await this.tryVenue(client, {
      venueId: preferred_venue_id,
      eventDate: event_date,
      reservedStart,
      reservedEnd,
      attendees,
      projectorsRequested: projectors_requested,
      audioSystemsRequested: audio_systems_requested,
      staffRequested: staff_requested,
      excludeBookingId: exclude_booking_id
    });

    if (preferredResult) {
      return preferredResult;
    }

    // Step 2: Try other venues in deterministic order (ascending ID)
    const otherVenuesResult = await client.query(
      'SELECT id FROM venues WHERE id != $1 ORDER BY id ASC',
      [preferred_venue_id]
    );

    for (const venue of otherVenuesResult.rows) {
      const result = await this.tryVenue(client, {
        venueId: venue.id,
        eventDate: event_date,
        reservedStart,
        reservedEnd,
        attendees,
        projectorsRequested: projectors_requested,
        audioSystemsRequested: audio_systems_requested,
        staffRequested: staff_requested,
        excludeBookingId: exclude_booking_id
      });

      if (result) {
        return result;
      }
    }

    return null; // No feasible allocation found
  }

  /**
   * Try to allocate at a specific venue
   * @param {object} client
   * @param {object} params
   * @returns {Promise<object|null>}
   */
  async tryVenue(client, params) {
    const {
      venueId,
      eventDate,
      reservedStart,
      reservedEnd,
      attendees,
      projectorsRequested,
      audioSystemsRequested,
      staffRequested,
      excludeBookingId
    } = params;

    // Get halls with sufficient capacity (smallest first)
    const halls = await bookingRepo.getHallsByCapacity(client, venueId, attendees);

    if (halls.length === 0) {
      return null; // No hall with sufficient capacity
    }

    // Check each hall (smallest first due to ORDER BY in query)
    for (const hall of halls) {
      // Check hall availability
      const hallAvailable = await bookingRepo.isHallAvailable(
        client,
        hall.id,
        eventDate,
        reservedStart,
        reservedEnd,
        excludeBookingId
      );

      if (!hallAvailable) {
        continue; // Hall has conflict, try next
      }

      // Check resource availability
      const resourcesAvailable = await this.checkResourceAvailability(client, {
        venueId,
        eventDate,
        reservedStart,
        reservedEnd,
        projectorsRequested,
        audioSystemsRequested,
        staffRequested,
        excludeBookingId
      });

      if (resourcesAvailable) {
        // Found feasible allocation
        const venueResult = await client.query(
          'SELECT name FROM venues WHERE id = $1',
          [venueId]
        );

        return {
          hallId: hall.id,
          hallName: hall.name,
          hallCapacity: hall.capacity,
          venueId,
          venueName: venueResult.rows[0].name
        };
      }
    }

    return null; // No feasible combination at this venue
  }

  /**
   * Check resource availability using sweep-line algorithm
   * @param {object} client
   * @param {object} params
   * @returns {Promise<boolean>}
   */
  async checkResourceAvailability(client, params) {
    const {
      venueId,
      eventDate,
      reservedStart,
      reservedEnd,
      projectorsRequested,
      audioSystemsRequested,
      staffRequested,
      excludeBookingId
    } = params;

    // Get venue resource capacity
    const capacity = await bookingRepo.getVenueResourceCapacity(client, venueId);

    // Get overlapping bookings
    const overlappingBookings = await bookingRepo.getOverlappingBookings(
      client,
      venueId,
      eventDate,
      reservedStart,
      reservedEnd,
      excludeBookingId
    );

    // Build sweep-line events
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
      const resources = booking.resources || [];

      const projectors = resources.find(r => r.resource_type === 'projector')?.quantity || 0;
      const audio = resources.find(r => r.resource_type === 'audio_system')?.quantity || 0;
      const staff = resources.find(r => r.resource_type === 'support_staff')?.quantity || 0;

      events.push({
        time: booking.reserved_start,
        type: 'start',
        projectors,
        audio,
        staff
      });
      events.push({
        time: booking.reserved_end,
        type: 'end',
        projectors,
        audio,
        staff
      });
    }

    // Sort events (end before start at same time)
    events.sort((a, b) => {
      if (a.time === b.time) {
        return a.type === 'end' ? -1 : 1;
      }
      return a.time.localeCompare(b.time);
    });

    // Sweep through events
    let currentProjectors = 0;
    let currentAudio = 0;
    let currentStaff = 0;

    for (const event of events) {
      if (event.type === 'start') {
        currentProjectors += event.projectors;
        currentAudio += event.audio;
        currentStaff += event.staff;

        // Check capacity
        const maxProjectors = capacity.projector?.capacity || 0;
        const maxAudio = capacity.audio_system?.capacity || 0;
        const maxStaff = capacity.support_staff?.capacity || 0;

        if (currentProjectors > maxProjectors ||
            currentAudio > maxAudio ||
            currentStaff > maxStaff) {
          return false; // Capacity exceeded
        }
      } else {
        currentProjectors -= event.projectors;
        currentAudio -= event.audio;
        currentStaff -= event.staff;
      }
    }

    return true; // Resources available
  }

  /**
   * Validate booking request
   * @param {object} request
   * @returns {Promise<Array<string>>} Validation errors
   */
  async validateBookingRequest(request) {
    const errors = [];

    // Check operating hours
    const { reservedStart, reservedEnd } = calculateReservedInterval(
      request.event_date,
      request.event_start,
      request.event_end
    );

    if (!isWithinOperatingHours(reservedStart, reservedEnd)) {
      errors.push(
        `Event with setup and cleanup (${reservedStart} - ${reservedEnd}) ` +
        `falls outside operating hours (08:00 - 22:00)`
      );
    }

    return errors;
  }

  /**
   * Generate detailed rejection reason
   * @param {object} client
   * @param {object} request
   * @returns {Promise<string>}
   */
  async generateRejectionReason(client, request) {
    const { reservedStart, reservedEnd } = calculateReservedInterval(
      request.event_date,
      request.event_start,
      request.event_end
    );

    const venuesResult = await client.query('SELECT id, name FROM venues ORDER BY id');
    const reasons = [];

    for (const venue of venuesResult.rows) {
      const halls = await bookingRepo.getHallsByCapacity(client, venue.id, request.attendees);

      if (halls.length === 0) {
        reasons.push(`${venue.name}: No hall with capacity for ${request.attendees} attendees`);
        continue;
      }

      let anyHallAvailable = false;
      for (const hall of halls) {
        const available = await bookingRepo.isHallAvailable(
          client,
          hall.id,
          request.event_date,
          reservedStart,
          reservedEnd,
          null
        );
        if (available) {
          anyHallAvailable = true;
          break;
        }
      }

      if (!anyHallAvailable) {
        reasons.push(`${venue.name}: All suitable halls booked during ${reservedStart}-${reservedEnd}`);
        continue;
      }

      const resourcesAvailable = await this.checkResourceAvailability(client, {
        venueId: venue.id,
        eventDate: request.event_date,
        reservedStart,
        reservedEnd,
        projectorsRequested: request.projectors_requested,
        audioSystemsRequested: request.audio_systems_requested,
        staffRequested: request.staff_requested,
        excludeBookingId: null
      });

      if (!resourcesAvailable) {
        reasons.push(`${venue.name}: Insufficient resources during requested time`);
      }
    }

    return reasons.length > 0
      ? `Cannot accommodate request. ${reasons.join('; ')}`
      : 'No suitable venue, hall, and resource combination available';
  }

  /**
   * Build resource allocations array
   * @param {object} client
   * @param {object} resources
   * @returns {Promise<Array>}
   */
  async buildResourceAllocations(client, resources) {
    const allocations = [];

    const typesResult = await client.query('SELECT id, name FROM resource_types');
    const typeMap = {};
    typesResult.rows.forEach(t => { typeMap[t.name] = t.id; });

    if (resources.projectors_requested > 0) {
      allocations.push({
        resource_type_id: typeMap['projector'],
        quantity: resources.projectors_requested
      });
    }

    if (resources.audio_systems_requested > 0) {
      allocations.push({
        resource_type_id: typeMap['audio_system'],
        quantity: resources.audio_systems_requested
      });
    }

    if (resources.staff_requested > 0) {
      allocations.push({
        resource_type_id: typeMap['support_staff'],
        quantity: resources.staff_requested
      });
    }

    return allocations;
  }

  /**
   * Cancel a booking
   * @param {number} bookingId
   * @param {string} reason
   * @param {string} correlationId
   * @returns {Promise<object>}
   */
  async cancelBooking(bookingId, reason = null, correlationId = null) {
    return await transaction(async (client) => {
      const booking = await bookingRepo.cancelBooking(client, bookingId, reason);

      logger.info('Booking cancelled', {
        bookingId,
        reason,
        correlationId
      });

      return {
        success: true,
        booking,
        message: 'Booking cancelled successfully. Resources have been released.'
      };
    });
  }

  /**
   * Reschedule a booking (atomic operation)
   * @param {number} bookingId
   * @param {object} newRequest
   * @param {string} correlationId
   * @returns {Promise<object>}
   */
  async rescheduleBooking(bookingId, newRequest, correlationId = null) {
    const validated = bookingRequestSchema.parse(newRequest);

    return await withRetry(async () => {
      return await transaction(async (client) => {
        // Get original booking
        const originalResult = await client.query(
          'SELECT * FROM bookings WHERE id = $1 AND status = $2',
          [bookingId, 'confirmed']
        );

        if (originalResult.rows.length === 0) {
          throw new Error('Booking not found or not in confirmed status');
        }

        const original = originalResult.rows[0];

        // Acquire lock
        const locked = await bookingRepo.acquireAllocationLock(
          client,
          validated.preferred_venue_id,
          validated.event_date
        );

        if (!locked) {
          throw new Error('Unable to acquire resource lock for rescheduling');
        }

        // Calculate new reserved interval
        const { reservedStart, reservedEnd } = calculateReservedInterval(
          validated.event_date,
          validated.event_start,
          validated.event_end
        );

        // Find available hall (excluding current booking)
        const allocation = await this.findAvailableHall(client, {
          ...validated,
          reservedStart,
          reservedEnd,
          exclude_booking_id: bookingId
        });

        if (!allocation) {
          const rejectionReason = await this.generateRejectionReason(client, validated);

          await bookingRepo.createAuditEvent(client, {
            event_type: 'booking_reschedule_failed',
            booking_id: bookingId,
            correlation_id: correlationId,
            event_data: { reason: rejectionReason }
          });

          return {
            success: false,
            booking: original,
            message: `Cannot reschedule: ${rejectionReason}`
          };
        }

        // Update booking
        const resourceAllocations = await this.buildResourceAllocations(client, {
          projectors_requested: validated.projectors_requested,
          audio_systems_requested: validated.audio_systems_requested,
          staff_requested: validated.staff_requested
        });

        const updatedBooking = await bookingRepo.updateBooking(
          client,
          bookingId,
          {
            hall_id: allocation.hallId,
            venue_id: allocation.venueId,
            event_name: validated.event_name,
            event_date: validated.event_date,
            event_start: validated.event_start,
            event_end: validated.event_end,
            reserved_start: reservedStart,
            reserved_end: reservedEnd,
            attendees: validated.attendees
          },
          resourceAllocations
        );

        await bookingRepo.createAuditEvent(client, {
          event_type: 'booking_reschedule_succeeded',
          booking_id: bookingId,
          correlation_id: correlationId,
          event_data: { newVenueId: allocation.venueId, newHallId: allocation.hallId }
        });

        logger.info('Booking rescheduled', {
          bookingId,
          newVenueId: allocation.venueId,
          newHallId: allocation.hallId,
          correlationId
        });

        return {
          success: true,
          booking: updatedBooking,
          message: `Booking rescheduled to ${allocation.venueName} - ${allocation.hallName}`
        };
      });
    }, { maxRetries: 3 });
  }

  /**
   * Get alternative time slots
   * @param {object} request
   * @returns {Promise<Array>}
   */
  async getAlternativeSlots(request) {
    const alternatives = [];
    const timeOffsets = [60, -60, 120, -120, 180, -180]; // ±1h, ±2h, ±3h in minutes

    for (const offset of timeOffsets) {
      const [startHour, startMin] = request.event_start.split(':').map(Number);
      const [endHour, endMin] = request.event_end.split(':').map(Number);

      const newStartHour = startHour + Math.floor(offset / 60);
      const newEndHour = endHour + Math.floor(offset / 60);

      if (newStartHour >= 0 && newStartHour < 24 && newEndHour >= 0 && newEndHour < 24) {
        const testRequest = {
          ...request,
          event_start: `${String(newStartHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
          event_end: `${String(newEndHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
        };

        try {
          const result = await this.confirmBooking(testRequest);

          if (result.success) {
            alternatives.push({
              event_date: testRequest.event_date,
              event_start: testRequest.event_start,
              event_end: testRequest.event_end,
              venue_id: result.allocation.venueId,
              venue_name: result.allocation.venueName,
              hall_name: result.allocation.hallName,
              reason: `Available at ${testRequest.event_start}-${testRequest.event_end} (${offset > 0 ? '+' : ''}${offset / 60}h shift)`
            });

            // Rollback the test booking
            await this.cancelBooking(result.booking.id, 'Test booking for alternatives');

            if (alternatives.length >= 5) break;
          }
        } catch (error) {
          // Ignore validation errors for alternative slots
          continue;
        }
      }
    }

    return alternatives;
  }
}

export default new SchedulingService();
