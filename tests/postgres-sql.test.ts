import assert from 'node:assert/strict';
import { test } from 'node:test';
import { postgresSql } from '../server/db.js';

test('PostgreSQL adapter translates SQLite placeholders and conflict inserts safely', () => {
  const select = postgresSql("SELECT * FROM users WHERE id = ? AND note = '?' AND email = ?", [7, 'a@example.com']);
  assert.equal(select.text, "SELECT * FROM users WHERE id = $1 AND note = '?' AND email = $2");
  assert.deepEqual(select.values, [7, 'a@example.com']);

  const insert = postgresSql("INSERT OR IGNORE INTO xp_events (user_id, event_key) VALUES (?, ?) RETURNING id", [3, 'daily']);
  assert.equal(insert.text, 'INSERT INTO xp_events (user_id, event_key) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id');

  const mastery = postgresSql('UPDATE lesson_progress SET mastery_score = MAX(lesson_progress.mastery_score, excluded.mastery_score) WHERE substr(created_at, 1, 10) = ?', ['2026-11-22']);
  assert.equal(mastery.text, 'UPDATE lesson_progress SET mastery_score = GREATEST(lesson_progress.mastery_score, excluded.mastery_score) WHERE substring(created_at, 1, 10) = $1');
  assert.throws(() => postgresSql('SELECT ?', []), /parameter mismatch/i);
});
