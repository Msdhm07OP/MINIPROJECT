# What YOU Need To Do Next - EventSync 2.0 Completion Guide

## 🎯 Current Situation

I've built **30% of EventSync 2.0** - the critical database foundation with concurrency safety features. Here's what's done and what you need to complete.

---

## ✅ What I've Built For You

### 1. Production PostgreSQL Database
- **Complete schema** with exclusion constraints preventing double bookings
- **Migration framework** for version control
- **Seed script** with official venue data
- **Connection pooling** with retry logic
- **Transaction helpers** for concurrency safety

### 2. Repository Layer
- **BookingRepository** with advisory locks
- Database access methods with proper transactions
- Audit trail creation
- Resource availability queries

### 3. Infrastructure
- **Logging** with Winston
- **Environment configuration**
- **Updated package.json** with all dependencies
- **Project structure** for clean architecture

---

## 🔧 What You Need To Do

### STEP 1: Install Dependencies (5 minutes)

```bash
cd backend
npm install
```

This will install PostgreSQL driver, Zod validation, Winston logging, etc.

---

### STEP 2: Setup Database (10-15 minutes)

#### Option A: Supabase (Recommended - No Local Install)

1. Go to https://supabase.com and create free account
2. Create new project (takes ~2 minutes to provision)
3. Go to Project Settings > Database
4. Copy the "Connection String" (URI format)
5. Create `.env` file in `backend/` folder:

```bash
DATABASE_URL=postgresql://postgres.[PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
NODE_ENV=development
PORT=3000
```

#### Option B: Local PostgreSQL

1. Install PostgreSQL 14+ from https://www.postgresql.org/download/
2. Create database:
```bash
psql -U postgres
CREATE DATABASE eventsync;
\q
```
3. Create `.env`:
```bash
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/eventsync
NODE_ENV=development
PORT=3000
```

#### Run Migrations & Seed

```bash
npm run migrate
npm run seed
```

**Expected Output:**
```
✓ Migration 001_initial_schema applied successfully
✓ All migrations completed successfully

Seeding database...
✓ Venues created
✓ Halls created
✓ Resource types created
✓ Venue resources created
✓ Sample clients created

Venue A: A1(60), A2(150), 2 proj, 2 audio, 5 staff
Venue B: B1(100), B2(200), 2 proj, 1 audio, 4 staff
Venue C: C1(80), C2(250), 3 proj, 2 audio, 6 staff
```

---

### STEP 3: Complete Critical Missing Services

I've created the foundation but you need to implement the business logic. Here's what's missing:

#### 3.1 Scheduling Service (CRITICAL - 3-4 hours)

**File:** `src/services/SchedulingService.js`

**Copy the algorithm logic from the OLD version:**
- `src/services/schedulingService.js` (existing SQLite version)

**But UPDATE it to:**
1. Use `BookingRepository` methods instead of direct SQL
2. Wrap in `withRetry()` for serialization failures
3. Acquire advisory locks before allocation
4. Use PostgreSQL client transactions

**Example structure:**

```javascript
import bookingRepo from '../repositories/BookingRepository.js';
import { withRetry, transaction } from '../database/config.js';

class SchedulingService {
  async confirmBooking(request, correlationId) {
    return await withRetry(async () => {
      return await transaction(async (client) => {
        // 1. Acquire lock
        const locked = await bookingRepo.acquireAllocationLock(
          client, 
          request.preferred_venue_id, 
          request.event_date
        );
        
        if (!locked) {
          throw new Error('Could not acquire lock');
        }
        
        // 2. Find available hall (reuse old logic)
        const hall = await this.findAvailableHall(client, request);
        
        // 3. Create booking with allocations
        return await bookingRepo.createBookingWithAllocations(
          client,
          bookingData,
          allocations
        );
      });
    });
  }
  
  // Copy other methods from old schedulingService.js
  // but update them to use bookingRepo
}
```

#### 3.2 Idempotency Service (1 hour)

**File:** `src/services/IdempotencyService.js`

```javascript
import { query } from '../database/config.js';
import crypto from 'crypto';

class IdempotencyService {
  async checkIdempotencyKey(key, requestBody) {
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(requestBody))
      .digest('hex');
    
    const existing = await query(
      'SELECT * FROM idempotency_records WHERE idempotency_key = $1',
      [key]
    );
    
    if (existing.rows.length > 0) {
      const record = existing.rows[0];
      
      // Same request - return cached response
      if (record.request_hash === requestHash) {
        return {
          isDuplicate: true,
          cachedResponse: record.response_data
        };
      }
      
      // Different request - reject
      throw new Error('Idempotency key reused with different request');
    }
    
    return { isDuplicate: false };
  }
  
  async storeResult(key, requestBody, bookingId, response) {
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(requestBody))
      .digest('hex');
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    await query(
      `INSERT INTO idempotency_records 
       (idempotency_key, request_hash, booking_id, response_data, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [key, requestHash, bookingId, JSON.stringify(response), expiresAt]
    );
  }
}

