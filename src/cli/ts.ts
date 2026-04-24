import { loadConfig, saveConfig, type Mode } from "../storage/config.js";

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
  void cwd;
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
