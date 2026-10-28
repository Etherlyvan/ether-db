import { Router, json, type Request, type Response } from 'ether-http';
import { Database, type JsonValue } from './database.js';

function keyFrom(request: Request): string | undefined {
  const question = request.target.indexOf('?');
  const query = new URLSearchParams(question < 0 ? '' : request.target.slice(question + 1));
  const keys = query.getAll('key');
  return keys.length === 1 && keys[0].length > 0 ? keys[0] : undefined;
}

function error(status: number, message: string): Response {
  return { ...json({ error: message }), status };
}

export function createDatabaseRouter(db: Database): Router {
  return new Router()
    .on('GET', '/health', () => json({ status: 'ok' }))
    .on('GET', '/keys', () => json({ keys: db.keys(), size: db.size }))
    .on('GET', '/kv', request => {
      const key = keyFrom(request);
      if (key === undefined) return error(400, 'Provide exactly one non-empty key query parameter');
      const value = db.get(key);
      return value === undefined ? error(404, 'Key not found') : json({ key, value });
    })
    .on('PUT', '/kv', request => {
      const key = keyFrom(request);
      if (key === undefined) return error(400, 'Provide exactly one non-empty key query parameter');
      if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return error(415, 'Content-Type must be application/json');
      }
      let value: JsonValue;
      try { value = JSON.parse(request.body.toString('utf8')) as JsonValue; }
      catch { return error(400, 'Body must be valid JSON'); }
      try { db.set(key, value); }
      catch (cause) {
        if (cause instanceof TypeError) return error(400, 'Body must contain supported JSON values');
        throw cause;
      }
      return json({ key, value: db.get(key) });
    })
    .on('DELETE', '/kv', request => {
      const key = keyFrom(request);
      if (key === undefined) return error(400, 'Provide exactly one non-empty key query parameter');
      return db.delete(key) ? json({ key, deleted: true }) : error(404, 'Key not found');
    });
}