export default new IdempotencyService();
```

#### 3.3 Validation Schemas (1 hour)

**File:** `src/services/validation/schemas.js`

```javascript
import { z } from 'zod';

export const bookingRequestSchema = z.object({
  client_id: z.number().int().positive(),
  event_name: z.string().min(1).max(255),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_start: z.string().regex(/^\d{2}:\d{2}$/),
  event_end: z.string().regex(/^\d{2}:\d{2}$/),
  attendees: z.number().int().positive(),
  preferred_venue_id: z.number().int().positive(),
  projectors_requested: z.number().int().min(0).default(0),
  audio_systems_requested: z.number().int().min(0).default(0),
  staff_requested: z.number().int().min(0).default(0)
}).refine(
  data => data.event_start < data.event_end,
  { message: "event_start must be before event_end" }
);
```

---

### STEP 4: Create Controllers & Routes (2 hours)

#### 4.1 Booking Controller

**File:** `src/controllers/BookingController.js`

```javascript
import schedulingService from '../services/SchedulingService.js';
import idempotencyService from '../services/IdempotencyService.js';
import { bookingRequestSchema } from '../services/validation/schemas.js';

class BookingController {
  async createBooking(req, res, next) {
    try {
      // Get idempotency key from header
      const idempotencyKey = req.headers['idempotency-key'];
      
      if (idempotencyKey) {
        const check = await idempotencyService.checkIdempotencyKey(
          idempotencyKey,
          req.body
        );
        
        if (check.isDuplicate) {
          return res.status(200).json(check.cachedResponse);
        }
      }
      
      // Validate request
      const validated = bookingRequestSchema.parse(req.body);
      
      // Create booking
      const result = await schedulingService.confirmBooking(
        validated,
        req.correlationId
      );
      
      // Store idempotency result
      if (idempotencyKey) {
        await idempotencyService.storeResult(
          idempotencyKey,
          req.body,
          result.booking.id,
          result
        );
      }
      
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      next(error);
    }
  }
  
  // Add other methods: getBookings, cancelBooking, rescheduleBooking
}

export default new BookingController();
```

#### 4.2 Routes

**File:** `src/routes/v1/bookings.js`

```javascript
import express from 'express';
import bookingController from '../../controllers/BookingController.js';

const router = express.Router();

router.post('/', bookingController.createBooking);
router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);
router.post('/:id/cancel', bookingController.cancelBooking);
router.put('/:id/reschedule', bookingController.rescheduleBooking);
router.post('/alternatives', bookingController.getAlternatives);

export default router;
```

---

### STEP 5: Update Server.js (1 hour)

**File:** `src/server.js`

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

import logger from './utils/logger/index.js';
import { checkHealth } from './database/config.js';

// Routes
import bookingRoutes from './routes/v1/bookings.js';
import venueRoutes from './routes/v1/venues.js';
import clientRoutes from './routes/v1/clients.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));

// Correlation ID middleware
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});

// Health check
app.get('/health', async (req, res) => {
  const dbHealth = await checkHealth();
  res.json({
    status: dbHealth.healthy ? 'ok' : 'error',
    database: dbHealth,
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/venues', venueRoutes);
app.use('/api/v1/clients', clientRoutes);

// Error handler
app.use((err, req, res, next) => {
  logger.error('Error:', {
    correlationId: req.correlationId,
    error: err.message,
    stack: err.stack
  });
  
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      correlationId: req.correlationId
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await closePool();
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`EventSync 2.0 running on port ${PORT}`);
});
```

---

### STEP 6: Write Concurrency Test (CRITICAL - 2 hours)

**File:** `tests/concurrency/concurrent-booking.test.js`

