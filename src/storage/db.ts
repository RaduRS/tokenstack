import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Db = DatabaseSync;

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS read_cache (
    abspath TEXT PRIMARY KEY,
    mtime_ns INTEGER NOT NULL,
    size INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    brotli_content BLOB NOT NULL,
    served_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bash_tee (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cmd TEXT NOT NULL,
    raw_output TEXT NOT NULL,
    filtered_output TEXT NOT NULL,
    ts INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS session_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    kind TEXT NOT NULL,
    payload_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS symbols (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    name_lc TEXT NOT NULL,
    content TEXT NOT NULL,
    content_lc TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    UNIQUE(path, start_line, end_line)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bash_tee_ts ON bash_tee(ts)`,
  `CREATE INDEX IF NOT EXISTS idx_session_events_ts ON session_events(ts)`,
  `CREATE INDEX IF NOT EXISTS idx_symbols_path ON symbols(path)`,
  `CREATE INDEX IF NOT EXISTS idx_symbols_name_lc ON symbols(name_lc)`,
];

const PRAGMAS: string[] = [
  "PRAGMA journal_mode=WAL",
  "PRAGMA synchronous=NORMAL",
];

export function stateDir(projectRoot: string): string {
  return join(projectRoot, ".tokenstack");
}

export function runScript(db: Db, statements: string[]): void {
  for (const stmt of statements) {
    db.prepare(stmt).run();
  }
}

export function openDb(projectRoot: string): Db {
  const dir = stateDir(projectRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "state.db"));
  runScript(db, PRAGMAS);
  runScript(db, SCHEMA_STATEMENTS);
  return db;
}
