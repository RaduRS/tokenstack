const PATTERNS = [
    { kind: "function", re: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/ },
    { kind: "class", re: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/ },
    { kind: "variable", re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/ },
    { kind: "method", re: /^\s+(?:public\s+|private\s+|protected\s+|static\s+|async\s+|\*\s*)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^={]+)?\s*\{/ },
];
function findEnd(lines, start) {
    let depth = 0;
    let seen = false;
    for (let i = start; i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === "{") {
                depth++;
                seen = true;
            }
            else if (ch === "}") {
                depth--;
                if (seen && depth === 0)
                    return i + 1;
            }
        }
    }
    return Math.min(start + 50, lines.length);
}
export function extractJsTs(path, src) {
    const lines = src.split("\n");
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        for (const { kind, re } of PATTERNS) {
            const m = lines[i].match(re);
            if (m && m[1]) {
                const start = i + 1;
                const end = kind === "variable" ? start : findEnd(lines, i);
                out.push({ path, start_line: start, end_line: end, kind, name: m[1], content: lines.slice(start - 1, end).join("\n") });
                break;
            }
        }
    }
    return out;
}
