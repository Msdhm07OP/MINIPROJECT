-- EventSync 2.0 Initial Schema Migration
-- Migration: 001_initial_schema
-- Description: Core tables with proper constraints, indexes, and audit support

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- =============================================================================
-- CORE ENTITIES
-- =============================================================================

-- Venues
CREATE TABLE venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venues_name ON venues(name);

-- Halls
CREATE TABLE halls (
    id SERIAL PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
    name VARCHAR(50) NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(venue_id, name)
);

CREATE INDEX idx_halls_venue ON halls(venue_id);
CREATE INDEX idx_halls_capacity ON halls(capacity);
CREATE INDEX idx_halls_active ON halls(is_active) WHERE is_active = true;

-- Resource Types (projectors, audio systems, support staff)
CREATE TABLE resource_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    unit VARCHAR(20) NOT NULL DEFAULT 'units',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resource_types_name ON resource_types(name);

-- Venue Resource Capacity
CREATE TABLE venue_resource_capacity (
    id SERIAL PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    resource_type_id INTEGER NOT NULL REFERENCES resource_types(id) ON DELETE RESTRICT,
    capacity INTEGER NOT NULL CHECK (capacity >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(venue_id, resource_type_id)
);

CREATE INDEX idx_venue_resources_venue ON venue_resource_capacity(venue_id);
CREATE INDEX idx_venue_resources_type ON venue_resource_capacity(resource_type_id);

-- Clients
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    organization VARCHAR(200),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_email ON clients(email) WHERE email IS NOT NULL;
CREATE INDEX idx_clients_active ON clients(is_active) WHERE is_active = true;

-- =============================================================================
-- BOOKINGS
-- =============================================================================

-- Booking Status Enum
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'rejected');

-- Bookings
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    hall_id INTEGER REFERENCES halls(id) ON DELETE RESTRICT,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,

    -- Event details
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    event_start TIME NOT NULL,
    event_end TIME NOT NULL,

    -- Reserved times (including 30-min buffers)
    reserved_start TIME NOT NULL,
    reserved_end TIME NOT NULL,

    attendees INTEGER NOT NULL CHECK (attendees > 0),

    -- Booking state
    status booking_status NOT NULL,
    rejection_reason TEXT,
    rejection_code VARCHAR(50),

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    correlation_id UUID,

    -- Constraints
    CHECK (event_start < event_end),
    CHECK (reserved_start <= event_start),
    CHECK (reserved_end >= event_end),
    CHECK (
        (status = 'confirmed' AND hall_id IS NOT NULL AND rejection_reason IS NULL) OR
        (status = 'rejected' AND rejection_reason IS NOT NULL) OR
        (status = 'cancelled')
    )
);

