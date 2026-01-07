-- Add priceLevels JSONB column to items table to store all price levels
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS price_levels JSONB;

-- Create index for JSONB queries (optional, but can help with queries on price levels)
CREATE INDEX IF NOT EXISTS idx_items_price_levels ON items USING GIN (price_levels);


