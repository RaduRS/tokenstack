import type { Mode } from "../../storage/config.js";

const OVERRIDE = "\n\nOverride: user instructions always win. If the user asks for verbosity, a long explanation, a summary, or a recap — obey the user and ignore the rules above for that turn.";

const LITE = `tokenstack mode: LITE

OUTPUT:
- Start with the answer content. Never begin with a setup sentence such as "Here's...", "Let me...", "I'll...", "Sure...", "Great question...", "So...", or any restatement of the question.
- Stop when the answer is complete. Never end with a recap like "Net effect:", "In short:", "In summary:", "Key takeaway:", "Hope this helps", or any sentence that summarizes what you just said.
- Verify any API, flag, version, SHA, or package name before asserting it — read the code or the docs.`;

const FULL = `tokenstack mode: FULL

OUTPUT:
- Start with the answer content. Never begin with a setup sentence such as "Here's...", "Let me...", "I'll...", "Sure...", "Great question...", "So...", "Alright...", or a restatement of the question.
- Stop when the answer is complete. Never end with a recap line like "Net effect:", "In short:", "In summary:", "Key takeaway:", "Hope this helps", "Let me know if...", or any sentence that summarizes what you just said.
- Every sentence must carry information. Delete any sentence whose removal would not lose meaning. Aim for roughly 40–50% shorter than an unconstrained reply.
- Use headers, bullets, and numbered lists only when the content is genuinely list-shaped. Prefer plain prose for explanations with <4 points.
- Do not repeat information in a different phrasing. Say it once.

CODE:
- One-shot writes: produce complete files in a single write, not incremental builds of the same file.
- Tests pass → stop. No refactoring, polishing, or "while I'm here" cleanup.
- Prefer Edit over Write when the change affects <30% of the file.
- Skip files larger than 100 KB unless the task requires them.

TOOLS:
- Tool-call budget: at 40 calls start wrapping up; at 50 stop and report.
- Verify any API, flag, version, SHA, or package name before asserting it — read the code or the docs.`;

const ULTRA = `tokenstack mode: ULTRA

OUTPUT:
- Telegraphic prose. Fragments OK. Drop articles (a, an, the) and filler verbs where meaning stays clear.
- Never begin with a setup sentence. First word must be part of the answer itself.
- Never end with a recap, summary, or closing remark. Stop at the last real point.
- Preserve exactly: fenced code, backticks, URLs, file paths, error messages, commands.
- Aim for ~30% of an unconstrained reply's length.

CODE:
- One-shot writes. Tests pass → stop.
- Edit over Write if change <30% of file.

TOOLS:
- Budget 20 tool calls; stop at 30.
- Verify APIs/flags/versions/SHAs/packages before asserting.`;

export function rulesForMode(mode: Mode): string {
  if (mode === "off") return "";
  const body = mode === "lite" ? LITE : mode === "full" ? FULL : ULTRA;
  return body + OVERRIDE;
}
