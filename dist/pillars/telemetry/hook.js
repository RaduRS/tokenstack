import { openDb } from "../../storage/db.js";
import { listEvents } from "../compact_toc/events.js";
import { computeScore } from "./score.js";
import { writeSession, recentSessions } from "./trends.js";
export async function handleSessionEnd(e, base) {
    const cwd = e.cwd ?? process.cwd();
    const db = openDb(cwd);
    try {
        const events = listEvents(db, 10000);
        if (events.length === 0)
            return {};
        const tsStart = events[0].ts;
        const tsEnd = events[events.length - 1].ts;
        const readPaths = events.filter((x) => x.kind === "file_read").map((x) => String(x.payload.path));
        const duplicateReads = readPaths.length - new Set(readPaths).size;
        const signals = {
            context_fill_pct: 50,
            stale_read_count: 0,
            bloat_byte_count: 0,
            duplicate_read_count: duplicateReads,
            compaction_count: events.filter((x) => x.kind === "bash_run" && String(x.payload.cmd ?? "").includes("/compact")).length,
            tool_call_count: events.length,
            decision_count: events.filter((x) => x.kind === "decision").length,
        };
        const { score, signals: detail } = computeScore(signals);
        writeSession(base, { project: cwd, ts_start: tsStart, ts_end: tsEnd, score, signals: { input: signals, detail } });
        return {};
    }
    finally {
        db.close();
    }
}
export async function handleSessionStartShowLast(_e, base) {
    const rows = recentSessions(base, 1);
    if (rows.length === 0)
        return {};
    return { additionalContext: `[tokenstack] Last session score: ${rows[0].score.toFixed(1)}/100` };
}
