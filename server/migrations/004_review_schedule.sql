CREATE TABLE IF NOT EXISTS review_schedule (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  interval_days INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  last_answered_at TEXT NOT NULL,
  next_due_at TEXT NOT NULL,
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_review_due ON review_schedule(user_id, next_due_at);
