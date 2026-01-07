-- Add partner field to customers table
-- This stores the NetSuite ID of the sales rep (partner) assigned to each customer
-- Used for filtering customers by sales rep for access control

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS partner TEXT;

-- Add index for faster lookups when filtering by partner
CREATE INDEX IF NOT EXISTS idx_customers_partner ON customers(partner);


