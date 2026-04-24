import { loadConfig, saveConfig, type Mode } from "../storage/config.js";
import { openDb } from "../storage/db.js";
import { searchSymbols } from "../pillars/code_nav/search.js";
import { disclose } from "../pillars/code_nav/disclosure.js";
import { indexProject } from "../pillars/code_nav/indexer.js";

const MODES: Mode[] = ["off", "lite", "full", "ultra"];

type Opts = { positional: string[]; cwd?: string; home?: string };

function parseOpts(args: string[]): Opts {
  const positional: string[] = [];
  let cwd: string | undefined;
  let home: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cwd" && args[i + 1]) { cwd = args[++i]; continue; }
    if (args[i] === "--home" && args[i + 1]) { home = args[++i]; continue; }
    positional.push(args[i]!);
  }
  return { positional, cwd, home };
}

export async function runCli(argv: string[]): Promise<string> {
  const [cmd, ...rest] = argv;
  const { positional, cwd, home } = parseOpts(rest);
  switch (cmd) {
    case "mode": {
      const m = positional[0];
      if (!m || !MODES.includes(m as Mode)) throw new Error(`usage: /ts mode <${MODES.join("|")}>`);
      saveConfig(home ?? process.env.HOME ?? "", { mode: m as Mode });
      return `tokenstack mode -> ${m}`;
    }
    case "status": {
      const cfg = loadConfig(home);
      return `mode=${cfg.mode} filters=${cfg.filters_enabled} delta=${cfg.delta_enabled}`;
    }
    case "recover": {
      const id = Number(positional[0]);
      if (!id) throw new Error("usage: /ts recover <id>");
      const { recover } = await import("../pillars/bash_filter/hook.js");
      const raw = recover(cwd ?? process.cwd(), id);
      if (!raw) throw new Error(`no tee entry for id ${id}`);
      return raw;
    }
    case "search": {
      const q = positional.join(" ");
      if (!q) throw new Error("usage: /ts search <query>");
      const db = openDb(cwd ?? process.cwd());
      try {
        const hits = searchSymbols(db, q, 10);
        if (hits.length === 0) return "(no results)";
        return hits.map((h) => disclose(h, 0)).join("\n");
      } finally { db.close(); }
    }
    case "show": {
      const id = positional[0];
      const levelArg = rest.find((a) => a.startsWith("--level="));
      const level = Number(levelArg?.slice(8) ?? 3) as 0 | 1 | 2 | 3;
      if (!id) throw new Error("usage: /ts show <id> [--level=0..3]");
      const db = openDb(cwd ?? process.cwd());
      try {
        const row = db.prepare("SELECT id, path, start_line, end_line, kind, name, content FROM symbols WHERE id = ?").get(id) as any;
        if (!row) throw new Error(`no symbol: ${id}`);
        return disclose({ ...row, score: 1 }, level);
      } finally { db.close(); }
    }
    case "index": {
      const root = cwd ?? process.cwd();
      const db = openDb(root);
      try {
        const n = await indexProject(db, root);
        return `indexed ${n} symbols`;
      } finally { db.close(); }
    }
    default:
      return `Usage: /ts <subcommand> [args]
  mode <off|lite|full|ultra>   set output-rule mode
  status                       show current config
  (more subcommands ship in later phases)`;
  }
}

async function main(): Promise<void> {
  try {
    const out = await runCli(process.argv.slice(2));
    process.stdout.write(out + "\n");
  } catch (e) {
    process.stderr.write((e as Error).message + "\n");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
