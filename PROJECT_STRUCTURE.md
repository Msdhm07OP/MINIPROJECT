# EventSync Project Structure

## Directory Layout

```
mini/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # Database connection and initialization
│   │   ├── models/
│   │   │   ├── Venue.js             # Venue model
│   │   │   ├── Hall.js              # Hall model
│   │   │   ├── Client.js            # Client model
│   │   │   └── Booking.js           # Booking model
│   │   ├── services/
│   │   │   ├── schedulingService.js # Core scheduling algorithm
│   │   │   └── validationService.js # Input validation
│   │   ├── routes/
│   │   │   ├── venues.js            # Venue endpoints
│   │   │   ├── clients.js           # Client endpoints
│   │   │   └── bookings.js          # Booking endpoints
│   │   ├── middleware/
│   │   │   └── errorHandler.js      # Error handling
│   │   ├── utils/
│   │   │   └── timeHelpers.js       # Time calculation utilities
│   │   └── server.js                # Express app entry point
│   ├── tests/
│   │   └── scheduling.test.js       # Comprehensive test suite
│   ├── package.json
│   └── seed.js                      # Initial data seeding
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx        # Main dashboard
│   │   │   ├── BookingForm.jsx      # Create booking form
│   │   │   ├── BookingList.jsx      # View bookings
│   │   │   ├── VenueView.jsx        # Venue details
│   │   │   └── RecommendationModal.jsx  # Innovation: Alternative suggestions
│   │   ├── services/
│   │   │   └── api.js               # API client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── docs/
│   ├── IMPLEMENTATION_GUIDE.md      # Technical documentation
│   ├── HACKATHON_PRESENTATION.md    # Demo script
│   └── ALGORITHM_EXPLANATION.md     # Scheduling algorithm details
│
├── README.md
├── .gitignore
└── SETUP_INSTRUCTIONS.md
```

## Key Components

### Backend Services

**schedulingService.js** - Core business logic:
- `validateBookingRequest()` - Input validation
- `calculateReservedInterval()` - Add 30-min buffers
- `checkIntervalOverlap()` - Detect time conflicts
- `findAvailableHall()` - Hall selection algorithm
- `checkResourceAvailability()` - Shared resource validation
- `confirmBooking()` - Create confirmed booking
- `cancelBooking()` - Release resources
- `rescheduleBooking()` - Atomic rescheduling

**validationService.js** - Request validation:
- Operating hours enforcement
- Data type and range validation
- Business rule validation

### Frontend Components

**Dashboard.jsx** - Real-time statistics:
- Total/confirmed/rejected/cancelled counts
- Venue utilization metrics
- Upcoming events calendar

**BookingForm.jsx** - Event creation:
- Client selection/creation
- Date/time pickers
- Venue preference
- Resource quantity inputs
- Real-time validation feedback

**RecommendationModal.jsx** - Innovation feature:
- Alternative time slots
- Alternative venues
- Feasibility explanations
- One-click rebooking

### Database Schema

**venues** - id, name
**halls** - id, venue_id, name, capacity
**venue_resources** - venue_id, projectors, audio_systems, support_staff
**clients** - id, name, email, phone, organization
**bookings** - id, client_id, hall_id, venue_id, event_name, event_date, event_start, event_end, reserved_start, reserved_end, attendees, projectors_requested, audio_systems_requested, staff_requested, status, rejection_reason, created_at, updated_at

Status values: 'confirmed', 'cancelled', 'rejected'
