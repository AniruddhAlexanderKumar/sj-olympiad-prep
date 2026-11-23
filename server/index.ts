import { createApp } from './app.js';
import { bootstrapAdmin } from './auth.js';
import { createDatabase } from './db.js';

const db = await createDatabase();
await bootstrapAdmin(db);
const app = createApp(db);
// An empty or invalid PORT (for example PORT="") must never bind an ephemeral port,
// otherwise the web app's /api proxy and health checks silently lose the API.
const configuredPort = Number(process.env.PORT);
const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort < 65_536 ? configuredPort : 3001;
const host = process.env.HOST?.trim() || '0.0.0.0';
const server = app.listen(port, host, () => {
  const address = server.address();
  const listeningPort = address && typeof address !== 'string' ? address.port : port;
  console.info(JSON.stringify({ level: 'info', message: 'Axiom API ready', host, port: listeningPort, database: process.env.DATABASE_URL ? 'postgres' : process.env.DATABASE_PATH ?? 'data/axiom.sqlite' }));
});

const shutdown = () => {
  server.close(() => {
    void db.close().then(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
