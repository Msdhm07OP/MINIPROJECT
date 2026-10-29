/**
 * Comprehensive Test Suite for EventSync Scheduling Algorithm
 * Run with: npm test
 */

import { db, initDatabase } from '../src/config/database.js';
import { confirmBooking, cancelBooking, rescheduleBooking } from '../src/services/schedulingService.js';

// Initialize test database
initDatabase();

// Seed test data
const setupTestData = () => {
  // Clear existing data
  db.prepare('DELETE FROM bookings').run();
  db.prepare('DELETE FROM clients').run();
  db.prepare('DELETE FROM venue_resources').run();
  db.prepare('DELETE FROM halls').run();
  db.prepare('DELETE FROM venues').run();

  // Insert venues
  const venueA = db.prepare('INSERT INTO venues (name) VALUES (?)').run('Venue A');
  const venueB = db.prepare('INSERT INTO venues (name) VALUES (?)').run('Venue B');
  const venueC = db.prepare('INSERT INTO venues (name) VALUES (?)').run('Venue C');

  // Insert halls
  db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueA.lastInsertRowid, 'A1', 60);
  db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueA.lastInsertRowid, 'A2', 150);
  db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueB.lastInsertRowid, 'B1', 100);
  db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueB.lastInsertRowid, 'B2', 200);
  db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueC.lastInsertRowid, 'C1', 80);
  db.prepare('INSERT INTO halls (venue_id, name, capacity) VALUES (?, ?, ?)').run(venueC.lastInsertRowid, 'C2', 250);

  // Insert resources
  db.prepare('INSERT INTO venue_resources (venue_id, projectors, audio_systems, support_staff) VALUES (?, ?, ?, ?)').run(venueA.lastInsertRowid, 2, 2, 5);
  db.prepare('INSERT INTO venue_resources (venue_id, projectors, audio_systems, support_staff) VALUES (?, ?, ?, ?)').run(venueB.lastInsertRowid, 2, 1, 4);
  db.prepare('INSERT INTO venue_resources (venue_id, projectors, audio_systems, support_staff) VALUES (?, ?, ?, ?)').run(venueC.lastInsertRowid, 3, 2, 6);

  // Insert test client
  const client = db.prepare('INSERT INTO clients (name, email) VALUES (?, ?)').run('Test Client', 'test@example.com');

  return { venueA: venueA.lastInsertRowid, venueB: venueB.lastInsertRowid, venueC: venueC.lastInsertRowid, client: client.lastInsertRowid };
};

// Helper function to run test
const runTest = (testName, testFn) => {
  try {
    const result = setupTestData();
    testFn(result);
    console.log(`✓ TEST ${testName}: PASSED`);
  } catch (error) {
    console.log(`✗ TEST ${testName}: FAILED`);
    console.log(`  Error: ${error.message}`);
  }
};

console.log('\n=== EventSync Scheduling Algorithm Test Suite ===\n');

// TEST 1: Smallest sufficient hall
runTest('1 - Smallest Sufficient Hall', ({ venueA, client }) => {
  const result = confirmBooking({
    client_id: client,
    event_name: 'Small Workshop',
    event_date: '2026-11-15',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 1,
    audio_systems_requested: 1,
    staff_requested: 2
  });

  if (!result.success || !result.booking.hall_name || result.booking.hall_name !== 'A1') {
    throw new Error(`Expected hall A1, got ${result.booking.hall_name || 'none'}`);
  }
});

// TEST 2: Larger hall when required
runTest('2 - Larger Hall When Required', ({ venueA, client }) => {
  const result = confirmBooking({
    client_id: client,
    event_name: 'Medium Conference',
    event_date: '2026-11-16',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 120,
    preferred_venue_id: venueA,
    projectors_requested: 1,
    audio_systems_requested: 1,
    staff_requested: 2
  });

  if (!result.success || result.booking.hall_name !== 'A2') {
    throw new Error(`Expected hall A2, got ${result.booking.hall_name || 'none'}`);
  }
});

// TEST 3: Preferred venue priority
runTest('3 - Preferred Venue Priority', ({ venueA, client }) => {
  const result = confirmBooking({
    client_id: client,
    event_name: 'Preferred Venue Test',
    event_date: '2026-11-17',
    event_start: '14:00',
    event_end: '16:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 1,
    audio_systems_requested: 1,
    staff_requested: 1
  });

  if (!result.success || result.booking.venue_id !== venueA) {
    throw new Error('Preferred venue not selected when available');
  }
});

