import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { openDb } from "../../storage/db.js";
import { loadConfig } from "../../storage/config.js";
import { getCachedStale, setCached } from "./cache.js";
import { unifiedDiff, diffSizeRatio } from "./diff.js";
const EXCLUDED = [/\.env/, /\.pem$/, /\.p12$/, /\.key$/];
const DIFF_RATIO_LIMIT = 0.4;
function isExcluded(p) { return EXCLUDED.some((r) => r.test(p)); }
function isBinary(content) {
    const slice = content.length > 8192 ? content.slice(0, 8192) : content;
    return slice.includes("\0");
}
export async function handlePreToolUseRead(e) {
    if (e.tool_name !== "Read")
        return {};
    const cfg = loadConfig();
    if (!cfg.delta_enabled)
        return {};
    const input = e.tool_input;
    const cwd = e.cwd ?? process.cwd();
    if (!input?.file_path)
        return {};
    const abspath = isAbsolute(input.file_path) ? input.file_path : join(cwd, input.file_path);
    if (isExcluded(abspath))
        return {};
    let content;
    try {
        content = readFileSync(abspath, "utf8");
    }
    catch {
        return {};
    }
    if (isBinary(content))
        return {};
    const db = openDb(cwd);
    try {
        const cached = getCachedStale(db, abspath);
        if (!cached) {
            setCached(db, abspath, content);
            return {};
        }
        if (cached.content === content) {
            return {
                decision: "block",
                reason: "File unchanged since last read.",
                additionalContext: `[tokenstack] ${abspath} unchanged since ${new Date(cached.served_at).toISOString()}. Re-using prior read.`,
            };
        }
        const diff = unifiedDiff(cached.content, content);
        if (diffSizeRatio(diff, content.length) > DIFF_RATIO_LIMIT) {
            setCached(db, abspath, content);
            return {};
        }
        setCached(db, abspath, content);
        return {
            decision: "block",
            reason: "Small delta; see additionalContext.",
            additionalContext: `[tokenstack delta] ${abspath}\n${diff}`,
        };
    }
    finally {
        db.close();
    }
}
