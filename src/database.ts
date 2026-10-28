import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function assertJson(value: unknown, ancestors = new Set<object>()): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || ancestors.has(value)) throw new TypeError('Value must be finite, acyclic JSON');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Only plain JSON objects and arrays are supported');
  }
  if (Object.getOwnPropertySymbols(value).length) throw new TypeError('Symbol properties are unsupported');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(value, i)) throw new TypeError('Sparse arrays are unsupported');
        assertJson(value[i], ancestors);
      }
      if (Object.keys(value).length !== value.length) throw new TypeError('Array properties are unsupported');
    } else {
      for (const entry of Object.values(value)) assertJson(entry, ancestors);
    }
  } finally { ancestors.delete(value); }
}

function copy(value: JsonValue): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function assertKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0) throw new TypeError('Key must be a non-empty string');
}

export class Database {
  readonly filePath: string;
  private data = new Map<string, JsonValue>();

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
    let text: string;
    try { text = readFileSync(this.filePath, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    // Never silently replace an unreadable or corrupt database with an empty one.
    const document: unknown = JSON.parse(text);
    if (!document || typeof document !== 'object' ||
        !('version' in document) || document.version !== 1 ||
        !('entries' in document) || !Array.isArray(document.entries)) {
      throw new Error('Invalid database format or unsupported version');
    }
    for (const entry of document.entries) {
      if (!Array.isArray(entry) || entry.length !== 2) throw new Error('Invalid database entry');
      assertKey(entry[0]);
      assertJson(entry[1]);
      if (this.data.has(entry[0])) throw new Error('Duplicate database key');
      this.data.set(entry[0], entry[1]);
    }
  }

  get size(): number { return this.data.size; }

  get(key: string): JsonValue | undefined {
    assertKey(key);
    const value = this.data.get(key);
    return value === undefined ? undefined : copy(value);
  }

  has(key: string): boolean { assertKey(key); return this.data.has(key); }

  keys(): string[] { return [...this.data.keys()]; }

  set(key: string, value: JsonValue): this {
    assertKey(key);
    assertJson(value);
    const next = new Map(this.data);
    next.set(key, copy(value));
    this.persist(next);
    return this;
  }

  delete(key: string): boolean {
    assertKey(key);
    if (!this.data.has(key)) return false;
    const next = new Map(this.data);
    next.delete(key);
    this.persist(next);
    return true;
  }

  private persist(next: Map<string, JsonValue>): void {
    const text = JSON.stringify({ version: 1, entries: [...next] }, null, 2) + '\n';
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, text, { encoding: 'utf8', flag: 'wx' });
      renameSync(temporary, this.filePath);
      // Commit memory only after the file replacement succeeds.
      this.data = next;
    } finally { rmSync(temporary, { force: true }); }
  }
}
