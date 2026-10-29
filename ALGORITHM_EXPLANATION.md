# EventSync Scheduling Algorithm - Technical Deep Dive

## Overview

This document explains the core scheduling algorithm used in EventSync, covering hall selection, resource allocation, conflict detection, and edge case handling.

---

## Algorithm Phases

### Phase 1: Input Validation

**Purpose**: Reject invalid requests early before resource allocation

**Implementation**: `src/services/validationService.js`

```javascript
validateBookingRequest(request) {
  // 1. Client exists
  // 2. Event name not empty
  // 3. Date in valid format (YYYY-MM-DD) and not in past
  // 4. Time in valid format (HH:MM)
  // 5. Start time < End time
  // 6. Attendees > 0
  // 7. Resource requests >= 0
  // 8. Preferred venue exists
  // 9. Resources don't exceed maximum at ANY venue
}
```

**Why validate against max across all venues?**  
If a request asks for 5 projectors but no venue has more than 3, it's impossible to fulfill regardless of timing. Fail fast.

---

### Phase 2: Reserved Interval Calculation

**Purpose**: Add setup and cleanup buffers consistently

**Implementation**: `src/utils/timeHelpers.js`

```javascript
calculateReservedInterval(dateStr, startTime, endTime) {
  const eventStart = parseDateTime(dateStr, startTime);
  const eventEnd = parseDateTime(dateStr, endTime);
  
  const reservedStart = addMinutes(eventStart, -30);
  const reservedEnd = addMinutes(eventEnd, 30);
  
  return { reservedStart, reservedEnd };
}
```

**Example**:
- Event: 10:00 AM - 12:00 PM
- Reserved: 09:30 AM - 12:30 PM

**All subsequent checks use RESERVED intervals**, not event times.

---

### Phase 3: Operating Hours Validation

**Purpose**: Ensure entire reserved interval fits within 8 AM - 10 PM

**Implementation**: `src/utils/timeHelpers.js`

```javascript
isWithinOperatingHours(reservedStart, reservedEnd) {
  // reservedStart >= 08:00 AND reservedEnd <= 22:00
  return (start >= '08:00') && (end <= '22:00');
}
```

**Edge Cases**:
- Event 07:45-09:00 → Reserved 07:15-09:30 → **REJECTED** (starts too early)
- Event 21:00-22:00 → Reserved 20:30-22:30 → **REJECTED** (ends too late)
- Event 08:30-21:30 → Reserved 08:00-22:00 → **ACCEPTED** (exactly at boundaries)

---

### Phase 4: Hall Selection Algorithm

**Purpose**: Find smallest-sufficient hall at preferred venue, or fallback

**Implementation**: `src/services/schedulingService.js → findAvailableHall()`

#### Algorithm Steps:

```
1. TRY PREFERRED VENUE FIRST
   a. Get all halls with capacity >= attendees
   b. Sort by: capacity ASC, then id ASC (deterministic tie-breaking)
   c. For each hall (smallest to largest):
      i. Check if hall is available during reserved interval
      ii. If available, check if venue resources are available
      iii. If both available, RETURN this hall
   d. If no hall works, continue to step 2

2. TRY OTHER VENUES (in ascending ID order)
   a. Get all other venue IDs, sorted ASC
   b. For each other venue:
      - Repeat step 1.a-1.c
      - If any hall works, RETURN it
   c. If no venue works, return NULL

3. IF NULL
   - Generate detailed rejection reason
   - Create "rejected" booking record
```

#### Why This Order?

1. **Preferred venue first**: User preference honored when possible
2. **Smallest hall first**: Efficient space utilization
3. **Deterministic tie-breaking**: Two halls with capacity 100 → pick lower ID for reproducibility
4. **Ascending venue IDs for fallback**: Ensures predictable behavior

#### Example Scenario

Request: 75 attendees at Venue A

Venue A halls:
- A1: capacity 60 (too small, skip)
- A2: capacity 150 (sufficient, check availability)

