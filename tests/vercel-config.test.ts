import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Vercel SPA rewrites leave API paths for the serverless handler', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
    functions: Record<string, { includeFiles?: string }>;
    rewrites: { source: string; destination: string }[];
  };
  assert.ok(config.functions['api/[...path].ts']);
  assert.equal(config.functions['api/[...path].ts'].includeFiles, 'server/migrations/**/*');
  assert.ok(config.rewrites.length > 0);
  assert.ok(config.rewrites.every(({ source }) => source.startsWith('/') && !source.includes('api')));
  assert.ok(config.rewrites.some(({ source }) => source === '/lesson/:lessonId'));
});
