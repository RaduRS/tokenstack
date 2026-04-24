const ANSI_RE = /\x1b\[[0-9;]*m/g;
export function runFilter(f, input) {
    let text = input;
    if (f.stages.ansi_strip)
        text = text.replace(ANSI_RE, "");
    if (f.stages.replace) {
        for (const r of f.stages.replace)
            text = text.replace(r.pattern, r.replacement);
    }
    if (f.stages.match_output) {
        const mo = f.stages.match_output;
        if (mo.pattern.test(text) && !(mo.unless && mo.unless.test(text))) {
            return text.replace(mo.pattern, mo.replacement);
        }
    }
    let lines = text.split("\n");
    if (f.stages.strip)
        lines = lines.filter((l) => !f.stages.strip.test(l));
    if (f.stages.keep)
        lines = lines.filter((l) => f.stages.keep.test(l));
    if (f.stages.truncate_chars) {
        const n = f.stages.truncate_chars;
        lines = lines.map((l) => (l.length > n ? l.slice(0, n) + "…" : l));
    }
    if (f.stages.head_lines && lines.length > f.stages.head_lines) {
        const kept = lines.slice(0, f.stages.head_lines);
        const dropped = lines.length - f.stages.head_lines;
        lines = [...kept, `... ${dropped} more lines truncated ...`];
    }
    else if (f.stages.tail_lines && lines.length > f.stages.tail_lines) {
        const kept = lines.slice(-f.stages.tail_lines);
        const dropped = lines.length - f.stages.tail_lines;
        lines = [`... ${dropped} earlier lines truncated ...`, ...kept];
    }
    if (f.stages.max_lines && lines.length > f.stages.max_lines) {
        lines = [...lines.slice(0, f.stages.max_lines), `... capped at ${f.stages.max_lines} ...`];
    }
    const result = lines.join("\n").trim();
    if (!result && f.stages.on_empty)
        return f.stages.on_empty;
    return result;
}
export function selectFilter(filters, command) {
    return filters.find((f) => f.match_command.test(command));
}
