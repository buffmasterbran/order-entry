-- Add Send to Rep and Billing Zipcode fields to leads table

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS send_to_rep TEXT CHECK (send_to_rep IN ('Yes', 'No')),
ADD COLUMN IF NOT EXISTS billing_zipcode TEXT;

-- Create index for billing_zipcode if needed for searches
CREATE INDEX IF NOT EXISTS idx_leads_billing_zipcode ON leads(billing_zipcode);

-- Create index for send_to_rep if needed for filtering
CREATE INDEX IF NOT EXISTS idx_leads_send_to_rep ON leads(send_to_rep);
