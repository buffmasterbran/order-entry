-- Add sales_rep_id field to users table
-- This stores the NetSuite ID of the sales rep (partner) that the employee is tied to
-- This allows filtering customers by sales rep for access control

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS sales_rep_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS users_sales_rep_id_idx ON users(sales_rep_id);


