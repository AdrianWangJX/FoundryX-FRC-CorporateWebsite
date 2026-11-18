import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const migrations = fileURLToPath(new URL('../../drizzle/', import.meta.url));
export function localDatabase(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(
    'CREATE TABLE IF NOT EXISTS local_migrations (file TEXT PRIMARY KEY)',
  );
  for (const file of readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    if (db.prepare('SELECT 1 FROM local_migrations WHERE file = ?').get(file))
      continue;
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(path.join(migrations, file), 'utf8'));
      db.prepare('INSERT INTO local_migrations VALUES (?)').run(file);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return {
    raw: db,
    prepare(sql) {
      return {
        bind(...values) {
          const statement = db.prepare(sql);
          return {
            async first() {
              return statement.get(...values) ?? null;
            },
            async run() {
              return statement.run(...values);
            },
          };
        },
      };
    },
  };
}
