import type { AppDatabase } from './db.js';
import { getAuthUser } from './auth.js';
import { HttpError } from './errors.js';

type Row = Record<string, unknown>;

export const utcDate = (date = new Date()) => date.toISOString().slice(0, 10);
const stamp = () => new Date().toISOString();
const parseJson = <T,>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value ?? '')) as T; } catch { return fallback; }
};

export type PublicQuestion = {
  id: string;
  type: string;
  prompt: string;
  choices: { value: string; label: string }[];
  difficulty: number;
  objective: string;
  unitId?: string;
  unitTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
};

export function publicQuestion(row: Row): PublicQuestion {
  return {
    id: String(row.id),
    type: String(row.question_type ?? row.type),
    prompt: String(row.prompt),
    choices: parseJson(row.choices_json ?? row.choices, []),
    difficulty: Number(row.difficulty ?? 1),
    objective: String(row.objective ?? ''),
    ...(row.unit_id ? { unitId: String(row.unit_id), unitTitle: String(row.unit_title ?? '') } : {}),
    ...(row.lesson_id ? { lessonId: String(row.lesson_id), lessonTitle: String(row.lesson_title ?? '') } : {}),
  };
}

async function ensureActivity(db: AppDatabase, userId: number, day = utcDate()) {
  (await db.prepare('INSERT OR IGNORE INTO daily_activity (user_id, activity_date) VALUES (?, ?)').run(userId, day));
}