If A2 is available and resources work → allocate A2  
If A2 is unavailable → try Venue B (ID=2), then Venue C (ID=3)

Venue B halls:
- B1: capacity 100 (sufficient, check availability)
- B2: capacity 200 (larger, only check if B1 fails)

---

### Phase 5: Hall Availability Check

**Purpose**: Detect time conflicts with existing confirmed bookings

**Implementation**: `src/services/schedulingService.js → isHallAvailable()`

```javascript
isHallAvailable(hallId, eventDate, reservedStart, reservedEnd, excludeBookingId) {
  // Get all CONFIRMED bookings in this hall on this date
  // (excluding the booking being rescheduled, if any)
  
  const conflictingBookings = db.prepare(`
    SELECT reserved_start, reserved_end
    FROM bookings
    WHERE hall_id = ? AND event_date = ? AND status = 'confirmed'
      AND id != ?
  `).all(hallId, eventDate, excludeBookingId || -1);
  
  // Check for interval overlap with each booking
  for (const booking of conflictingBookings) {
    if (checkIntervalOverlap(
      eventDate,
      reservedStart, reservedEnd,
      booking.reserved_start, booking.reserved_end
    )) {
      return false; // Conflict found
    }
  }
  
  return true; // No conflicts
}
```

**Why exclude cancelled/rejected bookings?**  
Only CONFIRMED bookings consume hall resources. Cancelled bookings must not block future reservations.

---

### Phase 6: Interval Overlap Detection

**Purpose**: Determine if two time intervals conflict

**Implementation**: `src/utils/timeHelpers.js → checkIntervalOverlap()`

```javascript
checkIntervalOverlap(dateStr, start1, end1, start2, end2) {
  // Half-open interval rule:
  // Overlap if: A.start < B.end AND B.start < A.end
  
  return (start1 < end2) && (start2 < end1);
}
```

#### Visualization

```
Non-overlapping (touching at boundary):
A: |======|
B:        |======|
A.end = B.start → No overlap (half-open interval)

Overlapping:
A: |======|
B:     |======|
A.start < B.end AND B.start < A.end → Overlap detected
```

#### Examples

| Interval A | Interval B | Overlap? | Reason |
|------------|------------|----------|--------|
| 09:00-11:00 | 11:00-13:00 | **NO** | Touching at boundary (half-open) |
| 09:00-11:00 | 10:59-13:00 | **YES** | 09:00 < 13:00 AND 10:59 < 11:00 |
| 09:00-11:00 | 11:01-13:00 | **NO** | 09:00 < 13:00 BUT 11:01 >= 11:00 |

**Critical Design Decision**: We use strict inequality (`<`) not (`<=`). This means:
- Event 1 ends at 11:00 (reserved until 11:00)
- Event 2 starts at 11:00 (reserved from 11:00)
- **These DO NOT overlap** (touching at exact boundary is allowed)

However, with 30-minute buffers:
- Event 1: 09:00-11:00 → Reserved 08:30-11:30
- Event 2: 11:00-13:00 → Reserved 10:30-13:30
- **These DO overlap** (10:30-13:30 overlaps with 08:30-11:30)

---

### Phase 7: Resource Availability Check (Sweep-Line Algorithm)

**Purpose**: Calculate concurrent resource usage during the reserved interval

**Challenge**: Multiple bookings may overlap partially, each using different quantities of resources.

**Naive Approach (Wrong)**:
```javascript
// Count overlapping bookings
const count = overlappingBookings.length;
const totalProjectors = count * projectorsPerBooking;
// Problem: Not all bookings request the same quantity!
```

**Correct Approach: Sweep-Line Algorithm**

**Implementation**: `src/services/schedulingService.js → areResourcesAvailable()`

