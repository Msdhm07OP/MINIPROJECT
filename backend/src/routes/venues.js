import express from 'express';
import { db } from '../config/database.js';

const router = express.Router();

/**
 * GET /api/venues - Get all venues with halls and resources
 */
router.get('/', (req, res) => {
  try {
    const venues = db.prepare(`
      SELECT v.id, v.name,
             vr.projectors, vr.audio_systems, vr.support_staff
      FROM venues v
      LEFT JOIN venue_resources vr ON v.id = vr.venue_id
      ORDER BY v.id ASC
    `).all();

    // Get halls for each venue
    venues.forEach(venue => {
      venue.halls = db.prepare(`
        SELECT id, name, capacity
        FROM halls
        WHERE venue_id = ?
        ORDER BY id ASC
      `).all(venue.id);
    });

    res.json(venues);
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

/**
 * GET /api/venues/:id - Get specific venue details
 */
router.get('/:id', (req, res) => {
  try {
    const venueId = parseInt(req.params.id);

    const venue = db.prepare(`
      SELECT v.id, v.name,
             vr.projectors, vr.audio_systems, vr.support_staff
      FROM venues v
      LEFT JOIN venue_resources vr ON v.id = vr.venue_id
      WHERE v.id = ?
    `).get(venueId);

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    venue.halls = db.prepare(`
      SELECT id, name, capacity
      FROM halls
      WHERE venue_id = ?
      ORDER BY capacity ASC
    `).all(venueId);

    res.json(venue);
  } catch (error) {
    console.error('Error fetching venue:', error);
    res.status(500).json({ error: 'Failed to fetch venue' });
  }
});

/**
 * GET /api/venues/:id/bookings - Get bookings for a specific venue
 */
router.get('/:id/bookings', (req, res) => {
  try {
    const venueId = parseInt(req.params.id);
    const { date } = req.query;

    let query = `
      SELECT b.*, h.name as hall_name, c.name as client_name
      FROM bookings b
      LEFT JOIN halls h ON b.hall_id = h.id
      JOIN clients c ON b.client_id = c.id
      WHERE b.venue_id = ?
    `;

    const params = [venueId];

    if (date) {
      query += ` AND b.event_date = ?`;
      params.push(date);
    }

    query += ` ORDER BY b.event_date ASC, b.event_start ASC`;

    const bookings = db.prepare(query).all(...params);

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching venue bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

export default router;