export async function awardXp(db: AppDatabase, userId: number, eventKey: string, amount: number, category: string, reason: string) {
  const points = Math.max(0, Math.floor(amount));
  if (points === 0) return 0;
  const result = (await db.prepare(`INSERT OR IGNORE INTO xp_events (user_id, event_key, category, amount, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(userId, eventKey, category, points, reason, stamp()));
  if (Number(result.changes) === 0) return 0;
  await ensureActivity(db, userId);
  await db.prepare('UPDATE daily_activity SET xp_earned = xp_earned + ? WHERE user_id = ? AND activity_date = ?').run(points, userId, utcDate());
  return points;
}

async function awardDailyQuests(db: AppDatabase, userId: number) {
  const day = utcDate();
  const activity = (await db.prepare('SELECT questions_answered, correct_answers, lessons_completed FROM daily_activity WHERE user_id = ? AND activity_date = ?')
    .get(userId, day)) as Row | undefined;
  if (!activity) return;
  const uniqueQuestions = Number((await db.prepare(`SELECT COUNT(DISTINCT question_id) AS count FROM question_attempts
    WHERE user_id = ? AND substr(created_at, 1, 10) = ?`).get(userId, day))?.count ?? 0);
  if (uniqueQuestions >= 3) await awardXp(db, userId, `quest:three-questions:${day}`, 10, 'quest', 'Daily quest: three thoughtful solves');
  if (Number(activity.lessons_completed) >= 1) await awardXp(db, userId, `quest:one-lesson:${day}`, 15, 'quest', 'Daily quest: finish a lesson');
  if (Number(activity.correct_answers) >= 3) await awardXp(db, userId, `quest:three-correct:${day}`, 10, 'quest', 'Daily quest: three correct answers');
}

function consecutiveStreak(dates: string[]) {
  const unique = new Set(dates);
  let day = utcDate();
  if (!unique.has(day)) {
    const yesterday = new Date(`${day}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    day = utcDate(yesterday);
    if (!unique.has(day)) return 0;
  }
  let count = 0;
  while (unique.has(day)) {
    count += 1;
    const previous = new Date(`${day}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    day = utcDate(previous);
  }
  return count;
}

export async function currentStreak(db: AppDatabase, userId: number) {
  const rows = (await db.prepare('SELECT activity_date FROM daily_activity WHERE user_id = ? AND (questions_answered > 0 OR lessons_completed > 0 OR xp_earned > 0) ORDER BY activity_date DESC')
    .all(userId)) as Row[];
  return consecutiveStreak(rows.map((row) => String(row.activity_date)));
}

async function updateTopicMastery(db: AppDatabase, userId: number, unitId: string) {
  const rows = (await db.prepare(`SELECT question_id, is_correct, difficulty, created_at FROM (
      SELECT qa.question_id, qa.is_correct, q.difficulty, qa.created_at,
        ROW_NUMBER() OVER (PARTITION BY qa.question_id ORDER BY qa.id DESC) AS row_number
      FROM question_attempts qa
      JOIN questions q ON q.id = qa.question_id
      JOIN lessons l ON l.id = q.lesson_id
      WHERE qa.user_id = ? AND l.unit_id = ? AND qa.review_status = 'reviewed'
    ) AS latest WHERE row_number = 1`).all(userId, unitId)) as Row[];
  if (!rows.length) return 0;
  const now = Date.now();
  let weightedCorrect = 0;
  let totalWeight = 0;
  for (const row of rows) {
    const difficultyWeight = 0.75 + Number(row.difficulty) * 0.18;
    const createdAt = new Date(String(row.created_at).replace(' ', 'T') + (String(row.created_at).includes('Z') ? '' : 'Z')).getTime();
    const ageDays = Number.isFinite(createdAt) ? Math.max(0, (now - createdAt) / 86_400_000) : 0;
    const recencyWeight = 0.7 + 0.3 * Math.exp(-ageDays / 45);
    const weight = difficultyWeight * recencyWeight;
    weightedCorrect += Number(row.is_correct) * weight;
    totalWeight += weight;
  }
  const score = totalWeight ? weightedCorrect / totalWeight : 0;
  (await db.prepare(`INSERT INTO topic_mastery (user_id, unit_id, mastery_score, question_count, last_assessed_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, unit_id) DO UPDATE SET
      mastery_score = excluded.mastery_score, question_count = excluded.question_count, last_assessed_at = excluded.last_assessed_at`)
    .run(userId, unitId, score, rows.length, stamp()));
  return score;
}

function evaluateAnswer(questionType: string, input: unknown, expected: string) {
  if (questionType === 'single_choice') {
    return typeof input === 'string' && input.trim().toUpperCase() === expected.trim().toUpperCase();
  }
  if (questionType === 'multiple_select') {
    const normalizeSet = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.map((entry) => String(entry).trim().toUpperCase()).filter(Boolean).sort();
      try {
        const parsed = JSON.parse(String(value));
        if (Array.isArray(parsed)) return parsed.map((entry) => String(entry).trim().toUpperCase()).filter(Boolean).sort();
      } catch { /* Fall through to comma-separated values. */ }
      return String(value).split(',').map((entry) => entry.trim().toUpperCase()).filter(Boolean).sort();
    };
    return JSON.stringify(normalizeSet(input)) === JSON.stringify(normalizeSet(expected));
  }
  if (questionType === 'number') {
    const numeric = (value: unknown): number | undefined => {
      const text = String(value ?? '').replace(/,/g, '').replace(/[\s$°]/g, '');
      const fraction = text.match(/^([-+]?\d*\.?\d+)\/([-+]?\d*\.?\d+)$/);
      if (fraction) {
        const denominator = Number(fraction[2]);
        if (denominator === 0) return undefined;
        return Number(fraction[1]) / denominator;
      }
      if (!/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/i.test(text)) return undefined;
      const result = Number(text);
      return Number.isFinite(result) ? result : undefined;
    };
    const actual = numeric(input);
    const answer = numeric(expected);
    return actual !== undefined && answer !== undefined && Math.abs(actual - answer) <= 1e-8 * Math.max(1, Math.abs(answer));
  }
  if (questionType === 'short_answer') {
    const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
    return normalize(input) === normalize(expected);
  }
  return false;
}

export type AnswerResult = {
  correct: boolean;
  attemptNumber: number;
  feedback: string;
  hint?: string;
  explanation?: string;
  correctAnswer?: string;
  needsReview?: boolean;
  reviewerFeedback?: string;
  xpAwarded: number;
  mastery: number;
};

export async function recordAnswer(db: AppDatabase, userId: number, questionId: string, answer: unknown, mode = 'lesson', sessionId: string | null = null): Promise<AnswerResult> {
  if (typeof answer !== 'string' && !Array.isArray(answer)) throw new HttpError(400, 'Enter an answer before submitting.', 'invalid_answer');
  const normalizedAnswer = Array.isArray(answer) ? JSON.stringify(answer.map((part) => String(part).slice(0, 80))) : answer.trim();
  if (!normalizedAnswer || normalizedAnswer.length > 300) throw new HttpError(400, 'Answers must be between 1 and 300 characters.', 'invalid_answer');
  const question = (await db.prepare(`SELECT q.*, l.unit_id, l.id AS lesson_id FROM questions q
    JOIN lessons l ON l.id = q.lesson_id WHERE q.id = ? AND q.is_published = 1`).get(questionId)) as Row | undefined;
  if (!question) throw new HttpError(404, 'That question could not be found.', 'not_found');
  const isProof = String(question.question_type) === 'proof';
  const correct = isProof ? false : evaluateAnswer(String(question.question_type), answer, String(question.correct_answer));
  const priorCorrect = (await db.prepare('SELECT 1 AS found FROM question_attempts WHERE user_id = ? AND question_id = ? AND is_correct = 1 LIMIT 1')
    .get(userId, questionId));
  const attemptNumber = Number((await db.prepare('SELECT COUNT(*) AS count FROM question_attempts WHERE user_id = ? AND question_id = ?')
    .get(userId, questionId))?.count ?? 0) + 1;
  const now = stamp();
  (await db.prepare(`INSERT INTO question_attempts (user_id, question_id, session_id, submitted_answer, is_correct, attempt_number, mode, created_at, review_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, questionId, sessionId, normalizedAnswer, correct ? 1 : 0, attemptNumber, mode, now, isProof ? 'pending' : 'reviewed'));
  await ensureActivity(db, userId);
  await db.prepare(`UPDATE daily_activity SET questions_answered = questions_answered + 1, correct_answers = correct_answers + ?
    WHERE user_id = ? AND activity_date = ?`).run(correct ? 1 : 0, userId, utcDate());
  if (!isProof) {
    const schedule = (await db.prepare('SELECT repetitions, interval_days FROM review_schedule WHERE user_id = ? AND question_id = ?').get(userId, questionId)) as Row | undefined;
    const repetitions = correct ? Number(schedule?.repetitions ?? 0) + 1 : 0;
    const intervalDays = correct ? repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.min(30, Math.max(1, Number(schedule?.interval_days ?? 1) * 2)) : 0;
    const nextDue = correct ? new Date(Date.now() + intervalDays * 86_400_000).toISOString() : now;
    (await db.prepare(`INSERT INTO review_schedule (user_id, question_id, repetitions, interval_days, last_answered_at, next_due_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, question_id) DO UPDATE SET repetitions = excluded.repetitions,
        interval_days = excluded.interval_days, last_answered_at = excluded.last_answered_at, next_due_at = excluded.next_due_at`)
      .run(userId, questionId, repetitions, intervalDays, now, nextDue));
  }

  const lessonId = String(question.lesson_id);
  const unitId = String(question.unit_id);
  const countRows = (await db.prepare('SELECT COUNT(*) AS total FROM questions WHERE lesson_id = ? AND is_published = 1').get(lessonId)) as Row;
  const totalQuestions = Math.max(1, Number(countRows.total));
  const distinctCorrect = Number((await db.prepare(`SELECT COUNT(DISTINCT q.id) AS count FROM questions q
    WHERE q.lesson_id = ? AND EXISTS (SELECT 1 FROM question_attempts qa WHERE qa.user_id = ? AND qa.question_id = q.id AND qa.is_correct = 1)`)
    .get(lessonId, userId))?.count ?? 0);
  const bestScore = Math.min(1, distinctCorrect / totalQuestions);
  (await db.prepare(`INSERT INTO lesson_progress (user_id, lesson_id, started_at, last_activity_at, mastery_score, best_score, attempts)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(user_id, lesson_id) DO UPDATE SET last_activity_at = excluded.last_activity_at,
      mastery_score = MAX(lesson_progress.mastery_score, excluded.mastery_score),
      best_score = MAX(lesson_progress.best_score, excluded.best_score), attempts = lesson_progress.attempts + 1`)
    .run(userId, lessonId, now, now, bestScore, bestScore));

  const mastery = await updateTopicMastery(db, userId, unitId);
  let xpAwarded = 0;
  if (correct && !priorCorrect && !isProof) {
    const todayPracticeXp = Number((await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM xp_events
      WHERE user_id = ? AND category = 'practice' AND substr(created_at, 1, 10) = ?`).get(userId, utcDate()))?.total ?? 0);
    const amount = Math.min(5 + Number(question.difficulty) * 3, Math.max(0, 40 - todayPracticeXp));
    xpAwarded += await awardXp(db, userId, `first-correct:${questionId}`, amount, 'practice', `First correct solve: ${String(question.objective)}`);
  }
  await awardDailyQuests(db, userId);
  await checkAchievements(db, userId);

  const showSolution = !isProof && (correct || attemptNumber >= 2);
  const response: AnswerResult = {
    correct,
    attemptNumber,
    feedback: isProof ? 'Your proof is saved for a rubric-based review. It has not been automatically graded.' : correct ? 'That reasoning checks out.' : attemptNumber === 1 ? 'Not quite yet. Use the hint to find a smaller next step.' : 'That one is tricky. Here is the worked reasoning; take a moment to notice the pattern.',
    ...(isProof ? { needsReview: true } : {}),
    xpAwarded,
    mastery,
  };
  if (!isProof && !correct && attemptNumber === 1) response.hint = String(question.hint);
  if (showSolution) {
    response.explanation = String(question.explanation);
    response.correctAnswer = String(question.correct_answer);
  }
  return response;
}

export async function reviewProofAttempt(db: AppDatabase, attemptId: number, accepted: boolean, reviewerFeedback: string) {
  const attempt = (await db.prepare(`SELECT qa.*, q.id AS question_id, q.difficulty, q.objective, l.id AS lesson_id, l.unit_id
    FROM question_attempts qa JOIN questions q ON q.id = qa.question_id JOIN lessons l ON l.id = q.lesson_id
    WHERE qa.id = ? AND q.question_type = 'proof' AND qa.review_status = 'pending'`).get(attemptId)) as Row | undefined;
  if (!attempt) throw new HttpError(404, 'Pending proof response not found.', 'not_found');
  const userId = Number(attempt.user_id);
  const questionId = String(attempt.question_id);
  const lessonId = String(attempt.lesson_id);
  const unitId = String(attempt.unit_id);
  const now = stamp();
  (await db.prepare('UPDATE question_attempts SET is_correct = ?, review_status = \'reviewed\', reviewer_feedback = ? WHERE id = ?')
    .run(accepted ? 1 : 0, reviewerFeedback.slice(0, 1000), attemptId));
  let xpAwarded = 0;
  if (accepted) {
    const activityDay = String(attempt.created_at).slice(0, 10);
    await ensureActivity(db, userId, activityDay);
    (await db.prepare('UPDATE daily_activity SET correct_answers = correct_answers + 1 WHERE user_id = ? AND activity_date = ?').run(userId, activityDay));
    const priorCorrect = (await db.prepare('SELECT 1 FROM question_attempts WHERE user_id = ? AND question_id = ? AND is_correct = 1 AND id != ? LIMIT 1').get(userId, questionId, attemptId));
    if (!priorCorrect) {
      const todayPracticeXp = Number((await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM xp_events
        WHERE user_id = ? AND category = 'practice' AND substr(created_at, 1, 10) = ?`).get(userId, utcDate()))?.total ?? 0);
      const amount = Math.min(5 + Number(attempt.difficulty) * 3, Math.max(0, 40 - todayPracticeXp));
      xpAwarded += await awardXp(db, userId, `first-correct:${questionId}`, amount, 'practice', `Reviewed proof: ${String(attempt.objective)}`);
    }
    const due = new Date(Date.now() + 86_400_000).toISOString();
    (await db.prepare(`INSERT INTO review_schedule (user_id, question_id, repetitions, interval_days, last_answered_at, next_due_at)
      VALUES (?, ?, 1, 1, ?, ?) ON CONFLICT(user_id, question_id) DO UPDATE SET repetitions = 1,
        interval_days = 1, last_answered_at = excluded.last_answered_at, next_due_at = excluded.next_due_at`)
      .run(userId, questionId, now, due));
  }
  const total = Math.max(1, Number((await db.prepare('SELECT COUNT(*) AS count FROM questions WHERE lesson_id = ? AND is_published = 1').get(lessonId))?.count ?? 1));
  const correctCount = Number((await db.prepare(`SELECT COUNT(DISTINCT q.id) AS count FROM questions q WHERE q.lesson_id = ? AND EXISTS
    (SELECT 1 FROM question_attempts qa WHERE qa.user_id = ? AND qa.question_id = q.id AND qa.is_correct = 1 AND qa.review_status = 'reviewed')`).get(lessonId, userId))?.count ?? 0);
  const score = Math.min(1, correctCount / total);
  (await db.prepare(`INSERT INTO lesson_progress (user_id, lesson_id, started_at, last_activity_at, mastery_score, best_score, attempts)
    VALUES (?, ?, ?, ?, ?, ?, 0) ON CONFLICT(user_id, lesson_id) DO UPDATE SET last_activity_at = excluded.last_activity_at,
      mastery_score = MAX(lesson_progress.mastery_score, excluded.mastery_score), best_score = MAX(lesson_progress.best_score, excluded.best_score)`)
    .run(userId, lessonId, now, now, score, score));
  const mastery = await updateTopicMastery(db, userId, unitId);
  await awardDailyQuests(db, userId);
  await checkAchievements(db, userId);
  return { reviewed: true, accepted, reviewerFeedback: reviewerFeedback.slice(0, 1000), xpAwarded, mastery };
}