```javascript
areResourcesAvailable(venueId, eventDate, reservedStart, reservedEnd, 
                      projectorsRequested, audioRequested, staffRequested,
                      excludeBookingId) {
  
  // 1. Get venue capacity
  const capacity = getVenueResources(venueId);
  
  // 2. Get all overlapping CONFIRMED bookings at this venue
  const overlapping = getOverlappingBookings(venueId, eventDate, 
                                             reservedStart, reservedEnd,
                                             excludeBookingId);
  
  // 3. Create events for interval boundaries
  const events = [];
  
  // Add candidate booking
  events.push({
    time: reservedStart,
    type: 'start',
    projectors: projectorsRequested,
    audio: audioRequested,
    staff: staffRequested
  });
  events.push({
    time: reservedEnd,
    type: 'end',
    projectors: projectorsRequested,
    audio: audioRequested,
    staff: staffRequested
  });
  
  // Add existing bookings
  for (const booking of overlapping) {
    events.push({
      time: booking.reserved_start,
      type: 'start',
      projectors: booking.projectors_requested,
      audio: booking.audio_systems_requested,
      staff: booking.staff_requested
    });
    events.push({
      time: booking.reserved_end,
      type: 'end',
      projectors: booking.projectors_requested,
      audio: booking.audio_systems_requested,
      staff: booking.staff_requested
    });
  }
  
  // 4. Sort events by time (end before start at same time)
  events.sort((a, b) => {
    if (a.time === b.time) return a.type === 'end' ? -1 : 1;
    return a.time.localeCompare(b.time);
  });
  
  // 5. Sweep through events, tracking concurrent usage
  let currentProjectors = 0;
  let currentAudio = 0;
  let currentStaff = 0;
  
  for (const event of events) {
    if (event.type === 'start') {
      currentProjectors += event.projectors;
      currentAudio += event.audio;
      currentStaff += event.staff;
      
      // Check capacity
      if (currentProjectors > capacity.projectors ||
          currentAudio > capacity.audio_systems ||
          currentStaff > capacity.support_staff) {
        return false; // Exceeds capacity
      }
    } else {
      currentProjectors -= event.projectors;
      currentAudio -= event.audio;
      currentStaff -= event.staff;
    }
  }
  
  return true; // Capacity never exceeded
}
```

#### Sweep-Line Example

Venue A: 2 projectors available

Existing bookings:
- Booking 1: 09:30-11:30, requests 1 projector
- Booking 2: 10:30-12:30, requests 1 projector

Candidate: 11:00-13:00, requests 1 projector (reserved 10:30-13:30)

**Events**:
```
09:30 START B1 +1 proj → current = 1
10:30 START B2 +1 proj → current = 2
10:30 START Candidate +1 proj → current = 3 ❌ EXCEEDS CAPACITY (max 2)
```

**Result**: REJECTED (projector shortage during 10:30-11:30)

#### Why Sort End Before Start?

At the exact same time, resources released should be counted before resources consumed. This gives a fair "breathing room" for back-to-back events.

---

### Phase 8: Rejection Reason Generation

**Purpose**: Provide actionable feedback when booking fails

**Implementation**: `src/services/schedulingService.js → generateRejectionReason()`

```javascript
generateRejectionReason(request) {
  const reasons = [];
  
  for (const venue of allVenues) {
    const halls = getHallsWithCapacity(venue, request.attendees);
    
    if (halls.length === 0) {
      reasons.push(`${venue.name}: No hall with sufficient capacity`);
      continue;
    }
    
    const hallAvailable = halls.some(h => isHallAvailable(h, ...));
    const resourcesAvailable = areResourcesAvailable(venue, ...);
    
    if (!hallAvailable) {
      reasons.push(`${venue.name}: All suitable halls booked`);
    } else if (!resourcesAvailable) {
      reasons.push(`${venue.name}: Insufficient projectors/audio/staff`);
    }
  }
  
  return `Cannot accommodate. ${reasons.join('; ')}`;
}
```

**Example Rejection Messages**:
- "Cannot accommodate. Venue A: All suitable halls booked during 10:00-14:00. Venue B: Insufficient projectors (available: 2, needed: 3). Venue C: No hall with sufficient capacity for 300 attendees."

---

## Advanced Features

### Cancellation

