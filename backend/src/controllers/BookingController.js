import schedulingService from '../services/SchedulingService.js';
import idempotencyService from '../services/IdempotencyService.js';
import bookingRepo from '../repositories/BookingRepository.js';
import { bookingRequestSchema, queryFiltersSchema, cancellationSchema } from '../services/validation/schemas.js';
import logger from '../utils/logger/index.js';

class BookingController {
  /**
   * Create a new booking
   */
  async createBooking(req, res, next) {
    try {
      const idempotencyKey = req.headers['idempotency-key'];

      // Check idempotency
      if (idempotencyKey) {
        const check = await idempotencyService.checkIdempotencyKey(idempotencyKey, req.body);

        if (check.isDuplicate) {
          logger.info('Returning cached idempotent response', {
            idempotencyKey,
            correlationId: req.correlationId
          });
          return res.status(200).json(check.cachedResponse);
        }
      }

      // Validate and create booking
      const result = await schedulingService.confirmBooking(req.body, req.correlationId);

      // Store idempotency result
      if (idempotencyKey && result.booking) {
        await idempotencyService.storeResult(
          idempotencyKey,
          req.body,
          result.booking.id,
          result
        );
      }

      const statusCode = result.success ? 201 : 400;
      res.status(statusCode).json(result);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      next(error);
    }
  }

  /**
   * Get all bookings with filters
   */
  async getBookings(req, res, next) {
    try {
      const filters = queryFiltersSchema.parse({
        status: req.query.status,
        venue_id: req.query.venue_id ? parseInt(req.query.venue_id) : undefined,
        client_id: req.query.client_id ? parseInt(req.query.client_id) : undefined,
        event_date: req.query.event_date,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset) : undefined
      });

      const bookings = await bookingRepo.getBookings(filters);

      res.json({
        success: true,
        count: bookings.length,
        bookings
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.errors
        });
      }
      next(error);
    }
  }

  /**
   * Get booking by ID
   */
  async getBookingById(req, res, next) {
    try {
      const bookingId = parseInt(req.params.id);

      if (isNaN(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID'
        });
      }

      const booking = await bookingRepo.getBookingById(bookingId);

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      res.json({
        success: true,
        booking
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(req, res, next) {
    try {
      const bookingId = parseInt(req.params.id);

      if (isNaN(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID'
        });
      }

      const { reason } = cancellationSchema.parse(req.body);

      const result = await schedulingService.cancelBooking(
        bookingId,
        reason,
        req.correlationId
      );

      res.json(result);
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('not in confirmed status')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Reschedule a booking
   */
  async rescheduleBooking(req, res, next) {
    try {
      const bookingId = parseInt(req.params.id);

      if (isNaN(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID'
        });
      }

      const result = await schedulingService.rescheduleBooking(
        bookingId,
        req.body,
        req.correlationId
      );

      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors
        });
      }
      if (error.message.includes('not found') || error.message.includes('not in confirmed status')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get alternative time slots
   */
  async getAlternatives(req, res, next) {
    try {
      bookingRequestSchema.parse(req.body);

      const alternatives = await schedulingService.getAlternativeSlots(req.body);

      res.json({
        success: true,
        count: alternatives.length,
        alternatives
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors
        });
      }
      next(error);
    }
  }

  /**
   * Get booking statistics
   */
  async getStats(req, res, next) {
    try {
      const { query } = await import('../database/config.js');

      const totalResult = await query('SELECT COUNT(*) as count FROM bookings');
      const confirmedResult = await query('SELECT COUNT(*) as count FROM bookings WHERE status = $1', ['confirmed']);
      const cancelledResult = await query('SELECT COUNT(*) as count FROM bookings WHERE status = $1', ['cancelled']);
      const rejectedResult = await query('SELECT COUNT(*) as count FROM bookings WHERE status = $1', ['rejected']);

      const today = new Date().toISOString().split('T')[0];
      const upcomingResult = await query(
        'SELECT COUNT(*) as count FROM bookings WHERE status = $1 AND event_date >= $2',
        ['confirmed', today]
      );

      const venueUtilizationResult = await query(`
        SELECT v.name, COUNT(b.id) as booking_count
        FROM venues v
        LEFT JOIN bookings b ON v.id = b.venue_id AND b.status = 'confirmed'
        GROUP BY v.id, v.name
        ORDER BY v.id
      `);

      res.json({
        success: true,
        stats: {
          total: parseInt(totalResult.rows[0].count),
          confirmed: parseInt(confirmedResult.rows[0].count),
          cancelled: parseInt(cancelledResult.rows[0].count),
          rejected: parseInt(rejectedResult.rows[0].count),
          upcoming: parseInt(upcomingResult.rows[0].count),
          venueUtilization: venueUtilizationResult.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new BookingController();
