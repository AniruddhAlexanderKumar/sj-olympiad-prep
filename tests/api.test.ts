import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db.js';

test('student can register, learn, earn progress, practise, and resume from the database', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'axiom-test-'));
  const databasePath = join(folder, 'test.sqlite');
  let db = await createDatabase(databasePath);
  let server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  let base = `http://127.0.0.1:${address.port}/api`;
  let cookie = '';
  const send = async (path: string, options: { method?: string; body?: unknown; cookie?: string } = {}) => {
    const headers = new Headers();
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    if (options.cookie) headers.set('cookie', options.cookie);
    const response = await fetch(`${base}${path}`, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const data = await response.json() as Record<string, any>;
    return { response, data };
  };
  try {
    const unauthenticated = await send('/bootstrap');
    assert.equal(unauthenticated.response.status, 401);

    const missingEndpoint = await send('/this-route-does-not-exist');
    assert.equal(missingEndpoint.response.status, 404);
    assert.ok((missingEndpoint.response.headers.get('content-type') ?? '').includes('application/json'));
    assert.equal(missingEndpoint.data.code, 'not_found');

    const invalidEmail = await send('/auth/register', { method: 'POST', body: { fullName: 'Jordan Learner', email: 'not-an-email', password: 'thoughtful-study-42', grade: '10', competitionSlug: 'amc-10' } });
    assert.equal(invalidEmail.response.status, 400);
    assert.equal(invalidEmail.data.code, 'invalid_email');

    const signup = await send('/auth/register', { method: 'POST', body: { fullName: '  Jordan Learner  ', email: 'JORDAN@EXAMPLE.COM', password: 'thoughtful-study-42', grade: '10', competitionSlug: 'amc-10' } });
    assert.equal(signup.response.status, 201);
    assert.equal(signup.data.user.fullName, 'Jordan Learner');
    assert.equal(signup.data.user.email, 'jordan@example.com');
    const setCookie = signup.response.headers.get('set-cookie');
    assert.ok(setCookie?.includes('axiom_session='));
    cookie = setCookie!.split(';')[0];

    const duplicateSignup = await send('/auth/register', { method: 'POST', body: { fullName: 'Another Name', email: 'JORDAN@example.com', password: 'thoughtful-study-42', grade: '', competitionSlug: 'amc-10' } });
    assert.equal(duplicateSignup.response.status, 409);
    assert.equal(duplicateSignup.data.code, 'email_in_use');

    const adminAccess = await send('/admin/content', { cookie });
    assert.equal(adminAccess.response.status, 403);

    const firstBootstrap = await send('/bootstrap', { cookie });
    assert.equal(firstBootstrap.response.status, 200);
    assert.equal(firstBootstrap.data.units.length, 4);
    assert.equal(firstBootstrap.data.stats.totalLessons, 12);
    assert.equal(firstBootstrap.data.currentLesson.id, 'nt-remainders');
    assert.equal(firstBootstrap.data.units[0].lessons[0].status, 'available');
    assert.equal(firstBootstrap.data.units[0].lessons[1].status, 'locked');

    const lessonResponse = await send('/lessons/nt-remainders', { cookie });
    assert.equal(lessonResponse.response.status, 200);
    assert.equal(lessonResponse.data.questions.length, 2);
    assert.equal('correct_answer' in lessonResponse.data.questions[0], false);
    assert.equal('answer' in lessonResponse.data.questions[0], false);

    const wrongFirstTry = await send('/lessons/nt-remainders/answer', { method: 'POST', cookie, body: { questionId: 'q-nt-rem-1', answer: 'A' } });
    assert.equal(wrongFirstTry.data.correct, false);
    assert.ok(wrongFirstTry.data.hint);
    assert.equal(wrongFirstTry.data.explanation, undefined);
    assert.equal(wrongFirstTry.data.correctAnswer, undefined);

    const rightRetry = await send('/lessons/nt-remainders/answer', { method: 'POST', cookie, body: { questionId: 'q-nt-rem-1', answer: 'B' } });
    assert.equal(rightRetry.data.correct, true);
    assert.ok(rightRetry.data.explanation);
    assert.ok(rightRetry.data.xpAwarded > 0);

    const numericTry = await send('/lessons/nt-remainders/answer', { method: 'POST', cookie, body: { questionId: 'q-nt-rem-2', answer: '2' } });
    assert.equal(numericTry.data.correct, false);
    assert.ok(numericTry.data.hint);
    const completion = await send('/lessons/nt-remainders/complete', { method: 'POST', cookie, body: {} });
    assert.equal(completion.response.status, 200);
    assert.equal(completion.data.completed, true);
    assert.equal(completion.data.masteryScore, 0.5);
    assert.equal(completion.data.newlyUnlocked.id, 'nt-divisibility');

    const afterLesson = await send('/bootstrap', { cookie });
    assert.equal(afterLesson.data.stats.completedLessons, 1);
    assert.ok(afterLesson.data.stats.xp >= 40);
    assert.equal(afterLesson.data.units[0].lessons[0].status, 'completed');
    assert.equal(afterLesson.data.units[0].lessons[1].status, 'available');
    assert.ok(afterLesson.data.achievements.some((item: any) => item.slug === 'first-step' && item.earnedAt));

    const lessonRestricted = await send('/lessons/nt-prime-factors', { cookie });
    assert.equal(lessonRestricted.response.status, 409);

    const reviewBootstrap = await send('/bootstrap', { cookie });
    assert.equal(reviewBootstrap.data.stats.dueReviews, 1);
    const review = await send('/practice/sessions', { method: 'POST', cookie, body: { mode: 'review' } });
    assert.equal(review.response.status, 201);
    assert.deepEqual(review.data.session.questions.map((question: any) => question.id), ['q-nt-rem-2']);
    const reviewResult = await send(`/practice/sessions/${review.data.session.id}/submit`, { method: 'POST', cookie, body: {} });
    assert.equal(reviewResult.response.status, 200);
    assert.equal(reviewResult.data.result.questionCount, 1);

    const timed = await send('/practice/sessions', { method: 'POST', cookie, body: { mode: 'timed' } });
    assert.equal(timed.response.status, 201);
    assert.ok(timed.data.session.questions.length >= 2);
    const timedQuestion = timed.data.session.questions[0];
    const answerKey = String(((await db.prepare('SELECT correct_answer FROM questions WHERE id = ?').get(timedQuestion.id)) as { correct_answer: string }).correct_answer);
    const saved = await send(`/practice/sessions/${timed.data.session.id}/answer`, { method: 'POST', cookie, body: { questionId: timedQuestion.id, answer: answerKey } });
    assert.equal(saved.data.saved, true);
    assert.equal(saved.data.correct, undefined);
    assert.equal(saved.data.explanation, undefined);
    const report = await send(`/practice/sessions/${timed.data.session.id}/submit`, { method: 'POST', cookie, body: {} });
    assert.equal(report.response.status, 200);
    assert.equal(report.data.result.correctCount, 1);
    assert.ok(report.data.result.results[0].explanation);
    assert.equal(report.data.result.questionCount, timed.data.session.questions.length);

    const oldUserId = Number(signup.data.user.id);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.close();

    db = await createDatabase(databasePath);
    server = createApp(db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const restartedAddress = server.address();
    assert.ok(restartedAddress && typeof restartedAddress !== 'string');
    base = `http://127.0.0.1:${restartedAddress.port}/api`;
    const resumed = await send('/bootstrap', { cookie });
    assert.equal(resumed.response.status, 200);
    assert.equal(resumed.data.user.id, oldUserId);
    assert.equal(resumed.data.stats.completedLessons, 1);
    assert.ok(resumed.data.recentAssessments.length > 0);
    assert.equal(resumed.data.recentAssessments[0].correctCount, 1);

    const login = await send('/auth/login', { method: 'POST', body: { email: 'JORDAN@EXAMPLE.COM', password: 'thoughtful-study-42' } });
    assert.equal(login.response.status, 200);
    assert.equal(login.data.user.id, oldUserId);
    const loginCookie = login.response.headers.get('set-cookie')?.split(';')[0];
    assert.ok(loginCookie?.startsWith('axiom_session='));
    const loginBootstrap = await send('/bootstrap', { cookie: loginCookie });
    assert.equal(loginBootstrap.response.status, 200);
    assert.equal(loginBootstrap.data.user.email, 'jordan@example.com');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test('answer validation accepts equivalent fractions and rejects non-numeric input', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'axiom-validation-'));
  const db = await createDatabase(join(folder, 'test.sqlite'));
  try {
    const { recordAnswer } = await import('../server/learning.js');
    const user = await db.prepare(`INSERT INTO users (full_name, email, password_salt, password_hash, active_competition_slug)
      VALUES ('Test Student', 'test@example.com', 'salt', 'hash', 'amc-10')`).run();
    const userId = Number(user.lastInsertRowid);
    assert.equal((await recordAnswer(db, userId, 'q-comb-prob-1', '0.375')).correct, true);
    assert.equal((await recordAnswer(db, userId, 'q-comb-prob-1', '3/8')).correct, true);
    assert.equal((await recordAnswer(db, userId, 'q-comb-prob-1', 'not a number')).correct, false);
  } finally {
    await db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
