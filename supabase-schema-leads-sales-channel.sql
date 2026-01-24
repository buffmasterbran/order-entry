-- Add Sales Channel field to leads table
-- Options: General Gift, Golf, Promotional

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS sales_channel TEXT;

-- Add CHECK constraint for allowed values
ALTER TABLE leads
DROP CONSTRAINT IF EXISTS leads_sales_channel_check;

ALTER TABLE leads
ADD CONSTRAINT leads_sales_channel_check
CHECK (sales_channel IS NULL OR sales_channel IN ('General Gift', 'Golf', 'Promotional'));

-- Optional index for filtering by sales channel
CREATE INDEX IF NOT EXISTS idx_leads_sales_channel ON leads(sales_channel);