-- Indexes for bookings
CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_bookings_hall ON bookings(hall_id);
CREATE INDEX idx_bookings_venue ON bookings(venue_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_date ON bookings(event_date);
CREATE INDEX idx_bookings_date_status ON bookings(event_date, status);
CREATE INDEX idx_bookings_venue_date_status ON bookings(venue_id, event_date, status);
CREATE INDEX idx_bookings_uuid ON bookings(uuid);
CREATE INDEX idx_bookings_correlation ON bookings(correlation_id) WHERE correlation_id IS NOT NULL;

-- CRITICAL: Exclusion constraint to prevent overlapping confirmed bookings in same hall
-- Using btree_gist extension for interval overlap detection
ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_hall_bookings
EXCLUDE USING gist (
    hall_id WITH =,
    event_date WITH =,
    tsrange(
        (event_date + reserved_start)::timestamp,
        (event_date + reserved_end)::timestamp
    ) WITH &&
) WHERE (status = 'confirmed');

-- =============================================================================
-- RESOURCE ALLOCATIONS
-- =============================================================================

-- Booking Resource Allocations
CREATE TABLE booking_resource_allocations (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    resource_type_id INTEGER NOT NULL REFERENCES resource_types(id) ON DELETE RESTRICT,
    quantity_allocated INTEGER NOT NULL CHECK (quantity_allocated >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(booking_id, resource_type_id)
);

CREATE INDEX idx_allocations_booking ON booking_resource_allocations(booking_id);
CREATE INDEX idx_allocations_resource ON booking_resource_allocations(resource_type_id);

-- =============================================================================
-- IDEMPOTENCY
-- =============================================================================

-- Idempotency records for preventing duplicate bookings
CREATE TABLE idempotency_records (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(255) NOT NULL,
    request_hash TEXT NOT NULL,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
    response_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE(idempotency_key)
);

CREATE INDEX idx_idempotency_key ON idempotency_records(idempotency_key);
CREATE INDEX idx_idempotency_expires ON idempotency_records(expires_at);

-- =============================================================================
-- AUDIT AND HISTORY
-- =============================================================================

-- Audit event types
CREATE TYPE audit_event_type AS ENUM (
    'booking_requested',
    'booking_confirmed',
    'booking_rejected',
    'booking_cancelled',
    'booking_reschedule_attempted',
    'booking_reschedule_succeeded',
    'booking_reschedule_failed',
    'resource_allocated',
    'resource_released',
    'concurrency_conflict',
    'validation_failed'
);

-- Audit events
CREATE TABLE audit_events (
    id SERIAL PRIMARY KEY,
    event_id UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
    event_type audit_event_type NOT NULL,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    correlation_id UUID,
    actor VARCHAR(100),
    event_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_booking ON audit_events(booking_id);
CREATE INDEX idx_audit_client ON audit_events(client_id);
CREATE INDEX idx_audit_type ON audit_events(event_type);
CREATE INDEX idx_audit_correlation ON audit_events(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_audit_created ON audit_events(created_at DESC);

-- Booking status history
CREATE TABLE booking_status_history (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status booking_status,
    to_status booking_status NOT NULL,
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by VARCHAR(100)
);

CREATE INDEX idx_status_history_booking ON booking_status_history(booking_id);
CREATE INDEX idx_status_history_changed ON booking_status_history(changed_at DESC);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_halls_updated_at BEFORE UPDATE ON halls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venue_resources_updated_at BEFORE UPDATE ON venue_resource_capacity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger for booking status changes
CREATE OR REPLACE FUNCTION log_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO booking_status_history (booking_id, from_status, to_status, reason)
        VALUES (NEW.id, OLD.status, NEW.status, NEW.rejection_reason);
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO booking_status_history (booking_id, from_status, to_status, reason)
        VALUES (NEW.id, NULL, NEW.status, NEW.rejection_reason);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_booking_status AFTER INSERT OR UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION log_booking_status_change();

-- Clean up expired idempotency records
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM idempotency_records WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS FOR ANALYTICS
-- =============================================================================

-- Active bookings view
CREATE VIEW active_bookings AS
SELECT
    b.*,
    h.name as hall_name,
    h.capacity as hall_capacity,
    v.name as venue_name,
    c.name as client_name,
    c.organization as client_organization
FROM bookings b
JOIN venues v ON b.venue_id = v.id
JOIN clients c ON b.client_id = c.id
LEFT JOIN halls h ON b.hall_id = h.id
WHERE b.status = 'confirmed';

-- Resource utilization view
CREATE VIEW resource_utilization AS
SELECT
    v.id as venue_id,
    v.name as venue_name,
    rt.name as resource_type,
    vrc.capacity as total_capacity,
    b.event_date,
    b.reserved_start,
    b.reserved_end,
    SUM(bra.quantity_allocated) as allocated_quantity,
    vrc.capacity - COALESCE(SUM(bra.quantity_allocated), 0) as available_quantity
FROM venues v
JOIN venue_resource_capacity vrc ON v.id = vrc.venue_id
JOIN resource_types rt ON vrc.resource_type_id = rt.id
LEFT JOIN bookings b ON v.id = b.venue_id AND b.status = 'confirmed'
LEFT JOIN booking_resource_allocations bra ON b.id = bra.booking_id AND bra.resource_type_id = rt.id
GROUP BY v.id, v.name, rt.name, vrc.capacity, b.event_date, b.reserved_start, b.reserved_end;

COMMIT;
