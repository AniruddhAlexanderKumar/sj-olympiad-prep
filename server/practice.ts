import { randomUUID } from 'node:crypto';
import type { AppDatabase } from './db.js';
import { HttpError } from './errors.js';
import { awardXp, getBootstrap, publicQuestion, recordAnswer, utcDate } from './learning.js';

type Row = Record<string, unknown>;
type PracticeMode = 'topic' | 'mixed' | 'timed' | 'review' | 'mock';
const parseJson = <T,>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value ?? '')) as T; } catch { return fallback; }
};
const stamp = () => new Date().toISOString();

function elapsedSeconds(startedAt: unknown) {
  const raw = String(startedAt ?? '');
  const parsed = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`).getTime();
  return Number.isFinite(parsed) ? Math.max(0, Math.floor((Date.now() - parsed) / 1000)) : 0;
}

async function activeCompetition(db: AppDatabase, userId: number) {
  const row = (await db.prepare(`SELECT c.slug FROM users u JOIN competitions c ON c.slug = u.active_competition_slug
    WHERE u.id = ? AND c.is_available = 1 AND c.is_published = 1`).get(userId)) as Row | undefined;
  if (!row) throw new HttpError(409, 'Choose an available competition journey first.', 'competition_unavailable');
  return String(row.slug);
}

function accessibleQuestionQuery() {
  return `SELECT q.*, l.id AS lesson_id, l.title AS lesson_title, u.id AS unit_id, u.title AS unit_title
    FROM questions q JOIN lessons l ON l.id = q.lesson_id JOIN units u ON u.id = l.unit_id
    WHERE q.is_published = 1 AND l.is_published = 1 AND u.is_published = 1
      AND NOT EXISTS (
        SELECT 1 FROM lesson_prerequisites p LEFT JOIN lesson_progress lp
          ON lp.user_id = ? AND lp.lesson_id = p.prerequisite_lesson_id
        WHERE p.lesson_id = l.id AND lp.completed_at IS NULL
      )`;
}

export async function startPracticeSession(db: AppDatabase, userId: number, modeInput: unknown, unitInput?: unknown) {
  const validModes: PracticeMode[] = ['topic', 'mixed', 'timed', 'review', 'mock'];
  const mode = String(modeInput ?? '') as PracticeMode;
  if (!validModes.includes(mode)) throw new HttpError(400, 'Choose a valid practice format.', 'invalid_mode');
  const comp = await activeCompetition(db, userId);
  const unitId = typeof unitInput === 'string' && unitInput.length <= 100 ? unitInput : undefined;
  let rows: Row[];
  if (mode === 'review') {
    const base = accessibleQuestionQuery();
    rows = (await db.prepare(`${base} AND u.competition_slug = ?
      AND (EXISTS(SELECT 1 FROM review_schedule rs WHERE rs.user_id = ? AND rs.question_id = q.id AND rs.next_due_at <= ?)
        OR (EXISTS(SELECT 1 FROM question_attempts old WHERE old.user_id = ? AND old.question_id = q.id AND old.is_correct = 0)
          AND NOT EXISTS(SELECT 1 FROM question_attempts right_answer WHERE right_answer.user_id = ? AND right_answer.question_id = q.id AND right_answer.is_correct = 1)))
      ORDER BY COALESCE((SELECT rs.next_due_at FROM review_schedule rs WHERE rs.user_id = ? AND rs.question_id = q.id), '0000') ASC,
        (SELECT MAX(old2.created_at) FROM question_attempts old2 WHERE old2.user_id = ? AND old2.question_id = q.id AND old2.is_correct = 0) DESC LIMIT 5`)
      .all(userId, comp, userId, stamp(), userId, userId, userId, userId)) as Row[];
  } else {
    if (mode === 'topic' && !unitId) throw new HttpError(400, 'Choose a topic for topic practice.', 'unit_required');
    if (unitId) {
      const unit = (await db.prepare('SELECT id FROM units WHERE id = ? AND competition_slug = ? AND is_published = 1').get(unitId, comp));
      if (!unit) throw new HttpError(404, 'That topic is not in your active journey.', 'unit_not_found');
    }
    const base = accessibleQuestionQuery();
    const query = `${base} AND u.competition_slug = ? ${unitId ? 'AND u.id = ?' : ''} ORDER BY RANDOM()`;
    const params = unitId ? [userId, comp, unitId] : [userId, comp];
    rows = (await db.prepare(query).all(...params)) as Row[];
    const mastery = unitId
      ? Number((await db.prepare('SELECT mastery_score FROM topic_mastery WHERE user_id = ? AND unit_id = ?').get(userId, unitId))?.mastery_score ?? 0)
      : Number((await db.prepare('SELECT AVG(mastery_score) AS score FROM topic_mastery tm JOIN units u ON u.id = tm.unit_id WHERE tm.user_id = ? AND u.competition_slug = ?').get(userId, comp))?.score ?? 0);
    const targetDifficulty = mastery < 0.35 ? 1 : mastery < 0.65 ? 2 : mastery < 0.85 ? 3 : 4;
    rows.sort((left, right) => Math.abs(Number(left.difficulty) - targetDifficulty) - Math.abs(Number(right.difficulty) - targetDifficulty));
    rows = rows.slice(0, mode === 'mock' ? 8 : mode === 'timed' ? 6 : 5);
  }
  if (!rows.length) {
    throw new HttpError(mode === 'review' ? 404 : 409, mode === 'review' ? 'No missed or scheduled review questions are due yet.' : 'Unlock a lesson in this topic before starting practice.', 'no_questions');
  }
  const questions = rows.map(publicQuestion);
  const id = randomUUID();
  const timeLimit = mode === 'timed' ? 8 * 60 : mode === 'mock' ? 20 * 60 : 0;
  (await db.prepare(`INSERT INTO practice_sessions (id, user_id, mode, unit_id, question_ids_json, time_limit_seconds, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, userId, mode, unitId ?? null, JSON.stringify(questions.map((question) => question.id)), timeLimit, stamp()));
  return { id, mode, unitId: unitId ?? null, timeLimitSeconds: timeLimit, startedAt: stamp(), questions, answers: {}, submitted: false };
}

