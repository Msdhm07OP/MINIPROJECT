/**
 * CRITICAL CONCURRENCY TEST
 * Tests 100 simultaneous booking requests for the same hall and time
 * MUST result in only 1 confirmed booking and 0 double bookings
 */

import schedulingService from '../../src/services/SchedulingService.js';
import { query, transaction } from '../../src/database/config.js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

async function setupTestData() {
  console.log(`${BLUE}Setting up test data...${RESET}`);

  // Ensure we have a test client
  const clientResult = await query(
    `INSERT INTO clients (name, email) VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    ['Concurrent Test Client', 'concurrent@test.com']
  );

  let clientId;
  if (clientResult.rows.length > 0) {
    clientId = clientResult.rows[0].id;
  } else {
    const existing = await query(
      'SELECT id FROM clients WHERE email = $1',
      ['concurrent@test.com']
    );
    clientId = existing.rows[0].id;
  }

  console.log(`✓ Test client ID: ${clientId}\n`);
  return clientId;
}

async function cleanupTestBookings() {
  await query(`
    DELETE FROM booking_resource_allocations
    WHERE booking_id IN (
      SELECT id FROM bookings
      WHERE client_id = (SELECT id FROM clients WHERE email = 'concurrent@test.com')
    )
  `);

  await query(`
    DELETE FROM bookings
    WHERE client_id = (SELECT id FROM clients WHERE email = 'concurrent@test.com')
  `);
}

async function testConcurrentSameHallBookings() {
  console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}TEST 1: 100 Concurrent Requests for SAME Hall/Time${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}\n`);

  const clientId = await setupTestData();
  await cleanupTestBookings();

  // Same booking request 100 times - all competing for Hall A1
  const baseRequest = {
    client_id: clientId,
    event_name: 'Concurrent Test Event',
    event_date: '2026-12-15',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50, // Fits in A1 (60 capacity) - smallest hall
    preferred_venue_id: 1, // Venue A
    projectors_requested: 1,
    audio_systems_requested: 1,
    staff_requested: 2
  };

  console.log(`${YELLOW}Request Details:${RESET}`);
  console.log(`  Event: ${baseRequest.event_name}`);
  console.log(`  Date: ${baseRequest.event_date}`);
  console.log(`  Time: ${baseRequest.event_start} - ${baseRequest.event_end}`);
  console.log(`  Attendees: ${baseRequest.attendees}`);
  console.log(`  Preferred: Venue A (will select Hall A1)`);
  console.log(`  Resources: ${baseRequest.projectors_requested} projector, ${baseRequest.audio_systems_requested} audio, ${baseRequest.staff_requested} staff\n`);

  console.log(`${YELLOW}Sending 100 simultaneous requests...${RESET}\n`);

  const startTime = Date.now();

  // Create 100 identical requests
  const requests = Array(100).fill(null).map(() => ({ ...baseRequest }));

  // Send all requests simultaneously
  const results = await Promise.allSettled(
    requests.map(req => schedulingService.confirmBooking(req, `concurrent-test-${Math.random()}`))
  );

  const duration = Date.now() - startTime;

  // Analyze results
  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  const confirmed = fulfilled.filter(r => r.value?.success === true);
  const notAvailable = fulfilled.filter(r => r.value?.success === false);
  const errors = rejected.length;

  console.log(`${BLUE}Results:${RESET}`);
  console.log(`  Total requests: 100`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`  ${GREEN}Confirmed bookings: ${confirmed.length}${RESET}`);
  console.log(`  ${YELLOW}Rejected (no availability): ${notAvailable.length}${RESET}`);
  console.log(`  ${RED}Errors: ${errors}${RESET}\n`);

  // CRITICAL: Verify database state
  console.log(`${YELLOW}Verifying database state...${RESET}`);

  const dbBookings = await query(`
    SELECT id, status, hall_id, event_date, event_start, event_end
    FROM bookings
    WHERE client_id = $1
      AND event_date = $2
      AND event_start = $3
      AND event_end = $4
      AND status = 'confirmed'
  `, [clientId, baseRequest.event_date, baseRequest.event_start, baseRequest.event_end]);

  const confirmedInDb = dbBookings.rows.length;

  console.log(`  Confirmed bookings in database: ${confirmedInDb}\n`);

  // ASSERTIONS
  let passed = true;
  const failures = [];

  if (confirmedInDb > 1) {
    failures.push(`DOUBLE BOOKING DETECTED! ${confirmedInDb} bookings confirmed in database`);
    passed = false;
  }

  if (confirmedInDb === 0 && confirmed.length > 0) {
    failures.push(`Mismatch: ${confirmed.length} confirmed in response but ${confirmedInDb} in database`);
    passed = false;
  }

  if (confirmed.length > 1) {
    failures.push(`Multiple confirmations returned: ${confirmed.length}`);
    passed = false;
  }

  if (confirmedInDb === 0 && confirmed.length === 0) {
    failures.push('System too restrictive - no bookings confirmed');
    passed = false;
  }

  // Check for unique hall allocation
  const hallIds = [...new Set(dbBookings.rows.map(b => b.hall_id))];
  if (hallIds.length > 1) {
    failures.push(`Multiple halls allocated: ${hallIds.join(', ')}`);
    passed = false;
  }

  console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}`);
  if (passed) {
    console.log(`${GREEN}✓ TEST 1 PASSED - No double bookings detected${RESET}`);
    console.log(`${GREEN}✓ Database-level concurrency safety verified${RESET}`);
  } else {
    console.log(`${RED}✗ TEST 1 FAILED${RESET}`);
    failures.forEach(f => console.log(`${RED}  - ${f}${RESET}`));
  }
  console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}\n`);

  return passed;
}

