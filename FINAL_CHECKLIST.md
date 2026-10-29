# ✅ EventSync - Final Pre-Demo Checklist

Print this and check off items as you complete them!

---

## 📅 ONE WEEK BEFORE DEMO

- [ ] Node.js v18+ installed
- [ ] Project files extracted to accessible location
- [ ] Read `START_HERE.md` completely
- [ ] Read `README.md` for project understanding
- [ ] Backend dependencies installed (`npm install`)
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Database seeded (`npm run seed`)
- [ ] All tests pass (`npm test`)
- [ ] Application runs successfully
- [ ] Created at least 3 sample bookings

---

## 📘 ONE DAY BEFORE DEMO

### Documentation Review

- [ ] Read `HACKATHON_PRESENTATION.md` (demo script)
- [ ] Read `ALGORITHM_EXPLANATION.md` (algorithm deep dive)
- [ ] Reviewed Q&A section (anticipated judge questions)
- [ ] Understand smallest-hall-first selection
- [ ] Understand sweep-line resource algorithm
- [ ] Understand 30-minute buffer logic
- [ ] Can explain interval overlap detection

### Demo Preparation

- [ ] Practiced 7-minute demo flow
- [ ] Timed yourself (should be 6-7 minutes)
- [ ] Created realistic sample scenario
- [ ] Tested rejection and alternatives feature
- [ ] Tested cancellation feature
- [ ] Tested rescheduling feature
- [ ] Screenshots taken as backup
- [ ] Demo notes printed/accessible

### Technical Verification

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Database populated with correct venue data
- [ ] All 14 tests passing
- [ ] Dashboard shows correct statistics
- [ ] No console errors in browser
- [ ] Tested on actual demo machine

---

## 🌅 MORNING OF DEMO

### Hardware

- [ ] Laptop fully charged
- [ ] Charger packed
- [ ] Mouse (optional but nice)
- [ ] Backup laptop/plan (if available)
- [ ] HDMI/adapter cable (if presenting on projector)

### Software

- [ ] Node.js still installed (`node --version`)
- [ ] Backend dependencies OK (`npm install` to be safe)
- [ ] Frontend dependencies OK (`npm install` to be safe)
- [ ] Database fresh (`npm run seed`)
- [ ] Tests still pass (`npm test`)
- [ ] Git status clean (if using Git)

### Environment

- [ ] Close unnecessary applications
- [ ] Free up RAM (>2GB available)
- [ ] Clear browser cache
- [ ] Disable notifications
- [ ] Set "Do Not Disturb" mode
- [ ] Increase screen brightness
- [ ] Set readable font size
- [ ] Background apps closed

### Demo Data

