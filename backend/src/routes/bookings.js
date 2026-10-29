import express from 'express';
import { db } from '../config/database.js';
import {
  confirmBooking,
  cancelBooking,
  rescheduleBooking,
  getAlternatives
} from '../services/schedulingService.js';

const router = express.Router();

/**
 * GET /api/bookings - Get all bookings
 */
router.get('/', (req, res) => {
  try {
    const { status, date, venue_id } = req.query;

    let query = `
      SELECT b.*, h.name as hall_name, v.name as venue_name, c.name as client_name
      FROM bookings b
      LEFT JOIN halls h ON b.hall_id = h.id
      JOIN venues v ON b.venue_id = v.id
      JOIN clients c ON b.client_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    if (date) {
      query += ` AND b.event_date = ?`;
      params.push(date);
    }

    if (venue_id) {
      query += ` AND b.venue_id = ?`;
      params.push(parseInt(venue_id));
    }

    query += ` ORDER BY b.event_date DESC, b.event_start DESC`;

    const bookings = db.prepare(query).all(...params);

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/bookings/stats - Get booking statistics for dashboard
 */
router.get('/stats', (req, res) => {
  try {
    const stats = {
      total: 0,
      confirmed: 0,
      cancelled: 0,
      rejected: 0,
      upcoming: 0
    };

    // Total bookings
    const total = db.prepare(`SELECT COUNT(*) as count FROM bookings`).get();
    stats.total = total.count;

    // By status
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM bookings
      GROUP BY status
    `).all();

    byStatus.forEach(row => {
      stats[row.status] = row.count;
    });

    // Upcoming events (confirmed bookings from today onwards)
    const today = new Date().toISOString().split('T')[0];
    const upcoming = db.prepare(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE status = 'confirmed' AND event_date >= ?
    `).get(today);
    stats.upcoming = upcoming.count;

    // Venue utilization
    const venueUtilization = db.prepare(`
      SELECT v.name, COUNT(b.id) as booking_count
      FROM venues v
      LEFT JOIN bookings b ON v.id = b.venue_id AND b.status = 'confirmed'
      GROUP BY v.id, v.name
      ORDER BY v.id ASC
    `).all();

    stats.venueUtilization = venueUtilization;

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/bookings/:id - Get specific booking
 */
router.get('/:id', (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    const booking = db.prepare(`
      SELECT b.*, h.name as hall_name, v.name as venue_name, c.name as client_name
      FROM bookings b
      LEFT JOIN halls h ON b.hall_id = h.id
      JOIN venues v ON b.venue_id = v.id
      JOIN clients c ON b.client_id = c.id
      WHERE b.id = ?
    `).get(bookingId);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/**
 * POST /api/bookings - Create new booking
 */
router.post('/', (req, res) => {
  try {
    const result = confirmBooking(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        booking: result.booking
      });
    }

    res.status(201).json({
      success: true,
      message: result.message,
      booking: result.booking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

/**
 * POST /api/bookings/:id/cancel - Cancel a booking
 */
router.post('/:id/cancel', (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const result = cancelBooking(bookingId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Get updated booking
    const booking = db.prepare(`
      SELECT b.*, h.name as hall_name, v.name as venue_name, c.name as client_name
      FROM bookings b
      LEFT JOIN halls h ON b.hall_id = h.id
      JOIN venues v ON b.venue_id = v.id
      JOIN clients c ON b.client_id = c.id
      WHERE b.id = ?
    `).get(bookingId);

    res.json({
      success: true,
      message: result.message,
      booking
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * PUT /api/bookings/:id/reschedule - Reschedule a booking
 */
router.put('/:id/reschedule', (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const result = rescheduleBooking(bookingId, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error rescheduling booking:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

/**
 * POST /api/bookings/alternatives - Get alternative time slots and venues
 */
router.post('/alternatives', (req, res) => {
  try {
    const alternatives = getAlternatives(req.body);
    res.json(alternatives);
  } catch (error) {
    console.error('Error getting alternatives:', error);
    res.status(500).json({ error: 'Failed to get alternatives' });
  }
});

export default router;
