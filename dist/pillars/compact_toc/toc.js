import { listEvents } from "./events.js";
const MAX_BYTES = 2048;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function buildToc(db) {
    const events = listEvents(db, 1000);
    const files = Array.from(new Set(events.filter((e) => e.kind === "file_edit").map((e) => String(e.payload.path)))).slice(-10);
    const fails = events.filter((e) => e.kind === "test_fail").map((e) => String(e.payload.name)).slice(-5);
    const todos = events.filter((e) => e.kind === "todo").map((e) => String(e.payload.text)).slice(-5);
    const decisions = events.filter((e) => e.kind === "decision").map((e) => String(e.payload.text)).slice(-5);
    const parts = [`<session_resume version="1">`];
    if (files.length) {
        parts.push("  <files_edited>");
        for (const p of files)
            parts.push(`    <file path="${esc(p)}" query="/ts search &quot;${esc(p)}&quot;"/>`);
        parts.push("  </files_edited>");
    }
    if (fails.length) {
        parts.push("  <failing_tests>");
        for (const n of fails)
            parts.push(`    <test name="${esc(n)}" query="/ts search &quot;${esc(n)}&quot;"/>`);
        parts.push("  </failing_tests>");
    }
    if (todos.length) {
        parts.push("  <todos>");
        for (const t of todos)
            parts.push(`    <todo text="${esc(t)}"/>`);
        parts.push("  </todos>");
    }
    if (decisions.length) {
        parts.push("  <decisions>");
        for (const d of decisions)
            parts.push(`    <decision text="${esc(d)}"/>`);
        parts.push("  </decisions>");
    }
    parts.push("</session_resume>");
    let out = parts.join("\n");
    if (out.length > MAX_BYTES)
        out = out.slice(0, MAX_BYTES - 20) + "…</session_resume>";
    return out;
}
