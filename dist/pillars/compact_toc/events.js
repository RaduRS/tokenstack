export function logEvent(db, kind, payload) {
    db.prepare("INSERT INTO session_events(ts, kind, payload_json) VALUES (?, ?, ?)").run(Date.now(), kind, JSON.stringify(payload));
}
export function listEvents(db, limit = 1000) {
    const rows = db.prepare("SELECT id, ts, kind, payload_json FROM session_events ORDER BY id DESC LIMIT ?").all(limit);
    return rows.map((r) => ({ id: r.id, ts: r.ts, kind: r.kind, payload: JSON.parse(r.payload_json) })).reverse();
}
