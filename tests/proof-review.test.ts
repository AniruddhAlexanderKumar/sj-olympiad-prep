import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { bootstrapAdmin } from '../server/auth.js';
import { createDatabase } from '../server/db.js';

test('proof submissions wait for rubric review and never reveal an automatic answer key', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'axiom-proof-review-'));
  const previousAdminEmail = process.env.ADMIN_EMAIL;
  const previousAdminPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_EMAIL = 'reviewer@example.com';
  process.env.ADMIN_PASSWORD = 'careful-review-password-92';
  const db = await createDatabase(join(folder, 'test.sqlite'));
  let server: Server | undefined;
  try {
    await bootstrapAdmin(db);
    await db.prepare(`UPDATE questions SET question_type = 'proof', correct_answer = '', rubric_json = ? WHERE id = 'q-nt-rem-1'`)
      .run(JSON.stringify(['States the claim clearly', 'Uses congruences correctly', 'Explains why the conclusion follows']));
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

    const studentSignup = await send('/auth/register', { method: 'POST', body: { fullName: 'Alex Student', email: 'alex@example.com', password: 'student-password-123', grade: '10', competitionSlug: 'amc-10' } });
    assert.equal(studentSignup.response.status, 201);
    const studentCookie = studentSignup.response.headers.get('set-cookie')!.split(';')[0];
    const adminLogin = await send('/auth/login', { method: 'POST', body: { email: 'reviewer@example.com', password: 'careful-review-password-92' } });
    assert.equal(adminLogin.response.status, 200);
    const adminCookie = adminLogin.response.headers.get('set-cookie')!.split(';')[0];

    const submitted = await send('/lessons/nt-remainders/answer', { method: 'POST', cookie: studentCookie, body: { questionId: 'q-nt-rem-1', answer: 'Since n is congruent to 1 modulo 4, n squared is congruent to 1 modulo 8, which proves the result.' } });
    assert.equal(submitted.response.status, 200);
    assert.equal(submitted.data.correct, false);
    assert.equal(submitted.data.needsReview, true);
    assert.equal(submitted.data.xpAwarded, 0);
    assert.equal(submitted.data.correctAnswer, undefined);
    assert.equal(submitted.data.explanation, undefined);
    assert.match(submitted.data.feedback, /not been automatically graded/i);

    const pending = await send('/admin/proof-reviews', { cookie: adminCookie });
    assert.equal(pending.response.status, 200);
    assert.equal(pending.data.reviews.length, 1);
    assert.deepEqual(pending.data.reviews[0].rubric, ['States the claim clearly', 'Uses congruences correctly', 'Explains why the conclusion follows']);
    const content = await send('/admin/content', { cookie: adminCookie });
    assert.equal(content.response.status, 200);
    assert.deepEqual(content.data.questions.find((question: any) => question.id === 'q-nt-rem-1').rubric, pending.data.reviews[0].rubric);

    const reviewed = await send(`/admin/proof-reviews/${pending.data.reviews[0].id}`, { method: 'POST', cookie: adminCookie, body: { verdict: 'accepted', feedback: 'Clear congruence setup. Add one sentence explaining why 8 divides n squared minus 1.' } });
    assert.equal(reviewed.response.status, 200);
    assert.equal(reviewed.data.accepted, true);
    assert.equal(reviewed.data.reviewed, true);
    assert.ok(reviewed.data.xpAwarded > 0);

    const studentLesson = await send('/lessons/nt-remainders', { cookie: studentCookie });
    const proofQuestion = studentLesson.data.questions.find((question: any) => question.id === 'q-nt-rem-1');
    assert.equal(proofQuestion.reviewPending, false);
    assert.match(proofQuestion.reviewerFeedback, /Clear congruence setup/);
    const queueAfter = await send('/admin/proof-reviews', { cookie: adminCookie });
    assert.equal(queueAfter.data.reviews.length, 0);
    assert.equal((await send('/admin/proof-reviews', { cookie: studentCookie })).response.status, 403);
  } finally {
    if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await db.close();
    rmSync(folder, { recursive: true, force: true });
    if (previousAdminEmail === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = previousAdminEmail;
    if (previousAdminPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previousAdminPassword;
  }
});
