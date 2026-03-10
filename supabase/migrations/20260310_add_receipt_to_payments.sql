-- Add receipt columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_data jsonb;

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_payments_receipt_number ON payments(receipt_number);
