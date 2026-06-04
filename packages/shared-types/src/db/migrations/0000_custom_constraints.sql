-- Custom constraints that Drizzle ORM cannot express natively
-- Run after the main Drizzle-generated migration

-- Enable btree_gist extension for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Exclusion constraint: prevent double-booking on the same schedule link
-- Only applies to non-cancelled bookings
ALTER TABLE bookings ADD CONSTRAINT no_double_booking
EXCLUDE USING GIST (
    schedule_link_id WITH =,
    tstzrange(start_time, end_time) WITH &&
) WHERE (status != 'cancelled');

-- CHECK constraints for data integrity

-- day_of_week must be 0-6 (Sunday=0 through Saturday=6)
ALTER TABLE availability_rules ADD CONSTRAINT chk_day_of_week
CHECK (day_of_week >= 0 AND day_of_week <= 6);

-- end_time must be after start_time
ALTER TABLE availability_rules ADD CONSTRAINT chk_time_range
CHECK (end_time > start_time);

-- calendar_accounts.provider limited to known values
ALTER TABLE calendar_accounts ADD CONSTRAINT chk_provider
CHECK (provider IN ('google', 'outlook', 'icloud'));

-- bookings.status limited to known values
ALTER TABLE bookings ADD CONSTRAINT chk_booking_status
CHECK (status IN ('confirmed', 'cancelled', 'rescheduled'));

-- schedule_rules.rule_type limited to known values
ALTER TABLE schedule_rules ADD CONSTRAINT chk_rule_type
CHECK (rule_type IN (
    'buffer_before',
    'buffer_after',
    'daily_limit',
    'weekly_limit',
    'monthly_limit',
    'min_notice_hours',
    'max_future_days'
));

-- schedule_rules.rule_value must be positive
ALTER TABLE schedule_rules ADD CONSTRAINT chk_rule_value_positive
CHECK (rule_value > 0);
