import { statSync } from "node:fs";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { createHash } from "node:crypto";
function fingerprint(abspath) {
    const s = statSync(abspath);
    // Store as microseconds to stay within JS safe integer range while preserving sub-ms resolution.
    return { mtime_ns: Math.floor(s.mtimeMs * 1000), size: s.size };
}
function sha256(s) {
    return createHash("sha256").update(s).digest("hex");
}
export function setCached(db, abspath, content) {
    const { mtime_ns, size } = fingerprint(abspath);
    const hash = sha256(content);
    const blob = brotliCompressSync(Buffer.from(content, "utf8"), { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } });
    db.prepare(`INSERT INTO read_cache(abspath, mtime_ns, size, content_hash, brotli_content, served_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(abspath) DO UPDATE SET
       mtime_ns=excluded.mtime_ns, size=excluded.size,
       content_hash=excluded.content_hash, brotli_content=excluded.brotli_content,
       served_at=excluded.served_at`).run(abspath, mtime_ns, size, hash, blob, Date.now());
}
export function getCached(db, abspath) {
    const row = db.prepare("SELECT mtime_ns, size, content_hash, brotli_content, served_at FROM read_cache WHERE abspath = ?").get(abspath);
    if (!row)
        return null;
    let fp;
    try {
        fp = fingerprint(abspath);
    }
    catch {
        return null;
    }
    if (fp.mtime_ns !== row.mtime_ns || fp.size !== row.size)
        return null;
    const content = brotliDecompressSync(row.brotli_content).toString("utf8");
    return { content, hash: row.content_hash, served_at: row.served_at };
}
// Like getCached but ignores mtime/size drift — used by the delta hook which
// explicitly wants the previously-served content even if the file has since changed.
export function getCachedStale(db, abspath) {
    const row = db.prepare("SELECT content_hash, brotli_content, served_at FROM read_cache WHERE abspath = ?").get(abspath);
    if (!row)
        return null;
    const content = brotliDecompressSync(row.brotli_content).toString("utf8");
    return { content, hash: row.content_hash, served_at: row.served_at };
}
