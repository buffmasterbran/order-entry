-- Migrate leads table from single 'name' field to 'first_name' and 'last_name' fields
-- This migration:
-- 1. Adds first_name and last_name columns
-- 2. Migrates existing name data (splits on first space)
-- 3. Drops the old name column
-- 4. Updates indexes

-- Step 1: Add new columns (nullable initially for migration)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Step 2: Migrate existing name data
-- Split name on first space: first part -> first_name, rest -> last_name
UPDATE leads 
SET 
  first_name = CASE 
    WHEN name LIKE '% %' THEN SPLIT_PART(name, ' ', 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN name LIKE '% %' THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
    ELSE NULL
  END
WHERE first_name IS NULL;

-- Step 3: Make first_name NOT NULL (since it's required)
ALTER TABLE leads 
ALTER COLUMN first_name SET NOT NULL;

-- Step 4: Drop the old name column
ALTER TABLE leads 
DROP COLUMN IF EXISTS name;

-- Step 5: Update indexes (drop old name index, add new indexes)
DROP INDEX IF EXISTS idx_leads_name;
CREATE INDEX IF NOT EXISTS idx_leads_first_name ON leads(first_name);
CREATE INDEX IF NOT EXISTS idx_leads_last_name ON leads(last_name);
