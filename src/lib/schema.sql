-- NyumbaFlow database schema (PostgreSQL)
--
-- Runs via CREATE TABLE/INDEX IF NOT EXISTS on every cold start (see db.ts),
-- so it's safe to apply repeatedly against the same database.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('LANDLORD', 'TENANT', 'CARETAKER')),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  national_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'LOGIN',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  landlord_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id),
  label TEXT NOT NULL,
  bedrooms TEXT,
  target_rent REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'VACANT' CHECK (status IN ('VACANT', 'OCCUPIED', 'NOTICE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leases (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  tenant_id TEXT NOT NULL REFERENCES users(id),
  monthly_rent REAL NOT NULL,
  security_deposit REAL NOT NULL,
  service_charge REAL NOT NULL DEFAULT 0,
  move_in_date TEXT NOT NULL,
  lease_term_months INTEGER NOT NULL DEFAULT 12,
  rent_due_day INTEGER NOT NULL DEFAULT 5,
  late_fee_per_day REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_SIGNATURE', 'PENDING_PAYMENT', 'ACTIVE', 'TERMINATED')),
  signature_name TEXT,
  signature_national_id TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  lease_id TEXT NOT NULL REFERENCES leases(id),
  kplc_meter_reading REAL,
  kplc_meter_number TEXT,
  water_meter_reading REAL,
  water_meter_number TEXT,
  rooms_json TEXT NOT NULL DEFAULT '[]',
  tenant_signed_off INTEGER NOT NULL DEFAULT 0,
  caretaker_signed_off INTEGER NOT NULL DEFAULT 0,
  keys_handed_over INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rent_invoices (
  id TEXT PRIMARY KEY,
  lease_id TEXT NOT NULL REFERENCES leases(id),
  period TEXT NOT NULL, -- e.g. '2024-11'
  amount_due REAL NOT NULL,
  amount_paid REAL NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DUE' CHECK (status IN ('DUE', 'PARTIAL', 'PAID', 'OVERDUE')),
  is_move_in_invoice INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES rent_invoices(id),
  lease_id TEXT REFERENCES leases(id),
  tenant_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('MPESA', 'AIRTEL', 'CARD', 'BANK')),
  phone_number TEXT,
  provider TEXT NOT NULL DEFAULT 'INTASEND',
  intasend_invoice_id TEXT,
  intasend_tracking_id TEXT,
  intasend_checkout_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED')),
  failure_reason TEXT,
  raw_webhook_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES units(id),
  property_id TEXT NOT NULL REFERENCES properties(id),
  reported_by TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN ('PLUMBING', 'ELECTRICAL', 'CARPENTRY', 'OTHER')),
  title TEXT NOT NULL,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('URGENT', 'NORMAL')),
  status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'ASSIGNED', 'QUOTED', 'REPAIRED', 'PAID')),
  contractor_name TEXT,
  contractor_phone TEXT,
  quote_amount REAL,
  quote_approved INTEGER NOT NULL DEFAULT 0,
  photo_urls_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  posted_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_lease ON rent_invoices(lease_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_tickets_property ON maintenance_tickets(property_id);
