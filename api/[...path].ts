import type { Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Application } from 'express';
import { bootstrapAdmin } from '../server/auth.js';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db.js';

let application: Promise<Application> | undefined;

type CatchAllRequest = IncomingMessage & { query?: Record<string, string | string[] | undefined> };

function normalizeApiUrl(request: CatchAllRequest) {
  const originalUrl = request.url ?? '/';
  if (originalUrl === '/api' || originalUrl.startsWith('/api/') || originalUrl.startsWith('/api?')) return;
  const route = request.query?.path ?? request.query?.['...path'];
  if (route) {
    const routePath = Array.isArray(route) ? route.join('/') : route;
    const queryIndex = originalUrl.indexOf('?');
    request.url = `/api/${routePath}${queryIndex >= 0 ? originalUrl.slice(queryIndex) : ''}`;
    return;
  }
  request.url = `/api${originalUrl.startsWith('/') ? '' : '/'}${originalUrl}`;
}

function getApplication() {
  if (!application) {
    application = createDatabase()
      .then(async (db) => {
        await bootstrapAdmin(db);
        return createApp(db);
      })
      .catch((error: unknown) => {
        application = undefined;
        throw error;
      });
  }
  return application;
}

export function dispatchApiRequest(app: Application, request: IncomingMessage, response: ServerResponse) {
  normalizeApiUrl(request as CatchAllRequest);
  app(request as Request, response as Response);
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const app = await getApplication();
    dispatchApiRequest(app, request, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: 'error', message: 'Serverless API initialization failed', detail: message }));
    if (response.headersSent) return;
    response.statusCode = 503;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({
      error: 'The journey service is not configured or the database is temporarily unavailable. Please check the deployment database settings and try again.',
      code: message.includes('DATABASE_URL') || message.includes('POSTGRES_URL') ? 'database_not_configured' : 'service_unavailable',
    }));
  }
}
