import { createHash } from "node:crypto";
const MAX = 2500;
const OVERLAP = 300;
export function symbolId(path, startLine, endLine, content) {
    return createHash("sha256").update(`${path}:${startLine}:${endLine}:${content}`).digest("hex").slice(0, 16);
}
export function chunkSymbol(sym) {
    if (sym.content.length <= MAX) {
        return [{ ...sym, id: symbolId(sym.path, sym.start_line, sym.end_line, sym.content) }];
    }
    const chunks = [];
    const lines = sym.content.split("\n");
    let buf = [];
    let bufLen = 0;
    let startLine = sym.start_line;
    for (const line of lines) {
        if (bufLen + line.length + 1 > MAX && buf.length > 0) {
            const content = buf.join("\n");
            const endLine = startLine + buf.length - 1;
            chunks.push({ ...sym, start_line: startLine, end_line: endLine, content, id: symbolId(sym.path, startLine, endLine, content) });
            const overlapLines = [];
            let overlapLen = 0;
            for (let k = buf.length - 1; k >= 0 && overlapLen < OVERLAP; k--) {
                overlapLines.unshift(buf[k]);
                overlapLen += buf[k].length + 1;
            }
            buf = overlapLines;
            bufLen = overlapLen;
            startLine = endLine - overlapLines.length + 1;
        }
        buf.push(line);
        bufLen += line.length + 1;
    }
    if (buf.length > 0) {
        const content = buf.join("\n");
        const endLine = startLine + buf.length - 1;
        chunks.push({ ...sym, start_line: startLine, end_line: endLine, content, id: symbolId(sym.path, startLine, endLine, content) });
    }
    return chunks;
}
