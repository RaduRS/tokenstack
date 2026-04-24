const handlers = {};
export function register(event, handler) {
    handlers[event] = handler;
}
function mergeResponses(a, b) {
    const ctx = [a.additionalContext, b.additionalContext].filter(Boolean).join("\n\n");
    return {
        ...a, ...b,
        additionalContext: ctx || undefined,
        decision: b.decision ?? a.decision,
        reason: b.reason ?? a.reason,
        suppressOutput: a.suppressOutput || b.suppressOutput,
    };
}
import { handleSessionStart } from "./pillars/output_rules/session_start.js";
import { handlePostToolUseEvent, handlePreCompact, handleSessionStartToc } from "./pillars/compact_toc/hook.js";
import { handleSessionEnd, handleSessionStartShowLast } from "./pillars/telemetry/hook.js";
register("SessionStart", async (e) => {
    const a = await handleSessionStart(e);
    const b = await handleSessionStartToc(e);
    const c = await handleSessionStartShowLast(e);
    return mergeResponses(mergeResponses(a, b), c);
});
register("SessionEnd", handleSessionEnd);
import { handleUserPromptSubmit } from "./pillars/output_rules/prompt_submit.js";
register("UserPromptSubmit", handleUserPromptSubmit);
import { handlePostToolUseBash } from "./pillars/bash_filter/hook.js";
register("PostToolUse", async (e) => {
    const a = await handlePostToolUseBash(e);
    const b = await handlePostToolUseEvent(e);
    return mergeResponses(a, b);
});
import { handlePreToolUseRead } from "./pillars/file_delta/hook.js";
register("PreToolUse", async (e) => {
    if (e.tool_name === "Read")
        return handlePreToolUseRead(e);
    return {};
});
register("PreCompact", handlePreCompact);
export async function dispatch(event) {
    const h = handlers[event.hook_event_name];
    if (!h)
        return {};
    try {
        return await h(event);
    }
    catch (err) {
        return { additionalContext: `[tokenstack error] ${err.message}` };
    }
}
async function main() {
    const chunks = [];
    for await (const c of process.stdin)
        chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    let event;
    try {
        event = JSON.parse(raw);
    }
    catch {
        process.exit(0);
    }
    const response = await dispatch(event);
    process.stdout.write(JSON.stringify(response));
    process.exit(0);
}
if (import.meta.url === `file://${process.argv[1]}`) {
    void main();
}
