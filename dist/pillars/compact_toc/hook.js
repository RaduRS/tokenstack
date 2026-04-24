import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { openDb, stateDir } from "../../storage/db.js";
import { logEvent } from "./events.js";
import { buildToc } from "./toc.js";
import { reindexFile } from "../code_nav/incremental.js";
const tocPath = (cwd) => join(stateDir(cwd), "resume.xml");
export async function handlePostToolUseEvent(e) {
    const cwd = e.cwd ?? process.cwd();
    const db = openDb(cwd);
    try {
        if (e.tool_name === "Edit" || e.tool_name === "Write") {
            const p = e.tool_input?.file_path;
            if (p) {
                logEvent(db, "file_edit", { path: String(p) });
                const abspath = isAbsolute(String(p)) ? String(p) : join(cwd, String(p));
                try {
                    await reindexFile(db, cwd, abspath);
                }
                catch { /* ignore */ }
            }
        }
        else if (e.tool_name === "Bash") {
            const cmd = e.tool_input?.command;
            if (cmd)
                logEvent(db, "bash_run", { cmd: String(cmd) });
        }
        else if (e.tool_name === "Read") {
            const p = e.tool_input?.file_path;
            if (p)
                logEvent(db, "file_read", { path: String(p) });
        }
        return {};
    }
    finally {
        db.close();
    }
}
export async function handlePreCompact(e) {
    const cwd = e.cwd ?? process.cwd();
    const db = openDb(cwd);
    try {
        const xml = buildToc(db);
        writeFileSync(tocPath(cwd), xml);
        return { additionalContext: xml };
    }
    finally {
        db.close();
    }
}
export async function handleSessionStartToc(e) {
    const cwd = e.cwd ?? process.cwd();
    const p = tocPath(cwd);
    if (!existsSync(p))
        return {};
    return { additionalContext: readFileSync(p, "utf8") };
}
