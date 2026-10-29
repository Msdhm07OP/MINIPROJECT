# EventSync 2.0 - Production Deployment Guide

## 🚀 Quick Start

### 1. Database Setup

You have two options:

#### Option A: Supabase (Recommended for Production)

1. Create a Supabase project at https://supabase.com
2. Get your database connection string:
   - Go to Project Settings → Database
   - Copy the "Connection string" (URI format)
   - Should look like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

#### Option B: Local PostgreSQL

```bash
# Install PostgreSQL 14+ locally
# Then create database
createdb eventsync
```

### 2. Environment Configuration

Create `.env` file in the backend directory:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Example for Supabase:
# DATABASE_URL=postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres

# Example for local:
# DATABASE_URL=postgresql://localhost:5432/eventsync

# Server
PORT=3000
NODE_ENV=production

# CORS
CORS_ORIGIN=http://localhost:5173

# Database Pool
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_CONNECTION_TIMEOUT_MS=10000
DB_IDLE_TIMEOUT_MS=30000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Retry Configuration
MAX_TRANSACTION_RETRIES=3
RETRY_BASE_DELAY_MS=100

# Idempotency
IDEMPOTENCY_EXPIRY_HOURS=24

# Logging
LOG_LEVEL=info
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Migrations

This creates all database tables, constraints, triggers, and views:

```bash
npm run migrate
```

Expected output:
```
✓ Database connection established
✓ Schema migrations table ready
✓ Running migration: 001_initial_schema.sql
✓ All migrations completed successfully
```

### 5. Seed Initial Data

This loads the official problem statement data:

```bash
npm run seed
```

Expected output:
```
✓ Seeding venues...
✓ Seeding halls...
✓ Seeding resource types...
✓ Seeding venue resources...
✓ Seeding sample clients...
✓ Database seeded successfully!

Venue Summary:
  Venue A: Halls A1(60), A2(150) | Resources: 2 Projectors, 2 Audio, 5 Staff
  Venue B: Halls B1(100), B2(200) | Resources: 2 Projectors, 1 Audio, 4 Staff
  Venue C: Halls C1(80), C2(250) | Resources: 3 Projectors, 2 Audio, 6 Staff
```

### 6. Start Server

Development mode (with hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Expected output:
```
✓ EventSync 2.0 Server running on port 3000
✓ Environment: production
✓ Health check: http://localhost:3000/health
✓ API endpoint: http://localhost:3000/api/v1
```

### 7. Verify Installation

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-10-29T...",
  "uptime": 1.234,
  "database": {
    "healthy": true,
    "responseTime": 5
  },
  "version": "2.0.0"
}
```

---

## 🧪 Testing

### Unit Tests

Test core business logic:

```bash
npm test
```

### Concurrency Tests

**CRITICAL**: Verify zero double-bookings under load:

```bash
npm run test:concurrency
```

This test:
- Sends 100 simultaneous booking requests for the same hall/time
- Verifies only 1 booking is confirmed
- Tests resource allocation limits
- Validates database-level safety mechanisms

Expected output:
```
═══════════════════════════════════════════════════
TEST 1: 100 Concurrent Requests for SAME Hall/Time
═══════════════════════════════════════════════════

Results:
  Total requests: 100
  Duration: ~2000ms
  ✓ Confirmed bookings: 1
  ✓ Rejected (no availability): 99
  ✓ Errors: 0

  Confirmed bookings in database: 1

✓ TEST 1 PASSED - No double bookings detected
✓ Database-level concurrency safety verified

✓✓✓ ALL CONCURRENCY TESTS PASSED ✓✓✓
```

### Load Testing

Test performance under sustained load:

```bash
npm run load:test
```

This uses autocannon to simulate 100 connections over 30 seconds.

---

## 📡 API Usage

### Create a Booking

```bash
curl -X POST http://localhost:3000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-request-id-123" \
  -d '{
    "client_id": 1,
    "event_name": "Tech Conference 2026",
    "event_date": "2026-12-15",
    "event_start": "09:00",
    "event_end": "17:00",
    "attendees": 150,
    "preferred_venue_id": 1,
    "projectors_requested": 2,
    "audio_systems_requested": 1,
    "staff_requested": 3
  }'
