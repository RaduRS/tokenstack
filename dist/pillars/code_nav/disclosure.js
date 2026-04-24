export function disclose(h, level) {
    if (level === 0)
        return `${h.path}:${h.start_line}-${h.end_line}  [${h.kind}] ${h.name}  (id=${h.id})`;
    const firstLine = h.content.split("\n")[0] ?? "";
    if (level === 1)
        return `${h.path}:${h.start_line}  ${firstLine}`;
    if (level === 2) {
        const lines = h.content.split("\n");
        const outline = lines.slice(0, Math.min(6, lines.length)).join("\n");
        return `${h.path}:${h.start_line}-${h.end_line}\n${outline}${lines.length > 6 ? "\n..." : ""}`;
    }
    return h.content;
}
