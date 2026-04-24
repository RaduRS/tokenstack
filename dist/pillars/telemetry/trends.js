import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { runScript } from "../../storage/db.js";
const TRENDS_SCHEMA = [
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
function trendsPath(base = homedir()) {
    const dir = join(base, ".claude", "tokenstack");
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    return join(dir, "trends.db");
}
function openTrends(base) {
    const db = new DatabaseSync(trendsPath(base));
    runScript(db, TRENDS_SCHEMA);
    return db;
}
export function writeSession(base, row) {
    const db = openTrends(base);
    try {
        db.prepare("INSERT INTO sessions(project, ts_start, ts_end, score, signals_json) VALUES (?, ?, ?, ?, ?)")
            .run(row.project, row.ts_start, row.ts_end, row.score, JSON.stringify(row.signals));
    }
    finally {
        db.close();
    }
}
export function recentSessions(base, limit = 20) {
    const db = openTrends(base);
    try {
        const rows = db.prepare("SELECT project, ts_start, ts_end, score, signals_json FROM sessions ORDER BY id DESC LIMIT ?").all(limit);
        return rows.map((r) => ({ ...r, signals: JSON.parse(r.signals_json) }));
    }
    finally {
        db.close();
    }
}
