import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { bootstrapAdmin } from '../server/auth.js';
import { PostgresDatabase, type PostgresPoolLike } from '../server/db.js';
import { seedContent } from '../server/db.js';

function pglitePool(pg: PGlite): PostgresPoolLike {
  const query = async (text: string, values?: any[]) => await pg.query(text, values) as any;
  return {
    query,
    connect: async () => ({ query, release: () => undefined }),
    end: async () => { await pg.close(); },
  };
}

test('core student journey runs against PostgreSQL SQL and schema', async () => {
  const previousAdminEmail = process.env.ADMIN_EMAIL;
  const previousAdminPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_EMAIL = 'pg-reviewer@example.com';
  process.env.ADMIN_PASSWORD = 'pg-reviewer-password-92';
  const pg = new PGlite();
  const db = new PostgresDatabase(pglitePool(pg));
  let server: Server | undefined;
  try {
    await db.exec(readFileSync(new URL('../server/migrations/postgres/001_initial.sql', import.meta.url), 'utf8'));
    await seedContent(db);
    await seedContent(db);
    await bootstrapAdmin(db);
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

    const signup = await send('/auth/register', { method: 'POST', body: { fullName: 'Postgres Student', email: 'pg-student@example.com', password: 'postgres-student-password', grade: '10', competitionSlug: 'amc-10' } });
    assert.equal(signup.response.status, 201);
    const cookie = signup.response.headers.get('set-cookie')!.split(';')[0];
    const adminLogin = await send('/auth/login', { method: 'POST', body: { email: 'pg-reviewer@example.com', password: 'pg-reviewer-password-92' } });
    assert.equal(adminLogin.response.status, 200);
    const adminCookie = adminLogin.response.headers.get('set-cookie')!.split(';')[0];
    const adminContent = await send('/admin/content', { cookie: adminCookie });
    assert.equal(adminContent.response.status, 200);
    const assessment = await send('/admin/assessments', { method: 'POST', cookie: adminCookie, body: { id: 'pg-diagnostic', competitionSlug: 'amc-10', title: 'Postgres diagnostic', type: 'diagnostic', timeLimitSeconds: 300, passingScore: 0.7 } });
    assert.equal(assessment.response.status, 201);
    const configured = await send('/admin/assessments/pg-diagnostic/questions', { method: 'PUT', cookie: adminCookie, body: { questions: [{ questionId: 'q-nt-rem-1', points: 2 }] } });
    assert.equal(configured.response.status, 200);
    const updatedContent = await send('/admin/content', { cookie: adminCookie });
    assert.deepEqual(updatedContent.data.assessments.find((item: any) => item.id === 'pg-diagnostic').questionIds, ['q-nt-rem-1']);

    const bootstrap = await send('/bootstrap', { cookie });
    assert.equal(bootstrap.response.status, 200);
    assert.equal(bootstrap.data.stats.totalLessons, 12);
    assert.equal(bootstrap.data.currentLesson.id, 'nt-remainders');

    const lesson = await send('/lessons/nt-remainders', { cookie });
    assert.equal(lesson.response.status, 200);
    const answer = await send('/lessons/nt-remainders/answer', { method: 'POST', cookie, body: { questionId: 'q-nt-rem-1', answer: 'B' } });
    assert.equal(answer.response.status, 200);
    assert.equal(answer.data.correct, true);
    assert.ok(answer.data.xpAwarded > 0);

    const practice = await send('/practice/sessions', { method: 'POST', cookie, body: { mode: 'mixed' } });
    assert.equal(practice.response.status, 201);
    assert.ok(practice.data.session.questions.length > 0);
    const practiceQuestion = practice.data.session.questions[0];
    const practiceAnswer = await db.prepare('SELECT correct_answer FROM questions WHERE id = ?').get(practiceQuestion.id) as { correct_answer: string };
    const savedAnswer = await send(`/practice/sessions/${practice.data.session.id}/answer`, { method: 'POST', cookie, body: { questionId: practiceQuestion.id, answer: practiceAnswer.correct_answer } });
    assert.equal(savedAnswer.response.status, 200);
    assert.equal(savedAnswer.data.correct, true);
    const practiceResult = await send(`/practice/sessions/${practice.data.session.id}/submit`, { method: 'POST', cookie, body: {} });
    assert.equal(practiceResult.response.status, 200);
    assert.equal(practiceResult.data.result.correctCount, 1);
    const tutor = await send('/tutor/chat', { method: 'POST', cookie, body: { message: 'Can you suggest a study plan?' } });
    assert.equal(tutor.response.status, 200);
    assert.equal(tutor.data.message.role, 'tutor');

    const profile = await send('/profile', { method: 'PATCH', cookie, body: { theme: 'dark', dailyGoal: 4 } });
    assert.equal(profile.response.status, 200);
    assert.equal(profile.data.user.theme, 'dark');
    assert.equal(profile.data.user.dailyGoal, 4);
  } finally {
    if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await db.close();
    if (previousAdminEmail === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = previousAdminEmail;
    if (previousAdminPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previousAdminPassword;
  }
});
