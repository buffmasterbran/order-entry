-- Clear all data from Supabase database
-- Run this in the Supabase SQL Editor

-- Option 1: Simple version (uses CASCADE deletes - RECOMMENDED)
-- Since addresses, contacts, and orders have ON DELETE CASCADE from customers,
-- deleting customers will automatically delete them
DELETE FROM customers;  -- This cascades to addresses, contacts, and orders
DELETE FROM items;
DELETE FROM users;

-- Option 2: Explicit version (more control)
-- Uncomment below and comment out Option 1 if you want explicit control
-- DELETE FROM orders;
-- DELETE FROM addresses;
-- DELETE FROM contacts;
-- DELETE FROM customers;
-- DELETE FROM items;
-- DELETE FROM users;

-- Option 3: TRUNCATE (faster, but requires disabling triggers temporarily)
-- WARNING: TRUNCATE resets auto-increment sequences and is not reversible
-- Uncomment and use if you want a faster clear (use with caution)
-- TRUNCATE TABLE orders, addresses, contacts, customers, items, users CASCADE;

