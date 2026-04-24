import type { Symbol } from "./js_ts.js";

function make(
  path: string, src: string,
  patterns: { kind: Symbol["kind"]; re: RegExp }[],
  endHint: (lines: string[], start: number) => number
): Symbol[] {
  const lines = src.split("\n");
  const out: Symbol[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (const { kind, re } of patterns) {
      const m = lines[i]!.match(re);
      if (m && m[1]) {
        const start = i + 1;
        const end = endHint(lines, i);
        out.push({ path, start_line: start, end_line: end, kind, name: m[1], content: lines.slice(start - 1, end).join("\n") });
        break;
      }
    }
  }
  return out;
}

function indentEnd(lines: string[], start: number): number {
  const base = lines[start]!.match(/^\s*/)![0].length;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.trim() === "") continue;
    if (l.match(/^\s*/)![0].length <= base) return i;
  }
  return lines.length;
}

function braceEnd(lines: string[], start: number): number {
  let depth = 0, seen = false;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]!) {
      if (ch === "{") { depth++; seen = true; }
      else if (ch === "}") { depth--; if (seen && depth === 0) return i + 1; }
    }
  }
  return Math.min(start + 50, lines.length);
}

function rubyEnd(lines: string[], start: number): number {
  let depth = 1;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*(def|class|module|if|unless|while|until|do|begin|case)\b/.test(lines[i]!)) depth++;
    if (/^\s*end\b/.test(lines[i]!)) { depth--; if (depth === 0) return i + 1; }
  }
  return lines.length;
}

export function extractPython(path: string, src: string): Symbol[] {
  return make(path, src, [
    { kind: "function", re: /^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)/ },
    { kind: "class", re: /^\s*class\s+([A-Za-z_][\w]*)/ },
  ], indentEnd);
}

export function extractGo(path: string, src: string): Symbol[] {
  return make(path, src, [
    { kind: "function", re: /^\s*func(?:\s+\([^)]+\))?\s+([A-Za-z_][\w]*)/ },
    { kind: "class", re: /^\s*type\s+([A-Za-z_][\w]*)\s+(?:struct|interface)\b/ },
  ], braceEnd);
}

export function extractRust(path: string, src: string): Symbol[] {
  return make(path, src, [
    { kind: "function", re: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)/ },
    { kind: "class", re: /^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z_][\w]*)/ },
  ], braceEnd);
}

export function extractJava(path: string, src: string): Symbol[] {
  return make(path, src, [
    { kind: "class", re: /^\s*(?:public\s+|private\s+|protected\s+|abstract\s+|final\s+)*(?:class|interface|enum)\s+([A-Za-z_][\w]*)/ },
    { kind: "method", re: /^\s*(?:public\s+|private\s+|protected\s+|static\s+|final\s+|abstract\s+|synchronized\s+)*[\w<>\[\],\s]*\s+([A-Za-z_][\w]*)\s*\([^)]*\)\s*(?:throws\s+[^{]+)?\s*\{/ },
  ], braceEnd);
}

export function extractRuby(path: string, src: string): Symbol[] {
  return make(path, src, [
    { kind: "function", re: /^\s*def\s+(?:self\.)?([A-Za-z_][\w?!=]*)/ },
    { kind: "class", re: /^\s*(?:class|module)\s+([A-Za-z_][\w:]*)/ },
  ], rubyEnd);
}
