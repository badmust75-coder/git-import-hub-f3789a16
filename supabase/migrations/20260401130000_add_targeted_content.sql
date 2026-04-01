-- Add targeted content support: admin can send content to a specific student
-- target_user_id NULL = visible by all students (existing behavior)
-- target_user_id set = only visible to that student
ALTER TABLE sourate_content ADD COLUMN IF NOT EXISTS target_user_id UUID;
ALTER TABLE sourate_content ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

ALTER TABLE nourania_lesson_content ADD COLUMN IF NOT EXISTS target_user_id UUID;
ALTER TABLE nourania_lesson_content ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
