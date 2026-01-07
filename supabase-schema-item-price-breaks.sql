-- Replace individual price columns with price_breaks JSONB column
-- This stores quantity-based pricing breaks for each price level

-- Remove old price columns
ALTER TABLE items 
DROP COLUMN IF EXISTS msrp,
DROP COLUMN IF EXISTS wholesale,
DROP COLUMN IF EXISTS promotional_listed,
DROP COLUMN IF EXISTS promotional_distributor,
DROP COLUMN IF EXISTS baseprice;

-- Add price_breaks JSONB column
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS price_breaks JSONB;

-- Create GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_items_price_breaks ON items USING GIN (price_breaks);

-- Example structure of price_breaks:
-- {
--   "1": [{ "quantity": 1, "price": 44.00 }],  -- MSRP (no breaks)
--   "4": [{ "quantity": 1, "price": 15.50 }],  -- Wholesale (no breaks)
--   "3": [  -- Promotional (Listed)
--     { "quantity": 1, "price": 44.00 },
--     { "quantity": 48, "price": 34.76 },
--     { "quantity": 192, "price": 32.56 },
--     { "quantity": 480, "price": 31.24 },
--     { "quantity": 960, "price": 30.36 }
--   ],
--   "14": [  -- Promotional (Distributor)
--     { "quantity": 1, "price": 44.00 },
--     { "quantity": 24, "price": 30.80 },
--     { "quantity": 48, "price": 24.33 },
--     { "quantity": 192, "price": 22.79 },
--     { "quantity": 480, "price": 21.24 },
--     { "quantity": 960, "price": 20.04 }
--   ]
-- }


