-- Remove CHECK constraints from leads table that are now freeform text fields
-- This allows interest_timeline to accept any text value instead of just the old dropdown values

-- Remove the interest_timeline CHECK constraint
ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_interest_timeline_check;

-- Note: The engagement_level and follow_up_type constraints should remain
-- as they are still dropdown fields with specific values