export async function completeLesson(db: AppDatabase, userId: number, lessonId: string) {
  const lesson = (await db.prepare(`SELECT l.id, l.unit_id, u.competition_slug FROM lessons l
    JOIN units u ON u.id = l.unit_id WHERE l.id = ? AND l.is_published = 1 AND u.is_published = 1`).get(lessonId)) as Row | undefined;
  if (!lesson) throw new HttpError(404, 'Lesson not found.', 'not_found');
  await ensureLessonAccessible(db, userId, lessonId, String(lesson.competition_slug));
  const questions = (await db.prepare('SELECT id FROM questions WHERE lesson_id = ? AND is_published = 1').all(lessonId)) as Row[];
  if (!questions.length) throw new HttpError(400, 'This lesson is not ready to complete yet.', 'lesson_empty');
  const attemptRows = (await db.prepare(`SELECT qa.question_id, MAX(qa.is_correct) AS is_correct FROM question_attempts qa
    JOIN questions q ON q.id = qa.question_id WHERE qa.user_id = ? AND q.lesson_id = ? AND qa.review_status = 'reviewed'
    GROUP BY qa.question_id`).all(userId, lessonId)) as Row[];
  const attemptedIds = new Set(attemptRows.map((row) => String(row.question_id)));
  if (questions.some((question) => !attemptedIds.has(String(question.id)))) throw new HttpError(400, 'Try each practice question once before finishing the lesson.', 'questions_incomplete');
  const correctCount = attemptRows.filter((row) => Number(row.is_correct) === 1).length;
  const score = correctCount / questions.length;
  if (score < 0.5) throw new HttpError(400, 'You are close. Solve at least one practice question correctly to unlock the next step.', 'mastery_needed');
  const now = stamp();
  (await db.prepare(`INSERT INTO lesson_progress (user_id, lesson_id, started_at, last_activity_at, completed_at, mastery_score, best_score, attempts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, lesson_id) DO UPDATE SET last_activity_at = excluded.last_activity_at,
      completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at),
      mastery_score = MAX(lesson_progress.mastery_score, excluded.mastery_score),
      best_score = MAX(lesson_progress.best_score, excluded.best_score)`)
    .run(userId, lessonId, now, now, now, score, score, questions.length));
  await ensureActivity(db, userId);
  await db.prepare('UPDATE daily_activity SET lessons_completed = lessons_completed + 1 WHERE user_id = ? AND activity_date = ? AND NOT EXISTS (SELECT 1 FROM xp_events WHERE user_id = ? AND event_key = ?)')
    .run(userId, utcDate(), userId, `lesson:${lessonId}`);
  const xpAwarded = await awardXp(db, userId, `lesson:${lessonId}`, 25, 'lesson', `Lesson complete: ${lessonId}`);
  if (score >= 0.999) await awardXp(db, userId, `lesson-perfect:${lessonId}`, 10, 'mastery', `Mastered lesson: ${lessonId}`);
  await updateTopicMastery(db, userId, String(lesson.unit_id));
  await awardDailyQuests(db, userId);
  const newlyUnlocked = (await db.prepare(`SELECT l.id, l.title FROM lessons l
    JOIN lesson_prerequisites p ON p.lesson_id = l.id
    WHERE p.prerequisite_lesson_id = ? AND NOT EXISTS (
      SELECT 1 FROM lesson_prerequisites p2
      LEFT JOIN lesson_progress lp2 ON lp2.user_id = ? AND lp2.lesson_id = p2.prerequisite_lesson_id
      WHERE p2.lesson_id = l.id AND lp2.completed_at IS NULL
    ) LIMIT 1`).get(lessonId, userId)) as Row | undefined;
  await checkAchievements(db, userId);
  return { completed: true, masteryScore: score, correctCount, totalQuestions: questions.length, xpAwarded, newlyUnlocked: newlyUnlocked ? { id: String(newlyUnlocked.id), title: String(newlyUnlocked.title) } : null };
}

