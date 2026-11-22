import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { Pool, type QueryResult } from 'pg';
import { achievements, competitions, units } from './content.js';

type Row = Record<string, unknown>;
type Awaitable<T> = T | Promise<T>;
export type RunResult = { changes: number; lastInsertRowid: number | bigint };
export interface PreparedQuery {
  get(...params: unknown[]): Promise<Row | undefined>;
  all(...params: unknown[]): Promise<Row[]>;
  run(...params: unknown[]): Promise<RunResult>;
}
export interface AppDatabase {
  prepare(sql: string): PreparedQuery;
  exec(sql: string): Promise<void>;
  transaction<T>(work: () => Awaitable<T>): Promise<T>;
  close(): Promise<void>;
  readonly dialect: 'sqlite' | 'postgres';
}

export interface PostgresClientLike {
  query(text: string, values?: any[]): Promise<QueryResult>;
  release(): void;
}

export interface PostgresPoolLike {
  query(text: string, values?: any[]): Promise<QueryResult>;
  connect(): Promise<PostgresClientLike>;
  end(): Promise<void>;
}

const migrationDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));
const sqliteMigrationFiles = ['001_initial.sql', '002_assessments.sql', '003_sessions.sql', '004_review_schedule.sql', '005_proof_reviews.sql'];
const postgresSchemaPath = fileURLToPath(new URL('./migrations/postgres/001_initial.sql', import.meta.url));

class SqliteDatabase implements AppDatabase {
  readonly dialect = 'sqlite' as const;
  constructor(private readonly client: DatabaseSync) {}

  prepare(sql: string): PreparedQuery {
    const statement: StatementSync = this.client.prepare(sql);
    return {
      get: async (...params) => statement.get(...params as any[]) as Row | undefined,
      all: async (...params) => statement.all(...params as any[]) as Row[],
      run: async (...params) => {
        const result = statement.run(...params as any[]);
        return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid };
      },
    };
  }

  async exec(sql: string) { this.client.exec(sql); }

  async transaction<T>(work: () => Awaitable<T>): Promise<T> {
    this.client.exec('BEGIN IMMEDIATE');
    try {
      const result = await work();
      this.client.exec('COMMIT');
      return result;
    } catch (error) {
      try { this.client.exec('ROLLBACK'); } catch { /* No active transaction. */ }
      throw error;
    }
  }

  async close() { this.client.close(); }
}

export class PostgresDatabase implements AppDatabase {
  readonly dialect = 'postgres' as const;
  private readonly transactionContext = new AsyncLocalStorage<PostgresClientLike>();

  constructor(private readonly pool: PostgresPoolLike) {}

  prepare(sql: string): PreparedQuery {
    return {
      get: async (...params) => {
        const result = await this.query(sql, params);
        return result.rows[0] as Row | undefined;
      },
      all: async (...params) => {
        const result = await this.query(sql, params);
        return result.rows as Row[];
      },
      run: async (...params) => {
        const insertTable = sql.match(/\bINSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+([a-z_]+)/i)?.[1]?.toLowerCase();
        const returnsNumericId = ['users', 'question_attempts', 'xp_events', 'tutor_messages', 'admin_audit_log'].includes(insertTable ?? '');
        const result = await this.query(returnsNumericId && !/\bRETURNING\b/i.test(sql) ? `${sql.trim().replace(/;$/, '')} RETURNING id` : sql, params);
        return { changes: result.rowCount ?? 0, lastInsertRowid: Number(result.rows[0]?.id ?? 0) };
      },
    };
  }

  async exec(sql: string) {
    for (const statement of splitSqlStatements(sql)) await this.query(statement, []);
  }

  async transaction<T>(work: () => Awaitable<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.transactionContext.run(client, () => work());
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* Preserve the original error. */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async close() { await this.pool.end(); }

  private async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const { text, values } = postgresSql(sql, params);
    const client = this.transactionContext.getStore();
    if (client) return values.length ? client.query(text, values) : client.query(text);
    return values.length ? this.pool.query(text, values) : this.pool.query(text);
  }
}

function splitSqlStatements(source: string) {
  const statements: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let dollarQuote: string | null = null;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (dollarQuote) {
      if (source.startsWith(dollarQuote, index)) {
        current += dollarQuote;
        index += dollarQuote.length - 1;
        dollarQuote = null;
      } else current += char;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote && source[index + 1] === quote) { current += source[index + 1]; index += 1; }
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; current += char; continue; }
    if (char === '$') {
      const tag = source.slice(index).match(/^\$[a-zA-Z_0-9]*\$/)?.[0];
      if (tag) { dollarQuote = tag; current += tag; index += tag.length - 1; continue; }
    }
    if (char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export function postgresSql(sql: string, params: unknown[]) {
  let text = sql;
  const ignoreInsert = /\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(text);
  text = text.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO');
  text = text
    .replace(/MAX\(lesson_progress\.mastery_score,\s*excluded\.mastery_score\)/gi, 'GREATEST(lesson_progress.mastery_score, excluded.mastery_score)')
    .replace(/MAX\(lesson_progress\.best_score,\s*excluded\.best_score\)/gi, 'GREATEST(lesson_progress.best_score, excluded.best_score)')
    .replace(/\bsubstr\s*\(/gi, 'substring(');
  if (ignoreInsert && !/\bON\s+CONFLICT\b/i.test(text)) {
    const clean = text.trim().replace(/;$/, '');
    const returningIndex = clean.search(/\bRETURNING\b/i);
    text = returningIndex < 0
      ? `${clean} ON CONFLICT DO NOTHING`
      : `${clean.slice(0, returningIndex).trimEnd()} ON CONFLICT DO NOTHING ${clean.slice(returningIndex)}`;
  }

  let index = 0;
  let quoted: "'" | '"' | null = null;
  let converted = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      converted += char;
      if (char === quoted && text[i + 1] === quoted) { converted += text[i + 1]; i += 1; }
      else if (char === quoted) quoted = null;
      continue;
    }
    if (char === "'" || char === '"') { quoted = char; converted += char; continue; }
    if (char === '?') { index += 1; converted += `$${index}`; continue; }
    converted += char;
  }
  if (index !== params.length) throw new Error(`SQL parameter mismatch: expected ${index}, received ${params.length}.`);
  return { text: converted, values: params };
}