export async function getActivePracticeSession(db: AppDatabase, userId: number) {
  const session = (await db.prepare('SELECT * FROM practice_sessions WHERE user_id = ? AND submitted_at IS NULL ORDER BY started_at DESC LIMIT 1').get(userId)) as Row | undefined;
  if (!session) return null;
  return sessionPayload(db, userId, session);
}

export async function getPracticeSession(db: AppDatabase, userId: number, id: string) {
  const session = (await db.prepare('SELECT * FROM practice_sessions WHERE id = ? AND user_id = ?').get(id, userId)) as Row | undefined;
  if (!session) throw new HttpError(404, 'Practice session not found.', 'not_found');
  return sessionPayload(db, userId, session);
}

async function sessionPayload(db: AppDatabase, userId: number, session: Row) {
  const questionIds = parseJson<string[]>(session.question_ids_json, []);
  const questionRows = await Promise.all(questionIds.map(async (questionId) => (await db.prepare(`SELECT q.*, l.id AS lesson_id, l.title AS lesson_title, u.id AS unit_id, u.title AS unit_title
    FROM questions q JOIN lessons l ON l.id = q.lesson_id JOIN units u ON u.id = l.unit_id WHERE q.id = ?`).get(questionId)) as Row | undefined));
  const questions = questionRows.filter((row): row is Row => Boolean(row)).map(publicQuestion);
  const answerRows = (await db.prepare('SELECT question_id, answer_text FROM practice_answers WHERE session_id = ? AND session_id IN (SELECT id FROM practice_sessions WHERE user_id = ?)')
    .all(String(session.id), userId)) as Row[];
  const answers = Object.fromEntries(answerRows.map((row) => [String(row.question_id), String(row.answer_text)]));
  const submitted = Boolean(session.submitted_at);
  return {
    id: String(session.id), mode: String(session.mode), unitId: session.unit_id ? String(session.unit_id) : null,
    timeLimitSeconds: Number(session.time_limit_seconds), elapsedSeconds: elapsedSeconds(session.started_at),
    startedAt: String(session.started_at), questions, answers, submitted,
    score: submitted ? parseJson(session.score_json, null) : null,
  };
}