export async function ensureLessonAccessible(db: AppDatabase, userId: number, lessonId: string, competitionSlug?: string) {
  const row = (await db.prepare(`SELECT l.id, u.competition_slug, c.is_available
    FROM lessons l JOIN units u ON u.id = l.unit_id JOIN competitions c ON c.slug = u.competition_slug
    WHERE l.id = ? AND l.is_published = 1 AND u.is_published = 1 AND c.is_published = 1`).get(lessonId)) as Row | undefined;
  if (!row || Number(row.is_available) !== 1 || (competitionSlug && String(row.competition_slug) !== competitionSlug)) {
    throw new HttpError(404, 'Lesson not found.', 'not_found');
  }
  const missing = (await db.prepare(`SELECT p.prerequisite_lesson_id AS id FROM lesson_prerequisites p
    LEFT JOIN lesson_progress lp ON lp.user_id = ? AND lp.lesson_id = p.prerequisite_lesson_id
    WHERE p.lesson_id = ? AND lp.completed_at IS NULL LIMIT 1`).get(userId, lessonId)) as Row | undefined;
  if (missing) throw new HttpError(409, 'Complete the previous lesson to unlock this one.', 'lesson_locked');
  return row;
}

export async function getLesson(db: AppDatabase, userId: number, lessonId: string) {
  const lesson = (await db.prepare(`SELECT l.*, u.title AS unit_title, u.short_title AS unit_short_title, u.color AS unit_color,
      c.name AS competition_name, c.slug AS competition_slug
    FROM lessons l JOIN units u ON u.id = l.unit_id JOIN competitions c ON c.slug = u.competition_slug
    WHERE l.id = ? AND l.is_published = 1 AND u.is_published = 1`).get(lessonId)) as Row | undefined;
  if (!lesson) throw new HttpError(404, 'Lesson not found.', 'not_found');
  await ensureLessonAccessible(db, userId, lessonId, String(lesson.competition_slug));
  const now = stamp();
  (await db.prepare(`INSERT INTO lesson_progress (user_id, lesson_id, started_at, last_activity_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(user_id, lesson_id) DO UPDATE SET last_activity_at = excluded.last_activity_at`)
    .run(userId, lessonId, now, now));
  const questionRows = (await db.prepare(`SELECT q.*,
      COUNT(qa.id) AS attempts,
      MAX(CASE WHEN qa.review_status = 'reviewed' THEN qa.is_correct ELSE 0 END) AS ever_correct,
      MAX(CASE WHEN qa.review_status = 'pending' THEN 1 ELSE 0 END) AS review_pending,
      MAX(qa.reviewer_feedback) AS reviewer_feedback
    FROM questions q LEFT JOIN question_attempts qa ON qa.question_id = q.id AND qa.user_id = ?
    WHERE q.lesson_id = ? AND q.is_published = 1
    GROUP BY q.id ORDER BY q.sort_order`).all(userId, lessonId)) as Row[];
  const progress = (await db.prepare('SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').get(userId, lessonId)) as Row;
  return {
    lesson: {
      id: String(lesson.id), title: String(lesson.title), summary: String(lesson.summary),
      difficulty: Number(lesson.difficulty), estimatedMinutes: Number(lesson.estimated_minutes),
      objectives: parseJson<string[]>(lesson.objectives_json, []),
      body: parseJson(lesson.body_json, {}),
      unit: { id: String(lesson.unit_id), title: String(lesson.unit_title), shortTitle: String(lesson.unit_short_title), color: String(lesson.unit_color) },
      competition: String(lesson.competition_name),
    },
    questions: questionRows.map((question) => ({ ...publicQuestion(question), attempts: Number(question.attempts), everCorrect: Number(question.ever_correct ?? 0) === 1, reviewPending: Number(question.review_pending ?? 0) === 1, reviewerFeedback: String(question.reviewer_feedback ?? '') })),
    progress: { startedAt: String(progress.started_at), completedAt: progress.completed_at ? String(progress.completed_at) : null, masteryScore: Number(progress.mastery_score), attempts: Number(progress.attempts) },
  };
}