- [ ] Database seeded with clean data
- [ ] 2-3 sample bookings created (so dashboard isn't empty)
- [ ] Know client names you'll use in demo
- [ ] Know venue names and capacities
- [ ] Sample scenario prepared (from presentation doc)

---

## ⏰ 30 MINUTES BEFORE DEMO

### Start Services

- [ ] Terminal 1: `cd backend && npm start`
  - [ ] Verify: "running on port 3000"
  - [ ] Keep terminal visible
  
- [ ] Terminal 2: `cd frontend && npm run dev`
  - [ ] Verify: "Local: http://localhost:5173"
  - [ ] Keep terminal visible

- [ ] Browser: http://localhost:5173 opened
  - [ ] Dashboard loads
  - [ ] Shows non-zero statistics
  - [ ] No console errors

### Final Checks

- [ ] Create one test booking (verify everything works)
- [ ] Check that booking appears in list
- [ ] Verify reschedule modal opens
- [ ] Verify cancel confirmation appears
- [ ] WiFi/internet OFF (if presenting offline)
- [ ] Volume muted (no notification sounds)
- [ ] Full screen browser ready
- [ ] Demo notes visible/printed

### Backup Plan

- [ ] Screenshots in accessible folder
- [ ] Code files easy to navigate to
- [ ] `HACKATHON_PRESENTATION.md` open in another window
- [ ] Test results copied (output of `npm test`)
- [ ] Alternative demo approach ready

---

## 🎤 DURING DEMO (7 MINUTES)

### 0:00 - 0:30 | Introduction
- [ ] Introduce EventSync
- [ ] State the problem it solves
- [ ] Mention 3 venues, multi-client scheduling

### 0:30 - 1:15 | Problem Context
- [ ] Show venue configuration (docs or dashboard)
- [ ] Explain operating hours (8 AM - 10 PM)
- [ ] Explain 30-minute buffers
- [ ] Mention shared resources concept

### 1:15 - 2:15 | Demo Part 1: Success
- [ ] Navigate to Create Booking
- [ ] Fill form: 120 attendees, Venue A
- [ ] Submit and show success
- [ ] Point out: "Allocated A2 (smallest sufficient)"
- [ ] Point out: Reserved interval shown

### 2:15 - 3:15 | Demo Part 2: Overlap Handling
- [ ] Create overlapping booking: 50 attendees
- [ ] Submit
- [ ] Show: "Allocated A1 (different hall)"
- [ ] Explain: Both confirmed, different halls

### 3:15 - 4:15 | Demo Part 3: Rejection + Innovation
- [ ] Create third booking (will reject)
- [ ] Submit
- [ ] Show rejection message
- [ ] Click "Show Alternative Suggestions"
- [ ] Explain innovation feature
- [ ] Highlight: System suggests feasible alternatives

### 4:15 - 5:00 | Demo Part 4: Management
- [ ] Navigate to View Bookings
- [ ] Show one booking
- [ ] Click Reschedule
- [ ] Change time (submit or cancel)
- [ ] Click Cancel on another booking
- [ ] Confirm cancellation

### 5:00 - 6:00 | Technical Highlights
- [ ] Explain hall selection algorithm
- [ ] Mention sweep-line for resources
- [ ] Mention half-open interval overlap
- [ ] State: SQLite database with ACID
- [ ] Mention: Atomic rescheduling

### 6:00 - 6:30 | Testing
- [ ] Switch to terminal
- [ ] Show `npm test` output (or pre-captured)
- [ ] State: "All 14 scenarios pass"
- [ ] Mention: PDF sample scenario included

### 6:30 - 7:00 | Conclusion
- [ ] Summarize features
- [ ] Restate innovation (alternatives)
- [ ] Thank judges
- [ ] Invite questions

---

## 🙋 DURING Q&A

### Be Ready For:

- [ ] "How do you handle concurrent requests?"
  - → SQLite WAL mode, synchronous operations
  
- [ ] "Why sweep-line algorithm?"
  - → Different bookings use different resource quantities
  
- [ ] "Why smallest hall first?"
  - → Efficient space utilization, best-fit strategy
  
- [ ] "What if two halls same capacity?"
  - → Deterministic tie-breaking by hall ID
  
- [ ] "How do you ensure atomicity in rescheduling?"
  - → Single UPDATE after validation, exclude self from conflicts
  
- [ ] "Time complexity?"
  - → O(V × H × B log B), efficient for hackathon scale
  
- [ ] "Why SQLite not PostgreSQL?"
  - → Zero config, ACID compliant, perfect for scale
  
- [ ] "Can you explain the 30-minute buffers?"
  - → Setup before event, cleanup after, both included in reservation
  
- [ ] "What's the innovation?"
  - → Alternative time slot suggestions when booking rejected
  
- [ ] "How would you scale this?"
  - → Indexes, caching, parallel venue search, PostgreSQL

See `HACKATHON_PRESENTATION.md` for detailed answers!

---

## 📊 SUCCESS METRICS

At the end of demo, judges should have seen:

- [ ] ✅ Successful booking (confirms smallest hall selection)
- [ ] ✅ Overlapping bookings handled (different halls)
- [ ] ✅ Booking rejection with clear reason
- [ ] ✅ Alternative suggestions (innovation feature)
- [ ] ✅ Rescheduling capability
- [ ] ✅ Cancellation capability
- [ ] ✅ Real-time statistics dashboard
- [ ] ✅ Test suite passing
- [ ] ✅ Clear algorithm explanation
- [ ] ✅ Professional UI

---

## 🎯 POST-DEMO

### Immediately After:

- [ ] Save application state (don't close!)
- [ ] Keep terminals running (judges may want to see again)
- [ ] Be ready to answer follow-up questions
- [ ] Show code if requested
- [ ] Demonstrate edge cases if asked

### Reflection:

- [ ] What went well?
- [ ] What would you improve?
- [ ] Any unexpected questions?
- [ ] Technical issues encountered?

---

## 🚨 EMERGENCY PROCEDURES

### If Backend Won't Start:

1. Check port: `netstat -ano | findstr :3000` (Windows)
2. Kill process or change port
3. Restart: `npm start`
4. Show backup screenshots

### If Frontend Won't Start:

1. Check port: `netstat -ano | findstr :5173`
2. Let Vite use next port (5174)
3. Update browser URL accordingly
4. Show backup screenshots

### If Demo Breaks:

1. STAY CALM
2. Show pre-captured screenshots
3. Explain what should happen
4. Walk through code instead
5. Show test output
6. Restart services if time permits

### If Tests Fail:

1. Check database: `npm run seed`
2. Retry: `npm test`
3. Show previous test output screenshot
4. Explain test scenarios verbally

---

## 💯 CONFIDENCE BOOSTERS

Before you go in, remember:

- ✅ You have a COMPLETE, WORKING system
- ✅ Every requirement is implemented
- ✅ Algorithm is correct and tested
- ✅ Code is clean and documented
- ✅ You CAN explain every design decision
- ✅ Innovation feature adds real value
- ✅ Professional UI that judges will see
- ✅ Comprehensive test coverage

**You've got this! 🚀**

---

## 📝 NOTES SECTION

Use this space for last-minute reminders:

Venue Configuration:
- Venue A: A1(60), A2(150), 2 proj, 2 audio, 5 staff
- Venue B: B1(100), B2(200), 2 proj, 1 audio, 4 staff
- Venue C: C1(80), C2(250), 3 proj, 2 audio, 6 staff

Sample Clients:
- TechCorp Solutions
- Marketing Masters
- Innovation Labs

Operating Hours: 8:00 AM - 10:00 PM
Buffers: 30 minutes before + 30 minutes after

---

**Check off ALL items before demo!**

**GOOD LUCK! 🎉**
