-- Add color column to items table
-- This stores the item color name from NetSuite's custitem_item_color field

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS color TEXT;

-- Create index for color queries (optional, useful if filtering by color)
CREATE INDEX IF NOT EXISTS idx_items_color ON items(color);