async function testConcurrentResourceContention() {
  console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BLUE}TEST 2: 100 Concurrent Requests for Shared Resources${RESET}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}\n`);

  const clientId = await setupTestData();
  await cleanupTestBookings();

  // Create requests that compete for shared resources (not same hall)
  // Venue A has: 2 projectors, 2 audio, 5 staff
  const requests = [];

  for (let i = 0; i < 100; i++) {
    requests.push({
      client_id: clientId,
      event_name: `Resource Test ${i}`,
      event_date: '2026-12-16',
      event_start: '14:00',
      event_end: '16:00',
      attendees: i % 2 === 0 ? 50 : 120, // Mix of A1 and A2 eligible
      preferred_venue_id: 1,
      projectors_requested: 1, // Each needs 1 projector (max 2 available)
      audio_systems_requested: 1, // Each needs 1 audio (max 2 available)
      staff_requested: 2 // Each needs 2 staff (max 5 available)
    });
  }

  console.log(`${YELLOW}Sending 100 requests with varying attendee counts...${RESET}`);
  console.log(`  All request 1 projector, 1 audio, 2 staff`);
  console.log(`  Venue A capacity: 2 projectors, 2 audio, 5 staff`);
  console.log(`  Expected: Max 2 confirmed (limited by projectors/audio)\n`);

  const startTime = Date.now();

  const results = await Promise.allSettled(
    requests.map(req => schedulingService.confirmBooking(req, `resource-test-${Math.random()}`))
  );

  const duration = Date.now() - startTime;

  const confirmed = results.filter(r =>
    r.status === 'fulfilled' && r.value?.success === true
  ).length;

  const rejected = results.filter(r =>
    r.status === 'fulfilled' && r.value?.success === false
  ).length;

  console.log(`${BLUE}Results:${RESET}`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`  ${GREEN}Confirmed: ${confirmed}${RESET}`);
  console.log(`  ${YELLOW}Rejected: ${rejected}${RESET}\n`);

  // Verify resource allocation doesn't exceed capacity
  const resourceCheck = await query(`
    SELECT
      SUM(bra.quantity_allocated) as total_allocated,
      rt.name as resource_type,
      vrc.capacity
    FROM booking_resource_allocations bra
    JOIN resource_types rt ON bra.resource_type_id = rt.id
    JOIN bookings b ON bra.booking_id = b.id
    JOIN venue_resource_capacity vrc ON b.venue_id = vrc.venue_id AND vrc.resource_type_id = rt.id
    WHERE b.client_id = $1
      AND b.event_date = '2026-12-16'
      AND b.status = 'confirmed'
      AND b.venue_id = 1
    GROUP BY rt.name, vrc.capacity
  `, [clientId]);

  console.log(`${YELLOW}Resource Allocation Verification:${RESET}`);
  let resourcesPassed = true;

  for (const row of resourceCheck.rows) {
    const exceeded = row.total_allocated > row.capacity;
    const status = exceeded ? RED : GREEN;
    console.log(`  ${row.resource_type}: ${row.total_allocated} / ${row.capacity} ${exceeded ? '❌ EXCEEDED' : '✓'} ${status}${RESET}`);

    if (exceeded) {
      resourcesPassed = false;
    }
  }

  console.log(`\n${BLUE}═══════════════════════════════════════════════════${RESET}`);
  if (resourcesPassed && confirmed <= 2) {
    console.log(`${GREEN}✓ TEST 2 PASSED - Resources not over-allocated${RESET}`);
  } else {
    console.log(`${RED}✗ TEST 2 FAILED - Resource over-allocation detected${RESET}`);
  }
  console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}\n`);

  return resourcesPassed;
}

async function runAllTests() {
  console.log(`\n${BLUE}╔═══════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BLUE}║   EventSync 2.0 Concurrency Safety Test Suite    ║${RESET}`);
  console.log(`${BLUE}╚═══════════════════════════════════════════════════╝${RESET}\n`);

  try {
    const test1Passed = await testConcurrentSameHallBookings();
    const test2Passed = await testConcurrentResourceContention();

    console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}`);
    console.log(`${BLUE}FINAL RESULTS${RESET}`);
    console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}`);
    console.log(`  Test 1 (Hall Conflicts): ${test1Passed ? GREEN + '✓ PASSED' : RED + '✗ FAILED'}${RESET}`);
    console.log(`  Test 2 (Resource Limits): ${test2Passed ? GREEN + '✓ PASSED' : RED + '✗ FAILED'}${RESET}`);
    console.log(`${BLUE}═══════════════════════════════════════════════════${RESET}\n`);

    if (test1Passed && test2Passed) {
      console.log(`${GREEN}✓✓✓ ALL CONCURRENCY TESTS PASSED ✓✓✓${RESET}`);
      console.log(`${GREEN}Database-level safety verified under load${RESET}\n`);
      process.exit(0);
    } else {
      console.log(`${RED}✗✗✗ CONCURRENCY TESTS FAILED ✗✗✗${RESET}`);
      console.log(`${RED}System is NOT safe for concurrent access${RESET}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`${RED}Test execution failed:${RESET}`, error);
    process.exit(1);
  }
}

runAllTests();
