import { z } from 'zod';

/**
 * Booking request validation schema
 */
export const bookingRequestSchema = z.object({
  client_id: z.number().int().positive('Client ID must be a positive integer'),
  event_name: z.string().min(1, 'Event name is required').max(255, 'Event name too long'),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  event_start: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format'),
  event_end: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format'),
  attendees: z.number().int().positive('Attendees must be a positive integer'),
  preferred_venue_id: z.number().int().positive('Preferred venue ID must be a positive integer'),
  projectors_requested: z.number().int().min(0, 'Projectors cannot be negative').default(0),
  audio_systems_requested: z.number().int().min(0, 'Audio systems cannot be negative').default(0),
  staff_requested: z.number().int().min(0, 'Staff cannot be negative').default(0)
}).refine(
  data => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(data.event_date);
    return eventDate >= today;
  },
  { message: 'Event date cannot be in the past', path: ['event_date'] }
).refine(
  data => data.event_start < data.event_end,
  { message: 'Event start time must be before end time', path: ['event_end'] }
);

/**
 * Reschedule request validation schema
 */
export const rescheduleRequestSchema = bookingRequestSchema.extend({
  booking_id: z.number().int().positive('Booking ID must be a positive integer')
});

/**
 * Client creation validation schema
 */
export const clientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(200, 'Name too long'),
  email: z.string().email('Invalid email format').optional().nullable(),
  phone: z.string().max(50, 'Phone number too long').optional().nullable(),
  organization: z.string().max(200, 'Organization name too long').optional().nullable()
});

/**
 * Query filters validation schema
 */
export const queryFiltersSchema = z.object({
  status: z.enum(['confirmed', 'cancelled', 'rejected']).optional(),
  venue_id: z.number().int().positive().optional(),
  client_id: z.number().int().positive().optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().positive().max(1000).default(100).optional(),
  offset: z.number().int().min(0).default(0).optional()
});

/**
 * Cancellation request schema
 */
export const cancellationSchema = z.object({
  reason: z.string().max(500).optional().nullable()
});