```

Success response:
```json
{
  "success": true,
  "booking": {
    "id": 1,
    "confirmation_number": "BK-20261215-001",
    "status": "confirmed",
    "venue_name": "Venue A",
    "hall_name": "Hall A2",
    "hall_capacity": 150,
    "event_date": "2026-12-15",
    "event_start": "09:00:00",
    "event_end": "17:00:00",
    "reserved_from": "08:30:00",
    "reserved_until": "17:30:00"
  },
  "resources_allocated": [
    { "resource_type": "Projector", "quantity": 2 },
    { "resource_type": "Audio System", "quantity": 1 },
    { "resource_type": "Support Staff", "quantity": 3 }
  ]
}
```

Rejection response (no availability):
```json
{
  "success": false,
  "message": "No suitable venue available",
  "reason": "Requested hall not available due to conflicting booking BK-20261215-001 (09:00 - 17:00)"
}
```

### Idempotency

Use the `X-Idempotency-Key` header to prevent duplicate bookings:

```bash
# First request - creates booking
curl -H "X-Idempotency-Key: abc123" -X POST ... 

# Duplicate request - returns cached result
curl -H "X-Idempotency-Key: abc123" -X POST ...
```

### List Bookings

```bash
# All bookings
curl http://localhost:3000/api/v1/bookings

# Filter by date
curl "http://localhost:3000/api/v1/bookings?start_date=2026-12-01&end_date=2026-12-31"

# Filter by status
curl "http://localhost:3000/api/v1/bookings?status=confirmed"
```

### Get Booking Statistics

```bash
curl http://localhost:3000/api/v1/bookings/stats
```

Response:
```json
{
  "total_bookings": 45,
  "by_status": {
    "confirmed": 40,
    "cancelled": 5
  },
  "by_venue": {
    "Venue A": 15,
    "Venue B": 12,
    "Venue C": 13
  },
  "total_revenue": 225000.00,
  "utilization_rate": 75.5
}
```

### Cancel Booking

```bash
curl -X POST http://localhost:3000/api/v1/bookings/1/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason": "Event postponed"}'
```

### Reschedule Booking

```bash
curl -X PUT http://localhost:3000/api/v1/bookings/1/reschedule \
  -H "Content-Type: application/json" \
  -d '{
    "new_date": "2026-12-20",
    "new_start": "10:00",
    "new_end": "18:00"
  }'
```

### Get Alternative Slots

```bash
curl -X POST http://localhost:3000/api/v1/bookings/alternatives \
  -H "Content-Type: application/json" \
  -d '{
    "event_date": "2026-12-15",
    "event_start": "09:00",
    "event_end": "17:00",
    "attendees": 150,
    "preferred_venue_id": 1
  }'
```

---

## 🏗️ Architecture Overview

### Core Safety Mechanisms

1. **PostgreSQL Exclusion Constraints** (Primary Defense)
   - Database-level prevention of overlapping bookings
   - Cannot be bypassed by application logic
   - Atomic enforcement at transaction commit

2. **Advisory Locks** (Coordination Layer)
   - Prevents race conditions during resource allocation
   - One transaction at a time per venue+date
   - Released automatically on transaction end

3. **Idempotency Keys** (Duplicate Prevention)
   - SHA-256 hashing of request payload
   - 24-hour cached responses
   - Prevents accidental double submissions

4. **Automatic Retries** (Resilience)
   - Exponential backoff for serialization failures
   - Max 3 retries per request
   - Graceful degradation under load

### Transaction Flow

```
Request → Idempotency Check → Advisory Lock → Hall Selection
    ↓
Resource Validation → Create Booking → Allocate Resources
    ↓
