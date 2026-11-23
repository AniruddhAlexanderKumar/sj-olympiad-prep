import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppDatabase } from './db.js';
import { HttpError } from './errors.js';

export type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  isGuest: boolean;
  role: 'student' | 'admin';
  grade: string;
  activeCompetitionSlug: string | null;
  dailyGoal: number;
  theme: 'light' | 'dark' | 'system';
  leaderboardOptIn: boolean;
};

export type AuthenticatedRequest = Request & { user?: AuthUser };

function scryptKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key as Buffer));
  });
}

export async function hashPassword(password: string, salt: string) {
  return (await scryptKey(password, salt)).toString('hex');
}

export async function verifyPassword(password: string, salt: string, expectedHex: string) {
  const actual = await scryptKey(password, salt);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function getAuthUser(db: AppDatabase, userId: number): Promise<AuthUser | undefined> {
  const row = (await db.prepare(`SELECT id, full_name, email, role, grade, active_competition_slug, daily_goal, theme, leaderboard_opt_in
    FROM users WHERE id = ?`).get(userId)) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  const email = String(row.email);
  const isGuest = email.endsWith('@guest.axiom.invalid');
  return {
    id: Number(row.id),
    fullName: String(row.full_name),
    email: isGuest ? '' : email,
    isGuest,
    role: row.role === 'admin' ? 'admin' : 'student',
    grade: String(row.grade ?? ''),
    activeCompetitionSlug: row.active_competition_slug ? String(row.active_competition_slug) : null,
    dailyGoal: Number(row.daily_goal),
    theme: row.theme === 'dark' || row.theme === 'system' ? row.theme : 'light',
    leaderboardOptIn: Number(row.leaderboard_opt_in) === 1,
  };
}

function readCookie(request: Request, cookieName: string) {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === cookieName) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export const authRequired = (db: AppDatabase): RequestHandler => async (request, _response, next) => {
  try {
    const token = readCookie(request, 'axiom_session');
    if (!token || token.length > 256) throw new HttpError(401, 'Please sign in to continue.', 'unauthenticated');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = (await db.prepare(`SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?`)
      .get(tokenHash, new Date().toISOString())) as { user_id: number } | undefined;
    if (!session) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'unauthenticated');
    const user = await getAuthUser(db, Number(session.user_id));
    if (!user) throw new HttpError(401, 'Your account could not be found.', 'unauthenticated');
    (request as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const adminRequired: RequestHandler = (request, _response, next) => {
  const user = (request as AuthenticatedRequest).user;
  if (!user || user.role !== 'admin') return next(new HttpError(403, 'Administrator access is required.', 'forbidden'));
  next();
};

export async function issueSession(db: AppDatabase, response: Response, userId: number) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  (await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString()));
  (await db.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(randomBytes(16).toString('hex'), userId, tokenHash, expiresAt));
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `axiom_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${secure}`);
}

export async function destroySession(db: AppDatabase, request: Request, response: Response) {
  const token = readCookie(request, 'axiom_session');
  if (token) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    (await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash));
  }
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `axiom_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, { count: number; expiresAt: number }>();
  return (request: Request, _response: Response, next: NextFunction) => {
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.expiresAt <= now) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > limit) return next(new HttpError(429, 'Too many requests. Please pause for a moment and try again.', 'rate_limited'));
    next();
  };
}

export async function bootstrapAdmin(db: AppDatabase) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) return;
  const existing = (await db.prepare('SELECT id FROM users WHERE email = ?').get(email)) as { id: number } | undefined;
  if (existing) {
    (await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id));
    return;
  }
  const salt = randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(password, salt);
  const created = (await db.prepare(`INSERT INTO users (full_name, email, password_salt, password_hash, role, active_competition_slug)
    VALUES (?, ?, ?, ?, 'admin', 'amc-10')`).run('Axiom administrator', email, salt, passwordHash));
  const id = Number(created.lastInsertRowid);
  (await db.prepare('INSERT OR IGNORE INTO user_competitions (user_id, competition_slug) VALUES (?, ?)').run(id, 'amc-10'));
}
