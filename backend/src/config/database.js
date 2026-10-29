import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'eventsync.db');

// Initialize database
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
const initDatabase = () => {
  // Venues table
  db.exec(`
    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  // Halls table
  db.exec(`
    CREATE TABLE IF NOT EXISTS halls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      FOREIGN KEY (venue_id) REFERENCES venues(id),
      UNIQUE(venue_id, name)
    )
  `);

  // Venue resources table
  db.exec(`
    CREATE TABLE IF NOT EXISTS venue_resources (
      venue_id INTEGER PRIMARY KEY,
      projectors INTEGER NOT NULL,
      audio_systems INTEGER NOT NULL,
      support_staff INTEGER NOT NULL,
      FOREIGN KEY (venue_id) REFERENCES venues(id)
    )
  `);

  // Clients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      organization TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bookings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      hall_id INTEGER,
      venue_id INTEGER NOT NULL,
      event_name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_start TEXT NOT NULL,
      event_end TEXT NOT NULL,
      reserved_start TEXT NOT NULL,
      reserved_end TEXT NOT NULL,
      attendees INTEGER NOT NULL,
      projectors_requested INTEGER NOT NULL DEFAULT 0,
      audio_systems_requested INTEGER NOT NULL DEFAULT 0,
      staff_requested INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('confirmed', 'cancelled', 'rejected')),
      rejection_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (hall_id) REFERENCES halls(id),
      FOREIGN KEY (venue_id) REFERENCES venues(id)
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(event_date);
    CREATE INDEX IF NOT EXISTS idx_bookings_venue ON bookings(venue_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_hall ON bookings(hall_id);
  `);

  console.log('Database initialized successfully');
};

// Check if database needs initialization
const needsInit = !fs.existsSync(dbPath);
if (needsInit) {
  initDatabase();
}

export { db, initDatabase };
