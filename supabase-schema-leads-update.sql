-- Add new fields to leads table for enhanced lead tracking
-- Engagement Level, Interest Timeline, Product Interest, Competitor Info, Follow-up Type

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS engagement_level TEXT CHECK (engagement_level IN ('Hot', 'Warm', 'Cold')),
ADD COLUMN IF NOT EXISTS interest_timeline TEXT CHECK (interest_timeline IN ('Immediate', '1-2 months', 'Long-term')),
ADD COLUMN IF NOT EXISTS product_interest TEXT,
ADD COLUMN IF NOT EXISTS competitor_info TEXT,
ADD COLUMN IF NOT EXISTS follow_up_type TEXT CHECK (follow_up_type IN ('Personal Touch', 'AI Sequence'));

-- Create indexes for better query performance on new fields
CREATE INDEX IF NOT EXISTS idx_leads_engagement_level ON leads(engagement_level);
CREATE INDEX IF NOT EXISTS idx_leads_interest_timeline ON leads(interest_timeline);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_type ON leads(follow_up_type);