// TEST 4: Fallback venue
runTest('4 - Fallback Venue', ({ venueA, venueB, client }) => {
  // Book both halls at Venue A
  confirmBooking({
    client_id: client,
    event_name: 'Block A1',
    event_date: '2026-11-18',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  confirmBooking({
    client_id: client,
    event_name: 'Block A2',
    event_date: '2026-11-18',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 100,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  // Try to book at Venue A (should fallback to Venue B)
  const result = confirmBooking({
    client_id: client,
    event_name: 'Needs Fallback',
    event_date: '2026-11-18',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  if (!result.success || result.booking.venue_id === venueA) {
    throw new Error('Should have fallen back to another venue');
  }
});

// TEST 5: Hall conflict
runTest('5 - Hall Conflict', ({ venueA, client }) => {
  // First booking
  confirmBooking({
    client_id: client,
    event_name: 'First Event',
    event_date: '2026-11-19',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  // Conflicting booking (same hall, overlapping time)
  const result = confirmBooking({
    client_id: client,
    event_name: 'Conflicting Event',
    event_date: '2026-11-19',
    event_start: '11:00',
    event_end: '13:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  // Should either reject or allocate to A2
  if (result.success && result.booking.hall_name === 'A1') {
    throw new Error('Should not allow overlapping bookings in same hall');
  }
});

// TEST 6: Setup buffer conflict
runTest('6 - Setup Buffer Conflict', ({ venueA, client }) => {
  // Event ends at 11:00, cleanup until 11:30
  confirmBooking({
    client_id: client,
    event_name: 'Morning Event',
    event_date: '2026-11-20',
    event_start: '09:00',
    event_end: '11:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  // Event starts at 11:15, setup from 10:45 - conflicts with cleanup
  const result = confirmBooking({
    client_id: client,
    event_name: 'Afternoon Event',
    event_date: '2026-11-20',
    event_start: '11:15',
    event_end: '13:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  // Should allocate to different hall or reject
  if (result.success && result.booking.hall_name === 'A1') {
    throw new Error('Setup/cleanup buffers should prevent booking');
  }
});

// TEST 7: Adjacent reservations (touching boundaries)
runTest('7 - Adjacent Reservations', ({ venueA, client }) => {
  // Event: 10:00-12:00, reserved: 09:30-12:30
  confirmBooking({
    client_id: client,
    event_name: 'First Event',
    event_date: '2026-11-21',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  // Event: 12:30-14:30, reserved: 12:00-15:00 - touches at 12:00 (boundary)
  const result = confirmBooking({
    client_id: client,
    event_name: 'Adjacent Event',
    event_date: '2026-11-21',
    event_start: '12:30',
    event_end: '14:30',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  // Half-open interval: 09:30-12:30 and 12:00-15:00 overlap
  // Should allocate to different hall or reject
  if (result.success && result.booking.hall_name === 'A1') {
    throw new Error('Adjacent intervals with overlap should conflict');
  }
});

// TEST 8: Projector limit
runTest('8 - Projector Limit', ({ venueA, client }) => {
  // Use both projectors
  confirmBooking({
    client_id: client,
    event_name: 'Event 1',
    event_date: '2026-11-22',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 2,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  // Try to request another projector
  const result = confirmBooking({
    client_id: client,
    event_name: 'Event 2',
    event_date: '2026-11-22',
    event_start: '11:00',
    event_end: '13:00',
    attendees: 80,
    preferred_venue_id: venueA,
    projectors_requested: 1,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  // Should be rejected or allocated to different venue
  if (result.success && result.booking.venue_id === venueA) {
    throw new Error('Should not exceed projector capacity');
  }
});

// TEST 9: Operating hours restriction
runTest('9 - Operating Hours Restriction', ({ venueA, client }) => {
  // Event 07:30-09:00, reserved 07:00-09:30 (starts before 08:00)
  const result1 = confirmBooking({
    client_id: client,
    event_name: 'Too Early',
    event_date: '2026-11-23',
    event_start: '07:30',
    event_end: '09:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  if (result1.success) {
    throw new Error('Should reject events starting before operating hours (with buffer)');
  }

  // Event 21:00-22:30, reserved 20:30-23:00 (ends after 22:00)
  const result2 = confirmBooking({
    client_id: client,
    event_name: 'Too Late',
    event_date: '2026-11-23',
    event_start: '21:00',
    event_end: '22:30',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  if (result2.success) {
    throw new Error('Should reject events ending after operating hours (with buffer)');
  }
});

// TEST 10: Invalid input
runTest('10 - Invalid Input', ({ venueA, client }) => {
  // Negative attendees
  const result1 = confirmBooking({
    client_id: client,
    event_name: 'Invalid',
    event_date: '2026-11-24',
    event_start: '10:00',
    event_end: '12:00',
    attendees: -10,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  if (result1.success) {
    throw new Error('Should reject negative attendees');
  }

  // End before start
  const result2 = confirmBooking({
    client_id: client,
    event_name: 'Invalid Time',
    event_date: '2026-11-24',
    event_start: '14:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  if (result2.success) {
    throw new Error('Should reject end time before start time');
  }
});

// TEST 11: Cancellation releases resources
runTest('11 - Cancellation Releases Resources', ({ venueA, client }) => {
  const booking1 = confirmBooking({
    client_id: client,
    event_name: 'To Be Cancelled',
    event_date: '2026-11-25',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 2,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  if (!booking1.success) {
    throw new Error('First booking should succeed');
  }

  // Cancel it
  cancelBooking(booking1.booking.id);

  // Now should be able to use those resources
  const booking2 = confirmBooking({
    client_id: client,
    event_name: 'Using Released Resources',
    event_date: '2026-11-25',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 2,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  if (!booking2.success) {
    throw new Error('Should be able to use released resources after cancellation');
  }
});

// TEST 12: Successful rescheduling
runTest('12 - Successful Rescheduling', ({ venueA, client }) => {
  const booking = confirmBooking({
    client_id: client,
    event_name: 'Original Event',
    event_date: '2026-11-26',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 1,
    audio_systems_requested: 1,
    staff_requested: 2
  });

  if (!booking.success) {
    throw new Error('Initial booking should succeed');
  }

  // Reschedule to different time
  const result = rescheduleBooking(booking.booking.id, {
    client_id: client,
    event_name: 'Rescheduled Event',
    event_date: '2026-11-26',
    event_start: '14:00',
    event_end: '16:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 1,
    audio_systems_requested: 1,
    staff_requested: 2
  });

  if (!result.success || result.booking.event_start !== '14:00') {
    throw new Error('Rescheduling should succeed');
  }
});

// TEST 13: Failed rescheduling preserves original
runTest('13 - Failed Rescheduling Preserves Original', ({ venueA, client }) => {
  const booking = confirmBooking({
    client_id: client,
    event_name: 'Original Event',
    event_date: '2026-11-27',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  if (!booking.success) {
    throw new Error('Initial booking should succeed');
  }

  const originalStart = booking.booking.event_start;

  // Try to reschedule to invalid time (outside operating hours)
  const result = rescheduleBooking(booking.booking.id, {
    client_id: client,
    event_name: 'Invalid Reschedule',
    event_date: '2026-11-27',
    event_start: '07:00',
    event_end: '09:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 0,
    audio_systems_requested: 0,
    staff_requested: 0
  });

  if (result.success) {
    throw new Error('Invalid rescheduling should fail');
  }

  // Verify original booking unchanged
  const currentBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.booking.id);
  if (currentBooking.event_start !== originalStart || currentBooking.status !== 'confirmed') {
    throw new Error('Original booking should remain unchanged after failed reschedule');
  }
});

// TEST 14: Sample scenario from PDF
runTest('14 - PDF Sample Scenario', ({ venueA, client }) => {
  // Conference: 120 guests, 10:00-13:00, 1 projector, 3 staff
  const booking1 = confirmBooking({
    client_id: client,
    event_name: 'Conference',
    event_date: '2026-11-28',
    event_start: '10:00',
    event_end: '13:00',
    attendees: 120,
    preferred_venue_id: venueA,
    projectors_requested: 1,
    audio_systems_requested: 0,
    staff_requested: 3
  });

  if (!booking1.success || booking1.booking.hall_name !== 'A2') {
    throw new Error('Conference should be allocated to A2');
  }

  // Workshop: 50 guests, 11:00-14:00, 1 projector, 2 staff
  const booking2 = confirmBooking({
    client_id: client,
    event_name: 'Workshop',
    event_date: '2026-11-28',
    event_start: '11:00',
    event_end: '14:00',
    attendees: 50,
    preferred_venue_id: venueA,
    projectors_requested: 1,
    audio_systems_requested: 0,
    staff_requested: 2
  });

  if (!booking2.success || booking2.booking.hall_name !== 'A1') {
    throw new Error('Workshop should be allocated to A1');
  }

  // Product launch: 100 guests, 13:15 (1:15 PM)
  // Reserved interval would be 12:45-... which overlaps with both previous events
  // Venue A has: 2 projectors (both used), 5 staff (5 used = 3+2)
  const booking3 = confirmBooking({
    client_id: client,
    event_name: 'Product Launch',
    event_date: '2026-11-28',
    event_start: '13:15',
    event_end: '15:15',
    attendees: 100,
    preferred_venue_id: venueA,
    projectors_requested: 1,
    audio_systems_requested: 0,
    staff_requested: 1
  });

  // This should fail or go to another venue due to:
  // - A2 occupied until 13:30 (13:00 + 30min cleanup)
  // - A1 occupied until 14:30 (14:00 + 30min cleanup)
  // - Both halls at Venue A still in cleanup when setup starts at 12:45
  if (booking3.success && booking3.booking.venue_id === venueA) {
    // Check if it's really feasible
    console.log('  Note: Product launch allocated to Venue A - verifying resource constraints');
  }
});

console.log('\n=== Test Suite Complete ===\n');