async function createSqliteDatabase(databasePath: string): Promise<AppDatabase> {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (databasePath !== ':memory:') database.exec('PRAGMA journal_mode = WAL;');
  const db = new SqliteDatabase(database);
  await migrateSqlite(db);
  await seedContent(db);
  return db;
}

async function migrateSqlite(db: AppDatabase) {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))" );
  for (const file of sqliteMigrationFiles) {
    const id = file.replace(/\.sql$/, '').replaceAll('_', '-');
    const applied = await db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get(id) as { id: string } | undefined;
    if (applied) continue;
    await db.transaction(async () => {
      await db.exec(readFileSync(`${migrationDirectory}/${file}`, 'utf8'));
      await db.prepare('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)').run(id);
    });
  }
}

async function createPostgresDatabase(connectionString: string): Promise<AppDatabase> {
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  const db = new PostgresDatabase(pool);
  try {
    await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (to_char(current_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')))" );
    const applied = await db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get('001-postgres-schema');
    if (!applied) {
      await db.transaction(async () => {
        await db.exec(readFileSync(postgresSchemaPath, 'utf8'));
        await db.prepare('INSERT INTO schema_migrations (id) VALUES (?) ON CONFLICT (id) DO NOTHING').run('001-postgres-schema');
      });
    }
    await seedContent(db);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export async function createDatabase(databasePath?: string): Promise<AppDatabase> {
  if (databasePath !== undefined) return createSqliteDatabase(databasePath);
  if (process.env.DATABASE_URL) return createPostgresDatabase(process.env.DATABASE_URL);
  if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production. Set it to a PostgreSQL connection string.');
  return createSqliteDatabase(process.env.DATABASE_PATH ?? resolve(process.cwd(), 'data/axiom.sqlite'));
}

export async function seedContent(db: AppDatabase) {
  await db.transaction(async () => {
    const addCompetition = db.prepare(`INSERT OR IGNORE INTO competitions
      (slug, name, subject, level, description, format_json, is_available, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`);
    for (const competition of competitions) {
      await addCompetition.run(competition.slug, competition.name, competition.subject, competition.level, competition.description, JSON.stringify(competition.format), competition.available ? 1 : 0);
    }

    const addUnit = db.prepare(`INSERT OR IGNORE INTO units
      (id, competition_slug, sort_order, title, short_title, description, color, icon, estimated_minutes, is_published)
      VALUES (?, 'amc-10', ?, ?, ?, ?, ?, ?, ?, 1)`);
    const addLesson = db.prepare(`INSERT OR IGNORE INTO lessons
      (id, unit_id, sort_order, title, slug, summary, objectives_json, body_json, difficulty, estimated_minutes, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);
    const addQuestion = db.prepare(`INSERT OR IGNORE INTO questions
      (id, lesson_id, sort_order, question_type, prompt, choices_json, correct_answer, hint, explanation, difficulty, objective, source_note, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Original practice question; not official competition material', 1)`);
    const addPrerequisite = db.prepare('INSERT OR IGNORE INTO lesson_prerequisites (lesson_id, prerequisite_lesson_id) VALUES (?, ?)');

    let previousLessonId: string | undefined;
    for (const [unitIndex, unit] of units.entries()) {
      await addUnit.run(unit.id, unitIndex + 1, unit.title, unit.shortTitle, unit.description, unit.color, unit.icon, unit.minutes);
      for (const [lessonIndex, lesson] of unit.lessons.entries()) {
        await addLesson.run(lesson.id, unit.id, lessonIndex + 1, lesson.title, lesson.id, lesson.summary, JSON.stringify(lesson.objectives), JSON.stringify(lesson.body), lesson.difficulty, lesson.minutes);
        if (previousLessonId) await addPrerequisite.run(lesson.id, previousLessonId);
        previousLessonId = lesson.id;
        for (const [questionIndex, question] of lesson.questions.entries()) {
          await addQuestion.run(question.id, lesson.id, questionIndex + 1, question.type, question.prompt, JSON.stringify(question.choices ?? []), question.answer, question.hint, question.explanation, question.difficulty, question.objective);
        }
      }
    }

    const addAchievement = db.prepare(`INSERT OR IGNORE INTO achievements
      (slug, title, description, category, icon, xp_bonus) VALUES (?, ?, ?, ?, ?, ?)`);
    for (const achievement of achievements) {
      await addAchievement.run(achievement.slug, achievement.title, achievement.description, achievement.category, achievement.icon, achievement.xp);
    }
  });
}