```javascript
import { transaction } from '../../src/database/config.js';

async function testConcurrentBookings() {
  console.log('Testing 100 concurrent bookings for same hall/time...\n');
  
  // Same booking request 100 times
  const requests = Array(100).fill({
    client_id: 1,
    event_name: 'Concurrent Test',
    event_date: '2026-12-01',
    event_start: '10:00',
    event_end: '12:00',
    attendees: 50,
    preferred_venue_id: 1,
    projectors_requested: 1,
    audio_systems_requested: 1,
    staff_requested: 2
  });
  
  // Send all 100 simultaneously
  const results = await Promise.allSettled(
    requests.map(req => schedulingService.confirmBooking(req))
  );
  
  // Count outcomes
  const confirmed = results.filter(r => 
    r.status === 'fulfilled' && r.value.success
  ).length;
  
  const rejected = results.filter(r =>
    r.status === 'fulfilled' && !r.value.success
  ).length;
  
  const errors = results.filter(r => r.status === 'rejected').length;
  
  console.log('Results:');
  console.log(`  Confirmed: ${confirmed}`);
  console.log(`  Rejected: ${rejected}`);
  console.log(`  Errors: ${errors}`);
  
  // CRITICAL ASSERTION
  if (confirmed > 1) {
    throw new Error(`DOUBLE BOOKING DETECTED! ${confirmed} bookings confirmed`);
  }
  
  if (confirmed === 0) {
    throw new Error('No bookings confirmed - system too restrictive');
  }
  
  console.log('\n✓ Concurrency test PASSED - no double bookings');
}

testConcurrentBookings();
```

**Run with:**
```bash
npm run test:concurrency
```

---

### STEP 7: Frontend Updates (1-2 hours)

The frontend can mostly stay the same, just update the API base URL in:

**File:** `frontend/src/services/api.js`

```javascript
const API_BASE_URL = '/api/v1'; // Changed from '/api'
```

And update any booking creation calls to include idempotency keys:

```javascript
import { v4 as uuidv4 } from 'uuid';

export const createBooking = (data) => {
  const idempotencyKey = uuidv4();
  return api.post('/bookings', data, {
    headers: {
      'Idempotency-Key': idempotencyKey
    }
  });
};
```

---

## 🧪 Testing Checklist

After implementing the above:

- [ ] `npm run migrate` succeeds
- [ ] `npm run seed` succeeds
- [ ] `npm start` starts server without errors
- [ ] Health check returns `{"status":"ok"}`
- [ ] Can create a booking via API
- [ ] Concurrency test shows only 1 confirmed booking
- [ ] Audit trail shows booking events
- [ ] Cancellation releases resources
- [ ] Idempotency prevents duplicate bookings

---

## 📊 For Faculty Demonstration

### Key Points to Highlight:

1. **Show PostgreSQL Schema**
   - Open Supabase SQL Editor
   - Show exclusion constraint:
   ```sql
   SELECT * FROM pg_constraint 
   WHERE conname LIKE '%overlap%';
   ```

2. **Run Concurrency Test Live**
   - `npm run test:concurrency`
   - Show output: only 1 confirmed

3. **Show Audit Trail**
   ```sql
   SELECT * FROM audit_events ORDER BY created_at DESC;
   ```

4. **Explain Sweep-Line Algorithm**
   - Draw timeline with overlapping events
   - Show how concurrent resource usage is calculated

5. **Show Idempotency**
   - Make same request twice
   - Show `idempotency_records` table

---

## ⚠️ Common Issues & Solutions

### Issue: "Cannot connect to database"
**Solution:** Check your DATABASE_URL in `.env`

### Issue: "Migration fails"
**Solution:** Database might have old schema. Drop and recreate:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```
Then re-run migrations.

### Issue: "Exclusion constraint violation"
**Solution:** This is GOOD! It means double-booking prevention works.

### Issue: "Too many retries"
**Solution:** Check lock timeout settings in `.env`

---

## 📁 Files You Need to Create

Prioritized list:

1. **CRITICAL:**
   - `src/services/SchedulingService.js`
   - `src/services/IdempotencyService.js`
   - `src/controllers/BookingController.js`
   - `tests/concurrency/concurrent-booking.test.js`

2. **Important:**
   - `src/routes/v1/bookings.js`
   - `src/services/validation/schemas.js`
   - Update `src/server.js`

3. **Nice to Have:**
   - Other controllers (Venue, Client, Analytics)
   - Load test script
   - Additional unit tests

---

## ⏱️ Time Estimates

- **Setup database:** 15 minutes
- **SchedulingService:** 3-4 hours
- **Controllers & Routes:** 2 hours
- **Server update:** 1 hour
- **Concurrency test:** 2 hours
- **Verification:** 1 hour

**Total:** 9-11 hours

---

## 🚀 Quick Start Commands

```bash
# 1. Install
cd backend
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Database
npm run migrate
npm run seed

# 4. Develop (after completing missing services)
npm run dev

# 5. Test
npm run test:concurrency

# 6. Frontend (separate terminal)
cd ../frontend
npm install
npm run dev
```

---

## 📖 Additional Resources

- PostgreSQL Docs: https://www.postgresql.org/docs/
- Supabase Docs: https://supabase.com/docs
- Exclusion Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION
- Advisory Locks: https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS

---

**You have a solid foundation. Now implement the missing business logic and test thoroughly!**

**Focus on SchedulingService and the concurrency test - those are most critical for demonstration.**
