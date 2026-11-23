import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db.js';

test('a visitor starts a private guest journey without registration fields', async () => {
  const db = await createDatabase(':memory:');
  const server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  try {
    const started = await fetch(`${base}/auth/guest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(started.status, 201);
    const data = await started.json() as { user: { fullName: string; email: string; isGuest: boolean; activeCompetitionSlug: string } };
    assert.equal(data.user.fullName, 'Learner');
    assert.equal(data.user.email, '');
    assert.equal(data.user.isGuest, true);
    assert.equal(data.user.activeCompetitionSlug, 'amc-10');
    const cookie = started.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie?.startsWith('axiom_session='));

    const bootstrap = await fetch(`${base}/bootstrap`, { headers: { cookie: cookie! } });
    assert.equal(bootstrap.status, 200);
    const journey = await bootstrap.json() as { user: { isGuest: boolean }; currentLesson: { id: string }; units: unknown[] };
    assert.equal(journey.user.isGuest, true);
    assert.equal(journey.currentLesson.id, 'nt-remainders');
    assert.equal(journey.units.length, 4);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  }
});