Audit Trail → Commit Transaction → Release Lock → Response
```

### Database Schema

Key tables:
- `venues` - Physical locations
- `halls` - Rooms within venues
- `resource_types` - Projectors, audio, staff
- `venue_resource_capacity` - Available resources per venue
- `bookings` - Event bookings (with exclusion constraint)
- `booking_resource_allocations` - Resources assigned to bookings
- `idempotency_records` - Request deduplication
- `audit_events` - Complete activity log

---

## 🔍 Monitoring & Debugging

### Health Monitoring

```bash
# Check system health
curl http://localhost:3000/health

# Check database connectivity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bookings;"
```

### Logs

Production logs use JSON format for machine parsing:

```bash
# View logs
tail -f logs/combined.log

# Search for errors
grep '"level":"error"' logs/combined.log

# Track correlation IDs
grep '"correlationId":"abc-123"' logs/combined.log
```

Development logs are colorized for readability.

### Common Issues

#### Connection Pool Exhausted

**Symptom**: "ECONNREFUSED" or timeout errors

**Solution**: Increase `DB_POOL_MAX` in `.env`

```env
DB_POOL_MAX=50
```

#### Serialization Failures

**Symptom**: 503 errors with "High concurrency detected"

**Expected**: System is working correctly under high load
**Action**: Client should retry with exponential backoff

#### Double Booking Detected

**Symptom**: Concurrency test shows > 1 booking confirmed

**Action**: CRITICAL - Database constraint may be misconfigured
```bash
# Verify exclusion constraint exists
psql $DATABASE_URL -c "\d+ bookings" | grep EXCLUDE
```

---

## 🚢 Production Deployment

### Supabase Deployment

1. Create project at https://supabase.com
2. Get connection string from Project Settings → Database
3. Set `DATABASE_URL` in your hosting platform
4. Run migrations: `npm run migrate`
5. Run seed: `npm run seed`
6. Deploy application

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL=<your-supabase-connection-string>
PORT=3000
LOG_LEVEL=info
DB_POOL_MAX=20
RATE_LIMIT_MAX_REQUESTS=100
```

### Security Checklist

- [ ] `NODE_ENV=production` set
- [ ] Database credentials secured (not in git)
- [ ] CORS configured for your frontend domain
- [ ] Rate limiting enabled
- [ ] HTTPS enforced
- [ ] Database backups configured
- [ ] Monitoring/alerting configured
- [ ] Error reporting service integrated

### Performance Tuning

1. **Database Indexes**: Already created in migration
2. **Connection Pooling**: Adjust `DB_POOL_MAX` based on load
3. **Caching**: Consider Redis for idempotency records
4. **CDN**: Serve static frontend files via CDN
5. **Load Balancing**: Run multiple instances behind load balancer

---

## 📊 Metrics to Monitor

1. **Response Time**: P50, P95, P99 latency
2. **Error Rate**: 5xx errors / total requests
3. **Database Pool**: Active connections / max connections
4. **Booking Success Rate**: Confirmed / total requests
5. **Concurrency Conflicts**: Serialization failures / second
6. **Resource Utilization**: Average % of resources allocated

---

## 🆘 Support

### Database Issues

Check connection:
```bash
psql $DATABASE_URL -c "SELECT version();"
```

View active connections:
```bash
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

### Application Issues

Enable debug logging:
```env
LOG_LEVEL=debug
```

Check for blocked transactions:
```sql
SELECT * FROM pg_locks WHERE NOT granted;
```

---

## 📚 Additional Resources

- **API Documentation**: See `README_EVENTSYNC_2.0.md`
- **Architecture Details**: See `IMPLEMENTATION_PLAN.md`
- **Development Status**: See `EVENTSYNC_2.0_STATUS.md`
- **Next Steps**: See `WHAT_TO_DO_NEXT.md`

---

**EventSync 2.0** - Production-grade event scheduling with database-level concurrency safety.

Built with PostgreSQL exclusion constraints, advisory locks, and comprehensive audit trails.
