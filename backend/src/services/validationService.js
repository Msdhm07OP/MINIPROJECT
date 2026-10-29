import {
  isValidTimeFormat,
  isValidDateFormat,
  isStartBeforeEnd,
  calculateReservedInterval,
  isWithinOperatingHours
} from '../utils/timeHelpers.js';
import { db } from '../config/database.js';

/**
 * Validate booking request
 * @param {object} request - Booking request object
 * @returns {object} { valid: boolean, errors: string[] }
 */
export const validateBookingRequest = (request) => {
  const errors = [];

  // Validate client_id
  if (!request.client_id || !Number.isInteger(request.client_id) || request.client_id <= 0) {
    errors.push('Valid client_id is required');
  } else {
    const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(request.client_id);
    if (!client) {
      errors.push('Client does not exist');
    }
  }

  // Validate event_name
  if (!request.event_name || request.event_name.trim().length === 0) {
    errors.push('Event name is required');
  }

  // Validate event_date
  if (!request.event_date || !isValidDateFormat(request.event_date)) {
    errors.push('Valid event date is required (YYYY-MM-DD format)');
  } else {
    const eventDate = new Date(request.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
      errors.push('Event date cannot be in the past');
    }
  }

  // Validate event_start
  if (!request.event_start || !isValidTimeFormat(request.event_start)) {
    errors.push('Valid event start time is required (HH:MM format)');
  }

  // Validate event_end
  if (!request.event_end || !isValidTimeFormat(request.event_end)) {
    errors.push('Valid event end time is required (HH:MM format)');
  }

  // Validate start before end
  if (request.event_date && request.event_start && request.event_end) {
    if (isValidDateFormat(request.event_date) &&
        isValidTimeFormat(request.event_start) &&
        isValidTimeFormat(request.event_end)) {
      if (!isStartBeforeEnd(request.event_date, request.event_start, request.event_end)) {
        errors.push('Event start time must be before end time');
      }
    }
  }

  // Validate operating hours with buffers
  if (request.event_date && request.event_start && request.event_end) {
    if (isValidDateFormat(request.event_date) &&
        isValidTimeFormat(request.event_start) &&
        isValidTimeFormat(request.event_end)) {
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
    }
  }

  // Validate attendees
  if (!request.attendees || !Number.isInteger(request.attendees) || request.attendees <= 0) {
    errors.push('Number of attendees must be a positive integer');
  }

  // Validate preferred_venue_id
  if (!request.preferred_venue_id || !Number.isInteger(request.preferred_venue_id)) {
    errors.push('Valid preferred venue is required');
  } else {
    const venue = db.prepare('SELECT id FROM venues WHERE id = ?').get(request.preferred_venue_id);
    if (!venue) {
      errors.push('Preferred venue does not exist');
    }
  }

  // Validate resource requests (must be non-negative)
  const projectors = request.projectors_requested || 0;
  const audioSystems = request.audio_systems_requested || 0;
  const staff = request.staff_requested || 0;

  if (!Number.isInteger(projectors) || projectors < 0) {
    errors.push('Projectors requested must be a non-negative integer');
  }

  if (!Number.isInteger(audioSystems) || audioSystems < 0) {
    errors.push('Audio systems requested must be a non-negative integer');
  }

  if (!Number.isInteger(staff) || staff < 0) {
    errors.push('Support staff requested must be a non-negative integer');
  }

  // Check if any venue can satisfy the resource request
  if (errors.length === 0) {
    const maxResources = db.prepare(`
      SELECT
        MAX(projectors) as max_projectors,
        MAX(audio_systems) as max_audio,
        MAX(support_staff) as max_staff
      FROM venue_resources
    `).get();

    if (projectors > maxResources.max_projectors) {
      errors.push(`Requested projectors (${projectors}) exceed maximum available at any venue (${maxResources.max_projectors})`);
    }

    if (audioSystems > maxResources.max_audio) {
      errors.push(`Requested audio systems (${audioSystems}) exceed maximum available at any venue (${maxResources.max_audio})`);
    }

    if (staff > maxResources.max_staff) {
      errors.push(`Requested support staff (${staff}) exceed maximum available at any venue (${maxResources.max_staff})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate client data
 * @param {object} client - Client object
 * @returns {object} { valid: boolean, errors: string[] }
 */
export const validateClient = (client) => {
  const errors = [];

  if (!client.name || client.name.trim().length === 0) {
    errors.push('Client name is required');
  }

  if (client.email && client.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(client.email)) {
      errors.push('Invalid email format');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
