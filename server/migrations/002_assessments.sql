CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  competition_slug TEXT NOT NULL REFERENCES competitions(slug) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('diagnostic', 'topic', 'unit', 'mock')),
  time_limit_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_limit_seconds >= 0),
  passing_score REAL NOT NULL DEFAULT 0.7 CHECK (passing_score BETWEEN 0 AND 1),
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assessment_questions (
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  point_value REAL NOT NULL DEFAULT 1 CHECK (point_value > 0),
  PRIMARY KEY (assessment_id, question_id),
  UNIQUE (assessment_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_assessments_competition ON assessments(competition_slug, is_published);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_order ON assessment_questions(assessment_id, sort_order);
