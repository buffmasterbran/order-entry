-- Update follow_up_type to include 'Send to Rep' as a valid option
-- This migration adds 'Send to Rep' to the follow_up_type field

-- First, drop any existing CHECK constraint on follow_up_type if it exists
ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_follow_up_type_check;

-- Add new CHECK constraint that includes 'Send to Rep'
-- This allows: 'Personal Touch', 'AI Sequence', or 'Send to Rep'
ALTER TABLE leads
ADD CONSTRAINT leads_follow_up_type_check 
CHECK (follow_up_type IS NULL OR follow_up_type IN ('Personal Touch', 'AI Sequence', 'Send to Rep'));
