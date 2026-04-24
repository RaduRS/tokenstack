import type { HookEvent, HookResponse } from "../../hook.js";
import { openDb } from "../../storage/db.js";
import { runFilter, selectFilter } from "./engine.js";
import { FILTERS } from "./filters/index.js";
import { loadConfig } from "../../storage/config.js";

export async function handlePostToolUseBash(e: HookEvent): Promise<HookResponse> {
  if (e.tool_name !== "Bash") return {};
  const cwd = e.cwd ?? process.cwd();
  const cfg = loadConfig();
  if (!cfg.filters_enabled) return {};

  const cmd = String((e.tool_input as any)?.command ?? "");
  const raw = String((e.tool_response as any)?.stdout ?? "") + String((e.tool_response as any)?.stderr ?? "");
  if (!raw) return {};

  const filter = selectFilter(FILTERS, cmd);
  if (!filter) return {};

  const filtered = runFilter(filter, raw);
  const db = openDb(cwd);
  try {
    db.prepare("INSERT INTO bash_tee(cmd, raw_output, filtered_output, ts) VALUES (?, ?, ?, ?)").run(cmd, raw, filtered, Date.now());
    const id = (db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number }).id;
    const savedPct = raw.length > 0 ? Math.round((1 - filtered.length / raw.length) * 100) : 0;
    return {
      additionalContext: `[tokenstack filter ${filter.name}, -${savedPct}%, recover id=${id}]\n${filtered}`,
      suppressOutput: true,
    };
  } finally { db.close(); }
}

export function recover(cwd: string, id: number): string | null {
  const db = openDb(cwd);
  try {
    const row = db.prepare("SELECT raw_output FROM bash_tee WHERE id = ?").get(id) as { raw_output: string } | undefined;
    return row?.raw_output ?? null;
  } finally { db.close(); }
}
