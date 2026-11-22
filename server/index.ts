import { createApp } from './app.js';
import { bootstrapAdmin } from './auth.js';
import { createDatabase } from './db.js';

const db = await createDatabase();
await bootstrapAdmin(db);
const app = createApp(db);
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';
const server = app.listen(port, host, () => {
  console.info(JSON.stringify({ level: 'info', message: 'Axiom API ready', host, port, database: process.env.DATABASE_URL ? 'postgres' : process.env.DATABASE_PATH ?? 'data/axiom.sqlite' }));
});

const shutdown = () => {
  server.close(() => {
    void db.close().then(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
