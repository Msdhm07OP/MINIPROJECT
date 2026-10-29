# EventSync - Complete Setup Instructions

This guide will walk you through setting up EventSync from scratch on a fresh machine.

---

## System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher (comes with Node.js)
- **Operating System**: Windows, macOS, or Linux
- **Disk Space**: ~500 MB for dependencies
- **RAM**: Minimum 4 GB

---

## Quick Start (TL;DR)

```bash
# Backend
cd backend
npm install
npm run seed
npm start

# Frontend (new terminal)
cd frontend
npm install
npm run dev

# Open browser to http://localhost:5173
```

---

## Detailed Setup Instructions

### Step 1: Verify Node.js Installation

Open a terminal/command prompt and run:

```bash
node --version
npm --version
```

Expected output:
```
v18.x.x or higher
9.x.x or higher
```

If not installed, download from: https://nodejs.org/

---

### Step 2: Navigate to Project Directory

```bash
cd path/to/mini
```

On Windows:
```bash
cd C:\Users\YourName\OneDrive\Desktop\mini
```

On macOS/Linux:
```bash
cd ~/Desktop/mini
```

---

### Step 3: Backend Setup

#### 3.1 Install Backend Dependencies

```bash
cd backend
npm install
```

This will install:
- express (web framework)
- cors (cross-origin resource sharing)
- better-sqlite3 (database)
- date-fns (date manipulation)
- nodemon (development auto-reload)

**Wait time**: ~2-3 minutes depending on internet speed

Expected output:
```
added 150 packages, and audited 151 packages in 45s
```

#### 3.2 Seed the Database

```bash
npm run seed
```

Expected output:
```
Seeding database with initial data...

Creating venues...
✓ Venues created
Creating halls...
✓ Halls created
Creating venue resources...
✓ Venue resources created
Creating sample clients...
✓ Sample clients created

=== Database Summary ===
Venues: 3
Halls: 6
Clients: 5

=== Venue Configuration ===

Venue A:
  Halls: A1 (60), A2 (150)
  Resources: 2 projectors, 2 audio systems, 5 staff

Venue B:
  Halls: B1 (100), B2 (200)
  Resources: 2 projectors, 1 audio systems, 4 staff

Venue C:
  Halls: C1 (80), C2 (250)
  Resources: 3 projectors, 2 audio systems, 6 staff

✓ Database seeded successfully!
```

This creates `backend/eventsync.db` with the official venue configuration.

#### 3.3 Start Backend Server

```bash
npm start
```

Expected output:
```
✓ EventSync Backend Server running on port 3000
✓ API available at http://localhost:3000
✓ Database initialized
```

**Leave this terminal running.** The backend server must stay active.

To verify it's working, open a browser and visit:
- http://localhost:3000

You should see:
```json
{
  "message": "EventSync API",
  "version": "1.0.0",
  "endpoints": {
    "venues": "/api/venues",
    "clients": "/api/clients",
    "bookings": "/api/bookings"
  }
}
```

---

### Step 4: Frontend Setup

**Open a NEW terminal** (keep the backend terminal running).

#### 4.1 Install Frontend Dependencies

```bash
cd frontend
npm install
```

This will install:
- react (UI framework)
- vite (build tool)
- tailwindcss (styling)
- axios (HTTP client)
- lucide-react (icons)

**Wait time**: ~3-4 minutes

Expected output:
```
added 250 packages, and audited 251 packages in 1m
```

#### 4.2 Start Frontend Development Server

```bash
npm run dev
```

Expected output:
```
  VITE v5.0.8  ready in 1500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

---

### Step 5: Access the Application

Open your web browser and navigate to:

**http://localhost:5173**

You should see the EventSync dashboard.

---

## Verification Checklist

- [ ] Backend running on http://localhost:3000
- [ ] Frontend running on http://localhost:5173
- [ ] Dashboard loads with statistics (0 bookings initially after fresh seed)
- [ ] "Create Booking" tab shows form
- [ ] Clients dropdown shows 5 sample clients
- [ ] Venues dropdown shows 3 venues

---

## Common Issues & Solutions

### Issue 1: `npm install` fails with permission error

**Solution (macOS/Linux)**:
```bash
sudo npm install
```

**Solution (Windows)**:
Run terminal as Administrator

---

### Issue 2: Port 3000 already in use

**Error**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**:
Find and kill the process using port 3000:

**Windows**:
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**macOS/Linux**:
```bash
lsof -ti:3000 | xargs kill -9
```

Or change the port in `backend/src/server.js`:
```javascript
const PORT = 3001; // Change from 3000
```

---

### Issue 3: Port 5173 already in use

**Solution**:
Vite will automatically try the next available port (5174, 5175, etc.)

Or specify a port in `frontend/vite.config.js`:
```javascript
server: {
  port: 5174
}
```

---

### Issue 4: Frontend shows "Cannot connect to server"

**Check**:
1. Is backend running? Look for terminal with "running on port 3000"
2. Visit http://localhost:3000 directly to verify

**Solution**:
Restart backend server:
```bash
cd backend
npm start
```

---

### Issue 5: Database is empty or missing

**Solution**:
Re-run the seed script:
```bash
cd backend
npm run seed
```

This will recreate the database from scratch.

---

### Issue 6: `better-sqlite3` installation fails

**Error**:
```
gyp ERR! build error
```

**Solution (Windows)**:
Install build tools:
```bash
npm install --global windows-build-tools
```

**Solution (macOS)**:
Install Xcode Command Line Tools:
```bash
xcode-select --install
```

**Solution (Linux)**:
```bash
sudo apt-get install build-essential python3
```

Then retry:
```bash
npm install
```

---

## Running Tests

```bash
cd backend
npm test
```

Expected output:
```
=== EventSync Scheduling Algorithm Test Suite ===

