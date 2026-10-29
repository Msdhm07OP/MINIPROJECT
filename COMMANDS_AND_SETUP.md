# EventSync - All Commands and Setup Requirements

## 🎯 Quick Reference: Complete Setup Commands

Copy and paste these commands in order:

### Step 1: Backend Setup

```bash
cd backend
npm install
npm run seed
npm start
```

**Keep this terminal running!**

### Step 2: Frontend Setup (New Terminal)

```bash
cd frontend
npm install
npm run dev
```

**Keep this terminal running!**

### Step 3: Open Application

Open browser to: **http://localhost:5173**

---

## 📋 All Available Commands

### Backend Commands

```bash
# Install dependencies
npm install

# Seed database with official venue data
npm run seed

# Start production server
npm start

# Start development server (auto-reload on code changes)
npm run dev

# Run test suite
npm test
```

### Frontend Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🔧 External Services Required

### **ANSWER: NONE!**

This project is **completely self-contained**. No external services, API keys, cloud accounts, or configuration needed.

### What IS Required (All Local):

1. ✅ **Node.js 18+** (download from https://nodejs.org)
2. ✅ **npm** (comes with Node.js)
3. ✅ **Web Browser** (any modern browser)

### What is NOT Required:

- ❌ No external database (SQLite runs locally)
- ❌ No API keys
- ❌ No cloud accounts (AWS, Azure, GCP)
- ❌ No email service (SendGrid, Mailgun, etc.)
- ❌ No authentication service (Auth0, Clerk, etc.)
- ❌ No file storage (Cloudinary, S3, etc.)
- ❌ No payment service (Stripe, PayPal, etc.)
- ❌ No internet connection needed (after npm install)

---

## 📦 Dependencies Installed by npm

### Backend Dependencies (Installed Automatically)

```json
{
  "express": "^4.18.2",           // Web framework
  "cors": "^2.8.5",               // Cross-origin requests
  "better-sqlite3": "^9.2.2",     // SQLite database
  "date-fns": "^3.0.6"            // Date manipulation
}
```

**Development Dependencies**:
```json
{
  "nodemon": "^3.0.2",            // Auto-reload server
  "jest": "^29.7.0"               // Testing framework
}
```

### Frontend Dependencies (Installed Automatically)

```json
{
  "react": "^18.2.0",             // UI framework
  "react-dom": "^18.2.0",         // React DOM rendering
  "axios": "^1.6.2",              // HTTP client
  "date-fns": "^3.0.6",           // Date utilities
  "lucide-react": "^0.294.0"      // Icon library
}
```

**Development Dependencies**:
```json
{
  "vite": "^5.0.8",               // Build tool
  "@vitejs/plugin-react": "^4.2.1", // React support
  "tailwindcss": "^3.3.6",        // CSS framework
  "autoprefixer": "^10.4.16",     // CSS vendor prefixes
  "postcss": "^8.4.32"            // CSS processing
}
```

All dependencies are **free, open-source, and MIT-licensed**.

---

## 🌐 Network Requirements

### During Installation:

- ✅ Internet connection required to download npm packages (~300 MB total)

### During Development/Demo:

- ❌ **No internet connection needed**
- Everything runs on localhost (127.0.0.1)

### Ports Used:

- **3000**: Backend API server
- **5173**: Frontend development server (Vite)

**Note**: If ports are in use, see troubleshooting in `SETUP_INSTRUCTIONS.md`

---

## 💾 File Storage

### Database:

**Location**: `backend/eventsync.db`  
**Type**: SQLite file-based database  
**Size**: ~100 KB (empty), grows with bookings  
**Backup**: Simply copy the .db file

**Related Files**:
- `eventsync.db-shm` (SQLite shared memory)
- `eventsync.db-wal` (Write-ahead log for WAL mode)

### Temporary Files:

**Node Modules**: ~250 MB per folder (backend + frontend)  
Can be deleted and reinstalled anytime with `npm install`

---

## 🔐 Environment Variables

### **None Required!**

The application works out-of-the-box with sensible defaults.

### Optional Environment Variables:

If you want to customize ports, create these files:

**backend/.env** (optional):
```bash
PORT=3000
NODE_ENV=development
```

**frontend/.env** (optional):
```bash
VITE_API_URL=http://localhost:3000/api
```

But these are **not necessary** for the hackathon demo.

---

## 🗂️ Configuration Files

All configuration files are **already created** in the project:

### Backend:
- ✅ `package.json` - Dependencies and scripts
- ✅ `src/config/database.js` - Database configuration

### Frontend:
- ✅ `package.json` - Dependencies and scripts
- ✅ `vite.config.js` - Vite build tool config
- ✅ `tailwind.config.js` - Tailwind CSS config
- ✅ `postcss.config.js` - PostCSS config

**No manual editing required!**

---

## 🚀 First-Time Setup (Complete Walkthrough)

### Total Time: ~10 minutes

#### Minute 0-2: Install Node.js (if not already installed)

1. Visit https://nodejs.org
2. Download LTS version (18.x or higher)
3. Run installer (keep defaults)
4. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### Minute 2-4: Backend Setup

```bash
# Navigate to project
cd path/to/mini/backend

# Install dependencies (~2 minutes)
npm install

# Seed database (~2 seconds)
npm run seed

# Start server
npm start
```

**Expected output**:
```
✓ EventSync Backend Server running on port 3000
```

**Leave this terminal running.**

#### Minute 4-7: Frontend Setup (New Terminal)

```bash
# Navigate to frontend
cd path/to/mini/frontend

# Install dependencies (~3 minutes)
npm install

# Start dev server
npm run dev
```

**Expected output**:
```
➜  Local:   http://localhost:5173/
```

**Leave this terminal running.**

#### Minute 7-8: Verify Setup

1. Open http://localhost:5173 in browser
2. Should see EventSync dashboard
3. Click "Create Booking" tab
4. Verify dropdowns populate (clients, venues)

#### Minute 8-10: Run Tests

```bash
# In backend directory (new terminal)
cd path/to/mini/backend
npm test
```

All 14 tests should pass.

---

## 📊 System Resource Usage

### Disk Space:

- **Backend node_modules**: ~150 MB
- **Frontend node_modules**: ~250 MB
- **Database**: ~100 KB (empty), ~10 MB (1000s of bookings)
- **Source code**: ~5 MB

**Total**: ~405 MB

### Memory (RAM):

- **Backend server**: ~50 MB
- **Frontend dev server**: ~100 MB
- **Browser tab**: ~100 MB

**Total**: ~250 MB

### CPU:

- **Idle**: <1%
- **During booking creation**: ~5-10% (brief spike)
- **During database seed**: ~20% (few seconds)

**Requirements**: Any modern laptop can handle it easily.

---

## 🔄 Reset/Cleanup Commands

### Reset Database Only:

```bash
cd backend
npm run seed
```

This deletes all bookings and recreates the official venue configuration.

### Full Cleanup:

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json eventsync.db
npm install
npm run seed

# Frontend
cd frontend
rm -rf node_modules package-lock.json dist
npm install
```

**Windows users**: Use `rmdir /s` instead of `rm -rf`

---

## 🐛 Troubleshooting Commands

### Check if ports are in use:

**Windows**:
```bash
netstat -ano | findstr :3000
netstat -ano | findstr :5173
```

**macOS/Linux**:
```bash
lsof -i :3000
lsof -i :5173
```

### Kill process on port:

**Windows**:
```bash
taskkill /PID <PID_NUMBER> /F
```

**macOS/Linux**:
```bash
kill -9 <PID_NUMBER>
```

### Check Node.js installation:

```bash
node --version   # Should be 18.x or higher
npm --version    # Should be 9.x or higher
which node       # Shows installation path
```

### Verify backend is running:

```bash
curl http://localhost:3000
```

**Expected response**: JSON with API info

### Verify database was seeded:

```bash
cd backend
ls -lh eventsync.db
```

**Should exist** and be ~100 KB

---

## 📱 Testing the Application

### Manual Testing Checklist:

```bash
# 1. Start servers (see quick reference above)

# 2. Open http://localhost:5173

# 3. Test Dashboard:
- [ ] See statistics (should show 0s initially)
- [ ] Venue utilization shows 3 venues

# 4. Test Create Booking:
- [ ] Client dropdown shows 5 clients
- [ ] Venue dropdown shows 3 venues
- [ ] Can create a successful booking
- [ ] See success message with hall allocation

# 5. Test Rejection:
- [ ] Create overlapping booking in same hall
- [ ] See rejection message or different hall allocation
- [ ] Alternative suggestions appear

# 6. Test Booking List:
- [ ] See created bookings
- [ ] Can filter by status/venue/date
- [ ] Can reschedule a booking
- [ ] Can cancel a booking

# 7. Test Innovation Feature:
- [ ] Create a rejected booking
- [ ] See alternative suggestions
- [ ] Click "Use This" to apply alternative
```

### Automated Testing:

```bash
cd backend
npm test
```

All 14 tests should pass in <5 seconds.

---

## 🎬 Demo Day Commands

### Morning of Demo:

```bash
# 1. Pull latest code (if using git)
git pull

# 2. Reinstall dependencies (to be safe)
cd backend && npm install
cd ../frontend && npm install

# 3. Reset database to clean state
cd ../backend && npm run seed

# 4. Run tests to verify everything works
npm test

# 5. Start backend
npm start
# Leave terminal open

# 6. Start frontend (new terminal)
cd ../frontend
npm run dev
# Leave terminal open

# 7. Open browser
# Navigate to http://localhost:5173

# 8. Create 2-3 sample bookings for demo
# (So dashboard isn't empty)
```

**Total time**: ~5 minutes

---

## 📋 Pre-Demo Checklist

Run these commands to verify readiness:

```bash
# Verify Node.js
node --version
# ✅ Should be v18.x.x or higher

# Backend test
cd backend
npm test
# ✅ All tests should pass

# Start backend
npm start &
# ✅ Should see "running on port 3000"

# Test backend API
curl http://localhost:3000
# ✅ Should return JSON

# Frontend build test
cd ../frontend
npm run build
# ✅ Should create dist/ folder without errors

# Start frontend
npm run dev
# ✅ Should see "Local: http://localhost:5173"

# Open browser and test
# ✅ Dashboard loads
# ✅ Can create booking
# ✅ Booking appears in list
```

---

## 🔑 Key Locations

### Database File:
```
backend/eventsync.db
```

### Logs:
- **Backend**: Visible in terminal running `npm start`
- **Frontend**: Browser DevTools console (F12)

### Configuration:
- **Backend port**: `backend/src/server.js:5` (PORT variable)
- **Frontend proxy**: `frontend/vite.config.js:6` (server.proxy)

---

## 💻 IDE/Editor Setup (Optional)

### Recommended for Code Review:

**VS Code**: Free, excellent JavaScript support
```bash
code .   # Opens current directory in VS Code
```

**Extensions** (optional but helpful):
- ESLint
- Prettier
- Tailwind CSS IntelliSense

### Or use any editor:
- Notepad++ (Windows)
- Sublime Text
- Atom
- WebStorm
- Vim/Emacs

**Not required for running the app!**

---

## 🎯 Summary

### Required Setup:
1. Install Node.js (one-time, 5 minutes)
2. Run `npm install` in backend and frontend (one-time, 5 minutes)
3. Run `npm run seed` in backend (creates database, 5 seconds)

### To Run:
```bash
# Terminal 1
cd backend && npm start

# Terminal 2
cd frontend && npm run dev

# Browser
http://localhost:5173
```

### External Services:
**NONE** ✅

### Internet Required:
**Only for npm install** ✅

### Total Cost:
**$0** ✅

---

**The system is completely self-contained and ready to run with just Node.js installed!**
