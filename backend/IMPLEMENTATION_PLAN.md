# EventSync 2.0 Implementation Plan

## Current Status

**Phase 1: COMPLETED** - Audit complete
**Phase 2: IN PROGRESS** - Database infrastructure

## Completed Work

### ✅ Database Infrastructure
1. PostgreSQL schema with proper constraints (`001_initial_schema.sql`)
   - Exclusion constraints for preventing overlapping bookings
   - Proper foreign keys and cascades
   - Audit trail tables
   - Idempotency support
   - Automated triggers for timestamps and status history

2. Migration framework (`migrate.js`)
   - Version tracking
   - Safe rollback support
   - Status checking

3. Seed script with official data (`seed.js`)
   - Venue A: A1(60), A2(150), 2 proj, 2 audio, 5 staff
   - Venue B: B1(100), B2(200), 2 proj, 1 audio, 4 staff
   - Venue C: C1(80), C2(250), 3 proj, 2 audio, 6 staff

4. Database config with connection pooling (`config.js`)
   - Transaction helpers
   - Retry logic for serialization failures
   - Health checks

5. Structured logging (`logger/index.js`)

## Remaining Work (Prioritized)

### HIGH PRIORITY - Core Functionality

#### 1. Repository Layer (data access)
- `repositories/BookingRepository.js` - CRUD with concurrency safety
- `repositories/VenueRepository.js`
- `repositories/ClientRepository.js`
- `repositories/ResourceRepository.js`

#### 2. Core Scheduling Service (business logic)
- `services/SchedulingService.js` - Hall selection algorithm
- `services/ResourceAllocationService.js` - Sweep-line resource checking
- `services/IdempotencyService.js` - Duplicate prevention
- `services/ValidationService.js` - Input validation with Zod

#### 3. Controllers (API layer)
- `controllers/BookingController.js`
- `controllers/VenueController.js`
- `controllers/ClientController.js`
- `controllers/AnalyticsController.js`

#### 4. Routes & Server
- Update `server.js` for PostgreSQL
- API versioning (/api/v1)
- Proper error handling middleware
- Request correlation IDs

### MEDIUM PRIORITY - Concurrency & Safety

#### 5. Concurrency Implementation
- Advisory locks for shared resources
- Idempotency key handling
- Retry mechanisms
- Deadlock handling

#### 6. Testing Infrastructure
- Unit tests for scheduling algorithm
- Integration tests with test database
- **Critical:** 100 concurrent users test
- Load testing with autocannon

### STANDARD PRIORITY - Features

#### 7. Analytics Service
- Real-time utilization queries
- Reporting views
- Data quality checks

#### 8. Alternative Slot Recommendations
- Time slot searching
- Feasibility checking
- Ranking algorithm

#### 9. Audit & Monitoring
- Audit event creation
- Performance monitoring
- Health check endpoints

### Documentation
- API documentation (OpenAPI)
- Database design docs
- Concurrency design explanation
- Setup instructions for PostgreSQL/Supabase

## Migration from SQLite

The existing SQLite implementation will be:
1. **Preserved** as fallback during development
2. **Replaced** once PostgreSQL version is verified
3. Old files moved to `src/legacy/` for reference

## Key Design Decisions

### Concurrency Strategy
- **Approach:** PostgreSQL exclusion constraints + advisory locks
- **Isolation Level:** READ COMMITTED with explicit locking
- **Idempotency:** UUID-based keys with 24-hour expiry
- **Retries:** Max 3 attempts with exponential backoff

### Resource Allocation
- **Method:** Sweep-line algorithm in application layer
- **Validation:** Double-check with database constraints
- **Atomicity:** All allocations in single transaction

### Testing Strategy
- **Unit:** Pure functions (time calc, overlap detection)
- **Integration:** Real database transactions
- **Concurrency:** Actual parallel requests
- **Load:** Autocannon with realistic scenarios

## Next Immediate Steps

1. Create BookingRepository with transaction safety
2. Implement SchedulingService with proper locking
3. Build API controllers
4. Update server.js
5. Write concurrency tests
6. Verify 100 concurrent users scenario

## Estimated Completion

- Core functionality: 4-6 hours remaining
- Testing & verification: 2-3 hours
- Documentation: 1-2 hours

**Total remaining: 7-11 hours**
