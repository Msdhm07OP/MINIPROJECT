import express from 'express';
import { db } from '../config/database.js';
import { validateClient } from '../services/validationService.js';

const router = express.Router();

/**
 * GET /api/clients - Get all clients
 */
router.get('/', (req, res) => {
  try {
    const clients = db.prepare(`
      SELECT * FROM clients ORDER BY name ASC
    `).all();

    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

/**
 * GET /api/clients/:id - Get specific client
 */
router.get('/:id', (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    const client = db.prepare(`
      SELECT * FROM clients WHERE id = ?
    `).get(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

/**
 * POST /api/clients - Create new client
 */
router.post('/', (req, res) => {
  try {
    const validation = validateClient(req.body);

    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const { name, email, phone, organization } = req.body;

    const stmt = db.prepare(`
      INSERT INTO clients (name, email, phone, organization)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      email?.trim() || null,
      phone?.trim() || null,
      organization?.trim() || null
    );

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

/**
 * GET /api/clients/:id/bookings - Get bookings for a specific client
 */
router.get('/:id/bookings', (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    const bookings = db.prepare(`
      SELECT b.*, h.name as hall_name, v.name as venue_name
      FROM bookings b
      LEFT JOIN halls h ON b.hall_id = h.id
      JOIN venues v ON b.venue_id = v.id
      WHERE b.client_id = ?
      ORDER BY b.event_date DESC, b.event_start DESC
    `).all(clientId);

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching client bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

export default router;
