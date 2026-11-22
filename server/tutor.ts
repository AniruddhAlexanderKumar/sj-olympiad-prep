import type { AppDatabase } from './db.js';
import { HttpError } from './errors.js';
import { ensureLessonAccessible } from './learning.js';

const parseJson = <T,>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value ?? '')) as T; } catch { return fallback; }
};

type Row = Record<string, unknown>;

export async function tutorHistory(db: AppDatabase, userId: number) {
  const rows = (await db.prepare(`SELECT id, role, content, lesson_id, created_at FROM tutor_messages
    WHERE user_id = ? ORDER BY id DESC LIMIT 40`).all(userId)) as Row[];
  return rows.reverse().map((row) => ({ id: Number(row.id), role: String(row.role), content: String(row.content), lessonId: row.lesson_id ? String(row.lesson_id) : null, createdAt: String(row.created_at) }));
}

export async function sendTutorMessage(db: AppDatabase, userId: number, messageInput: unknown, lessonIdInput?: unknown) {
  const message = typeof messageInput === 'string' ? messageInput.trim() : '';
  if (!message || message.length > 1000) throw new HttpError(400, 'Write a message between 1 and 1,000 characters.', 'invalid_message');
  let lessonId = typeof lessonIdInput === 'string' && lessonIdInput.length <= 100 ? lessonIdInput : undefined;
  let lesson: Row | undefined;
  if (lessonId) {
    lesson = (await db.prepare(`SELECT l.*, u.title AS unit_title, u.id AS unit_id, u.competition_slug, c.name AS competition_name
      FROM lessons l JOIN units u ON u.id = l.unit_id JOIN competitions c ON c.slug = u.competition_slug
      WHERE l.id = ? AND l.is_published = 1`).get(lessonId)) as Row | undefined;
    if (!lesson) lessonId = undefined;
    else await ensureLessonAccessible(db, userId, lessonId, String(lesson.competition_slug));
  }
  const active = (await db.prepare(`SELECT c.slug FROM users u JOIN competitions c ON c.slug = u.active_competition_slug
    WHERE u.id = ?`).get(userId)) as Row | undefined;
  const competitionSlug = String(active?.slug ?? 'amc-10');
  if (!lesson) {
    const current = (await db.prepare(`SELECT l.*, u.title AS unit_title, u.id AS unit_id, u.competition_slug, c.name AS competition_name
      FROM lessons l JOIN units u ON u.id = l.unit_id JOIN competitions c ON c.slug = u.competition_slug
      WHERE u.competition_slug = ? AND l.is_published = 1 AND u.is_published = 1
        AND NOT EXISTS(SELECT 1 FROM lesson_prerequisites p LEFT JOIN lesson_progress lp
          ON lp.user_id = ? AND lp.lesson_id = p.prerequisite_lesson_id
          WHERE p.lesson_id = l.id AND lp.completed_at IS NULL)
      ORDER BY u.sort_order, l.sort_order LIMIT 1`).get(competitionSlug, userId)) as Row | undefined;
    lesson = current;
    lessonId = current ? String(current.id) : undefined;
  }
  if (lesson && String(lesson.competition_slug) !== competitionSlug) {
    lesson = undefined;
    lessonId = undefined;
  }

  const body = lesson ? parseJson<Record<string, unknown>>(lesson.body_json, {}) : {};
  const explanation = Array.isArray(body.explanation) ? body.explanation.map(String) : [];
  const lastMistake = (await db.prepare(`SELECT q.id, q.prompt, q.hint, q.explanation, q.lesson_id, l.title AS lesson_title,
      COUNT(qa.id) AS attempts, SUM(CASE WHEN qa.is_correct = 0 THEN 1 ELSE 0 END) AS wrong_attempts
    FROM question_attempts qa JOIN questions q ON q.id = qa.question_id JOIN lessons l ON l.id = q.lesson_id
    WHERE qa.user_id = ? AND qa.is_correct = 0 AND (CAST(? AS TEXT) IS NULL OR q.lesson_id = ?)
      AND NOT EXISTS (SELECT 1 FROM question_attempts later WHERE later.user_id = qa.user_id
        AND later.question_id = qa.question_id AND later.is_correct = 1 AND later.id > qa.id)
    GROUP BY q.id, l.title ORDER BY MAX(qa.id) DESC LIMIT 1`).get(userId, lessonId ?? null, lessonId ?? null)) as Row | undefined;
  const masteryRows = (await db.prepare(`SELECT u.id, u.title, COALESCE(tm.mastery_score, 0) AS mastery_score
    FROM units u LEFT JOIN topic_mastery tm ON tm.unit_id = u.id AND tm.user_id = ?
    WHERE u.competition_slug = ? AND u.is_published = 1 ORDER BY mastery_score ASC, u.sort_order`).all(userId, competitionSlug)) as Row[];
  const weakest = masteryRows[0];
  const score = Number(lesson ? (await db.prepare('SELECT mastery_score FROM topic_mastery WHERE user_id = ? AND unit_id = ?').get(userId, String(lesson.unit_id)))?.mastery_score ?? 0 : 0);
  const asksForHint = /hint|stuck|where (?:do|should) i start|help me start/i.test(message);
  const asksForSolution = /full solution|show (?:me )?(?:the )?answer|solve (?:it|this)|explain (?:the )?(?:solution|answer)/i.test(message);
  const asksForPlan = /weak|revise|revision|study plan|what should i (?:study|work on)|where should i focus/i.test(message);
  const asksForPractice = /practice|another question|give me a problem|challenge me/i.test(message);
  let response: string;

  if ((asksForHint || asksForSolution) && lastMistake) {
    const questionAttempts = Number(lastMistake.attempts ?? 0);
    const hint = String(lastMistake.hint);
    const solution = String(lastMistake.explanation);
    if (asksForSolution && questionAttempts >= 2) {
      response = `You have already taken another pass at “${String(lastMistake.prompt)},” so here is the full reasoning. ${solution}\n\nThe important move is to identify the structure before calculating.`;
    } else {
      response = `Let's keep the answer yours. For “${String(lastMistake.prompt)},” try this next step: ${hint}\n\nWrite down what you know, then take one more attempt. I can walk through the full reasoning after you've had another try.`;
    }
  } else if (asksForPlan && weakest) {
    const next = (await db.prepare(`SELECT l.title, l.id FROM lessons l WHERE l.unit_id = ? AND l.is_published = 1
      ORDER BY l.sort_order LIMIT 1`).get(String(weakest.id))) as Row | undefined;
    response = `A useful next focus is ${String(weakest.title)} (${Math.round(Number(weakest.mastery_score) * 100)}% estimated mastery so far). ${next ? `Start with “${String(next.title)}” and practise one idea at a time.` : 'I will suggest a lesson here as soon as this topic has published content.'} I use recent answers and question difficulty for this estimate; it is a study signal, not a grade.`;
  } else if (asksForPractice && weakest) {
    const question = (await db.prepare(`SELECT q.prompt, q.objective, u.title AS unit_title FROM questions q
      JOIN lessons l ON l.id = q.lesson_id JOIN units u ON u.id = l.unit_id
      WHERE u.id = ? AND q.is_published = 1 AND NOT EXISTS (
        SELECT 1 FROM lesson_prerequisites p LEFT JOIN lesson_progress lp
          ON lp.user_id = ? AND lp.lesson_id = p.prerequisite_lesson_id
          WHERE p.lesson_id = l.id AND lp.completed_at IS NULL
      ) ORDER BY RANDOM() LIMIT 1`).get(String(weakest.id), userId)) as Row | undefined;
    response = question
      ? `A short practice prompt from ${String(question.unit_title)}: ${String(question.prompt)}\n\nTry it without looking anything up. If you get stuck, ask me for a hint and I will give you one step at a time.`
      : `Your current focus is ${String(weakest.title)}. Finish the next lesson there to unlock a fresh practice question.`;
  } else if (lesson && explanation.length) {
    const first = explanation[0];
    const second = explanation[1];
    const adaptation = score < 0.35 ? 'Let’s keep the first pass concrete and build up from a small example.' : score >= 0.8 ? 'You have a strong base here; look for a shortcut or a way to generalize the pattern.' : 'Try to connect the definition to the worked example before reaching for a shortcut.';
    response = `For ${String(lesson.title)}, start with this idea: ${first}${second ? ` ${second}` : ''}\n\n${adaptation} What part would you like to unpack?`;
  } else {
    response = weakest
      ? `I’m here to help you make the next step, not skip the thinking. Your current AMC 10 focus is ${String(weakest.title)}. Ask for a hint, a simpler explanation, a revision recommendation, or another practice question.`
      : 'I can help with a hint, a concept explanation, a revision recommendation, or an extra practice question. Which would be most useful right now?';
  }

  const now = new Date().toISOString();
  (await db.prepare('INSERT INTO tutor_messages (user_id, role, content, lesson_id, created_at) VALUES (?, \'student\', ?, ?, ?)')
    .run(userId, message, lessonId ?? null, now));
  const created = (await db.prepare(`INSERT INTO tutor_messages (user_id, role, content, lesson_id, created_at)
    VALUES (?, 'tutor', ?, ?, ?)`).run(userId, response, lessonId ?? null, new Date(Date.now() + 1).toISOString()));
  return { id: Number(created.lastInsertRowid), role: 'tutor', content: response, lessonId: lessonId ?? null, createdAt: new Date(Date.now() + 1).toISOString(), context: lesson ? { lessonTitle: String(lesson.title), topic: String(lesson.unit_title), mastery: score } : null };
}
