-- Add pricelevel column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS pricelevel TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_pricelevel ON customers(pricelevel);


