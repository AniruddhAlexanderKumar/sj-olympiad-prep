ALTER TABLE questions ADD COLUMN rubric_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE question_attempts ADD COLUMN review_status TEXT NOT NULL DEFAULT 'reviewed' CHECK (review_status IN ('reviewed', 'pending'));
ALTER TABLE question_attempts ADD COLUMN reviewer_feedback TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_pending_proof_reviews ON question_attempts(review_status, created_at DESC);