```javascript
cancelBooking(bookingId) {
  // 1. Verify booking exists and is confirmed
  // 2. Update status to 'cancelled'
  // 3. Resources automatically released (query filters by status='confirmed')
}
```

**Key**: Cancelled bookings remain in database for history but don't count against resource availability because queries filter `WHERE status = 'confirmed'`.

### Rescheduling (Atomic Operation)

```javascript
rescheduleBooking(bookingId, newRequest) {
  // 1. Load original booking
  // 2. Validate new request
  // 3. Run allocation algorithm WITH exclude_booking_id = bookingId
  //    (This allows booking to "move" without conflicting with itself)
  // 4. If allocation succeeds, UPDATE booking
  // 5. If allocation fails, return error, original booking UNCHANGED
}
```

**Critical**: Passing `exclude_booking_id` prevents a booking from conflicting with its own current allocation.

**Example**:
- Booking #5 currently holds A1 from 10:00-12:00
- User reschedules to 11:00-13:00
- Algorithm checks A1 availability, ignoring booking #5
- If A1 is available at new time, update booking #5
- If not, original booking #5 remains at 10:00-12:00

---

## Time Complexity Analysis

Let:
- V = number of venues (3)
- H = halls per venue (~2)
- B = bookings per date (~10-100)

### Per Booking Request:

1. **Validation**: O(1) database lookups
2. **Hall selection**: O(V × H) = O(6) venues × halls
3. **For each hall**:
   - Hall availability: O(B) to check conflicts
   - Resource availability: O(B log B) for sweep-line sort
4. **Total**: O(V × H × B log B) ≈ O(B log B)

For practical hackathon scale (B ≤ 1000), this is **milliseconds per request**.

### Optimization Opportunities:

1. **Index on (venue_id, event_date, status)**: Already implemented
2. **Caching venue resources**: Rarely change, could cache in memory
3. **Early termination**: Return immediately when preferred venue works

---

## Edge Cases Handled

### 1. Exactly Touching Intervals
- Event A: 10:00-12:00 (reserved 09:30-12:30)
- Event B: 12:30-14:30 (reserved 12:00-15:00)
- **Overlap check**: 09:30 < 15:00 AND 12:00 < 12:30 → **TRUE (overlap)**
- Events that visually touch actually have cleanup/setup overlap

### 2. Zero Resource Requests
- Projectors: 0, Audio: 0, Staff: 0 → Valid, just needs hall

### 3. Equal-Capacity Halls
- Both halls have capacity 100 → Pick lower ID for determinism

### 4. Same-Day Multiple Bookings
- Same client can book multiple events on same day at different times
- Same client can even book at multiple venues simultaneously

### 5. Past Date Prevention
- Validation rejects dates before today

### 6. Midnight Boundary
- Events cannot span midnight (single-day constraint)
- Times handled as strings within a date context

---

## Testing Strategy

See `backend/tests/scheduling.test.js` for 20+ test cases covering:
- ✅ Smallest hall selection
- ✅ Preferred venue priority
- ✅ Fallback venue behavior
- ✅ Hall conflicts
- ✅ Setup buffer conflicts
- ✅ Resource limits (projectors, audio, staff)
- ✅ Operating hours validation
- ✅ Invalid inputs
- ✅ Cancellation and rescheduling
- ✅ Official PDF sample scenario

---

## Summary

The EventSync scheduling algorithm combines:
1. **Multi-level validation** for early failure detection
2. **Deterministic hall selection** with clear priority rules
3. **Sweep-line resource tracking** for accurate concurrent usage calculation
4. **Half-open interval overlap** for standard time conflict detection
5. **Atomic transactions** for safe cancellation and rescheduling
6. **Detailed error messages** for user-friendly feedback

**Time complexity**: O(B log B) per request  
**Space complexity**: O(B) for bookings storage  
**Correctness**: Tested with 20+ scenarios

This design ensures **no double bookings**, **accurate resource allocation**, and **explainable decisions** — critical for a production event management system.
