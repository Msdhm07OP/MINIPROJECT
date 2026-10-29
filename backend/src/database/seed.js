import { transaction, query } from './config.js';

/**
 * Seed database with official problem statement data
 */
async function seed() {
  try {
    console.log('Seeding database with initial data...\n');

    await transaction(async (client) => {
      // Clear existing data (in correct order to respect foreign keys)
      console.log('Clearing existing data...');
      await client.query('TRUNCATE audit_events, booking_status_history, booking_resource_allocations, idempotency_records, bookings, clients, venue_resource_capacity, halls, venues, resource_types RESTART IDENTITY CASCADE');

      // ========================================================================
      // VENUES (Official Problem Statement)
      // ========================================================================
      console.log('Creating venues...');

      const venueA = await client.query(
        'INSERT INTO venues (name) VALUES ($1) RETURNING id',
        ['Venue A']
      );
      const venueB = await client.query(
        'INSERT INTO venues (name) VALUES ($1) RETURNING id',
        ['Venue B']
      );
      const venueC = await client.query(
        'INSERT INTO venues (name) VALUES ($1) RETURNING id',
        ['Venue C']
      );

      const venueAId = venueA.rows[0].id;
      const venueBId = venueB.rows[0].id;
      const venueCId = venueC.rows[0].id;

      console.log('✓ Venues created');

      // ========================================================================
      // HALLS (Official Problem Statement)
      // ========================================================================
      console.log('Creating halls...');

      // Venue A: A1 (60), A2 (150)
      await client.query(
        'INSERT INTO halls (venue_id, name, capacity) VALUES ($1, $2, $3)',
        [venueAId, 'A1', 60]
      );
      await client.query(
        'INSERT INTO halls (venue_id, name, capacity) VALUES ($1, $2, $3)',
        [venueAId, 'A2', 150]
      );

      // Venue B: B1 (100), B2 (200)
      await client.query(
        'INSERT INTO halls (venue_id, name, capacity) VALUES ($1, $2, $3)',
        [venueBId, 'B1', 100]
      );
      await client.query(
        'INSERT INTO halls (venue_id, name, capacity) VALUES ($1, $2, $3)',
        [venueBId, 'B2', 200]
      );

      // Venue C: C1 (80), C2 (250)
      await client.query(
        'INSERT INTO halls (venue_id, name, capacity) VALUES ($1, $2, $3)',
        [venueCId, 'C1', 80]
      );
      await client.query(
        'INSERT INTO halls (venue_id, name, capacity) VALUES ($1, $2, $3)',
        [venueCId, 'C2', 250]
      );

      console.log('✓ Halls created');

      // ========================================================================
      // RESOURCE TYPES
      // ========================================================================
      console.log('Creating resource types...');

      const projectorType = await client.query(
        'INSERT INTO resource_types (name, description, unit) VALUES ($1, $2, $3) RETURNING id',
        ['projector', 'Digital projectors for presentations', 'units']
      );
      const audioType = await client.query(
        'INSERT INTO resource_types (name, description, unit) VALUES ($1, $2, $3) RETURNING id',
        ['audio_system', 'Audio systems for events', 'units']
      );
      const staffType = await client.query(
        'INSERT INTO resource_types (name, description, unit) VALUES ($1, $2, $3) RETURNING id',
        ['support_staff', 'Support staff members', 'people']
      );

      const projectorId = projectorType.rows[0].id;
      const audioId = audioType.rows[0].id;
      const staffId = staffType.rows[0].id;

      console.log('✓ Resource types created');

      // ========================================================================
      // VENUE RESOURCES (Official Problem Statement)
      // ========================================================================
      console.log('Creating venue resource capacity...');

      // Venue A: 2 projectors, 2 audio systems, 5 staff
      await client.query(
        'INSERT INTO venue_resource_capacity (venue_id, resource_type_id, capacity) VALUES ($1, $2, $3)',
        [venueAId, projectorId, 2]
      );
      await client.query(
        'INSERT INTO venue_resource_capacity (venue_id, resource_type_id, capacity) VALUES ($1, $2, $3)',
        [venueAId, audioId, 2]
      );
      await client.query(
        'INSERT INTO venue_resource_capacity (venue_id, resource_type_id, capacity) VALUES ($1, $2, $3)',
        [venueAId, staffId, 5]
      );

      // Venue B: 2 projectors, 1 audio system, 4 staff
      await client.query(
        'INSERT INTO venue_resource_capacity (venue_id, resource_type_id, capacity) VALUES ($1, $2, $3)',
        [venueBId, projectorId, 2]
      );
      await client.query(
        'INSERT INTO venue_resource_capacity (venue_id, resource_type_id, capacity) VALUES ($1, $2, $3)',
        [venueBId, audioId, 1]
      );
      await client.query(
        'INSERT INTO venue_resource_capacity (venue_id, resource_type_id, capacity) VALUES ($1, $2, $3)',
        [venueBId, staffId, 4]
      );

      // Venue C: 3 projectors, 2 audio systems, 6 staff
      await client.query(
        'INSERT INTO venue_resource_capacity (venue_id, resource_type_id, capacity) VALUES ($1, $2, $3)',
        [venueCId, projectorId, 3]
      );
      await client.query(
        'INSERT INTO venue_resource_capacity (venue_id, resource_type_id, capacity) VALUES ($1, $2, $3)',
        [venueCId, audioId, 2]
      );
      await client.query(
        'INSERT INTO venue_resource_capacity (venue_id, resource_type_id, capacity) VALUES ($1, $2, $3)',
        [venueCId, staffId, 6]
      );

      console.log('✓ Venue resources created');

      // ========================================================================
      // SAMPLE CLIENTS
      // ========================================================================
      console.log('Creating sample clients...');

      await client.query(
        'INSERT INTO clients (name, email, phone, organization) VALUES ($1, $2, $3, $4)',
        ['TechCorp Solutions', 'contact@techcorp.com', '+1-555-0101', 'Technology Company']
      );
      await client.query(
        'INSERT INTO clients (name, email, phone, organization) VALUES ($1, $2, $3, $4)',
        ['Marketing Masters', 'events@marketingmasters.com', '+1-555-0102', 'Marketing Agency']
      );
      await client.query(
        'INSERT INTO clients (name, email, phone, organization) VALUES ($1, $2, $3, $4)',
        ['Innovation Labs', 'hello@innovationlabs.io', '+1-555-0103', 'Research Institute']
      );
      await client.query(
        'INSERT INTO clients (name, email, phone, organization) VALUES ($1, $2, $3, $4)',
        ['Global Ventures', 'info@globalventures.com', '+1-555-0104', 'Investment Firm']
      );
      await client.query(
        'INSERT INTO clients (name, email, phone, organization) VALUES ($1, $2, $3, $4)',
        ['Creative Studio', 'bookings@creativestudio.net', '+1-555-0105', 'Design Agency']
      );

      console.log('✓ Sample clients created');
    });

    // ========================================================================
    // VERIFICATION
    // ========================================================================
    console.log('\n=== Database Summary ===');

    const venueCount = await query('SELECT COUNT(*) as count FROM venues');
    console.log(`Venues: ${venueCount.rows[0].count}`);

    const hallCount = await query('SELECT COUNT(*) as count FROM halls');
    console.log(`Halls: ${hallCount.rows[0].count}`);

    const resourceCount = await query('SELECT COUNT(*) as count FROM resource_types');
    console.log(`Resource Types: ${resourceCount.rows[0].count}`);

    const clientCount = await query('SELECT COUNT(*) as count FROM clients');
    console.log(`Clients: ${clientCount.rows[0].count}`);

    console.log('\n=== Venue Configuration ===');
    const venueConfig = await query(`
      SELECT
        v.name as venue,
        json_agg(
          json_build_object(
            'hall', h.name,
            'capacity', h.capacity
          ) ORDER BY h.name
        ) as halls,
        (SELECT capacity FROM venue_resource_capacity vrc
         JOIN resource_types rt ON vrc.resource_type_id = rt.id
         WHERE vrc.venue_id = v.id AND rt.name = 'projector') as projectors,
        (SELECT capacity FROM venue_resource_capacity vrc
         JOIN resource_types rt ON vrc.resource_type_id = rt.id
         WHERE vrc.venue_id = v.id AND rt.name = 'audio_system') as audio_systems,
        (SELECT capacity FROM venue_resource_capacity vrc
         JOIN resource_types rt ON vrc.resource_type_id = rt.id
         WHERE vrc.venue_id = v.id AND rt.name = 'support_staff') as support_staff
      FROM venues v
      JOIN halls h ON v.id = h.venue_id
      GROUP BY v.id, v.name
      ORDER BY v.id
    `);

    venueConfig.rows.forEach(venue => {
      console.log(`\n${venue.venue}:`);
      console.log(`  Halls: ${venue.halls.map(h => `${h.hall} (${h.capacity})`).join(', ')}`);
      console.log(`  Resources: ${venue.projectors} projectors, ${venue.audio_systems} audio systems, ${venue.support_staff} staff`);
    });

    console.log('\n✓ Database seeded successfully!\n');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
