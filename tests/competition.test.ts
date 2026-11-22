import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db.js';

test('switching a competition preserves each independent journey and its progress', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'axiom-journeys-'));
  const db = await createDatabase(join(folder, 'test.sqlite'));
  let server: Server | undefined;
  try {
    await db.prepare("UPDATE competitions SET is_available = 1, is_published = 1 WHERE slug = 'amc-8'").run();
    await db.prepare(`INSERT INTO units (id, competition_slug, sort_order, title, short_title, description, is_published)
      VALUES ('amc8-arithmetic', 'amc-8', 1, 'Arithmetic', 'Arithmetic', 'A separate sample syllabus.', 1)`).run();
    await db.prepare(`INSERT INTO lessons (id, unit_id, sort_order, title, slug, summary, objectives_json, body_json, difficulty, estimated_minutes, is_published)
      VALUES ('amc8-place-value', 'amc8-arithmetic', 1, 'Place value patterns', 'amc8-place-value', 'An original sample lesson.', '[]', '{}', 1, 5, 1)`).run();
    await db.prepare(`INSERT INTO questions (id, lesson_id, sort_order, question_type, prompt, choices_json, correct_answer, hint, explanation, difficulty, objective, is_published)
      VALUES ('q-amc8-place-value', 'amc8-place-value', 1, 'number', 'What is 3 × 3?', '[]', '9', 'Multiply the two factors.', 'Three groups of three make nine.', 1, 'Multiplication', 1)`).run();

    server = createApp(db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/api`;
    const send = async (path: string, options: { method?: string; body?: unknown; cookie?: string } = {}) => {
      const headers = new Headers();
      if (options.body !== undefined) headers.set('content-type', 'application/json');
      if (options.cookie) headers.set('cookie', options.cookie);
      const response = await fetch(`${base}${path}`, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
      return { response, data: await response.json() as Record<string, any> };
    };

    const signup = await send('/auth/register', { method: 'POST', body: { fullName: 'Casey Learner', email: 'casey@example.com', password: 'learning-journeys-42', grade: '8', competitionSlug: 'amc-10' } });
    const cookie = signup.response.headers.get('set-cookie')!.split(';')[0];
    const firstAnswer = await send('/lessons/nt-remainders/answer', { method: 'POST', cookie, body: { questionId: 'q-nt-rem-1', answer: 'B' } });
    assert.equal(firstAnswer.data.correct, true);
    const secondQuestion = await db.prepare("SELECT correct_answer FROM questions WHERE id = 'q-nt-rem-2'").get() as { correct_answer: string };
    const secondAnswer = await send('/lessons/nt-remainders/answer', { method: 'POST', cookie, body: { questionId: 'q-nt-rem-2', answer: secondQuestion.correct_answer } });
    assert.equal(secondAnswer.data.correct, true);
    const completed = await send('/lessons/nt-remainders/complete', { method: 'POST', cookie, body: {} });
    assert.equal(completed.data.completed, true);

    const enroll = await send('/competitions/amc-8/enroll', { method: 'POST', cookie, body: {} });
    assert.equal(enroll.response.status, 200);
    assert.equal(enroll.data.bootstrap.competition.slug, 'amc-8');
    assert.equal(enroll.data.bootstrap.currentLesson.id, 'amc8-place-value');
    assert.deepEqual(enroll.data.bootstrap.enrolledCompetitions.sort(), ['amc-10', 'amc-8']);

    const switchBack = await send('/profile', { method: 'PATCH', cookie, body: { activeCompetitionSlug: 'amc-10' } });
    assert.equal(switchBack.response.status, 200);
    const resumed = await send('/bootstrap', { cookie });
    assert.equal(resumed.data.competition.slug, 'amc-10');
    assert.equal(resumed.data.units[0].lessons[0].status, 'mastered');
    assert.equal(resumed.data.stats.completedLessons, 1);
  } finally {
    if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
