const OVERRIDE = "\nUser instructions always override these rules. If the user asks for verbosity, long explanation, or a summary, obey the user.";
const LITE = `tokenstack mode: LITE
- No preamble. Do not start with "I'll help you..." or "Sure, here's...".
- No closing summary unless asked.
- Verify API/flag/version/SHA before asserting.`;
const FULL = `tokenstack mode: FULL
- No preamble ("I'll help...", "Sure, here's...", "Great question...").
- No closing summary unless the user asks.
- One-shot writes: if the full answer is short, produce it in one write, not increments.
- No polish on passing code. Tests green = stop.
- Tool-call budget: at 40 calls, start wrapping up; at 50, stop and report.
- Anti-hallucination: verify any API, flag, version, SHA, or package name by reading code or docs.
- Prefer Edit over full Write when the change is <30% of the file.
- Skip files >100 KB unless the task requires them.`;
const ULTRA = `tokenstack mode: ULTRA
Fragments OK. Drop articles. Keep code exact.
Preserve: fenced code, backticks, URLs, file paths.
No preamble. No summary. No polish. Verify before asserting.
Budget 20 tool calls; stop at 30.`;
export function rulesForMode(mode) {
    if (mode === "off")
        return "";
    const body = mode === "lite" ? LITE : mode === "full" ? FULL : ULTRA;
    return body + OVERRIDE;
}
