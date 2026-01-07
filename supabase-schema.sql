-- Supabase Database Schema for Order Entry System

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  netsuite_id TEXT,
  entityid TEXT NOT NULL,
  companyname TEXT NOT NULL,
  email TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  netsuite_id TEXT,
  addr1 TEXT,
  addr2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  addressee TEXT,
  addrtext TEXT,
  type TEXT CHECK (type IN ('ship', 'bill')),
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  netsuite_id TEXT,
  entityid TEXT NOT NULL,
  firstname TEXT,
  lastname TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  netsuite_id TEXT,
  itemid TEXT NOT NULL,
  displayname TEXT NOT NULL,
  baseprice NUMERIC,
  quantityavailable NUMERIC,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  ship_address_id TEXT REFERENCES addresses(id) ON DELETE SET NULL,
  bill_address_id TEXT REFERENCES addresses(id) ON DELETE SET NULL,
  items JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'synced', 'pushed')),
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_entityid ON customers(entityid);
CREATE INDEX IF NOT EXISTS idx_customers_companyname ON customers(companyname);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_customer ON contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_entityid ON contacts(entityid);
CREATE INDEX IF NOT EXISTS idx_items_itemid ON items(itemid);
CREATE INDEX IF NOT EXISTS idx_items_displayname ON items(displayname);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);




