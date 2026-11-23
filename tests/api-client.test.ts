import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, api } from '../src/api.js';

test('API client gives a useful account-service message for non-JSON 404 responses', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('<!doctype html><title>Not found</title>', {
    status: 404,
    headers: { 'content-type': 'text/html' },
  })) as typeof fetch;
  try {
    await assert.rejects(api('/auth/register', { method: 'POST', body: '{}' }), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 404);
      assert.equal(error.code, 'api_not_found');
      assert.match(error.message, /account service could not be found/i);
      assert.doesNotMatch(error.message, /request could not be completed/i);
      return true;
    });
    await assert.rejects(api('/auth/guest', { method: 'POST', body: '{}' }), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.match(error.message, /journey starter could not be found/i);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('API client explains network failures and rejects an HTML success page', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
    await assert.rejects(api('/auth/register', { method: 'POST', body: '{}' }), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'network_error');
      assert.match(error.message, /could not reach the account service/i);
      return true;
    });

    globalThis.fetch = (async () => new Response('<!doctype html><div>App shell</div>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })) as typeof fetch;
    await assert.rejects(api('/auth/register', { method: 'POST', body: '{}' }), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'unexpected_response');
      assert.match(error.message, /unexpected response/i);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
