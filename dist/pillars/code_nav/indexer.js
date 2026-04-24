import { readdirSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { createHash } from "node:crypto";
import { extractJsTs } from "./extract/js_ts.js";
import { extractPython, extractGo, extractRust, extractJava, extractRuby } from "./extract/generic.js";
import { chunkSymbol } from "./chunk.js";
const EXT_TO_LANG = {
    ".js": "jsts", ".jsx": "jsts", ".ts": "jsts", ".tsx": "jsts", ".mjs": "jsts", ".cjs": "jsts",
    ".py": "py", ".go": "go", ".rs": "rs", ".java": "java", ".rb": "rb",
};
function extractForLang(lang, path, src) {
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
const IGNORE = new Set(["node_modules", "dist", ".git", ".tokenstack", "coverage", "build", ".next", ".cache"]);
const sha = (s) => createHash("sha256").update(s).digest("hex");
function* walk(root, dir = root) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const ent of entries) {
        if (IGNORE.has(ent.name))
            continue;
        const p = join(dir, ent.name);
        if (ent.isDirectory())
            yield* walk(root, p);
        else if (ent.isFile() && EXT_TO_LANG[extname(ent.name)])
            yield p;
    }
}
export async function indexProject(db, root) {
    let n = 0;
    const insert = db.prepare(`INSERT INTO symbols(id, path, start_line, end_line, kind, name, name_lc, content, content_lc, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path, start_line, end_line) DO UPDATE SET
       kind=excluded.kind, name=excluded.name, name_lc=excluded.name_lc,
       content=excluded.content, content_lc=excluded.content_lc, content_hash=excluded.content_hash`);
    db.prepare("BEGIN").run();
    try {
        db.prepare("DELETE FROM symbols").run();
        for (const abspath of walk(root)) {
            let src;
            try {
                src = readFileSync(abspath, "utf8");
            }
            catch {
                continue;
            }
            if (src.length > 1024 * 1024)
                continue;
            const rel = relative(root, abspath);
            const lang = EXT_TO_LANG[extname(abspath)];
            if (!lang)
                continue;
            for (const sym of extractForLang(lang, rel, src)) {
                for (const c of chunkSymbol(sym)) {
                    insert.run(c.id, c.path, c.start_line, c.end_line, c.kind, c.name, c.name.toLowerCase(), c.content, c.content.toLowerCase(), sha(c.content));
                    n++;
                }
            }
        }
        db.prepare("COMMIT").run();
    }
    catch (e) {
        db.prepare("ROLLBACK").run();
        throw e;
    }
    return n;
}
