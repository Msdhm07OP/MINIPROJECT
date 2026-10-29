import { db, initDatabase } from './src/config/database.js';

console.log('Seeding database with initial data...\n');

// Initialize database schema
initDatabase();

// Clear existing data (for clean seed)
db.prepare('DELETE FROM bookings').run();
db.prepare('DELETE FROM clients').run();
db.prepare('DELETE FROM venue_resources').run();
db.prepare('DELETE FROM halls').run();
db.prepare('DELETE FROM venues').run();

// Insert venues as per official problem statement
console.log('Creating venues...');
const venueA = db.prepare('INSERT INTO venues (name) VALUES (?)').run('Venue A');
const venueB = db.prepare('INSERT INTO venues (name) VALUES (?)').run('Venue B');
const venueC = db.prepare('INSERT INTO venues (name) VALUES (?)').run('Venue C');

console.log('✓ Venues created');

// Insert halls with official capacities
console.log('Creating halls...');
// Venue A halls
db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueA.lastInsertRowid, 'A1', 60);
db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueA.lastInsertRowid, 'A2', 150);

// Venue B halls
db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueB.lastInsertRowid, 'B1', 100);
db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueB.lastInsertRowid, 'B2', 200);

// Venue C halls
db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueC.lastInsertRowid, 'C1', 80);
db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueC.lastInsertRowid, 'C2', 250);

console.log('✓ Halls created');

// Insert venue resources as per official problem statement
console.log('Creating venue resources...');
// Venue A: 2 projectors, 2 audio systems, 5 staff
db.prepare('INSERT INTO venue_resources (venue_id, projectors, audio_systems, support_staff) VALUES (?, ?, ?, ?)').run(venueA.lastInsertRowid, 2, 2, 5);

// Venue B: 2 projectors, 1 audio system, 4 staff
db.prepare('INSERT INTO venue_resources (venue_id, projectors, audio_systems, support_staff) VALUES (?, ?, ?, ?)').run(venueB.lastInsertRowid, 2, 1, 4);

// Venue C: 3 projectors, 2 audio systems, 6 staff
db.prepare('INSERT INTO venue_resources (venue_id, projectors, audio_systems, support_staff) VALUES (?, ?, ?, ?)').run(venueC.lastInsertRowid, 3, 2, 6);

console.log('✓ Venue resources created');

// Insert sample clients
console.log('Creating sample clients...');
db.prepare('INSERT INTO clients (name, email, phone, organization) VALUES (?, ?, ?, ?)').run(
  'TechCorp Solutions',
  'contact@techcorp.com',
  '+1-555-0101',
  'Technology Company'
);

db.prepare('INSERT INTO clients (name, email, phone, organization) VALUES (?, ?, ?, ?)').run(
  'Marketing Masters',
  'events@marketingmasters.com',
  '+1-555-0102',
  'Marketing Agency'
);

db.prepare('INSERT INTO clients (name, email, phone, organization) VALUES (?, ?, ?, ?)').run(
  'Innovation Labs',
  'hello@innovationlabs.io',
  '+1-555-0103',
  'Research Institute'
);

db.prepare('INSERT INTO clients (name, email, phone, organization) VALUES (?, ?, ?, ?)').run(
  'Global Ventures',
  'info@globalventures.com',
  '+1-555-0104',
  'Investment Firm'
);

db.prepare('INSERT INTO clients (name, email, phone, organization) VALUES (?, ?, ?, ?)').run(
  'Creative Studio',
  'bookings@creativestudio.net',
  '+1-555-0105',
  'Design Agency'
);

console.log('✓ Sample clients created');

// Verify data
console.log('\n=== Database Summary ===');
const venueCount = db.prepare('SELECT COUNT(*) as count FROM venues').get();
console.log(`Venues: ${venueCount.count}`);

const hallCount = db.prepare('SELECT COUNT(*) as count FROM halls').get();
console.log(`Halls: ${hallCount.count}`);

const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get();
console.log(`Clients: ${clientCount.count}`);

console.log('\n=== Venue Configuration ===');
const venues = db.prepare(`
  SELECT v.name,
         GROUP_CONCAT(h.name || ' (' || h.capacity || ')', ', ') as halls,
         vr.projectors, vr.audio_systems, vr.support_staff
  FROM venues v
  LEFT JOIN halls h ON v.id = h.venue_id
  LEFT JOIN venue_resources vr ON v.id = vr.venue_id
  GROUP BY v.id
  ORDER BY v.id
`).all();

venues.forEach(venue => {
  console.log(`\n${venue.name}:`);
  console.log(`  Halls: ${venue.halls}`);
  console.log(`  Resources: ${venue.projectors} projectors, ${venue.audio_systems} audio systems, ${venue.support_staff} staff`);
});

console.log('\n✓ Database seeded successfully!\n');
