import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db.js';

test('a guest space can become an account without losing progress, then be deleted', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'axiom-account-'));
  const db = await createDatabase(join(folder, 'test.sqlite'));
  const server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;

  const send = async (path: string, options: { method?: string; body?: unknown; cookie?: string } = {}) => {
    const headers = new Headers();
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    if (options.cookie) headers.set('cookie', options.cookie);
    const response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return { response, data: await response.json() as Record<string, any> };
  };

  try {
    const started = await send('/auth/guest', { method: 'POST', body: {} });
    assert.equal(started.response.status, 201);
    const guestId = Number(started.data.user.id);
    const cookie = started.response.headers.get('set-cookie')!.split(';')[0];

    await send('/lessons/nt-remainders/answer', { method: 'POST', cookie, body: { questionId: 'q-nt-rem-1', answer: 'B' } });
    await send('/lessons/nt-remainders/answer', { method: 'POST', cookie, body: { questionId: 'q-nt-rem-2', answer: '2' } });
    const completed = await send('/lessons/nt-remainders/complete', { method: 'POST', cookie, body: {} });
    assert.equal(completed.data.completed, true);

    const invalid = await send('/auth/upgrade', { method: 'POST', cookie, body: { fullName: 'Guest Learner', email: 'not-an-email', password: 'a-long-password' } });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.data.code, 'invalid_email');

    const upgraded = await send('/auth/upgrade', {
      method: 'POST',
      cookie,
      body: { fullName: 'Aanya Mehta', email: 'AANYA@example.com', password: 'a-thoughtful-password', grade: '10' },
    });
    assert.equal(upgraded.response.status, 200);
    assert.equal(upgraded.data.user.id, guestId);
    assert.equal(upgraded.data.user.isGuest, false);
    assert.equal(upgraded.data.user.email, 'aanya@example.com');

    const keptProgress = await send('/bootstrap', { cookie });
    assert.equal(keptProgress.response.status, 200);
    assert.equal(keptProgress.data.user.isGuest, false);
    assert.equal(keptProgress.data.stats.completedLessons, 1);

    const secondUpgrade = await send('/auth/upgrade', {
      method: 'POST',
      cookie,
      body: { fullName: 'Someone Else', email: 'other@example.com', password: 'another-long-password' },
    });
    assert.equal(secondUpgrade.response.status, 409);
    assert.equal(secondUpgrade.data.code, 'already_registered');

    const signIn = await send('/auth/login', { method: 'POST', body: { email: 'aanya@example.com', password: 'a-thoughtful-password' } });
    assert.equal(signIn.response.status, 200);
    assert.equal(signIn.data.user.id, guestId);

    const deleted = await send('/profile', { method: 'DELETE', cookie });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.data.ok, true);

    assert.equal(await db.prepare('SELECT 1 FROM users WHERE id = ?').get(guestId), undefined);
    const afterDelete = await send('/bootstrap', { cookie });
    assert.equal(afterDelete.response.status, 401);
    const signInAfterDelete = await send('/auth/login', { method: 'POST', body: { email: 'aanya@example.com', password: 'a-thoughtful-password' } });
    assert.equal(signInAfterDelete.response.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
