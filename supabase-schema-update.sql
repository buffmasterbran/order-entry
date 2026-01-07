-- Add msrp and wholesale price columns to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS msrp NUMERIC;
ALTER TABLE items ADD COLUMN IF NOT EXISTS wholesale NUMERIC;