✓ TEST 1 - Smallest Sufficient Hall: PASSED
✓ TEST 2 - Larger Hall When Required: PASSED
✓ TEST 3 - Preferred Venue Priority: PASSED
✓ TEST 4 - Fallback Venue: PASSED
✓ TEST 5 - Hall Conflict: PASSED
✓ TEST 6 - Setup Buffer Conflict: PASSED
✓ TEST 7 - Adjacent Reservations: PASSED
✓ TEST 8 - Projector Limit: PASSED
✓ TEST 9 - Operating Hours Restriction: PASSED
✓ TEST 10 - Invalid Input: PASSED
✓ TEST 11 - Cancellation Releases Resources: PASSED
✓ TEST 12 - Successful Rescheduling: PASSED
✓ TEST 13 - Failed Rescheduling Preserves Original: PASSED
✓ TEST 14 - PDF Sample Scenario: PASSED

=== Test Suite Complete ===
```

---

## Resetting the Application

To start fresh:

### Reset Database Only:
```bash
cd backend
npm run seed
```

### Full Reset (including dependencies):
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json eventsync.db
npm install
npm run seed

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## Development Mode vs Production

### Development (Current Setup):
- Backend: Auto-reload with nodemon
- Frontend: Hot module replacement with Vite
- Detailed error messages
- Source maps enabled

### Production Build:

**Backend**:
```bash
cd backend
npm start
```
(No build step needed, runs directly)

**Frontend**:
```bash
cd frontend
npm run build
```

This creates `frontend/dist/` folder with optimized static files.

To preview production build:
```bash
npm run preview
```

---

## Environment Variables (Optional)

### Backend `.env`:
```bash
# backend/.env (optional)
PORT=3000
NODE_ENV=development
```

### Frontend `.env`:
```bash
# frontend/.env (optional)
# Not needed for local development
# Vite proxy handles API requests
```

---

## Directory Structure After Setup

```
mini/
├── backend/
│   ├── node_modules/       ← Created by npm install
│   ├── eventsync.db        ← Created by npm run seed
│   ├── eventsync.db-shm    ← SQLite temp file
│   ├── eventsync.db-wal    ← SQLite write-ahead log
│   ├── src/
│   ├── tests/
│   └── package.json
│
├── frontend/
│   ├── node_modules/       ← Created by npm install
│   ├── dist/               ← Created by npm run build (optional)
│   ├── src/
│   └── package.json
│
├── README.md
├── SETUP_INSTRUCTIONS.md (this file)
└── other documentation files
```

---

## Performance Tuning (Optional)

### For Slow Machines:

Reduce Vite dev server overhead:
```javascript
// frontend/vite.config.js
export default defineConfig({
  server: {
    hmr: false // Disable hot module replacement
  }
})
```

### For Faster Startup:

Use npm caching:
```bash
npm install --prefer-offline
```

---

## Updating Dependencies

To update to latest compatible versions:

```bash
# Backend
cd backend
npm update

# Frontend
cd frontend
npm update
```

Check for security vulnerabilities:
```bash
npm audit
npm audit fix
```

---

## Support & Troubleshooting

### Check Logs:

**Backend logs**: Visible in terminal running `npm start`

**Frontend logs**: Open browser DevTools (F12) → Console tab

**Database queries**: Backend logs show all SQL queries

### Get Help:

1. Read error messages carefully
2. Check browser console for frontend errors
3. Check terminal for backend errors
4. Verify both servers are running
5. Confirm database was seeded correctly

---

## Next Steps After Setup

1. ✅ Read `README.md` for feature overview
2. ✅ Review `ALGORITHM_EXPLANATION.md` for technical details
3. ✅ Study `HACKATHON_PRESENTATION.md` for demo script
4. ✅ Explore the application by creating test bookings
5. ✅ Run the test suite to verify correctness

---

## System Ready!

If you've completed all steps successfully:

- ✅ Backend API running at http://localhost:3000
- ✅ Frontend UI running at http://localhost:5173
- ✅ Database initialized with 3 venues, 6 halls, 5 clients
- ✅ All tests passing

**You're ready to demonstrate EventSync!** 🎉

---

**Estimated Total Setup Time**: 10-15 minutes
