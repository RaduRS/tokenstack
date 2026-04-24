import { readFileSync } from "node:fs";
import { relative, extname, isAbsolute, join } from "node:path";
import { createHash } from "node:crypto";
import { extractJsTs } from "./extract/js_ts.js";
import { extractPython, extractGo, extractRust, extractJava, extractRuby } from "./extract/generic.js";
import { chunkSymbol } from "./chunk.js";
const EXT_TO_LANG = {
    ".js": "jsts", ".jsx": "jsts", ".ts": "jsts", ".tsx": "jsts", ".mjs": "jsts", ".cjs": "jsts",
    ".py": "py", ".go": "go", ".rs": "rs", ".java": "java", ".rb": "rb",
};
const sha = (s) => createHash("sha256").update(s).digest("hex");
function extract(lang, path, src) {
    switch (lang) {
        case "jsts": return extractJsTs(path, src);
        case "py": return extractPython(path, src);
        case "go": return extractGo(path, src);
        case "rs": return extractRust(path, src);
        case "java": return extractJava(path, src);
        case "rb": return extractRuby(path, src);
        default: return [];
    }
}
export async function reindexFile(db, root, abspath) {
    const ext = extname(abspath);
    const lang = EXT_TO_LANG[ext];
    if (!lang)
        return;
    const abs = isAbsolute(abspath) ? abspath : join(root, abspath);
    const rel = relative(root, abs);
    let src;
    try {
        src = readFileSync(abs, "utf8");
    }
    catch {
        return;
    }
    db.prepare("BEGIN").run();
    try {
        db.prepare("DELETE FROM symbols WHERE path = ?").run(rel);
        const insert = db.prepare(`INSERT INTO symbols(id, path, start_line, end_line, kind, name, name_lc, content, content_lc, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path, start_line, end_line) DO UPDATE SET
         kind=excluded.kind, name=excluded.name, name_lc=excluded.name_lc,
         content=excluded.content, content_lc=excluded.content_lc, content_hash=excluded.content_hash`);
        for (const sym of extract(lang, rel, src)) {
            for (const c of chunkSymbol(sym)) {
                insert.run(c.id, c.path, c.start_line, c.end_line, c.kind, c.name, c.name.toLowerCase(), c.content, c.content.toLowerCase(), sha(c.content));
            }
        }
        db.prepare("COMMIT").run();
    }
    catch (e) {
        db.prepare("ROLLBACK").run();
        throw e;
    }
}