async function checkAchievements(db: AppDatabase, userId: number) {
  const completed = Number((await db.prepare('SELECT COUNT(*) AS count FROM lesson_progress WHERE user_id = ? AND completed_at IS NOT NULL').get(userId))?.count ?? 0);
  const perfect = Number((await db.prepare('SELECT COUNT(*) AS count FROM lesson_progress WHERE user_id = ? AND mastery_score >= 0.999').get(userId))?.count ?? 0);
  const solved = Number((await db.prepare('SELECT COUNT(DISTINCT question_id) AS count FROM question_attempts WHERE user_id = ? AND is_correct = 1').get(userId))?.count ?? 0);
  const fullUnit = Number((await db.prepare(`SELECT COUNT(*) AS count FROM (
    SELECT u.id FROM units u JOIN lessons l ON l.unit_id = u.id
    LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
    GROUP BY u.id HAVING COUNT(l.id) > 0 AND SUM(CASE WHEN lp.completed_at IS NOT NULL THEN 1 ELSE 0 END) = COUNT(l.id)
  ) AS completed_units`).get(userId))?.count ?? 0);
  const streak = await currentStreak(db, userId);
  const candidates: string[] = [];
  if (completed >= 1) candidates.push('first-step');
  if (perfect >= 1) candidates.push('perfect-practice');
  if (fullUnit >= 1) candidates.push('topic-explorer');
  if (solved >= 10) candidates.push('ten-solves');
  if (streak >= 3) candidates.push('three-day-streak');
  for (const slug of candidates) {
    const definition = (await db.prepare('SELECT xp_bonus FROM achievements WHERE slug = ?').get(slug)) as Row | undefined;
    const earned = (await db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_slug, earned_at) VALUES (?, ?, ?)').run(userId, slug, stamp()));
    if (Number(earned.changes) > 0 && definition) await awardXp(db, userId, `achievement:${slug}`, Number(definition.xp_bonus), 'achievement', `Achievement unlocked: ${slug}`);
  }
}

