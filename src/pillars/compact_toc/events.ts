import type { Db } from "../../storage/db.js";

export type EventKind = "file_edit" | "file_read" | "test_fail" | "todo" | "decision" | "bash_run";

export function logEvent(db: Db, kind: EventKind, payload: Record<string, unknown>): void {
  db.prepare("INSERT INTO session_events(ts, kind, payload_json) VALUES (?, ?, ?)").run(Date.now(), kind, JSON.stringify(payload));
}

export type EventRow = { id: number; ts: number; kind: string; payload: Record<string, unknown> };

export function listEvents(db: Db, limit = 1000): EventRow[] {
  const rows = db.prepare("SELECT id, ts, kind, payload_json FROM session_events ORDER BY id DESC LIMIT ?").all(limit) as { id: number; ts: number; kind: string; payload_json: string }[];
  return rows.map((r) => ({ id: r.id, ts: r.ts, kind: r.kind, payload: JSON.parse(r.payload_json) })).reverse();
}
