import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'ether-http';
import { createDatabaseRouter } from '../src/api.js';
import { Database } from '../src/database.js';

test('HTTP API persists values across server restart and supports overwrite and delete', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'ether-db-api-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'db.json');
  async function start() {
    const server = createServer(createDatabaseRouter(new Database(path)));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return { server, url: `http://127.0.0.1:${address.port}` };
  }
  async function request(url: string, method = 'GET', body?: string, contentType = 'application/json') {
    const response = await fetch(url, {
      method, body, headers: { 'content-type': contentType }, signal: AbortSignal.timeout(2000),
    });
    return { status: response.status, body: await response.json() };
  }
  const first = await start();
  const query = '/kv?key=' + encodeURIComponent('user + é');
  assert.deepEqual(await request(first.url + query, 'PUT', '{"name":"etherlyvan"}'), {
    status: 200, body: { key: 'user + é', value: { name: 'etherlyvan' } },
  });
  await new Promise<void>(resolve => first.server.close(() => resolve()));
  const second = await start();
  assert.deepEqual(await request(second.url + query), {
    status: 200, body: { key: 'user + é', value: { name: 'etherlyvan' } },
  });
  assert.deepEqual((await request(second.url + '/keys')).body, { keys: ['user + é'], size: 1 });
  assert.equal((await request(second.url + query, 'PUT', 'null')).status, 200);
  assert.equal((await request(second.url + query)).body.value, null);

  const before = readFileSync(path, 'utf8');
  for (const [suffix, body, contentType, status] of [
    ['/kv', '1', 'application/json', 400],
    ['/kv?key=', '1', 'application/json', 400],
    ['/kv?key=a&key=b', '1', 'application/json', 400],
    [query, '{broken', 'application/json', 400],
    [query, '1e999', 'application/json', 400],
    [query, 'hello', 'text/plain', 415],
  ] as const) {
    assert.equal((await request(second.url + suffix, 'PUT', body, contentType)).status, status);
  }
  assert.equal(readFileSync(path, 'utf8'), before);
  const head = await fetch(second.url + query, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await request(second.url + query, 'DELETE')).status, 200);
  assert.equal((await request(second.url + query)).status, 404);
  assert.equal((await request(second.url + query, 'DELETE')).status, 404);
  assert.equal(new Database(path).size, 0);
});
