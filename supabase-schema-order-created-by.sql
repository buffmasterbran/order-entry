-- Add created_by field to orders table
-- This stores the username of the user who created the order

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS created_by TEXT;


