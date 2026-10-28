import { createServer } from 'ether-http';
import { createDatabaseRouter } from './api.js';
import { Database } from './database.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
const db = new Database(process.env.DB_PATH ?? 'data/api.json');
const server = createServer(createDatabaseRouter(db));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') console.log(`ether-db API listening at http://127.0.0.1:${address.port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close());
}
