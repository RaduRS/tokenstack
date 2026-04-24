import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { runScript } from "../../storage/db.js";

const TRENDS_SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    ts_start INTEGER NOT NULL,
    ts_end INTEGER NOT NULL,
    score REAL NOT NULL,
    signals_json TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_ts ON sessions(ts_end)`,
];

function trendsPath(base = homedir()): string {
  const dir = join(base, ".claude", "tokenstack");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "trends.db");
}

function openTrends(base?: string): DatabaseSync {
  const db = new DatabaseSync(trendsPath(base));
  runScript(db, TRENDS_SCHEMA);
  return db;
}

export function writeSession(
  base: string | undefined,
  row: { project: string; ts_start: number; ts_end: number; score: number; signals: unknown }
): void {
  const db = openTrends(base);
  try {
    db.prepare("INSERT INTO sessions(project, ts_start, ts_end, score, signals_json) VALUES (?, ?, ?, ?, ?)")
      .run(row.project, row.ts_start, row.ts_end, row.score, JSON.stringify(row.signals));
  } finally { db.close(); }
}

export type SessionRow = { project: string; ts_start: number; ts_end: number; score: number; signals: unknown };

export function recentSessions(base?: string, limit = 20): SessionRow[] {
  const db = openTrends(base);
  try {
    const rows = db.prepare("SELECT project, ts_start, ts_end, score, signals_json FROM sessions ORDER BY id DESC LIMIT ?").all(limit) as { project: string; ts_start: number; ts_end: number; score: number; signals_json: string }[];
    return rows.map((r) => ({ ...r, signals: JSON.parse(r.signals_json) }));
  } finally { db.close(); }
}