export async function answerPracticeQuestion(db: AppDatabase, userId: number, sessionId: string, questionIdInput: unknown, answerInput: unknown) {
  const questionId = String(questionIdInput ?? '');
  const answer = typeof answerInput === 'string' ? answerInput.trim() : Array.isArray(answerInput) ? JSON.stringify(answerInput) : '';
  if (!questionId || !answer || answer.length > 300) throw new HttpError(400, 'Choose or enter an answer first.', 'invalid_answer');
  const session = (await db.prepare('SELECT * FROM practice_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId)) as Row | undefined;
  if (!session) throw new HttpError(404, 'Practice session not found.', 'not_found');
  if (session.submitted_at) throw new HttpError(409, 'This practice session has already been submitted.', 'session_submitted');
  const questionIds = parseJson<string[]>(session.question_ids_json, []);
  if (!questionIds.includes(questionId)) throw new HttpError(400, 'That question is not part of this practice session.', 'question_not_in_session');
  const isAssessment = session.mode === 'timed' || session.mode === 'mock';
  if (isAssessment && Number(session.time_limit_seconds) > 0 && elapsedSeconds(session.started_at) >= Number(session.time_limit_seconds)) {
    throw new HttpError(409, 'Time is up. Submit your assessment to see your results.', 'time_expired');
  }
  (await db.prepare(`INSERT INTO practice_answers (session_id, question_id, answer_text, answered_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(session_id, question_id) DO UPDATE SET answer_text = excluded.answer_text, answered_at = excluded.answered_at`)
    .run(sessionId, questionId, answer, stamp()));
  if (isAssessment) return { saved: true, answer: answerInput };
  const result = await recordAnswer(db, userId, questionId, answerInput, String(session.mode), sessionId);
  return { saved: true, ...result };
}

export async function submitPracticeSession(db: AppDatabase, userId: number, sessionId: string) {
  const session = (await db.prepare('SELECT * FROM practice_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId)) as Row | undefined;
  if (!session) throw new HttpError(404, 'Practice session not found.', 'not_found');
  if (session.submitted_at && session.score_json) return parseJson(session.score_json, {});
  const questionIds = parseJson<string[]>(session.question_ids_json, []);
  const answerRows = (await db.prepare('SELECT question_id, answer_text FROM practice_answers WHERE session_id = ?').all(sessionId)) as Row[];
  const answers = new Map(answerRows.map((row) => [String(row.question_id), String(row.answer_text)]));
  const isAssessment = session.mode === 'timed' || session.mode === 'mock';
  const results: Row[] = [];
  for (const questionId of questionIds) {
    const question = (await db.prepare(`SELECT q.*, l.title AS lesson_title, l.id AS lesson_id, u.id AS unit_id, u.title AS unit_title
      FROM questions q JOIN lessons l ON l.id = q.lesson_id JOIN units u ON u.id = l.unit_id WHERE q.id = ?`).get(questionId)) as Row | undefined;
    if (!question) continue;
    const submittedAnswer = answers.get(questionId);
    let correct = false;
    if (submittedAnswer !== undefined && submittedAnswer !== '') {
      if (isAssessment) {
        correct = (await recordAnswer(db, userId, questionId, submittedAnswer, String(session.mode), sessionId)).correct;
      } else {
        correct = Boolean((await db.prepare(`SELECT is_correct FROM question_attempts WHERE user_id = ? AND session_id = ? AND question_id = ? ORDER BY id DESC LIMIT 1`)
          .get(userId, sessionId, questionId))?.is_correct);
      }
    }
    results.push({
      question: publicQuestion(question),
      yourAnswer: submittedAnswer ?? null,
      correct,
      correctAnswer: String(question.correct_answer),
      explanation: String(question.explanation),
      unitId: String(question.unit_id),
      unitTitle: String(question.unit_title),
      lessonTitle: String(question.lesson_title),
    });
  }
  const correctCount = results.filter((result) => result.correct).length;
  const score = questionIds.length ? correctCount / questionIds.length : 0;
  const elapsed = elapsedSeconds(session.started_at);
  const topicMap = new Map<string, { unitId: string; unitTitle: string; count: number; correct: number }>();
  for (const result of results) {
    const unitId = String(result.unitId);
    const topic = topicMap.get(unitId) ?? { unitId, unitTitle: String(result.unitTitle), count: 0, correct: 0 };
    topic.count += 1;
    if (result.correct) topic.correct += 1;
    topicMap.set(unitId, topic);
  }
  const topicPerformance = [...topicMap.values()].map((topic) => ({ ...topic, accuracy: topic.count ? topic.correct / topic.count : 0 }));
  const recommendation = topicPerformance.filter((topic) => topic.accuracy < 0.7).sort((a, b) => a.accuracy - b.accuracy).map((topic) => topic.unitTitle);
  const summary = { correctCount, questionCount: questionIds.length, accuracy: score, timeTakenSeconds: elapsed, topicPerformance, recommendations: recommendation, results, xpAwarded: 0 };
  (await db.prepare('UPDATE practice_sessions SET submitted_at = ?, score_json = ? WHERE id = ? AND submitted_at IS NULL')
    .run(stamp(), JSON.stringify(summary), sessionId));
  let bonus = 0;
  if (isAssessment) {
    bonus += await awardXp(db, userId, `assessment:${sessionId}`, 10 + Math.floor(score * 10), 'assessment', `Assessment complete: ${Math.round(score * 100)}%`);
    const earned = (await db.prepare(`INSERT OR IGNORE INTO user_achievements (user_id, achievement_slug, earned_at)
      VALUES (?, 'first-assessment', ?)`).run(userId, stamp()));
    if (Number(earned.changes) > 0) bonus += await awardXp(db, userId, 'achievement:first-assessment', 30, 'achievement', 'Achievement unlocked: On the clock');
    const previousRows = (await db.prepare(`SELECT score_json FROM practice_sessions WHERE user_id = ? AND mode = ? AND submitted_at IS NOT NULL AND id != ? ORDER BY submitted_at DESC LIMIT 20`)
      .all(userId, String(session.mode), sessionId)) as Row[];
    const previousBest = previousRows.reduce((best, row) => Math.max(best, Number(parseJson<{ accuracy?: number }>(row.score_json, {}).accuracy ?? 0)), 0);
    if (previousRows.length && score > previousBest) {
      const improved = (await db.prepare(`INSERT OR IGNORE INTO user_achievements (user_id, achievement_slug, earned_at)
        VALUES (?, 'better-than-before', ?)`).run(userId, stamp()));
      if (Number(improved.changes) > 0) bonus += await awardXp(db, userId, 'achievement:better-than-before', 35, 'achievement', 'Achievement unlocked: A little better');
    }
  }
  summary.xpAwarded = bonus;
  // Persist the bonus and the final result in the same score record returned to the student.
  (await db.prepare('UPDATE practice_sessions SET score_json = ? WHERE id = ?').run(JSON.stringify(summary), sessionId));
  return summary;
}

export async function practiceOverview(db: AppDatabase, userId: number) {
  const bootstrap = await getBootstrap(db, userId);
  return { units: bootstrap.units.map((unit) => ({ id: unit.id, title: unit.title, mastery: unit.mastery, lessonCount: unit.lessonCount, completedCount: unit.completedCount, unlocked: unit.lessons.some((lesson) => lesson.status !== 'locked') })) };
}

export function todayDate() { return utcDate(); }