async function activityWeek(db: AppDatabase, userId: number) {
  const rows = (await db.prepare('SELECT activity_date, xp_earned, questions_answered, lessons_completed FROM daily_activity WHERE user_id = ? AND activity_date >= ? ORDER BY activity_date')
    .all(userId, (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 6); return utcDate(d); })())) as Row[];
  const byDate = new Map(rows.map((row) => [String(row.activity_date), row]));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - 6 + index);
    const date = utcDate(day);
    const row = byDate.get(date);
    return { date, label: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(day), xp: Number(row?.xp_earned ?? 0), active: Number(row?.questions_answered ?? 0) > 0 || Number(row?.lessons_completed ?? 0) > 0 };
  });
}

export async function getBootstrap(db: AppDatabase, userId: number) {
  const user = await getAuthUser(db, userId);
  if (!user) throw new HttpError(401, 'Please sign in again.', 'unauthenticated');
  const competitionsRows = (await db.prepare(`SELECT c.*, EXISTS(SELECT 1 FROM user_competitions uc WHERE uc.user_id = ? AND uc.competition_slug = c.slug) AS enrolled
    FROM competitions c WHERE c.is_published = 1 ORDER BY CASE c.subject WHEN 'Mathematics' THEN 0 WHEN 'Physics' THEN 1 WHEN 'Chemistry' THEN 2 WHEN 'Biology' THEN 3 ELSE 4 END, c.name`)
    .all(userId)) as Row[];
  const activeSlug = user.activeCompetitionSlug ?? 'amc-10';
  const activeCompetition = competitionsRows.find((row) => String(row.slug) === activeSlug) ?? competitionsRows.find((row) => Number(row.is_available) === 1);
  if (!activeCompetition) throw new HttpError(503, 'No learning journey is available yet.', 'no_curriculum');
  const unitsRows = (await db.prepare('SELECT * FROM units WHERE competition_slug = ? AND is_published = 1 ORDER BY sort_order').all(String(activeCompetition.slug))) as Row[];
  const allLessonRows = (await db.prepare(`SELECT l.*, u.id AS unit_id, u.title AS unit_title, u.short_title AS unit_short_title,
      u.color AS unit_color, u.sort_order AS unit_order,
      lp.started_at AS progress_started_at, lp.completed_at, lp.mastery_score,
      COALESCE(tm.mastery_score, 0) AS topic_mastery,
      EXISTS(SELECT 1 FROM lesson_prerequisites p LEFT JOIN lesson_progress pp
        ON pp.user_id = ? AND pp.lesson_id = p.prerequisite_lesson_id
        WHERE p.lesson_id = l.id AND pp.completed_at IS NULL) AS has_missing_prerequisite
    FROM lessons l JOIN units u ON u.id = l.unit_id
    LEFT JOIN lesson_progress lp ON lp.user_id = ? AND lp.lesson_id = l.id
    LEFT JOIN topic_mastery tm ON tm.user_id = ? AND tm.unit_id = u.id
    WHERE u.competition_slug = ? AND l.is_published = 1 AND u.is_published = 1
    ORDER BY u.sort_order, l.sort_order`).all(userId, userId, userId, String(activeCompetition.slug))) as Row[];
  const lessonsByUnit = new Map<string, Row[]>();
  let lessonNumber = 0;
  for (const lesson of allLessonRows) {
    lessonNumber += 1;
    const complete = Boolean(lesson.completed_at);
    const locked = Number(lesson.has_missing_prerequisite) === 1;
    const status = complete ? (Number(lesson.mastery_score) >= 0.8 ? 'mastered' : 'completed') : locked ? 'locked' : lesson.progress_started_at ? 'in_progress' : 'available';
    const list = lessonsByUnit.get(String(lesson.unit_id)) ?? [];
    list.push({ id: String(lesson.id), title: String(lesson.title), summary: String(lesson.summary), difficulty: Number(lesson.difficulty), estimatedMinutes: Number(lesson.estimated_minutes), status, mastery: Number(lesson.mastery_score ?? 0), completedAt: lesson.completed_at ? String(lesson.completed_at) : null, number: lessonNumber });
    lessonsByUnit.set(String(lesson.unit_id), list);
  }
  const topicMasteryRows = await db.prepare('SELECT unit_id, mastery_score FROM topic_mastery WHERE user_id = ?').all(userId);
  const topicMasteryByUnit = new Map(topicMasteryRows.map((row) => [String(row.unit_id), Number(row.mastery_score)]));
  const journeyUnits = unitsRows.map((unit) => {
    const lessons = lessonsByUnit.get(String(unit.id)) ?? [];
    const completedCount = lessons.filter((lesson) => lesson.status === 'completed' || lesson.status === 'mastered').length;
    return { id: String(unit.id), title: String(unit.title), shortTitle: String(unit.short_title), description: String(unit.description), color: String(unit.color), icon: String(unit.icon), estimatedMinutes: Number(unit.estimated_minutes), lessonCount: lessons.length, completedCount, mastery: topicMasteryByUnit.get(String(unit.id)) ?? 0, lessons };
  });
  const flatLessons = journeyUnits.flatMap((unit) => unit.lessons);
  const nextLesson = flatLessons.find((lesson) => lesson.status === 'in_progress') ?? flatLessons.find((lesson) => lesson.status === 'available') ?? flatLessons.at(-1) ?? null;
  const xp = Number((await db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM xp_events WHERE user_id = ?').get(userId))?.total ?? 0);
  const day = utcDate();
  const today = (await db.prepare('SELECT * FROM daily_activity WHERE user_id = ? AND activity_date = ?').get(userId, day)) as Row | undefined;
  const history = (await db.prepare('SELECT activity_date FROM daily_activity WHERE user_id = ? AND (questions_answered > 0 OR lessons_completed > 0 OR xp_earned > 0) ORDER BY activity_date DESC').all(userId)) as Row[];
  const current = await currentStreak(db, userId);
  let best = 0;
  let streak = 0;
  let previous: string | undefined;
  for (const item of [...history].reverse()) {
    const date = String(item.activity_date);
    const previousDate = new Date(`${date}T00:00:00.000Z`);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    if (!previous || utcDate(previousDate) === previous) streak += 1;
    else streak = 1;
    best = Math.max(best, streak);
    previous = date;
  }
  const totalQuestions = Number((await db.prepare('SELECT COUNT(DISTINCT question_id) AS count FROM question_attempts WHERE user_id = ?').get(userId))?.count ?? 0);
  const correctQuestions = Number((await db.prepare('SELECT COUNT(DISTINCT question_id) AS count FROM question_attempts WHERE user_id = ? AND is_correct = 1').get(userId))?.count ?? 0);
  const masteryAverage = journeyUnits.length ? journeyUnits.reduce((sum, unit) => sum + unit.mastery, 0) / journeyUnits.length : 0;
  const enrolled = competitionsRows.filter((row) => Number(row.enrolled) === 1).map((row) => String(row.slug));
  const dailyQuestions = Number(today?.questions_answered ?? 0);
  const dailyUnique = Number((await db.prepare(`SELECT COUNT(DISTINCT question_id) AS count FROM question_attempts WHERE user_id = ? AND substr(created_at, 1, 10) = ?`).get(userId, day))?.count ?? 0);
  const dailyLessons = Number(today?.lessons_completed ?? 0);
  const dailyCorrect = Number(today?.correct_answers ?? 0);
  const dueReviews = Number((await db.prepare('SELECT COUNT(*) AS count FROM review_schedule WHERE user_id = ? AND next_due_at <= ?').get(userId, stamp()))?.count ?? 0);
  const achievementsRows = (await db.prepare(`SELECT a.*, ua.earned_at FROM achievements a
    LEFT JOIN user_achievements ua ON ua.achievement_slug = a.slug AND ua.user_id = ?
    ORDER BY CASE WHEN ua.earned_at IS NOT NULL THEN 0 ELSE 1 END, a.category, a.title`).all(userId)) as Row[];
  const openSessions = (await db.prepare('SELECT id, mode, started_at, time_limit_seconds FROM practice_sessions WHERE user_id = ? AND submitted_at IS NULL ORDER BY started_at DESC LIMIT 1').get(userId)) as Row | undefined;
  const calendarStart = new Date();
  calendarStart.setUTCHours(0, 0, 0, 0);
  calendarStart.setUTCDate(calendarStart.getUTCDate() - 27);
  const calendarRows = (await db.prepare('SELECT * FROM daily_activity WHERE user_id = ? AND activity_date >= ? ORDER BY activity_date').all(userId, utcDate(calendarStart))) as Row[];
  const calendarByDate = new Map(calendarRows.map((row) => [String(row.activity_date), row]));
  const calendar = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setUTCDate(date.getUTCDate() + index);
    const key = utcDate(date);
    const row = calendarByDate.get(key);
    const questions = Number(row?.questions_answered ?? 0);
    const lessons = Number(row?.lessons_completed ?? 0);
    return { date: key, day: date.getUTCDate(), weekday: date.getUTCDay(), active: questions > 0 || lessons > 0, questions, lessons, xp: Number(row?.xp_earned ?? 0) };
  });
  const assessmentRows = (await db.prepare(`SELECT id, mode, score_json, submitted_at FROM practice_sessions
    WHERE user_id = ? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 8`).all(userId)) as Row[];
  const recentAssessments = assessmentRows.map((row) => {
    const result = parseJson<Record<string, unknown>>(row.score_json, {});
    return { id: String(row.id), mode: String(row.mode), accuracy: Number(result.accuracy ?? 0), correctCount: Number(result.correctCount ?? 0), questionCount: Number(result.questionCount ?? 0), timeTakenSeconds: Number(result.timeTakenSeconds ?? 0), submittedAt: String(row.submitted_at) };
  });
  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const leaderboardRows = user.leaderboardOptIn ? (await db.prepare(`SELECT u.id, u.full_name, COALESCE(SUM(x.amount), 0) AS weekly_xp
    FROM users u JOIN user_competitions uc ON uc.user_id = u.id AND uc.competition_slug = ?
    LEFT JOIN xp_events x ON x.user_id = u.id AND substr(x.created_at, 1, 10) >= ?
    WHERE u.leaderboard_opt_in = 1 GROUP BY u.id ORDER BY weekly_xp DESC, u.id LIMIT 20`).all(String(activeCompetition.slug), utcDate(weekStart))) as Row[] : [];
  const leaderboard = leaderboardRows.map((row, index) => ({ rank: index + 1, name: String(row.full_name), xp: Number(row.weekly_xp), isYou: Number(row.id) === userId }));
  return {
    user,
    competition: { slug: String(activeCompetition.slug), name: String(activeCompetition.name), subject: String(activeCompetition.subject), level: String(activeCompetition.level), description: String(activeCompetition.description), available: Number(activeCompetition.is_available) === 1 },
    competitions: competitionsRows.map((row) => ({ slug: String(row.slug), name: String(row.name), subject: String(row.subject), level: String(row.level), description: String(row.description), available: Number(row.is_available) === 1, enrolled: Number(row.enrolled) === 1 })),
    enrolledCompetitions: enrolled,
    units: journeyUnits,
    currentLesson: nextLesson,
    stats: { xp, level: Math.floor(xp / 250) + 1, xpIntoLevel: xp % 250, xpToNextLevel: 250, currentStreak: current, bestStreak: best, completedLessons: flatLessons.filter((lesson) => lesson.status === 'completed' || lesson.status === 'mastered').length, totalLessons: flatLessons.length, topicMastery: masteryAverage, answeredQuestions: totalQuestions, correctQuestions, accuracy: totalQuestions ? correctQuestions / totalQuestions : 0, dueReviews, dailyQuestions, dailyGoal: user.dailyGoal },
    today: { date: day, xp: Number(today?.xp_earned ?? 0), questions: dailyQuestions, uniqueQuestions: dailyUnique, correct: dailyCorrect, lessons: dailyLessons },
    dailyQuests: [
      { id: 'three-questions', title: 'Three thoughtful solves', detail: `Answer ${Math.min(3, user.dailyGoal)} questions today`, progress: Math.min(dailyUnique, Math.min(3, user.dailyGoal)), target: Math.min(3, user.dailyGoal), reward: 10, icon: 'puzzle' },
      { id: 'one-lesson', title: 'One step forward', detail: 'Complete a lesson today', progress: Math.min(dailyLessons, 1), target: 1, reward: 15, icon: 'book-open' },
      { id: 'three-correct', title: 'Build your confidence', detail: 'Get three questions right today', progress: Math.min(dailyCorrect, 3), target: 3, reward: 10, icon: 'target' },
    ],
    achievements: achievementsRows.map((row) => ({ slug: String(row.slug), title: String(row.title), description: String(row.description), category: String(row.category), icon: String(row.icon), xpBonus: Number(row.xp_bonus), earnedAt: row.earned_at ? String(row.earned_at) : null })),
    week: await activityWeek(db, userId),
    calendar,
    recentAssessments,
    leaderboard: { enabled: user.leaderboardOptIn, entries: leaderboard },
    activePracticeSessionId: openSessions ? String(openSessions.id) : null,
  };
}
