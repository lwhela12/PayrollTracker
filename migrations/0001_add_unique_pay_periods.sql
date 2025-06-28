-- Add unique index to prevent duplicate pay periods for same employer and start date
CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_periods_employer_start_date
  ON pay_periods (employer_id, start_date);