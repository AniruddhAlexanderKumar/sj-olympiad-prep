import express, { type ErrorRequestHandler, type Request } from 'express';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppDatabase } from './db.js';
import { adminRequired, authRequired, createRateLimiter, destroySession, getAuthUser, hashPassword, issueSession, verifyPassword, type AuthenticatedRequest } from './auth.js';
import { HttpError } from './errors.js';
import { completeLesson, ensureLessonAccessible, getBootstrap, getLesson, recordAnswer, reviewProofAttempt } from './learning.js';
import { answerPracticeQuestion, getActivePracticeSession, getPracticeSession, practiceOverview, startPracticeSession, submitPracticeSession } from './practice.js';
import { sendTutorMessage, tutorHistory } from './tutor.js';

type Row = Record<string, unknown>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validQuestionTypes = new Set(['single_choice', 'multiple_select', 'number', 'short_answer', 'proof']);
const parseJson = <T,>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value ?? '')) as T; } catch { return fallback; }
};

function param(request: Request, key: string) {
  const value = request.params[key];
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

function authed(request: Request) {
  const user = (request as AuthenticatedRequest).user;
  if (!user) throw new HttpError(401, 'Please sign in to continue.', 'unauthenticated');
  return user;
}

function stringField(value: unknown, label: string, min: number, max: number, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text.`, 'invalid_input');
  const result = value.trim();
  if (result.length < min || result.length > max) throw new HttpError(400, `${label} must be between ${min} and ${max} characters.`, 'invalid_input');
  return result;
}

async function audit(db: AppDatabase, userId: number, action: string, type: string, id: string) {
  (await db.prepare('INSERT INTO admin_audit_log (admin_user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)').run(userId, action, type, id));
}

export function createApp(db: AppDatabase) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  const router = express.Router();
  const authLimiter = createRateLimiter(12, 15 * 60_000);
  const tutorLimiter = createRateLimiter(20, 60_000);
  const apiLimiter = createRateLimiter(300, 60_000);
  router.use(apiLimiter);

  router.get('/health', (_request, response) => response.json({ ok: true, service: 'axiom-api' }));

  router.post('/auth/register', authLimiter, async (request, response) => {
    const fullName = stringField(request.body?.fullName, 'Name', 2, 60);
    const email = stringField(request.body?.email, 'Email', 3, 254).toLowerCase();
    const password = stringField(request.body?.password, 'Password', 8, 128);
    const grade = stringField(request.body?.grade, 'Grade', 0, 30, true);
    const competitionSlug = typeof request.body?.competitionSlug === 'string' ? request.body.competitionSlug : 'amc-10';
    if (!emailPattern.test(email)) throw new HttpError(400, 'Enter a valid email address.', 'invalid_email');
    const competition = (await db.prepare('SELECT slug FROM competitions WHERE slug = ? AND is_available = 1 AND is_published = 1').get(competitionSlug));
    if (!competition) throw new HttpError(400, 'That learning journey is not available yet.', 'competition_unavailable');
    if ((await db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))) throw new HttpError(409, 'An account with that email already exists.', 'email_in_use');
    const salt = randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(password, salt);
    let userId: number;
    try {
      userId = await db.transaction(async () => {
        const created = await db.prepare(`INSERT INTO users (full_name, email, password_salt, password_hash, grade, active_competition_slug)
          VALUES (?, ?, ?, ?, ?, ?)`).run(fullName, email, salt, passwordHash, grade, competitionSlug);
        const createdUserId = Number(created.lastInsertRowid);
        await db.prepare('INSERT INTO user_competitions (user_id, competition_slug) VALUES (?, ?)').run(createdUserId, competitionSlug);
        return createdUserId;
      });
    } catch (error) {
      if (String(error).includes('UNIQUE') || String(error).includes('duplicate key')) throw new HttpError(409, 'An account with that email already exists.', 'email_in_use');
      throw error;
    }
    await issueSession(db, response, userId);
    response.status(201).json({ user: await getAuthUser(db, userId) });
  });

  router.post('/auth/login', authLimiter, async (request, response) => {
    const email = stringField(request.body?.email, 'Email', 3, 254).toLowerCase();
    const password = stringField(request.body?.password, 'Password', 1, 128);
    const user = (await db.prepare('SELECT id, password_salt, password_hash FROM users WHERE email = ?').get(email)) as Record<string, unknown> | undefined;
    if (!user || !await verifyPassword(password, String(user.password_salt), String(user.password_hash))) {
      throw new HttpError(401, 'Email or password is incorrect.', 'invalid_credentials');
    }
    await issueSession(db, response, Number(user.id));
    response.json({ user: await getAuthUser(db, Number(user.id)) });
  });

  router.post('/auth/logout', authLimiter, async (request, response) => {
    await destroySession(db, request, response);
    response.json({ ok: true });
  });

  router.get('/auth/me', authRequired(db), (request, response) => response.json({ user: authed(request) }));
  router.get('/bootstrap', authRequired(db), async (request, response) => response.json(await getBootstrap(db, authed(request).id)));

  router.post('/competitions/:slug/enroll', authRequired(db), async (request, response) => {
    const user = authed(request);
    const competition = (await db.prepare('SELECT slug, is_available FROM competitions WHERE slug = ? AND is_published = 1').get(param(request, 'slug'))) as Record<string, unknown> | undefined;
    if (!competition || Number(competition.is_available) !== 1) throw new HttpError(409, 'That competition journey is not open yet.', 'competition_unavailable');
    (await db.prepare('INSERT OR IGNORE INTO user_competitions (user_id, competition_slug) VALUES (?, ?)').run(user.id, String(competition.slug)));
    (await db.prepare('UPDATE users SET active_competition_slug = ?, updated_at = ? WHERE id = ?').run(String(competition.slug), new Date().toISOString(), user.id));
    response.json({ user: await getAuthUser(db, user.id), bootstrap: await getBootstrap(db, user.id) });
  });

  router.patch('/profile', authRequired(db), async (request, response) => {
    const user = authed(request);
    const fields: string[] = [];
    const values: (string | number)[] = [];
    if (request.body?.fullName !== undefined) {
      fields.push('full_name = ?');
      values.push(stringField(request.body.fullName, 'Name', 2, 60));
    }
    if (request.body?.grade !== undefined) {
      fields.push('grade = ?');
      values.push(stringField(request.body.grade, 'Grade', 0, 30, true));
    }
    if (request.body?.dailyGoal !== undefined) {
      const goal = Number(request.body.dailyGoal);
      if (!Number.isInteger(goal) || goal < 1 || goal > 10) throw new HttpError(400, 'Daily goal must be between 1 and 10 questions.', 'invalid_input');
      fields.push('daily_goal = ?');
      values.push(goal);
    }
    if (request.body?.theme !== undefined) {
      const theme = request.body.theme;
      if (!['light', 'dark', 'system'].includes(theme)) throw new HttpError(400, 'Choose a supported appearance.', 'invalid_input');
      fields.push('theme = ?');
      values.push(theme);
    }
    if (request.body?.leaderboardOptIn !== undefined) {
      fields.push('leaderboard_opt_in = ?');
      values.push(request.body.leaderboardOptIn === true ? 1 : 0);
    }
    if (request.body?.activeCompetitionSlug !== undefined) {
      const slug = stringField(request.body.activeCompetitionSlug, 'Competition', 2, 80);
      const enrolled = (await db.prepare(`SELECT c.slug FROM competitions c JOIN user_competitions uc ON uc.competition_slug = c.slug
        WHERE uc.user_id = ? AND c.slug = ? AND c.is_available = 1 AND c.is_published = 1`).get(user.id, slug));
      if (!enrolled) throw new HttpError(409, 'Enroll in an available journey before switching to it.', 'competition_unavailable');
      fields.push('active_competition_slug = ?');
      values.push(slug);
    }
    if (fields.length) {
      fields.push('updated_at = ?');
      values.push(new Date().toISOString(), user.id);
      (await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values));
    }
    response.json({ user: await getAuthUser(db, user.id) });
  });

  router.get('/lessons/:id', authRequired(db), async (request, response) => response.json(await getLesson(db, authed(request).id, param(request, 'id'))));
  router.post('/lessons/:id/answer', authRequired(db), async (request, response) => {
    const user = authed(request);
    const lessonId = param(request, 'id');
    await ensureLessonAccessible(db, user.id, lessonId);
    const questionId = stringField(request.body?.questionId, 'Question', 1, 100);
    const question = (await db.prepare('SELECT id FROM questions WHERE id = ? AND lesson_id = ? AND is_published = 1').get(questionId, lessonId));
    if (!question) throw new HttpError(404, 'Question not found in this lesson.', 'not_found');
    response.json(await recordAnswer(db, user.id, questionId, request.body?.answer, 'lesson'));
  });
  router.post('/lessons/:id/complete', authRequired(db), async (request, response) => response.json(await completeLesson(db, authed(request).id, param(request, 'id'))));

  router.get('/practice/overview', authRequired(db), async (request, response) => response.json(await practiceOverview(db, authed(request).id)));
  router.get('/practice/sessions/active', authRequired(db), async (request, response) => response.json({ session: await getActivePracticeSession(db, authed(request).id) }));
  router.post('/practice/sessions', authRequired(db), async (request, response) => {
    const session = await startPracticeSession(db, authed(request).id, request.body?.mode, request.body?.unitId);
    response.status(201).json({ session });
  });
  router.get('/practice/sessions/:id', authRequired(db), async (request, response) => response.json({ session: await getPracticeSession(db, authed(request).id, param(request, 'id')) }));
  router.post('/practice/sessions/:id/answer', authRequired(db), async (request, response) => response.json(await answerPracticeQuestion(db, authed(request).id, param(request, 'id'), request.body?.questionId, request.body?.answer)));
  router.post('/practice/sessions/:id/submit', authRequired(db), async (request, response) => response.json({ result: await submitPracticeSession(db, authed(request).id, param(request, 'id')) }));

  router.get('/tutor/history', authRequired(db), async (request, response) => response.json({ messages: await tutorHistory(db, authed(request).id) }));
  router.post('/tutor/chat', authRequired(db), tutorLimiter, async (request, response) => response.json({ message: await sendTutorMessage(db, authed(request).id, request.body?.message, request.body?.lessonId) }));

  const admin = express.Router();
  admin.use(authRequired(db), adminRequired);
  admin.get('/content', async (_request, response) => {
    const competitions = (await db.prepare('SELECT * FROM competitions ORDER BY subject, name').all());
    const units = (await db.prepare(`SELECT u.*, c.name AS competition_name FROM units u JOIN competitions c ON c.slug = u.competition_slug ORDER BY c.name, u.sort_order`).all());
    const lessons = (await db.prepare(`SELECT l.*, u.title AS unit_title FROM lessons l JOIN units u ON u.id = l.unit_id ORDER BY u.sort_order, l.sort_order`).all()) as Row[];
    const questions = (await db.prepare(`SELECT q.*, l.title AS lesson_title FROM questions q JOIN lessons l ON l.id = q.lesson_id ORDER BY l.id, q.sort_order`).all()) as Row[];
    const assessments = (await db.prepare(`SELECT a.*, c.name AS competition_name FROM assessments a JOIN competitions c ON c.slug = a.competition_slug ORDER BY a.updated_at DESC`).all()) as Row[];
    const lessonsWithPrerequisites = await Promise.all(lessons.map(async (row) => ({ ...row, objectives: parseJson(row.objectives_json, []), body: parseJson(row.body_json, {}), prerequisiteLessonIds: (await db.prepare('SELECT prerequisite_lesson_id FROM lesson_prerequisites WHERE lesson_id = ? ORDER BY prerequisite_lesson_id').all(String(row.id))).map((item) => String((item as Row).prerequisite_lesson_id)) })));
    const assessmentsWithQuestions = await Promise.all(assessments.map(async (row) => ({ ...row, questionIds: (await db.prepare('SELECT question_id FROM assessment_questions WHERE assessment_id = ? ORDER BY sort_order').all(String(row.id))).map((item) => String((item as Row).question_id)) })));
    return response.json({ competitions, units, lessons: lessonsWithPrerequisites, questions: questions.map((row) => ({ ...row, choices: parseJson(row.choices_json, []), rubric: parseJson(row.rubric_json, []) })), assessments: assessmentsWithQuestions });
  });
  admin.get('/proof-reviews', async (_request, response) => {
    const pending = (await db.prepare(`SELECT qa.id, qa.user_id, qa.question_id, qa.submitted_answer, qa.created_at,
        q.prompt, q.rubric_json, q.objective, l.title AS lesson_title, u.title AS unit_title, users.full_name
      FROM question_attempts qa JOIN questions q ON q.id = qa.question_id JOIN lessons l ON l.id = q.lesson_id
      JOIN units u ON u.id = l.unit_id JOIN users ON users.id = qa.user_id
      WHERE q.question_type = 'proof' AND qa.review_status = 'pending' ORDER BY qa.created_at ASC LIMIT 100`).all()) as Row[];
    return response.json({ reviews: pending.map((row) => ({ id: Number(row.id), userId: Number(row.user_id), studentName: String(row.full_name), questionId: String(row.question_id), answer: String(row.submitted_answer), submittedAt: String(row.created_at), prompt: String(row.prompt), rubric: parseJson(row.rubric_json, []), objective: String(row.objective), lessonTitle: String(row.lesson_title), unitTitle: String(row.unit_title) })) });
  });
  admin.post('/proof-reviews/:id', async (request, response) => {
    const id = Number(param(request, 'id'));
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Review ID is invalid.', 'invalid_input');
    const verdict = request.body?.verdict;
    if (verdict !== 'accepted' && verdict !== 'needs_revision') throw new HttpError(400, 'Choose an accepted or needs-revision verdict.', 'invalid_input');
    const feedback = stringField(request.body?.feedback ?? '', 'Feedback', 0, 1000, true);
    const result = await reviewProofAttempt(db, id, verdict === 'accepted', feedback);
    await audit(db, authed(request).id, `proof-${verdict}`, 'question_attempt', String(id));
    response.json(result);
  });
  admin.post('/competitions', async (request, response) => {
    const slug = stringField(request.body?.slug, 'Slug', 2, 80).toLowerCase();
    if (!slugPattern.test(slug)) throw new HttpError(400, 'Use lowercase letters, numbers, and hyphens for a slug.', 'invalid_slug');
    const name = stringField(request.body?.name, 'Name', 2, 100);
    const subject = stringField(request.body?.subject, 'Subject', 2, 80);
    const level = stringField(request.body?.level, 'Level', 2, 80);
    const description = stringField(request.body?.description ?? '', 'Description', 0, 500, true);
    const format = request.body?.format && typeof request.body.format === 'object' ? request.body.format : {};
    (await db.prepare(`INSERT INTO competitions (slug, name, subject, level, description, format_json, is_available, is_published)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0)`).run(slug, name, subject, level, description, JSON.stringify(format)));
    await audit(db, authed(request).id, 'create', 'competition', slug);
    response.status(201).json({ slug });
  });
  admin.patch('/competitions/:slug', async (request, response) => {
    const slug = param(request, 'slug');
    const exists = (await db.prepare('SELECT slug FROM competitions WHERE slug = ?').get(slug));
    if (!exists) throw new HttpError(404, 'Competition not found.', 'not_found');
    if (request.body?.isAvailable !== undefined) (await db.prepare('UPDATE competitions SET is_available = ? WHERE slug = ?').run(request.body.isAvailable === true ? 1 : 0, slug));
    if (request.body?.isPublished !== undefined) (await db.prepare('UPDATE competitions SET is_published = ? WHERE slug = ?').run(request.body.isPublished === true ? 1 : 0, slug));
    await audit(db, authed(request).id, 'update', 'competition', slug);
    response.json({ ok: true });
  });
  admin.post('/units', async (request, response) => {
    const id = stringField(request.body?.id, 'Unit ID', 2, 100);
    const comp = stringField(request.body?.competitionSlug, 'Competition', 2, 80);
    if (!(await db.prepare('SELECT 1 FROM competitions WHERE slug = ?').get(comp))) throw new HttpError(404, 'Competition not found.', 'not_found');
    const sortOrder = Number(request.body?.sortOrder);
    const minutes = Number(request.body?.estimatedMinutes ?? 30);
    if (!Number.isInteger(sortOrder) || sortOrder < 1 || !Number.isInteger(minutes) || minutes < 1 || minutes > 500) throw new HttpError(400, 'Unit ordering and estimated time must be positive whole numbers.', 'invalid_input');
    (await db.prepare(`INSERT INTO units (id, competition_slug, sort_order, title, short_title, description, color, icon, estimated_minutes, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`).run(id, comp, sortOrder, stringField(request.body?.title, 'Title', 2, 120), stringField(request.body?.shortTitle ?? request.body?.title, 'Short title', 2, 80), stringField(request.body?.description ?? '', 'Description', 0, 500, true), String(request.body?.color ?? '#59776b').slice(0, 20), String(request.body?.icon ?? 'sparkles').slice(0, 40), minutes));
    await audit(db, authed(request).id, 'create', 'unit', id);
    response.status(201).json({ id });
  });
  admin.patch('/units/:id', async (request, response) => {
    const id = param(request, 'id');
    if (!(await db.prepare('SELECT id FROM units WHERE id = ?').get(id))) throw new HttpError(404, 'Unit not found.', 'not_found');
    const fields: string[] = [];
    const values: (string | number)[] = [];
    if (request.body?.title !== undefined) { fields.push('title = ?'); values.push(stringField(request.body.title, 'Title', 2, 120)); }
    if (request.body?.shortTitle !== undefined) { fields.push('short_title = ?'); values.push(stringField(request.body.shortTitle, 'Short title', 2, 80)); }
    if (request.body?.description !== undefined) { fields.push('description = ?'); values.push(stringField(request.body.description, 'Description', 0, 500, true)); }
    if (request.body?.estimatedMinutes !== undefined) { const minutes = Number(request.body.estimatedMinutes); if (!Number.isInteger(minutes) || minutes < 1 || minutes > 500) throw new HttpError(400, 'Estimated time must be between 1 and 500 minutes.', 'invalid_input'); fields.push('estimated_minutes = ?'); values.push(minutes); }
    if (request.body?.isPublished !== undefined) { fields.push('is_published = ?'); values.push(request.body.isPublished === true ? 1 : 0); }
    if (fields.length) { values.push(id); (await db.prepare(`UPDATE units SET ${fields.join(', ')} WHERE id = ?`).run(...values)); }
    await audit(db, authed(request).id, 'update', 'unit', id);
    response.json({ ok: true });
  });
  admin.post('/lessons', async (request, response) => {
    const id = stringField(request.body?.id, 'Lesson ID', 2, 100);
    const unitId = stringField(request.body?.unitId, 'Unit', 2, 100);
    if (!(await db.prepare('SELECT 1 FROM units WHERE id = ?').get(unitId))) throw new HttpError(404, 'Unit not found.', 'not_found');
    const sortOrder = Number(request.body?.sortOrder);
    const difficulty = Number(request.body?.difficulty ?? 1);
    const minutes = Number(request.body?.estimatedMinutes ?? 8);
    if (!Number.isInteger(sortOrder) || sortOrder < 1 || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5 || !Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw new HttpError(400, 'Check the lesson order, difficulty, and estimated time.', 'invalid_input');
    const objectives = Array.isArray(request.body?.objectives) ? request.body.objectives.map((item: unknown) => String(item).slice(0, 160)).slice(0, 12) : [];
    const body = request.body?.body && typeof request.body.body === 'object' ? request.body.body : {};
    (await db.prepare(`INSERT INTO lessons (id, unit_id, sort_order, title, slug, summary, objectives_json, body_json, difficulty, estimated_minutes, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`).run(id, unitId, sortOrder, stringField(request.body?.title, 'Title', 2, 160), stringField(request.body?.slug ?? id, 'Slug', 2, 120), stringField(request.body?.summary ?? '', 'Summary', 0, 500, true), JSON.stringify(objectives), JSON.stringify(body), difficulty, minutes));
    await audit(db, authed(request).id, 'create', 'lesson', id);
    response.status(201).json({ id });
  });
  admin.patch('/lessons/:id', async (request, response) => {
    const id = param(request, 'id');
    const existing = (await db.prepare('SELECT id FROM lessons WHERE id = ?').get(id));
    if (!existing) throw new HttpError(404, 'Lesson not found.', 'not_found');
    const fields: string[] = [];
    const values: (string | number)[] = [];
    const setText = (key: string, column: string, label: string, max: number) => {
      if (request.body?.[key] !== undefined) { fields.push(`${column} = ?`); values.push(stringField(request.body[key], label, 1, max)); }
    };
    setText('title', 'title', 'Title', 160);
    setText('summary', 'summary', 'Summary', 500);
    if (request.body?.objectives !== undefined) { if (!Array.isArray(request.body.objectives)) throw new HttpError(400, 'Objectives must be a list.', 'invalid_input'); fields.push('objectives_json = ?'); values.push(JSON.stringify(request.body.objectives.map((item: unknown) => String(item).slice(0, 160)).slice(0, 12))); }
    if (request.body?.body !== undefined) { if (!request.body.body || typeof request.body.body !== 'object') throw new HttpError(400, 'Lesson body must be a structured object.', 'invalid_input'); fields.push('body_json = ?'); values.push(JSON.stringify(request.body.body)); }
    if (request.body?.difficulty !== undefined) { const difficulty = Number(request.body.difficulty); if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new HttpError(400, 'Difficulty must be from 1 to 5.', 'invalid_input'); fields.push('difficulty = ?'); values.push(difficulty); }
    if (request.body?.isPublished !== undefined) { fields.push('is_published = ?'); values.push(request.body.isPublished === true ? 1 : 0); }
    if (fields.length) { fields.push('updated_at = ?'); values.push(new Date().toISOString(), id); (await db.prepare(`UPDATE lessons SET ${fields.join(', ')} WHERE id = ?`).run(...values)); }
    await audit(db, authed(request).id, 'update', 'lesson', id);
    response.json({ ok: true });
  });
  admin.put('/lessons/:id/prerequisites', async (request, response) => {
    const lessonId = param(request, 'id');
    const lesson = (await db.prepare('SELECT l.id, u.competition_slug FROM lessons l JOIN units u ON u.id = l.unit_id WHERE l.id = ?').get(lessonId)) as Row | undefined;
    if (!lesson) throw new HttpError(404, 'Lesson not found.', 'not_found');
    const prerequisites = request.body?.prerequisiteLessonIds;
    if (!Array.isArray(prerequisites) || prerequisites.length > 20) throw new HttpError(400, 'Provide a list of up to 20 prerequisite lessons.', 'invalid_input');
    const ids = [...new Set(prerequisites.map((id: unknown) => stringField(id, 'Prerequisite lesson', 2, 100)))];
    const reaches = async (start: string, target: string, visited = new Set<string>()): Promise<boolean> => {
      if (start === target) return true;
      if (visited.has(start)) return false;
      visited.add(start);
      const rows = (await db.prepare('SELECT prerequisite_lesson_id FROM lesson_prerequisites WHERE lesson_id = ?').all(start)) as Row[];
      for (const row of rows) if (await reaches(String(row.prerequisite_lesson_id), target, visited)) return true;
      return false;
    };
    for (const prerequisiteId of ids) {
      const prerequisite = (await db.prepare('SELECT l.id, u.competition_slug FROM lessons l JOIN units u ON u.id = l.unit_id WHERE l.id = ?').get(prerequisiteId)) as Row | undefined;
      if (!prerequisite || String(prerequisite.competition_slug) !== String(lesson.competition_slug)) throw new HttpError(400, 'Prerequisites must belong to the same competition.', 'invalid_reference');
      if (prerequisiteId === lessonId || await reaches(prerequisiteId, lessonId)) throw new HttpError(400, 'This prerequisite would create a progression loop.', 'invalid_prerequisite');
    }
    await db.transaction(async () => {
      await db.prepare('DELETE FROM lesson_prerequisites WHERE lesson_id = ?').run(lessonId);
      const insert = db.prepare('INSERT INTO lesson_prerequisites (lesson_id, prerequisite_lesson_id) VALUES (?, ?)');
      for (const prerequisiteId of ids) await insert.run(lessonId, prerequisiteId);
    });
    await audit(db, authed(request).id, 'update-prerequisites', 'lesson', lessonId);
    response.json({ prerequisiteLessonIds: ids });
  });
  admin.post('/questions', async (request, response) => {
    const id = stringField(request.body?.id, 'Question ID', 2, 100);
    const lessonId = stringField(request.body?.lessonId, 'Lesson', 2, 100);
    if (!(await db.prepare('SELECT 1 FROM lessons WHERE id = ?').get(lessonId))) throw new HttpError(404, 'Lesson not found.', 'not_found');
    const type = String(request.body?.type ?? '');
    if (!validQuestionTypes.has(type)) throw new HttpError(400, 'Choose a supported question type.', 'invalid_input');
    const sortOrder = Number(request.body?.sortOrder);
    const difficulty = Number(request.body?.difficulty ?? 1);
    if (!Number.isInteger(sortOrder) || sortOrder < 1 || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new HttpError(400, 'Check question order and difficulty.', 'invalid_input');
    const choices = Array.isArray(request.body?.choices) ? request.body.choices.slice(0, 12) : [];
    const rubric = Array.isArray(request.body?.rubric) ? request.body.rubric.map((item: unknown) => String(item).slice(0, 200)).slice(0, 12) : [];
    const correctAnswer = type === 'proof' ? stringField(request.body?.correctAnswer ?? '', 'Reference answer', 0, 300, true) : stringField(request.body?.correctAnswer, 'Correct answer', 1, 300);
    (await db.prepare(`INSERT INTO questions (id, lesson_id, sort_order, question_type, prompt, choices_json, correct_answer, hint, explanation, difficulty, objective, is_published, rubric_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).run(id, lessonId, sortOrder, type, stringField(request.body?.prompt, 'Prompt', 3, 1000), JSON.stringify(choices), correctAnswer, stringField(request.body?.hint ?? '', 'Hint', 0, 500, true), stringField(request.body?.explanation ?? '', 'Explanation', 0, 1500, true), difficulty, stringField(request.body?.objective ?? '', 'Objective', 0, 160, true), JSON.stringify(rubric)));
    await audit(db, authed(request).id, 'create', 'question', id);
    response.status(201).json({ id });
  });
  admin.patch('/questions/:id', async (request, response) => {
    const id = param(request, 'id');
    const exists = (await db.prepare('SELECT id, question_type FROM questions WHERE id = ?').get(id)) as Row | undefined;
    if (!exists) throw new HttpError(404, 'Question not found.', 'not_found');
    const fields: string[] = [];
    const values: (string | number)[] = [];
    const textFields: Record<string, [string, string, number]> = { prompt: ['prompt', 'Prompt', 1000], correctAnswer: ['correct_answer', 'Correct answer', 300], hint: ['hint', 'Hint', 500], explanation: ['explanation', 'Explanation', 1500], objective: ['objective', 'Objective', 160] };
    for (const [key, [column, label, max]] of Object.entries(textFields)) {
      if (request.body?.[key] !== undefined) { fields.push(`${column} = ?`); const optional = key === 'hint' || key === 'explanation' || key === 'objective' || (key === 'correctAnswer' && String(exists.question_type) === 'proof'); values.push(stringField(request.body[key], label, key === 'prompt' || (key === 'correctAnswer' && !optional) ? 1 : 0, max, optional)); }
    }
    if (request.body?.choices !== undefined) { if (!Array.isArray(request.body.choices)) throw new HttpError(400, 'Choices must be a list.', 'invalid_input'); fields.push('choices_json = ?'); values.push(JSON.stringify(request.body.choices.slice(0, 12))); }
    if (request.body?.rubric !== undefined) { if (!Array.isArray(request.body.rubric)) throw new HttpError(400, 'Proof rubric must be a list.', 'invalid_input'); fields.push('rubric_json = ?'); values.push(JSON.stringify(request.body.rubric.map((item: unknown) => String(item).slice(0, 200)).slice(0, 12))); }
    if (request.body?.difficulty !== undefined) { const difficulty = Number(request.body.difficulty); if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new HttpError(400, 'Difficulty must be from 1 to 5.', 'invalid_input'); fields.push('difficulty = ?'); values.push(difficulty); }
    if (request.body?.isPublished !== undefined) { fields.push('is_published = ?'); values.push(request.body.isPublished === true ? 1 : 0); }
    if (fields.length) { values.push(id); (await db.prepare(`UPDATE questions SET ${fields.join(', ')} WHERE id = ?`).run(...values)); }
    await audit(db, authed(request).id, 'update', 'question', id);
    response.json({ ok: true });
  });
  admin.post('/assessments', async (request, response) => {
    const id = stringField(request.body?.id, 'Assessment ID', 2, 100);
    const competitionSlug = stringField(request.body?.competitionSlug, 'Competition', 2, 80);
    const type = String(request.body?.type ?? '');
    if (!['diagnostic', 'topic', 'unit', 'mock'].includes(type)) throw new HttpError(400, 'Choose a supported assessment type.', 'invalid_input');
    if (!(await db.prepare('SELECT 1 FROM competitions WHERE slug = ?').get(competitionSlug))) throw new HttpError(404, 'Competition not found.', 'not_found');
    const seconds = Number(request.body?.timeLimitSeconds ?? 0);
    const passingScore = Number(request.body?.passingScore ?? 0.7);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 8 * 60 * 60 || !Number.isFinite(passingScore) || passingScore < 0 || passingScore > 1) throw new HttpError(400, 'Check the assessment time limit and passing score.', 'invalid_input');
    (await db.prepare(`INSERT INTO assessments (id, competition_slug, title, description, assessment_type, time_limit_seconds, passing_score, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)`).run(id, competitionSlug, stringField(request.body?.title, 'Title', 2, 160), stringField(request.body?.description ?? '', 'Description', 0, 600, true), type, seconds, passingScore));
    await audit(db, authed(request).id, 'create', 'assessment', id);
    response.status(201).json({ id });
  });
  admin.patch('/assessments/:id', async (request, response) => {
    const id = param(request, 'id');
    if (!(await db.prepare('SELECT id FROM assessments WHERE id = ?').get(id))) throw new HttpError(404, 'Assessment not found.', 'not_found');
    const fields: string[] = [];
    const values: (string | number)[] = [];
    if (request.body?.title !== undefined) { fields.push('title = ?'); values.push(stringField(request.body.title, 'Title', 2, 160)); }
    if (request.body?.description !== undefined) { fields.push('description = ?'); values.push(stringField(request.body.description, 'Description', 0, 600, true)); }
    if (request.body?.timeLimitSeconds !== undefined) { const seconds = Number(request.body.timeLimitSeconds); if (!Number.isInteger(seconds) || seconds < 0 || seconds > 8 * 60 * 60) throw new HttpError(400, 'Time limit must be a non-negative number of seconds.', 'invalid_input'); fields.push('time_limit_seconds = ?'); values.push(seconds); }
    if (request.body?.passingScore !== undefined) { const score = Number(request.body.passingScore); if (!Number.isFinite(score) || score < 0 || score > 1) throw new HttpError(400, 'Passing score must be between 0 and 1.', 'invalid_input'); fields.push('passing_score = ?'); values.push(score); }
    if (request.body?.isPublished !== undefined) { fields.push('is_published = ?'); values.push(request.body.isPublished === true ? 1 : 0); }
    if (fields.length) { fields.push('updated_at = ?'); values.push(new Date().toISOString(), id); (await db.prepare(`UPDATE assessments SET ${fields.join(', ')} WHERE id = ?`).run(...values)); }
    await audit(db, authed(request).id, 'update', 'assessment', id);
    response.json({ ok: true });
  });
  admin.put('/assessments/:id/questions', async (request, response) => {
    const id = param(request, 'id');
    const assessment = (await db.prepare('SELECT competition_slug FROM assessments WHERE id = ?').get(id)) as Row | undefined;
    if (!assessment) throw new HttpError(404, 'Assessment not found.', 'not_found');
    const entries = request.body?.questions;
    if (!Array.isArray(entries) || entries.length > 200) throw new HttpError(400, 'Provide a list of up to 200 assessment questions.', 'invalid_input');
    const normalized = await Promise.all(entries.map(async (entry: unknown, index: number) => {
      const value = entry as Record<string, unknown>;
      const questionId = stringField(value?.questionId, 'Question', 2, 100);
      const points = Number(value?.points ?? 1);
      if (!Number.isFinite(points) || points <= 0 || points > 100) throw new HttpError(400, `Question ${index + 1} needs a positive point value.`, 'invalid_input');
      const question = (await db.prepare(`SELECT q.id FROM questions q JOIN lessons l ON l.id = q.lesson_id JOIN units u ON u.id = l.unit_id
        WHERE q.id = ? AND u.competition_slug = ?`).get(questionId, String(assessment.competition_slug)));
      if (!question) throw new HttpError(400, 'All questions must belong to the assessment’s competition.', 'invalid_reference');
      return { questionId, points };
    }));
    await db.transaction(async () => {
      await db.prepare('DELETE FROM assessment_questions WHERE assessment_id = ?').run(id);
      const insert = db.prepare('INSERT INTO assessment_questions (assessment_id, question_id, sort_order, point_value) VALUES (?, ?, ?, ?)');
      for (const [index, entry] of normalized.entries()) await insert.run(id, entry.questionId, index + 1, entry.points);
      await db.prepare('UPDATE assessments SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    });
    await audit(db, authed(request).id, 'configure-questions', 'assessment', id);
    response.json({ questions: normalized.length });
  });
  app.use('/api/admin', admin);
  app.use('/api', router);
  app.use('/api', (_request, response) => response.status(404).json({ error: 'That API endpoint could not be found.', code: 'not_found' }));

  if (process.env.NODE_ENV === 'production') {
    const distPath = resolve(process.cwd(), 'dist');
    if (existsSync(distPath)) {
      app.use(express.static(distPath, { maxAge: '1h', index: false }));
      app.get(/^(?!\/api).*/, (_request, response) => response.sendFile(resolve(distPath, 'index.html')));
    }
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof HttpError) return response.status(error.status).json({ error: error.message, code: error.code });
    const databaseError = error as { code?: string };
    if (databaseError?.code === '23505' || String(error).includes('UNIQUE constraint failed') || String(error).includes('duplicate key')) return response.status(409).json({ error: 'That item already exists.', code: 'conflict' });
    if (databaseError?.code === '23503' || String(error).includes('FOREIGN KEY constraint failed') || String(error).includes('violates foreign key constraint')) return response.status(400).json({ error: 'A related content item could not be found.', code: 'invalid_reference' });
    console.error(JSON.stringify({ level: 'error', message: error instanceof Error ? error.message : String(error), time: new Date().toISOString() }));
    return response.status(500).json({ error: 'Something went wrong. Please try again.', code: 'internal_error' });
  };
  app.use(errorHandler);
  return app;
}
