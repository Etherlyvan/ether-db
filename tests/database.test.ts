import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database, type JsonValue } from '../src/database.js';

function fixture(t: { after: (fn: () => void) => void }) {
  const directory = mkdtempSync(join(tmpdir(), 'ether-db-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, 'nested', 'store.json');
}

test('set, overwrite, delete, and reload persist all JSON value types', t => {
  const file = fixture(t);
  const db = new Database(file);
  assert.equal(db.size, 0);
  assert.equal(db.get('missing'), undefined);
  const values: JsonValue[] = [null, false, 42, 'halo é', [1, true], { name: 'etherlyvan' }];
  values.forEach((value, index) => db.set(String(index), value));
  const reopened = new Database(file);
  values.forEach((value, index) => assert.deepEqual(reopened.get(String(index)), value));
  reopened.set('0', 'updated');
  assert.equal(new Database(file).get('0'), 'updated');
  assert.equal(reopened.delete('1'), true);
  assert.equal(reopened.delete('missing'), false);
  assert.equal(new Database(file).has('1'), false);
  assert.equal(reopened.size, 5);
});

test('objects returned or passed by callers do not mutate stored values', t => {
  const db = new Database(fixture(t));
  const value = { nested: { count: 1 } };
  db.set('item', value);
  value.nested.count = 99;
  const returned = db.get('item') as typeof value;
  returned.nested.count = 77;
  assert.deepEqual(db.get('item'), { nested: { count: 1 } });
  db.set('__proto__', 'safe').set('constructor', 'also safe');
  assert.equal(new Database(db.filePath).get('__proto__'), 'safe');
});

test('invalid values and keys fail without changing memory or disk', t => {
  const file = fixture(t);
  const db = new Database(file).set('good', 1);
  const before = readFileSync(file, 'utf8');
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  for (const value of [undefined, NaN, Infinity, 1n, new Date(), { x: undefined }, cyclic, new Array(2)]) {
    assert.throws(() => db.set('bad', value as JsonValue), TypeError);
  }
  assert.throws(() => db.set('', 'bad'), TypeError);
  assert.equal(db.size, 1);
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('corrupt files and invalid schemas are rejected without overwriting them', t => {
  const file = fixture(t);
  new Database(file).set('good', true);
  for (const text of ['', '{broken', '{"version":2,"entries":[]}', '{"version":1,"entries":[["a",1],["a",2]]}', '{"version":1,"entries":[["",1]]}']) {
    writeFileSync(file, text);
    assert.throws(() => new Database(file));
    assert.equal(readFileSync(file, 'utf8'), text);
  }
});

test('failed file replacement preserves memory and cleans temporary files', t => {
  const file = fixture(t);
  const db = new Database(file).set('good', 1);
  rmSync(file);
  mkdirSync(file);
  assert.throws(() => db.set('good', 2));
  assert.equal(db.get('good'), 1);
  assert.deepEqual(readdirSync(join(file, '..')), ['store.json']);
});
