-- Add notes field to order items
-- Note: Order items are stored as JSONB in the orders.items column,
-- so this is primarily for documentation. The notes field will be
-- stored as part of the JSONB structure.

-- No actual ALTER TABLE needed since items are stored as JSONB
-- This migration file documents the change to the OrderItem interface

-- Example structure after this change:
-- {
--   "item_id": "abc123",
--   "quantity": 3,
--   "price": 15.99,
--   "notes": "Special packaging requested"
-- }

-- If you need to query items with notes in the future, you can use JSONB queries:
-- SELECT * FROM orders WHERE items @> '[{"notes": {"$ne": null}}]'::jsonb;

