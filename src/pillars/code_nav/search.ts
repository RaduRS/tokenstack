import type { Db } from "../../storage/db.js";

export type Hit = {
  id: string; path: string; start_line: number; end_line: number;
  kind: string; name: string; content: string; score: number;
};

const RRF_K = 60;
const TRIGRAM_CANDIDATES = 300;
const TRIGRAM_MIN_OVERLAP = 0.3;

function trigrams(s: string): Set<string> {
  const padded = `  ${s.toLowerCase()}  `;
  const out = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function rrf(lists: { rowid: number }[][], k: number): Map<number, number> {
  const score = new Map<number, number>();
  for (const list of lists) {
    list.forEach((row, idx) => {
      score.set(row.rowid, (score.get(row.rowid) ?? 0) + 1 / (k + idx + 1));
    });
  }
  return score;
}

export function searchSymbols(db: Db, query: string, limit = 20): Hit[] {
  const q = query.trim();
  if (!q) return [];
  const qLc = q.toLowerCase();

  // Channel 1: SQL LIKE — exact name first, then substring name, then substring content
  const exact = db.prepare("SELECT rowid FROM symbols WHERE name_lc = ? LIMIT 50").all(qLc) as { rowid: number }[];
  const prefix = db.prepare("SELECT rowid FROM symbols WHERE name_lc LIKE ? AND name_lc != ? LIMIT 50").all(`${qLc}%`, qLc) as { rowid: number }[];
  const substr = db.prepare("SELECT rowid FROM symbols WHERE name_lc LIKE ? AND name_lc NOT LIKE ? LIMIT 50").all(`%${qLc}%`, `${qLc}%`) as { rowid: number }[];
  const contentSub = db.prepare("SELECT rowid FROM symbols WHERE content_lc LIKE ? LIMIT 50").all(`%${qLc}%`) as { rowid: number }[];
  const sqlRanked = [...exact, ...prefix, ...substr, ...contentSub];

  // Channel 2: Trigram fuzzy
  const qTri = trigrams(q);
  const candidates = db.prepare(
    "SELECT rowid, name_lc FROM symbols LIMIT ?"
  ).all(TRIGRAM_CANDIDATES) as { rowid: number; name_lc: string }[];
  const scored = candidates
    .map((c) => ({ rowid: c.rowid, score: jaccard(qTri, trigrams(c.name_lc)) }))
    .filter((x) => x.score >= TRIGRAM_MIN_OVERLAP)
    .sort((a, b) => b.score - a.score);
  const triRanked = scored.map((s) => ({ rowid: s.rowid }));

  const fused = rrf([sqlRanked, triRanked], RRF_K);
  const sorted = [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (sorted.length === 0) return [];
  const ids = sorted.map(([rowid]) => rowid);
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT rowid, id, path, start_line, end_line, kind, name, content FROM symbols WHERE rowid IN (${placeholders})`
  ).all(...ids) as (Hit & { rowid: number })[];
  const byId = new Map(rows.map((r) => [r.rowid, r]));
  return sorted.map(([rowid, score]) => ({ ...(byId.get(rowid)!), score })).filter((r) => r.id);
}
