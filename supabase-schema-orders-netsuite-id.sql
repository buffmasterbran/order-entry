-- Add NetSuite Internal ID field to orders table
-- This stores the NetSuite internal ID (numeric) for sales orders that have been pushed to NetSuite

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS netsuite_id TEXT;

-- Create index for netsuite_id to enable quick lookups
CREATE INDEX IF NOT EXISTS idx_orders_netsuite_id ON orders(netsuite_id);

-- Optional: Add a comment to document the field
COMMENT ON COLUMN orders.netsuite_id IS 'NetSuite internal ID (numeric) for the sales order. Used to link to NetSuite sales order page.';
