CREATE TABLE IF NOT EXISTS competitions (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  level TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  format_json TEXT NOT NULL DEFAULT '{}',
  is_available INTEGER NOT NULL DEFAULT 0 CHECK (is_available IN (0, 1)),
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  grade TEXT NOT NULL DEFAULT '',
  active_competition_slug TEXT REFERENCES competitions(slug) ON DELETE SET NULL,
  daily_goal INTEGER NOT NULL DEFAULT 3 CHECK (daily_goal BETWEEN 1 AND 10),
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  leaderboard_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (leaderboard_opt_in IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE IF NOT EXISTS user_competitions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competition_slug TEXT NOT NULL REFERENCES competitions(slug) ON DELETE CASCADE,
  enrolled_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  PRIMARY KEY (user_id, competition_slug)
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  competition_slug TEXT NOT NULL REFERENCES competitions(slug) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  short_title TEXT NOT NULL,
  description TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#59776b',
  icon TEXT NOT NULL DEFAULT 'sparkles',
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  UNIQUE (competition_slug, sort_order)
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  objectives_json TEXT NOT NULL DEFAULT '[]',
  body_json TEXT NOT NULL DEFAULT '{}',
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  estimated_minutes INTEGER NOT NULL DEFAULT 8,
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  UNIQUE (unit_id, sort_order)
);

CREATE TABLE IF NOT EXISTS lesson_prerequisites (
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  prerequisite_lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, prerequisite_lesson_id),
  CHECK (lesson_id != prerequisite_lesson_id)
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('single_choice', 'multiple_select', 'number', 'short_answer', 'proof')),
  prompt TEXT NOT NULL,
  choices_json TEXT NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL DEFAULT '',
  hint TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  objective TEXT NOT NULL DEFAULT '',
  source_note TEXT NOT NULL DEFAULT 'Original practice question',
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  rubric_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE (lesson_id, sort_order)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  last_activity_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  completed_at TEXT,
  mastery_score REAL NOT NULL DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 1),
  best_score REAL NOT NULL DEFAULT 0 CHECK (best_score BETWEEN 0 AND 1),
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS topic_mastery (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  mastery_score REAL NOT NULL DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 1),
  question_count INTEGER NOT NULL DEFAULT 0,
  last_assessed_at TEXT,
  PRIMARY KEY (user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS question_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id TEXT,
  submitted_answer TEXT NOT NULL DEFAULT '',
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  mode TEXT NOT NULL DEFAULT 'lesson',
  created_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  review_status TEXT NOT NULL DEFAULT 'reviewed' CHECK (review_status IN ('reviewed', 'pending')),
  reviewer_feedback TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('topic', 'mixed', 'timed', 'review', 'mock')),
  unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
  question_ids_json TEXT NOT NULL,
  time_limit_seconds INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  submitted_at TEXT,
  score_json TEXT
);

CREATE TABLE IF NOT EXISTS practice_answers (
  session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL DEFAULT '',
  answered_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  PRIMARY KEY (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS xp_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  UNIQUE (user_id, event_key)
);

CREATE TABLE IF NOT EXISTS daily_activity (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  questions_answered INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  active_minutes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, activity_date)
);

CREATE TABLE IF NOT EXISTS achievements (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'award',
  xp_bonus INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_slug TEXT NOT NULL REFERENCES achievements(slug) ON DELETE CASCADE,
  earned_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  PRIMARY KEY (user_id, achievement_slug)
);

CREATE TABLE IF NOT EXISTS tutor_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'tutor')),
  content TEXT NOT NULL,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  competition_slug TEXT NOT NULL REFERENCES competitions(slug) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('diagnostic', 'topic', 'unit', 'mock')),
  time_limit_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_limit_seconds >= 0),
  passing_score REAL NOT NULL DEFAULT 0.7 CHECK (passing_score BETWEEN 0 AND 1),
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE IF NOT EXISTS assessment_questions (
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  point_value REAL NOT NULL DEFAULT 1 CHECK (point_value > 0),
  PRIMARY KEY (assessment_id, question_id),
  UNIQUE (assessment_id, sort_order)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

CREATE TABLE IF NOT EXISTS review_schedule (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  interval_days INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  last_answered_at TEXT NOT NULL,
  next_due_at TEXT NOT NULL,
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_units_competition ON units(competition_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_unit ON lessons(unit_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_questions_lesson ON questions(lesson_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_attempts_user_question ON question_attempts(user_id, question_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_user_date ON question_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_user_date ON xp_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date ON daily_activity(user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_open ON practice_sessions(user_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_tutor_messages_user_date ON tutor_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_competition ON assessments(competition_slug, is_published);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_order ON assessment_questions(assessment_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_review_due ON review_schedule(user_id, next_due_at);
CREATE INDEX IF NOT EXISTS idx_pending_proof_reviews ON question_attempts(review_status, created_at DESC);
