-- Add ship_date, notes, and credit_card fields to orders table

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS ship_date DATE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS credit_card JSONB;

-- Update status check constraint to include 'submitted'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('draft', 'submitted', 'synced', 'pushed'));




