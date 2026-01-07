-- Remove the price_levels JSONB column (if it exists)
ALTER TABLE items 
DROP COLUMN IF EXISTS price_levels;

DROP INDEX IF EXISTS idx_items_price_levels;

-- Add individual columns for each price level
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS promotional_listed NUMERIC, -- Price Level 3
ADD COLUMN IF NOT EXISTS promotional_distributor NUMERIC; -- Price Level 14

-- Note: msrp (Price Level 1) and wholesale (Price Level 4) already exist


