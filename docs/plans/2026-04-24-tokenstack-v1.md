# tokenstack v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Claude Code plugin that attacks five token-waste axes (output verbosity, Bash bloat, file re-read waste, compaction survival, code navigation) in a single install, above-average on every axis vs the 10 surveyed projects.

**Architecture:** Single Node 22.5+ TypeScript plugin, zero npm runtime deps, stdlib only (`node:sqlite`, `node:zlib`, `node:crypto`, `node:fs`, `node:test`). Three Claude Code surfaces: 7-phase hooks, `/ts` slash command, `SKILL.md`. Per-project SQLite state at `<project>/.tokenstack/state.db`; global config at `~/.claude/tokenstack/`.

**Tech Stack:** Node 22.5+, TypeScript 5.6, `node:test`, `node:sqlite` (FTS5 built in), `node:zlib` (Brotli), `node:crypto` (SHA-256). No npm runtime dependencies. `typescript` and `@types/node` only as devDependencies.

**SQL convention:** All SQL goes through `prepare(sql).run()` for single statements and a `runScript(db, sql)` helper that splits on `;` and prepares each. This keeps the call surface uniform and avoids multi-statement shell-like APIs.

---

## Phase 0 — Build infrastructure

### Task 0.1: TypeScript config

**Files:** Create `tsconfig.json`

- [ ] **Step 1: Install devDeps**

```bash
cd /Users/sisin/Developer/tokenstack
npm install --save-dev typescript@^5.6.0 @types/node@^22.0.0
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Verify build**

```bash
mkdir -p src && echo "export const ok = true;" > src/index.ts
npx tsc
ls dist/
```

Expected: `dist/index.js`, no errors.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json package.json package-lock.json src/index.ts
git commit -m "chore: typescript toolchain"
```

---

### Task 0.2: Test runner smoke

**Files:** Create `src/smoke.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/smoke.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

test("smoke: node:test runs", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Build and run**

```bash
npx tsc
node --test dist/smoke.test.js
```

Expected: `# pass 1`.

- [ ] **Step 3: Commit**

```bash
git add src/smoke.test.ts
git commit -m "test: node:test smoke"
```

---

### Task 0.3: Plugin manifest and hooks

**Files:** Create `.claude-plugin/plugin.json`, `.claude-plugin/hooks.json`

- [ ] **Step 1: `plugin.json`**

```json
{
  "name": "tokenstack",
  "version": "0.1.0",
  "description": "Five-front token optimization for Claude Code",
  "author": "tokenstack contributors",
  "license": "MIT",
  "commands": ["commands/ts.md"],
  "skills": ["skills/tokenstack"]
}
```

- [ ] **Step 2: `hooks.json`**

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Read", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/dist/hook.js\"" }] }
    ],
    "PostToolUse": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/dist/hook.js\"" }] }
    ],
    "UserPromptSubmit": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/dist/hook.js\"" }] }
    ],
    "PreCompact": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/dist/hook.js\"" }] }
    ],
    "SessionStart": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/dist/hook.js\"" }] }
    ],
    "SessionEnd": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/dist/hook.js\"" }] }
    ]
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/
git commit -m "feat: plugin manifest and hook routing"
```

---

### Task 0.4: Hook dispatcher entry

**Files:** Create `src/hook.ts`, `src/hook.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/hook.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatch } from "./hook.js";

test("dispatch: unknown event returns {}", async () => {
  const out = await dispatch({ hook_event_name: "Unknown" } as any);
  assert.deepEqual(out, {});
});

test("dispatch: known event with no handler returns {}", async () => {
  const out = await dispatch({ hook_event_name: "SessionEnd" } as any);
  assert.deepEqual(out, {});
});
```

- [ ] **Step 2: Write dispatcher**

```typescript
// src/hook.ts
export type HookEvent = {
  hook_event_name: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
  cwd?: string;
  session_id?: string;
  transcript_path?: string;
};

export type HookResponse = {
  continue?: boolean;
  decision?: "approve" | "block";
  reason?: string;
  additionalContext?: string;
  suppressOutput?: boolean;
};

type Handler = (e: HookEvent) => Promise<HookResponse>;

const handlers: Record<string, Handler> = {};

export function register(event: string, handler: Handler): void {
  handlers[event] = handler;
}

export async function dispatch(event: HookEvent): Promise<HookResponse> {
  const h = handlers[event.hook_event_name];
  if (!h) return {};
  try {
    return await h(event);
  } catch (err) {
    return { additionalContext: `[tokenstack error] ${(err as Error).message}` };
  }
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  let event: HookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const response = await dispatch(event);
  process.stdout.write(JSON.stringify(response));
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
```

- [ ] **Step 3: Build + run tests**

```bash
npx tsc && node --test dist/hook.test.js
```

Expected: `# pass 2`.

- [ ] **Step 4: CLI smoke**

```bash
echo '{"hook_event_name":"SessionEnd"}' | node dist/hook.js
```

Expected: `{}`

- [ ] **Step 5: Commit**

```bash
git add src/hook.ts src/hook.test.ts
git commit -m "feat: hook dispatcher with register/dispatch"
```

---

## Phase 1 — Storage foundation

### Task 1.1: Global config

**Files:** Create `src/storage/config.ts`, `src/storage/config.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/storage/config.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, saveConfig, defaultConfig } from "./config.js";

test("loadConfig returns defaults when missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    assert.deepEqual(loadConfig(dir), defaultConfig());
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("saveConfig round-trips", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    saveConfig(dir, { mode: "ultra" });
    assert.equal(loadConfig(dir).mode, "ultra");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Module**

```typescript
// src/storage/config.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type Mode = "off" | "lite" | "full" | "ultra";

export type Config = {
  mode: Mode;
  filters_enabled: boolean;
  delta_enabled: boolean;
};

export function defaultConfig(): Config {
  return { mode: "lite", filters_enabled: true, delta_enabled: true };
}

export function configDir(base = homedir()): string {
  return join(base, ".claude", "tokenstack");
}

export function loadConfig(base = homedir()): Config {
  const path = join(configDir(base), "config.json");
  if (!existsSync(path)) return defaultConfig();
  try {
    return { ...defaultConfig(), ...JSON.parse(readFileSync(path, "utf8")) };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(base: string, cfg: Partial<Config>): void {
  const dir = configDir(base);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const current = loadConfig(base);
  writeFileSync(join(dir, "config.json"), JSON.stringify({ ...current, ...cfg }, null, 2));
}
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/storage/config.test.js
```

Expected: `# pass 2`.

- [ ] **Step 4: Commit**

```bash
git add src/storage/config.ts src/storage/config.test.ts
git commit -m "feat(storage): global config with defaults"
```

---

### Task 1.2: Per-project DB

**Files:** Create `src/storage/db.ts`, `src/storage/db.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/storage/db.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./db.js";

test("openDb creates state.db with expected tables", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const db = openDb(dir);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' OR type='view'").all() as { name: string }[]).map((t) => t.name);
    assert.ok(tables.includes("read_cache"));
    assert.ok(tables.includes("bash_tee"));
    assert.ok(tables.includes("session_events"));
    assert.ok(tables.includes("symbols"));
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("openDb is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    openDb(dir).close();
    openDb(dir).close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Module**

```typescript
// src/storage/db.ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Db = DatabaseSync;

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS read_cache (
    abspath TEXT PRIMARY KEY,
    mtime_ns INTEGER NOT NULL,
    size INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    brotli_content BLOB NOT NULL,
    served_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bash_tee (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cmd TEXT NOT NULL,
    raw_output TEXT NOT NULL,
    filtered_output TEXT NOT NULL,
    ts INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS session_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    kind TEXT NOT NULL,
    payload_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS symbols (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    UNIQUE(path, start_line, end_line)
  )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
    name, content,
    content='symbols',
    content_rowid='rowid',
    tokenize='porter unicode61'
  )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS symbols_trigram USING fts5(
    name, content,
    content='symbols',
    content_rowid='rowid',
    tokenize='trigram'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bash_tee_ts ON bash_tee(ts)`,
  `CREATE INDEX IF NOT EXISTS idx_session_events_ts ON session_events(ts)`,
  `CREATE INDEX IF NOT EXISTS idx_symbols_path ON symbols(path)`,
];

const PRAGMAS: string[] = [
  "PRAGMA journal_mode=WAL",
  "PRAGMA synchronous=NORMAL",
];

export function stateDir(projectRoot: string): string {
  return join(projectRoot, ".tokenstack");
}

export function runScript(db: Db, statements: string[]): void {
  for (const stmt of statements) {
    db.prepare(stmt).run();
  }
}

export function openDb(projectRoot: string): Db {
  const dir = stateDir(projectRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "state.db"));
  runScript(db, PRAGMAS);
  runScript(db, SCHEMA_STATEMENTS);
  return db;
}
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/storage/db.test.js
```

Expected: `# pass 2`.

- [ ] **Step 4: Commit**

```bash
git add src/storage/db.ts src/storage/db.test.ts
git commit -m "feat(storage): sqlite schema with FTS5 porter+trigram"
```

---

## Phase 2 — Pillar 1: Output rules

### Task 2.1: Rules content

**Files:** Create `src/pillars/output_rules/rules.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/output_rules/rules.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { rulesForMode } from "./rules.js";

test("mode off returns empty", () => { assert.equal(rulesForMode("off"), ""); });

test("modes produce non-empty content", () => {
  for (const m of ["lite", "full", "ultra"] as const) assert.ok(rulesForMode(m).length > 0);
});

test("all active modes include override clause", () => {
  for (const m of ["lite", "full", "ultra"] as const) {
    assert.ok(rulesForMode(m).toLowerCase().includes("user instructions"));
  }
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/output_rules/rules.ts
import type { Mode } from "../../storage/config.js";

const OVERRIDE = "\nUser instructions always override these rules. If the user asks for verbosity, long explanation, or a summary, obey the user.";

const LITE = `tokenstack mode: LITE
- No preamble. Do not start with "I'll help you..." or "Sure, here's...".
- No closing summary unless asked.
- Verify API/flag/version/SHA before asserting.`;

const FULL = `tokenstack mode: FULL
- No preamble ("I'll help...", "Sure, here's...", "Great question...").
- No closing summary unless the user asks.
- One-shot writes: if the full answer is short, produce it in one write, not increments.
- No polish on passing code. Tests green = stop.
- Tool-call budget: at 40 calls, start wrapping up; at 50, stop and report.
- Anti-hallucination: verify any API, flag, version, SHA, or package name by reading code or docs.
- Prefer Edit over full Write when the change is <30% of the file.
- Skip files >100 KB unless the task requires them.`;

const ULTRA = `tokenstack mode: ULTRA
Fragments OK. Drop articles. Keep code exact.
Preserve: fenced code, backticks, URLs, file paths.
No preamble. No summary. No polish. Verify before asserting.
Budget 20 tool calls; stop at 30.`;

export function rulesForMode(mode: Mode): string {
  if (mode === "off") return "";
  const body = mode === "lite" ? LITE : mode === "full" ? FULL : ULTRA;
  return body + OVERRIDE;
}
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/output_rules/rules.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/output_rules/
git commit -m "feat(pillar1): mode-scaled output rules"
```

---

### Task 2.2: SessionStart injects rules

**Files:** Create `src/pillars/output_rules/session_start.ts`, `.test.ts`; modify `src/hook.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/output_rules/session_start.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveConfig } from "../../storage/config.js";
import { handleSessionStart } from "./session_start.js";

test("injects rules for full mode", async () => {
  const base = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    saveConfig(base, { mode: "full" });
    const r = await handleSessionStart({ hook_event_name: "SessionStart" } as any, base);
    assert.ok(r.additionalContext?.includes("tokenstack mode: FULL"));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("silent on mode off", async () => {
  const base = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    saveConfig(base, { mode: "off" });
    const r = await handleSessionStart({ hook_event_name: "SessionStart" } as any, base);
    assert.equal(r.additionalContext, undefined);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/output_rules/session_start.ts
import type { HookEvent, HookResponse } from "../../hook.js";
import { loadConfig } from "../../storage/config.js";
import { rulesForMode } from "./rules.js";
import { homedir } from "node:os";

export async function handleSessionStart(_e: HookEvent, base = homedir()): Promise<HookResponse> {
  const cfg = loadConfig(base);
  const rules = rulesForMode(cfg.mode);
  if (!rules) return {};
  return { additionalContext: rules };
}
```

- [ ] **Step 3: Register in dispatcher**

Add to `src/hook.ts`:

```typescript
import { handleSessionStart } from "./pillars/output_rules/session_start.js";
register("SessionStart", handleSessionStart);
```

- [ ] **Step 4: Build + test**

```bash
npx tsc && node --test dist/pillars/output_rules/session_start.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/hook.ts src/pillars/output_rules/session_start.ts src/pillars/output_rules/session_start.test.ts
git commit -m "feat(pillar1): SessionStart injects rules"
```

---

### Task 2.3: UserPromptSubmit ACTIVE reminder

**Files:** Create `src/pillars/output_rules/prompt_submit.ts`, `.test.ts`; modify `src/hook.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/output_rules/prompt_submit.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveConfig } from "../../storage/config.js";
import { handleUserPromptSubmit } from "./prompt_submit.js";

test("reminds on active mode", async () => {
  const base = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    saveConfig(base, { mode: "full" });
    const r = await handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit" } as any, base);
    assert.ok(r.additionalContext?.includes("ACTIVE"));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("silent on mode off", async () => {
  const base = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    saveConfig(base, { mode: "off" });
    const r = await handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit" } as any, base);
    assert.deepEqual(r, {});
  } finally { rmSync(base, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/output_rules/prompt_submit.ts
import type { HookEvent, HookResponse } from "../../hook.js";
import { loadConfig } from "../../storage/config.js";
import { homedir } from "node:os";

export async function handleUserPromptSubmit(_e: HookEvent, base = homedir()): Promise<HookResponse> {
  const cfg = loadConfig(base);
  if (cfg.mode === "off") return {};
  return { additionalContext: `[tokenstack ACTIVE: ${cfg.mode}] Continue applying output rules.` };
}
```

- [ ] **Step 3: Register**

```typescript
import { handleUserPromptSubmit } from "./pillars/output_rules/prompt_submit.js";
register("UserPromptSubmit", handleUserPromptSubmit);
```

- [ ] **Step 4: Build + test**

```bash
npx tsc && node --test dist/pillars/output_rules/prompt_submit.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/hook.ts src/pillars/output_rules/prompt_submit.ts src/pillars/output_rules/prompt_submit.test.ts
git commit -m "feat(pillar1): ACTIVE reminder on each prompt"
```

---

### Task 2.4: `/ts mode` and `/ts status`

**Files:** Create `commands/ts.md`, `src/cli/ts.ts`, `src/cli/ts.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/cli/ts.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../storage/config.js";
import { runCli } from "./ts.js";

test("ts mode ultra persists", async () => {
  const base = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    const out = await runCli(["mode", "ultra", "--home", base]);
    assert.match(out, /mode.*ultra/i);
    assert.equal(loadConfig(base).mode, "ultra");
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("ts mode bogus rejects", async () => {
  const base = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    await assert.rejects(runCli(["mode", "bogus", "--home", base]));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("ts status prints mode", async () => {
  const base = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    const out = await runCli(["status", "--home", base]);
    assert.match(out, /mode/i);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: CLI**

```typescript
// src/cli/ts.ts
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
  index                        (built later)
  search <query>               (built later)
  show <id> --level=N          (built later)
  recover <id>                 (built later)
  coach                        (built later)
  reset [--cache|--index|--all] (built later)`;
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
```

- [ ] **Step 3: Slash command wrapper**

```markdown
<!-- commands/ts.md -->
---
description: tokenstack control (mode, status, search, recover, index, coach, reset)
argument-hint: <subcommand> [args]
allowed-tools:
  - Bash
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/cli/ts.js" $ARGUMENTS`
```

- [ ] **Step 4: Build + test**

```bash
npx tsc && node --test dist/cli/ts.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/cli/ commands/ts.md
git commit -m "feat(cli): /ts mode and /ts status"
```

---

## Phase 3 — Pillar 2: Bash filter pipelines

### Task 3.1: Filter engine

**Files:** Create `src/pillars/bash_filter/engine.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/bash_filter/engine.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { runFilter, type Filter } from "./engine.js";

test("ansi strip", () => {
  const f: Filter = { match_command: /.*/, stages: { ansi_strip: true } };
  assert.equal(runFilter(f, "\x1b[31mRED\x1b[0m X"), "RED X");
});

test("replace chain", () => {
  const f: Filter = { match_command: /.*/, stages: { replace: [{ pattern: /foo/g, replacement: "bar" }, { pattern: /b/g, replacement: "B" }] } };
  assert.equal(runFilter(f, "foofoo"), "BarBar");
});

test("head_lines with marker", () => {
  const f: Filter = { match_command: /.*/, stages: { head_lines: 2 } };
  assert.equal(runFilter(f, "a\nb\nc\nd"), "a\nb\n... 2 more lines truncated ...");
});

test("tail_lines", () => {
  const f: Filter = { match_command: /.*/, stages: { tail_lines: 2 } };
  assert.equal(runFilter(f, "a\nb\nc\nd"), "... 2 earlier lines truncated ...\nc\nd");
});

test("keep regex", () => {
  const f: Filter = { match_command: /.*/, stages: { keep: /foo/ } };
  assert.equal(runFilter(f, "foo\nbar\nfoo2"), "foo\nfoo2");
});

test("strip regex", () => {
  const f: Filter = { match_command: /.*/, stages: { strip: /^\s*$/ } };
  assert.equal(runFilter(f, "a\n\nb\n \nc"), "a\nb\nc");
});

test("on_empty fallback", () => {
  const f: Filter = { match_command: /.*/, stages: { keep: /nope/, on_empty: "(no matches)" } };
  assert.equal(runFilter(f, "a\nb"), "(no matches)");
});
```

- [ ] **Step 2: Engine**

```typescript
// src/pillars/bash_filter/engine.ts
export type Filter = {
  name?: string;
  match_command: RegExp;
  stages: {
    ansi_strip?: boolean;
    replace?: { pattern: RegExp; replacement: string }[];
    match_output?: { pattern: RegExp; replacement: string; unless?: RegExp };
    strip?: RegExp;
    keep?: RegExp;
    truncate_chars?: number;
    head_lines?: number;
    tail_lines?: number;
    max_lines?: number;
    on_empty?: string;
  };
};

const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function runFilter(f: Filter, input: string): string {
  let text = input;
  if (f.stages.ansi_strip) text = text.replace(ANSI_RE, "");
  if (f.stages.replace) {
    for (const r of f.stages.replace) text = text.replace(r.pattern, r.replacement);
  }
  if (f.stages.match_output) {
    const mo = f.stages.match_output;
    if (mo.pattern.test(text) && !(mo.unless && mo.unless.test(text))) {
      return text.replace(mo.pattern, mo.replacement);
    }
  }
  let lines = text.split("\n");
  if (f.stages.strip) lines = lines.filter((l) => !f.stages.strip!.test(l));
  if (f.stages.keep) lines = lines.filter((l) => f.stages.keep!.test(l));
  if (f.stages.truncate_chars) {
    const n = f.stages.truncate_chars;
    lines = lines.map((l) => (l.length > n ? l.slice(0, n) + "…" : l));
  }
  if (f.stages.head_lines && lines.length > f.stages.head_lines) {
    const kept = lines.slice(0, f.stages.head_lines);
    const dropped = lines.length - f.stages.head_lines;
    lines = [...kept, `... ${dropped} more lines truncated ...`];
  } else if (f.stages.tail_lines && lines.length > f.stages.tail_lines) {
    const kept = lines.slice(-f.stages.tail_lines);
    const dropped = lines.length - f.stages.tail_lines;
    lines = [`... ${dropped} earlier lines truncated ...`, ...kept];
  }
  if (f.stages.max_lines && lines.length > f.stages.max_lines) {
    lines = [...lines.slice(0, f.stages.max_lines), `... capped at ${f.stages.max_lines} ...`];
  }
  const result = lines.join("\n").trim();
  if (!result && f.stages.on_empty) return f.stages.on_empty;
  return result;
}

export function selectFilter(filters: Filter[], command: string): Filter | undefined {
  return filters.find((f) => f.match_command.test(command));
}
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/bash_filter/engine.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/bash_filter/engine.ts src/pillars/bash_filter/engine.test.ts
git commit -m "feat(pillar2): 8-stage filter pipeline engine"
```

---

### Task 3.2: Ship 5 filters (git, npm, tsc)

**Files:** Create `src/pillars/bash_filter/filters/{git,npm,tsc,index}.ts`, `filters.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/bash_filter/filters/filters.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { runFilter } from "../engine.js";
import { FILTERS } from "./index.js";

function find(name: string) {
  const f = FILTERS.find((x) => x.name === name);
  if (!f) throw new Error(`no filter: ${name}`);
  return f;
}

test("git-status drops hint lines", () => {
  const raw = "On branch main\n(use \"git add ...\")\nmodified: a.ts";
  const out = runFilter(find("git-status"), raw);
  assert.ok(!out.includes("git add"));
  assert.ok(out.includes("modified"));
});

test("npm-ls collapses tree", () => {
  const raw = "a@1\n├── react@18\n│   ├── loose@1\n│   │   └── js-tokens@4\n│   └── sched@0\n└── dom@18";
  const out = runFilter(find("npm-ls"), raw);
  assert.ok(out.split("\n").length < raw.split("\n").length);
});

test("tsc keeps error lines", () => {
  const raw = "watch noise\nsrc/a.ts(10,3): error TS2322: x\nother noise\nsrc/b.ts(3,1): error TS2304: y";
  const out = runFilter(find("tsc"), raw);
  assert.ok(out.includes("TS2322"));
  assert.ok(out.includes("TS2304"));
  assert.ok(!out.includes("watch noise"));
});
```

- [ ] **Step 2: Filters**

```typescript
// src/pillars/bash_filter/filters/git.ts
import type { Filter } from "../engine.js";

export const gitStatus: Filter = {
  name: "git-status",
  match_command: /^git\s+status/,
  stages: {
    ansi_strip: true,
    strip: /\(use "git add|\(use "git restore|\(use "git push|^\s*$/,
    max_lines: 80,
    on_empty: "(clean working tree)",
  },
};

export const gitLog: Filter = {
  name: "git-log",
  match_command: /^git\s+log/,
  stages: { ansi_strip: true, strip: /^(Author|AuthorDate|CommitDate|Commit):/, head_lines: 40 },
};

export const gitDiff: Filter = {
  name: "git-diff",
  match_command: /^git\s+diff/,
  stages: { ansi_strip: true, max_lines: 200 },
};
```

```typescript
// src/pillars/bash_filter/filters/npm.ts
import type { Filter } from "../engine.js";

export const npmLs: Filter = {
  name: "npm-ls",
  match_command: /^(npm|pnpm|yarn)\s+ls/,
  stages: { ansi_strip: true, strip: /^│\s+│|^│\s+└──|^│\s+├──/, max_lines: 60 },
};
```

```typescript
// src/pillars/bash_filter/filters/tsc.ts
import type { Filter } from "../engine.js";

export const tsc: Filter = {
  name: "tsc",
  match_command: /^(npx\s+)?tsc\b/,
  stages: { ansi_strip: true, keep: /error\s+TS\d+|Found \d+ errors?/, on_empty: "(no type errors)", max_lines: 50 },
};
```

```typescript
// src/pillars/bash_filter/filters/index.ts
import type { Filter } from "../engine.js";
import { gitStatus, gitLog, gitDiff } from "./git.js";
import { npmLs } from "./npm.js";
import { tsc } from "./tsc.js";

export const FILTERS: Filter[] = [gitStatus, gitLog, gitDiff, npmLs, tsc];
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/bash_filter/filters/filters.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/bash_filter/filters/
git commit -m "feat(pillar2): 5 filters (git status/log/diff, npm ls, tsc)"
```

---

### Task 3.3: PostToolUse Bash hook + tee

**Files:** Create `src/pillars/bash_filter/hook.ts`, `.test.ts`; modify `src/hook.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/bash_filter/hook.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handlePostToolUseBash, recover } from "./hook.js";

test("filters git status via PostToolUse", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const r = await handlePostToolUseBash({
      hook_event_name: "PostToolUse", tool_name: "Bash",
      tool_input: { command: "git status" },
      tool_response: { stdout: "On branch main\n(use \"git add\")\nmodified: foo.ts" },
      cwd: dir,
    } as any);
    assert.ok(r.additionalContext?.includes("modified"));
    assert.ok(!r.additionalContext?.includes("git add"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("recover pulls raw", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    await handlePostToolUseBash({
      hook_event_name: "PostToolUse", tool_name: "Bash",
      tool_input: { command: "git status" },
      tool_response: { stdout: "raw-xyz" }, cwd: dir,
    } as any);
    assert.ok(recover(dir, 1)?.includes("raw-xyz"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Handler**

```typescript
// src/pillars/bash_filter/hook.ts
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
```

- [ ] **Step 3: Register**

```typescript
// in src/hook.ts
import { handlePostToolUseBash } from "./pillars/bash_filter/hook.js";
register("PostToolUse", handlePostToolUseBash);
```

- [ ] **Step 4: Build + test**

```bash
npx tsc && node --test dist/pillars/bash_filter/hook.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/hook.ts src/pillars/bash_filter/hook.ts src/pillars/bash_filter/hook.test.ts
git commit -m "feat(pillar2): PostToolUse Bash filter + tee recovery"
```

---

### Task 3.4: `/ts recover`

**Files:** Modify `src/cli/ts.ts`, `.test.ts`

- [ ] **Step 1: Add test**

Append to `src/cli/ts.test.ts`:

```typescript
import { openDb } from "../storage/db.js";

test("ts recover <id>", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-proj-"));
  try {
    const db = openDb(dir);
    db.prepare("INSERT INTO bash_tee(cmd, raw_output, filtered_output, ts) VALUES (?,?,?,?)").run("x", "RAW_HELLO", "", Date.now());
    db.close();
    const out = await runCli(["recover", "1", "--cwd", dir]);
    assert.ok(out.includes("RAW_HELLO"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Add case**

In `src/cli/ts.ts`, add to the switch:

```typescript
    case "recover": {
      const id = Number(positional[0]);
      if (!id) throw new Error("usage: /ts recover <id>");
      const { recover } = await import("../pillars/bash_filter/hook.js");
      const raw = recover(cwd ?? process.cwd(), id);
      if (!raw) throw new Error(`no tee entry for id ${id}`);
      return raw;
    }
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/cli/ts.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/ts.ts src/cli/ts.test.ts
git commit -m "feat(cli): /ts recover pulls raw bash output"
```

---

### Task 3.5: Add 5 more filters

**Files:** Create `src/pillars/bash_filter/filters/{test_runners,eslint,docker,coreutils}.ts`, modify `index.ts`, extend `filters.test.ts`

- [ ] **Step 1: Filter modules**

```typescript
// src/pillars/bash_filter/filters/test_runners.ts
import type { Filter } from "../engine.js";

export const jestVitest: Filter = {
  name: "jest-vitest",
  match_command: /^(npx\s+)?(jest|vitest)\b/,
  stages: { ansi_strip: true, keep: /✕|✗|FAIL|PASS\s+\S+|Tests:|Suites:|Duration/, head_lines: 30, on_empty: "(test runner output empty)" },
};
```

```typescript
// src/pillars/bash_filter/filters/eslint.ts
import type { Filter } from "../engine.js";

export const eslint: Filter = {
  name: "eslint",
  match_command: /^(npx\s+)?eslint\b/,
  stages: { ansi_strip: true, strip: /^\s*$/, keep: /error|warning|problem/i, max_lines: 80, on_empty: "(no lint findings)" },
};
```

```typescript
// src/pillars/bash_filter/filters/docker.ts
import type { Filter } from "../engine.js";

export const dockerPs: Filter = {
  name: "docker-ps",
  match_command: /^docker\s+(ps|container\s+ls)/,
  stages: { ansi_strip: true, truncate_chars: 120, max_lines: 30 },
};
```

```typescript
// src/pillars/bash_filter/filters/coreutils.ts
import type { Filter } from "../engine.js";

export const lsLong: Filter = {
  name: "ls",
  match_command: /^ls(\s|$)/,
  stages: { ansi_strip: true, max_lines: 60, on_empty: "(empty)" },
};

export const findCmd: Filter = {
  name: "find",
  match_command: /^find\s+/,
  stages: { ansi_strip: true, max_lines: 80 },
};
```

- [ ] **Step 2: Register**

```typescript
// src/pillars/bash_filter/filters/index.ts
import type { Filter } from "../engine.js";
import { gitStatus, gitLog, gitDiff } from "./git.js";
import { npmLs } from "./npm.js";
import { tsc } from "./tsc.js";
import { jestVitest } from "./test_runners.js";
import { eslint } from "./eslint.js";
import { dockerPs } from "./docker.js";
import { lsLong, findCmd } from "./coreutils.js";

export const FILTERS: Filter[] = [gitStatus, gitLog, gitDiff, npmLs, tsc, jestVitest, eslint, dockerPs, lsLong, findCmd];
```

- [ ] **Step 3: Add tests**

Append to `filters.test.ts`:

```typescript
test("jest keeps only failures + summary", () => {
  const raw = "PASS src/a.test.ts\nconsole.log noise\n✕ t1\nTests: 1 failed, 5 passed\nDuration 1.2s";
  const out = runFilter(find("jest-vitest"), raw);
  assert.ok(out.includes("✕"));
  assert.ok(out.includes("Tests:"));
  assert.ok(!out.includes("console.log"));
});

test("ls caps length", () => {
  const raw = Array.from({ length: 200 }, (_, i) => `f${i}.ts`).join("\n");
  const out = runFilter(find("ls"), raw);
  assert.ok(out.split("\n").length <= 61);
});
```

- [ ] **Step 4: Build + test**

```bash
npx tsc && node --test dist/pillars/bash_filter/filters/filters.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/pillars/bash_filter/filters/
git commit -m "feat(pillar2): 5 more filters (jest/vitest, eslint, docker, ls, find)"
```

---

## Phase 4 — Pillar 3: File re-read delta

### Task 4.1: Unified diff

**Files:** Create `src/pillars/file_delta/diff.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/file_delta/diff.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { unifiedDiff } from "./diff.js";

test("identical returns empty", () => { assert.equal(unifiedDiff("a\nb", "a\nb"), ""); });
test("single change", () => { const d = unifiedDiff("a\nb\nc", "a\nB\nc"); assert.ok(d.includes("-b")); assert.ok(d.includes("+B")); });
test("insertion", () => { assert.ok(unifiedDiff("a\nc", "a\nb\nc").includes("+b")); });
test("deletion", () => { assert.ok(unifiedDiff("a\nb\nc", "a\nc").includes("-b")); });
```

- [ ] **Step 2: Module (Myers-style LCS, line granularity)**

```typescript
// src/pillars/file_delta/diff.ts
export function unifiedDiff(a: string, b: string): string {
  if (a === b) return "";
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const n = aLines.length;
  const m = bLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (aLines[i] === bLines[j]) dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      else dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: string[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) { out.push(` ${aLines[i]}`); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { out.push(`-${aLines[i]}`); i++; }
    else { out.push(`+${bLines[j]}`); j++; }
  }
  while (i < n) out.push(`-${aLines[i++]}`);
  while (j < m) out.push(`+${bLines[j++]}`);
  return out.join("\n");
}

export function diffSizeRatio(diff: string, originalLen: number): number {
  if (originalLen === 0) return 1;
  return diff.length / originalLen;
}
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/file_delta/diff.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/file_delta/diff.ts src/pillars/file_delta/diff.test.ts
git commit -m "feat(pillar3): zero-dep LCS unified diff"
```

---

### Task 4.2: Read cache (Brotli + SQLite)

**Files:** Create `src/pillars/file_delta/cache.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/file_delta/cache.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { getCached, setCached } from "./cache.js";

test("round-trip", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const db = openDb(dir);
    const f = join(dir, "x.txt");
    writeFileSync(f, "hello");
    setCached(db, f, "hello");
    assert.equal(getCached(db, f)?.content, "hello");
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("returns null on mtime change", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const db = openDb(dir);
    const f = join(dir, "x.txt");
    writeFileSync(f, "v1");
    setCached(db, f, "v1");
    writeFileSync(f, "v2");
    assert.equal(getCached(db, f), null);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/file_delta/cache.ts
import { statSync } from "node:fs";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { createHash } from "node:crypto";
import type { Db } from "../../storage/db.js";

function fingerprint(abspath: string): { mtime_ns: number; size: number } {
  const s = statSync(abspath);
  return { mtime_ns: Number(s.mtimeNs ?? BigInt(s.mtimeMs) * 1000000n), size: s.size };
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function setCached(db: Db, abspath: string, content: string): void {
  const { mtime_ns, size } = fingerprint(abspath);
  const hash = sha256(content);
  const blob = brotliCompressSync(Buffer.from(content, "utf8"), { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } });
  db.prepare(
    `INSERT INTO read_cache(abspath, mtime_ns, size, content_hash, brotli_content, served_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(abspath) DO UPDATE SET
       mtime_ns=excluded.mtime_ns, size=excluded.size,
       content_hash=excluded.content_hash, brotli_content=excluded.brotli_content,
       served_at=excluded.served_at`
  ).run(abspath, mtime_ns, size, hash, blob, Date.now());
}

export type Cached = { content: string; hash: string; served_at: number };

export function getCached(db: Db, abspath: string): Cached | null {
  const row = db.prepare(
    "SELECT mtime_ns, size, content_hash, brotli_content, served_at FROM read_cache WHERE abspath = ?"
  ).get(abspath) as { mtime_ns: number; size: number; content_hash: string; brotli_content: Buffer; served_at: number } | undefined;
  if (!row) return null;
  let fp: { mtime_ns: number; size: number };
  try { fp = fingerprint(abspath); } catch { return null; }
  if (fp.mtime_ns !== row.mtime_ns || fp.size !== row.size) return null;
  const content = brotliDecompressSync(row.brotli_content).toString("utf8");
  return { content, hash: row.content_hash, served_at: row.served_at };
}
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/file_delta/cache.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/file_delta/cache.ts src/pillars/file_delta/cache.test.ts
git commit -m "feat(pillar3): brotli-compressed read cache"
```

---

### Task 4.3: PreToolUse Read hook

**Files:** Create `src/pillars/file_delta/hook.ts`, `.test.ts`; modify `src/hook.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/file_delta/hook.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handlePreToolUseRead } from "./hook.js";
import { setCached } from "./cache.js";
import { openDb } from "../../storage/db.js";

const makeEvent = (dir: string, file: string) => ({
  hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: file }, cwd: dir,
} as any);

test("first read passthrough", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const f = join(dir, "a.txt");
    writeFileSync(f, "hello");
    assert.deepEqual(await handlePreToolUseRead(makeEvent(dir, f)), {});
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("unchanged re-read: NO-OP block", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const f = join(dir, "a.txt");
    writeFileSync(f, "hello");
    const db = openDb(dir); setCached(db, f, "hello"); db.close();
    const r = await handlePreToolUseRead(makeEvent(dir, f));
    assert.equal(r.decision, "block");
    assert.ok(r.additionalContext?.includes("unchanged"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("small delta returns diff", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const f = join(dir, "a.txt");
    const big = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    writeFileSync(f, big);
    const db = openDb(dir); setCached(db, f, big); db.close();
    writeFileSync(f, big.replace("line 42", "line XLII"));
    const r = await handlePreToolUseRead(makeEvent(dir, f));
    assert.ok(r.additionalContext?.includes("XLII") || r.additionalContext?.includes("line 42"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Handler**

```typescript
// src/pillars/file_delta/hook.ts
import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { HookEvent, HookResponse } from "../../hook.js";
import { openDb } from "../../storage/db.js";
import { loadConfig } from "../../storage/config.js";
import { getCached, setCached } from "./cache.js";
import { unifiedDiff, diffSizeRatio } from "./diff.js";

const EXCLUDED = [/\.env/, /\.pem$/, /\.p12$/, /\.key$/];
const DIFF_RATIO_LIMIT = 0.4;

function isExcluded(p: string): boolean { return EXCLUDED.some((r) => r.test(p)); }

function isBinary(content: string): boolean {
  const slice = content.length > 8192 ? content.slice(0, 8192) : content;
  return slice.includes("\0");
}

export async function handlePreToolUseRead(e: HookEvent): Promise<HookResponse> {
  if (e.tool_name !== "Read") return {};
  const cfg = loadConfig();
  if (!cfg.delta_enabled) return {};

  const input = e.tool_input as { file_path?: string } | undefined;
  const cwd = e.cwd ?? process.cwd();
  if (!input?.file_path) return {};
  const abspath = isAbsolute(input.file_path) ? input.file_path : join(cwd, input.file_path);
  if (isExcluded(abspath)) return {};

  let content: string;
  try { content = readFileSync(abspath, "utf8"); } catch { return {}; }
  if (isBinary(content)) return {};

  const db = openDb(cwd);
  try {
    const cached = getCached(db, abspath);
    if (!cached) { setCached(db, abspath, content); return {}; }
    if (cached.content === content) {
      return {
        decision: "block",
        reason: "File unchanged since last read.",
        additionalContext: `[tokenstack] ${abspath} unchanged since ${new Date(cached.served_at).toISOString()}. Re-using prior read.`,
      };
    }
    const diff = unifiedDiff(cached.content, content);
    if (diffSizeRatio(diff, content.length) > DIFF_RATIO_LIMIT) {
      setCached(db, abspath, content);
      return {};
    }
    setCached(db, abspath, content);
    return {
      decision: "block",
      reason: "Small delta; see additionalContext.",
      additionalContext: `[tokenstack delta] ${abspath}\n${diff}`,
    };
  } finally { db.close(); }
}
```

- [ ] **Step 3: Register**

```typescript
// src/hook.ts
import { handlePreToolUseRead } from "./pillars/file_delta/hook.js";
register("PreToolUse", async (e) => {
  if (e.tool_name === "Read") return handlePreToolUseRead(e);
  return {};
});
```

- [ ] **Step 4: Build + test**

```bash
npx tsc && node --test dist/pillars/file_delta/hook.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/hook.ts src/pillars/file_delta/hook.ts src/pillars/file_delta/hook.test.ts
git commit -m "feat(pillar3): PreToolUse Read hook with delta+unchanged detection"
```

---

## Phase 5 — Pillar 4: Compact-survival TOC

### Task 5.1: Session event logger

**Files:** Create `src/pillars/compact_toc/events.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/compact_toc/events.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { logEvent, listEvents } from "./events.js";

test("log + list", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const db = openDb(dir);
    logEvent(db, "file_edit", { path: "a.ts" });
    logEvent(db, "test_fail", { name: "t1" });
    const out = listEvents(db);
    assert.equal(out.length, 2);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/compact_toc/events.ts
import type { Db } from "../../storage/db.js";

export type EventKind = "file_edit" | "file_read" | "test_fail" | "todo" | "decision" | "bash_run";

export function logEvent(db: Db, kind: EventKind, payload: Record<string, unknown>): void {
  db.prepare("INSERT INTO session_events(ts, kind, payload_json) VALUES (?, ?, ?)").run(Date.now(), kind, JSON.stringify(payload));
}

export type EventRow = { id: number; ts: number; kind: string; payload: Record<string, unknown> };

export function listEvents(db: Db, limit = 1000): EventRow[] {
  const rows = db.prepare("SELECT id, ts, kind, payload_json FROM session_events ORDER BY id DESC LIMIT ?").all(limit) as { id: number; ts: number; kind: string; payload_json: string }[];
  return rows.map((r) => ({ id: r.id, ts: r.ts, kind: r.kind, payload: JSON.parse(r.payload_json) })).reverse();
}
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/compact_toc/events.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/compact_toc/events.ts src/pillars/compact_toc/events.test.ts
git commit -m "feat(pillar4): session event logger"
```

---

### Task 5.2: TOC builder + PreCompact + SessionStart chaining

**Files:** Create `src/pillars/compact_toc/toc.ts`, `.test.ts`, `hook.ts`; modify `src/hook.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/compact_toc/toc.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { logEvent } from "./events.js";
import { buildToc } from "./toc.js";

test("categorized XML with re-runnable queries", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const db = openDb(dir);
    logEvent(db, "file_edit", { path: "src/a.ts" });
    logEvent(db, "file_edit", { path: "src/b.ts" });
    logEvent(db, "test_fail", { name: "should do X" });
    logEvent(db, "todo", { text: "refactor Y" });
    const xml = buildToc(db);
    assert.ok(xml.startsWith("<session_resume"));
    assert.ok(xml.includes("src/a.ts"));
    assert.ok(xml.includes("/ts search"));
    assert.ok(xml.length < 2048);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: TOC builder**

```typescript
// src/pillars/compact_toc/toc.ts
import type { Db } from "../../storage/db.js";
import { listEvents } from "./events.js";

const MAX_BYTES = 2048;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildToc(db: Db): string {
  const events = listEvents(db, 1000);
  const files = Array.from(new Set(events.filter((e) => e.kind === "file_edit").map((e) => String(e.payload.path)))).slice(-10);
  const fails = events.filter((e) => e.kind === "test_fail").map((e) => String(e.payload.name)).slice(-5);
  const todos = events.filter((e) => e.kind === "todo").map((e) => String(e.payload.text)).slice(-5);
  const decisions = events.filter((e) => e.kind === "decision").map((e) => String(e.payload.text)).slice(-5);

  const parts: string[] = [`<session_resume version="1">`];
  if (files.length) {
    parts.push("  <files_edited>");
    for (const p of files) parts.push(`    <file path="${esc(p)}" query="/ts search &quot;${esc(p)}&quot;"/>`);
    parts.push("  </files_edited>");
  }
  if (fails.length) {
    parts.push("  <failing_tests>");
    for (const n of fails) parts.push(`    <test name="${esc(n)}" query="/ts search &quot;${esc(n)}&quot;"/>`);
    parts.push("  </failing_tests>");
  }
  if (todos.length) {
    parts.push("  <todos>");
    for (const t of todos) parts.push(`    <todo text="${esc(t)}"/>`);
    parts.push("  </todos>");
  }
  if (decisions.length) {
    parts.push("  <decisions>");
    for (const d of decisions) parts.push(`    <decision text="${esc(d)}"/>`);
    parts.push("  </decisions>");
  }
  parts.push("</session_resume>");
  let out = parts.join("\n");
  if (out.length > MAX_BYTES) out = out.slice(0, MAX_BYTES - 20) + "…</session_resume>";
  return out;
}
```

- [ ] **Step 3: Hook wrappers**

```typescript
// src/pillars/compact_toc/hook.ts
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { HookEvent, HookResponse } from "../../hook.js";
import { openDb, stateDir } from "../../storage/db.js";
import { logEvent } from "./events.js";
import { buildToc } from "./toc.js";

const tocPath = (cwd: string): string => join(stateDir(cwd), "resume.xml");

export async function handlePostToolUseEvent(e: HookEvent): Promise<HookResponse> {
  const cwd = e.cwd ?? process.cwd();
  const db = openDb(cwd);
  try {
    if (e.tool_name === "Edit" || e.tool_name === "Write") {
      const p = (e.tool_input as any)?.file_path;
      if (p) logEvent(db, "file_edit", { path: String(p) });
    } else if (e.tool_name === "Bash") {
      const cmd = (e.tool_input as any)?.command;
      if (cmd) logEvent(db, "bash_run", { cmd: String(cmd) });
    } else if (e.tool_name === "Read") {
      const p = (e.tool_input as any)?.file_path;
      if (p) logEvent(db, "file_read", { path: String(p) });
    }
    return {};
  } finally { db.close(); }
}

export async function handlePreCompact(e: HookEvent): Promise<HookResponse> {
  const cwd = e.cwd ?? process.cwd();
  const db = openDb(cwd);
  try {
    const xml = buildToc(db);
    writeFileSync(tocPath(cwd), xml);
    return { additionalContext: xml };
  } finally { db.close(); }
}

export async function handleSessionStartToc(e: HookEvent): Promise<HookResponse> {
  const cwd = e.cwd ?? process.cwd();
  const p = tocPath(cwd);
  if (!existsSync(p)) return {};
  return { additionalContext: readFileSync(p, "utf8") };
}
```

- [ ] **Step 4: Chain in dispatcher**

Update `src/hook.ts`:

```typescript
import { handlePostToolUseEvent, handlePreCompact, handleSessionStartToc } from "./pillars/compact_toc/hook.js";

function mergeResponses(a: HookResponse, b: HookResponse): HookResponse {
  const ctx = [a.additionalContext, b.additionalContext].filter(Boolean).join("\n\n");
  return {
    ...a, ...b,
    additionalContext: ctx || undefined,
    decision: b.decision ?? a.decision,
    reason: b.reason ?? a.reason,
    suppressOutput: a.suppressOutput || b.suppressOutput,
  };
}

// replace previous PostToolUse registration:
register("PostToolUse", async (e) => {
  const a = await handlePostToolUseBash(e);
  const b = await handlePostToolUseEvent(e);
  return mergeResponses(a, b);
});

register("PreCompact", handlePreCompact);

// replace previous SessionStart registration:
register("SessionStart", async (e) => {
  const a = await handleSessionStart(e);
  const b = await handleSessionStartToc(e);
  return mergeResponses(a, b);
});
```

- [ ] **Step 5: Build + run all tests**

```bash
npx tsc && node --test "dist/**/*.test.js"
```

- [ ] **Step 6: Commit**

```bash
git add src/hook.ts src/pillars/compact_toc/
git commit -m "feat(pillar4): events + TOC + PreCompact + SessionStart wiring"
```

---

## Phase 6 — Pillar 5: Code navigation

### Task 6.1: JS/TS symbol extractor

**Files:** Create `src/pillars/code_nav/extract/js_ts.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/code_nav/extract/js_ts.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJsTs } from "./js_ts.js";

test("extracts function, class, method, variable", () => {
  const src = [
    "export function hello(name: string) { return 'hi ' + name; }",
    "export class Foo {",
    "  bar() { return 1; }",
    "  private baz(x: number): number { return x * 2; }",
    "}",
    "const arrow = (a: number) => a;",
  ].join("\n");
  const names = extractJsTs("x.ts", src).map((s) => s.name).sort();
  assert.ok(names.includes("hello"));
  assert.ok(names.includes("Foo"));
  assert.ok(names.includes("bar"));
  assert.ok(names.includes("baz"));
  assert.ok(names.includes("arrow"));
});

test("line numbers preserved", () => {
  const src = "\n\nexport function hello() { return 1; }\n";
  const h = extractJsTs("f.ts", src).find((s) => s.name === "hello")!;
  assert.equal(h.start_line, 3);
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/code_nav/extract/js_ts.ts
export type Symbol = {
  path: string;
  start_line: number;
  end_line: number;
  kind: "function" | "class" | "method" | "variable";
  name: string;
  content: string;
};

const PATTERNS: { kind: Symbol["kind"]; re: RegExp }[] = [
  { kind: "function", re: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/ },
  { kind: "class", re: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/ },
  { kind: "variable", re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/ },
  { kind: "method", re: /^\s+(?:public\s+|private\s+|protected\s+|static\s+|async\s+|\*\s*)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^={]+)?\s*\{/ },
];

function findEnd(lines: string[], start: number): number {
  let depth = 0;
  let seen = false;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]!) {
      if (ch === "{") { depth++; seen = true; }
      else if (ch === "}") { depth--; if (seen && depth === 0) return i + 1; }
    }
  }
  return Math.min(start + 50, lines.length);
}

export function extractJsTs(path: string, src: string): Symbol[] {
  const lines = src.split("\n");
  const out: Symbol[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (const { kind, re } of PATTERNS) {
      const m = lines[i]!.match(re);
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
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/code_nav/extract/js_ts.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/code_nav/extract/
git commit -m "feat(pillar5): regex symbol extractor for JS/TS"
```

---

### Task 6.2: Chunker

**Files:** Create `src/pillars/code_nav/chunk.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/code_nav/chunk.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkSymbol, symbolId } from "./chunk.js";

test("small symbol => one chunk", () => {
  const chunks = chunkSymbol({ path: "a.ts", start_line: 1, end_line: 3, kind: "function", name: "f", content: "function f(){return 1;}" });
  assert.equal(chunks.length, 1);
});

test("large symbol splits with overlap", () => {
  const body = Array.from({ length: 200 }, (_, i) => `// line ${i} padded with many words to reach volume`).join("\n");
  const chunks = chunkSymbol({ path: "a.ts", start_line: 1, end_line: 200, kind: "function", name: "big", content: body });
  assert.ok(chunks.length >= 2);
});

test("deterministic id", () => {
  assert.equal(symbolId("a.ts", 1, 5, "hi"), symbolId("a.ts", 1, 5, "hi"));
  assert.equal(symbolId("a.ts", 1, 5, "hi").length, 16);
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/code_nav/chunk.ts
import { createHash } from "node:crypto";
import type { Symbol } from "./extract/js_ts.js";

const MAX = 2500;
const OVERLAP = 300;

export function symbolId(path: string, startLine: number, endLine: number, content: string): string {
  return createHash("sha256").update(`${path}:${startLine}:${endLine}:${content}`).digest("hex").slice(0, 16);
}

export type Chunk = Symbol & { id: string };

export function chunkSymbol(sym: Symbol): Chunk[] {
  if (sym.content.length <= MAX) {
    return [{ ...sym, id: symbolId(sym.path, sym.start_line, sym.end_line, sym.content) }];
  }
  const chunks: Chunk[] = [];
  const lines = sym.content.split("\n");
  let buf: string[] = [];
  let bufLen = 0;
  let startLine = sym.start_line;
  for (const line of lines) {
    if (bufLen + line.length + 1 > MAX && buf.length > 0) {
      const content = buf.join("\n");
      const endLine = startLine + buf.length - 1;
      chunks.push({ ...sym, start_line: startLine, end_line: endLine, content, id: symbolId(sym.path, startLine, endLine, content) });
      const overlapLines: string[] = [];
      let overlapLen = 0;
      for (let k = buf.length - 1; k >= 0 && overlapLen < OVERLAP; k--) {
        overlapLines.unshift(buf[k]!);
        overlapLen += buf[k]!.length + 1;
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
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/code_nav/chunk.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/code_nav/chunk.ts src/pillars/code_nav/chunk.test.ts
git commit -m "feat(pillar5): chunker with sha256 deterministic IDs"
```

---

### Task 6.3: Project indexer + FTS5 rebuild

**Files:** Create `src/pillars/code_nav/indexer.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/code_nav/indexer.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { indexProject } from "./indexer.js";

test("walks and inserts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), "export function alpha() { return 1; }\nexport class Beta {}\n");
    writeFileSync(join(dir, "src/b.ts"), "export const gamma = () => 2;\n");
    writeFileSync(join(dir, "README.md"), "# ignored\n");
    const db = openDb(dir);
    const n = await indexProject(db, dir);
    assert.ok(n >= 3);
    const c = (db.prepare("SELECT COUNT(*) AS c FROM symbols").get() as { c: number }).c;
    assert.ok(c >= 3);
    assert.ok(db.prepare("SELECT name FROM symbols WHERE name = 'alpha'").get());
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/code_nav/indexer.ts
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { createHash } from "node:crypto";
import type { Db } from "../../storage/db.js";
import { runScript } from "../../storage/db.js";
import { extractJsTs } from "./extract/js_ts.js";
import { chunkSymbol } from "./chunk.js";

const EXT_TO_LANG: Record<string, string> = {
  ".js": "jsts", ".jsx": "jsts", ".ts": "jsts", ".tsx": "jsts", ".mjs": "jsts", ".cjs": "jsts",
};

const IGNORE = new Set(["node_modules", "dist", ".git", ".tokenstack", "coverage", "build", ".next", ".cache"]);

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function* walk(root: string, dir: string = root): Generator<string> {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    if (IGNORE.has(ent.name)) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(root, p);
    else if (ent.isFile() && EXT_TO_LANG[extname(ent.name)]) yield p;
  }
}

export async function indexProject(db: Db, root: string): Promise<number> {
  let n = 0;
  const insert = db.prepare(
    `INSERT INTO symbols(id, path, start_line, end_line, kind, name, content, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path, start_line, end_line) DO UPDATE SET
       kind=excluded.kind, name=excluded.name, content=excluded.content, content_hash=excluded.content_hash`
  );
  db.prepare("BEGIN").run();
  try {
    runScript(db, ["DELETE FROM symbols", "DELETE FROM symbols_fts", "DELETE FROM symbols_trigram"]);
    for (const abspath of walk(root)) {
      let src: string;
      try { src = readFileSync(abspath, "utf8"); } catch { continue; }
      if (src.length > 1024 * 1024) continue;
      const rel = relative(root, abspath);
      for (const sym of extractJsTs(rel, src)) {
        for (const c of chunkSymbol(sym)) {
          insert.run(c.id, c.path, c.start_line, c.end_line, c.kind, c.name, c.content, sha(c.content));
          n++;
        }
      }
    }
    runScript(db, [
      "INSERT INTO symbols_fts(rowid, name, content) SELECT rowid, name, content FROM symbols",
      "INSERT INTO symbols_trigram(rowid, name, content) SELECT rowid, name, content FROM symbols",
    ]);
    db.prepare("COMMIT").run();
  } catch (e) {
    db.prepare("ROLLBACK").run();
    throw e;
  }
  return n;
}
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/code_nav/indexer.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/code_nav/indexer.ts src/pillars/code_nav/indexer.test.ts
git commit -m "feat(pillar5): project indexer with FTS5 rebuild"
```

---

### Task 6.4: RRF hybrid search

**Files:** Create `src/pillars/code_nav/search.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/code_nav/search.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { indexProject } from "./indexer.js";
import { searchSymbols } from "./search.js";

test("exact match", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/auth.ts"), "export function authenticate(user: string) { return user; }\n");
    writeFileSync(join(dir, "src/other.ts"), "export function unrelated() { return 42; }\n");
    const db = openDb(dir);
    await indexProject(db, dir);
    const hits = searchSymbols(db, "authenticate");
    assert.ok(hits.length > 0);
    assert.equal(hits[0]!.name, "authenticate");
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("typo via trigram", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/auth.ts"), "export function authenticate(user: string) { return user; }\n");
    const db = openDb(dir);
    await indexProject(db, dir);
    const hits = searchSymbols(db, "authenitcate");
    assert.ok(hits.length > 0);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/code_nav/search.ts
import type { Db } from "../../storage/db.js";

export type Hit = { id: string; path: string; start_line: number; end_line: number; kind: string; name: string; content: string; score: number };

const RRF_K = 60;

function rank(db: Db, table: string, query: string, limit: number): { rowid: number }[] {
  const q = query.replace(/"/g, "").trim();
  if (!q) return [];
  try {
    return db.prepare(`SELECT rowid FROM ${table} WHERE ${table} MATCH ? ORDER BY rank LIMIT ?`).all(q, limit) as { rowid: number }[];
  } catch { return []; }
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
  const fts = rank(db, "symbols_fts", query, 50);
  const tri = rank(db, "symbols_trigram", query, 50);
  const fused = rrf([fts, tri], RRF_K);
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
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/code_nav/search.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/code_nav/search.ts src/pillars/code_nav/search.test.ts
git commit -m "feat(pillar5): RRF hybrid search over FTS5"
```

---

### Task 6.5: L0–L3 disclosure + `/ts search`/`show`/`index`

**Files:** Create `src/pillars/code_nav/disclosure.ts`, `.test.ts`; modify `src/cli/ts.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/code_nav/disclosure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { disclose } from "./disclosure.js";

const sym = { id: "abc", path: "src/x.ts", start_line: 1, end_line: 10, kind: "function", name: "doThing",
  content: "function doThing(a: number, b: string): boolean {\n  // compute it\n  return a > 0 && b.length > 0;\n}", score: 1 };

test("L0", () => { assert.match(disclose(sym, 0), /src\/x\.ts:1-10/); });
test("L1", () => { assert.ok(disclose(sym, 1).includes("doThing(a: number, b: string)")); });
test("L2 longer than L1", () => { assert.ok(disclose(sym, 2).length > disclose(sym, 1).length); });
test("L3 is full body", () => { assert.equal(disclose(sym, 3), sym.content); });
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/code_nav/disclosure.ts
import type { Hit } from "./search.js";

export function disclose(h: Hit, level: 0 | 1 | 2 | 3): string {
  if (level === 0) return `${h.path}:${h.start_line}-${h.end_line}  [${h.kind}] ${h.name}  (id=${h.id})`;
  const firstLine = h.content.split("\n")[0] ?? "";
  if (level === 1) return `${h.path}:${h.start_line}  ${firstLine}`;
  if (level === 2) {
    const lines = h.content.split("\n");
    const outline = lines.slice(0, Math.min(6, lines.length)).join("\n");
    return `${h.path}:${h.start_line}-${h.end_line}\n${outline}${lines.length > 6 ? "\n..." : ""}`;
  }
  return h.content;
}
```

- [ ] **Step 3: Wire CLI**

Add imports to `src/cli/ts.ts`:

```typescript
import { openDb } from "../storage/db.js";
import { searchSymbols } from "../pillars/code_nav/search.js";
import { disclose } from "../pillars/code_nav/disclosure.js";
import { indexProject } from "../pillars/code_nav/indexer.js";
```

Add cases to the switch in `runCli`:

```typescript
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
```

- [ ] **Step 4: Build + test + smoke**

```bash
npx tsc && node --test dist/pillars/code_nav/disclosure.test.js
mkdir -p /tmp/ts-smoke/src && echo 'export function greet(name: string) { return "hi " + name; }' > /tmp/ts-smoke/src/a.ts
node dist/cli/ts.js index --cwd /tmp/ts-smoke
node dist/cli/ts.js search greet --cwd /tmp/ts-smoke
```

Expected: index count, then L0 hit for `greet`.

- [ ] **Step 5: Commit**

```bash
git add src/pillars/code_nav/disclosure.ts src/pillars/code_nav/disclosure.test.ts src/cli/ts.ts
git commit -m "feat(pillar5): L0-L3 disclosure + /ts search/show/index"
```

---

### Task 6.6: Add Python/Go/Rust/Java/Ruby extractors

**Files:** Create `src/pillars/code_nav/extract/generic.ts`, `.test.ts`; modify `indexer.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/code_nav/extract/generic.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPython, extractGo, extractRust, extractJava, extractRuby } from "./generic.js";

test("python", () => { const s = extractPython("x.py", "def foo(x):\n    return x\n\nclass Bar:\n    pass\n"); assert.ok(s.some((x) => x.name === "foo")); assert.ok(s.some((x) => x.name === "Bar")); });
test("go", () => { const s = extractGo("x.go", "package main\nfunc Hello(n string) string {\n  return n\n}\n"); assert.ok(s.some((x) => x.name === "Hello")); });
test("rust", () => { const s = extractRust("x.rs", "pub fn alpha() {}\nstruct Beta;\n"); assert.ok(s.some((x) => x.name === "alpha")); assert.ok(s.some((x) => x.name === "Beta")); });
test("java", () => { const s = extractJava("X.java", "public class X {\n  public void foo() {}\n}\n"); assert.ok(s.some((x) => x.name === "X")); assert.ok(s.some((x) => x.name === "foo")); });
test("ruby", () => { const s = extractRuby("x.rb", "class X\n  def foo\n    1\n  end\nend\n"); assert.ok(s.some((x) => x.name === "X")); assert.ok(s.some((x) => x.name === "foo")); });
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/code_nav/extract/generic.ts
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
```

- [ ] **Step 3: Wire into indexer**

Modify `src/pillars/code_nav/indexer.ts`:

```typescript
// add import
import { extractPython, extractGo, extractRust, extractJava, extractRuby } from "./extract/generic.js";

// expand map
const EXT_TO_LANG: Record<string, string> = {
  ".js": "jsts", ".jsx": "jsts", ".ts": "jsts", ".tsx": "jsts", ".mjs": "jsts", ".cjs": "jsts",
  ".py": "py", ".go": "go", ".rs": "rs", ".java": "java", ".rb": "rb",
};

function extractForLang(lang: string, path: string, src: string) {
  switch (lang) {
    case "jsts": return extractJsTs(path, src);
    case "py": return extractPython(path, src);
    case "go": return extractGo(path, src);
    case "rs": return extractRust(path, src);
    case "java": return extractJava(path, src);
    case "rb": return extractRuby(path, src);
    default: return [];
  }
}

// inside walk loop replace `for (const sym of extractJsTs(rel, src))` with:
const lang = EXT_TO_LANG[extname(abspath)];
if (!lang) continue;
for (const sym of extractForLang(lang, rel, src)) {
  for (const c of chunkSymbol(sym)) {
    insert.run(c.id, c.path, c.start_line, c.end_line, c.kind, c.name, c.content, sha(c.content));
    n++;
  }
}
```

- [ ] **Step 4: Build + test**

```bash
npx tsc && node --test dist/pillars/code_nav/extract/generic.test.js dist/pillars/code_nav/indexer.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/pillars/code_nav/
git commit -m "feat(pillar5): py/go/rust/java/ruby extractors"
```

---

### Task 6.7: Incremental re-index on Edit/Write

**Files:** Create `src/pillars/code_nav/incremental.ts`, `.test.ts`; modify `src/pillars/compact_toc/hook.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/code_nav/incremental.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { indexProject } from "./indexer.js";
import { reindexFile } from "./incremental.js";

test("re-index single file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), "export function one() { return 1; }\n");
    writeFileSync(join(dir, "src/b.ts"), "export function two() { return 2; }\n");
    const db = openDb(dir);
    await indexProject(db, dir);
    writeFileSync(join(dir, "src/a.ts"), "export function oneRenamed() { return 1; }\n");
    await reindexFile(db, dir, join(dir, "src/a.ts"));
    const names = (db.prepare("SELECT name FROM symbols").all() as { name: string }[]).map((r) => r.name).sort();
    assert.ok(names.includes("oneRenamed"));
    assert.ok(names.includes("two"));
    assert.ok(!names.includes("one"));
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/code_nav/incremental.ts
import { readFileSync } from "node:fs";
import { relative, extname, isAbsolute, join } from "node:path";
import { createHash } from "node:crypto";
import type { Db } from "../../storage/db.js";
import { runScript } from "../../storage/db.js";
import { extractJsTs } from "./extract/js_ts.js";
import { extractPython, extractGo, extractRust, extractJava, extractRuby } from "./extract/generic.js";
import { chunkSymbol } from "./chunk.js";

const EXT_TO_LANG: Record<string, string> = {
  ".js": "jsts", ".jsx": "jsts", ".ts": "jsts", ".tsx": "jsts", ".mjs": "jsts", ".cjs": "jsts",
  ".py": "py", ".go": "go", ".rs": "rs", ".java": "java", ".rb": "rb",
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function extract(lang: string, path: string, src: string) {
  switch (lang) {
    case "jsts": return extractJsTs(path, src);
    case "py": return extractPython(path, src);
    case "go": return extractGo(path, src);
    case "rs": return extractRust(path, src);
    case "java": return extractJava(path, src);
    case "rb": return extractRuby(path, src);
    default: return [];
  }
}

export async function reindexFile(db: Db, root: string, abspath: string): Promise<void> {
  const ext = extname(abspath);
  const lang = EXT_TO_LANG[ext];
  if (!lang) return;
  const abs = isAbsolute(abspath) ? abspath : join(root, abspath);
  const rel = relative(root, abs);
  let src: string;
  try { src = readFileSync(abs, "utf8"); } catch { return; }

  db.prepare("BEGIN").run();
  try {
    const stale = db.prepare("SELECT rowid FROM symbols WHERE path = ?").all(rel) as { rowid: number }[];
    const rowids = stale.map((r) => r.rowid);
    db.prepare("DELETE FROM symbols WHERE path = ?").run(rel);
    if (rowids.length > 0) {
      const qs = rowids.map(() => "?").join(",");
      db.prepare(`DELETE FROM symbols_fts WHERE rowid IN (${qs})`).run(...rowids);
      db.prepare(`DELETE FROM symbols_trigram WHERE rowid IN (${qs})`).run(...rowids);
    }
    const insert = db.prepare(
      `INSERT INTO symbols(id, path, start_line, end_line, kind, name, content, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path, start_line, end_line) DO UPDATE SET
         kind=excluded.kind, name=excluded.name, content=excluded.content, content_hash=excluded.content_hash`
    );
    const newRowids: number[] = [];
    for (const sym of extract(lang, rel, src)) {
      for (const c of chunkSymbol(sym)) {
        insert.run(c.id, c.path, c.start_line, c.end_line, c.kind, c.name, c.content, sha(c.content));
        const row = db.prepare("SELECT rowid FROM symbols WHERE id = ?").get(c.id) as { rowid: number };
        newRowids.push(row.rowid);
      }
    }
    if (newRowids.length > 0) {
      const qs = newRowids.map(() => "?").join(",");
      runScript(db, [
        `INSERT INTO symbols_fts(rowid, name, content) SELECT rowid, name, content FROM symbols WHERE rowid IN (${qs.replaceAll("?", "")})`,
      ]);
      // use run with parameters instead — iterate
      for (const rowid of newRowids) {
        db.prepare("INSERT INTO symbols_fts(rowid, name, content) SELECT rowid, name, content FROM symbols WHERE rowid = ?").run(rowid);
        db.prepare("INSERT INTO symbols_trigram(rowid, name, content) SELECT rowid, name, content FROM symbols WHERE rowid = ?").run(rowid);
      }
    }
    db.prepare("COMMIT").run();
  } catch (e) {
    db.prepare("ROLLBACK").run();
    throw e;
  }
}
```

- [ ] **Step 3: Chain into PostToolUse**

In `src/pillars/compact_toc/hook.ts`:

```typescript
import { reindexFile } from "../code_nav/incremental.js";

// replace the Edit/Write branch inside handlePostToolUseEvent:
if (e.tool_name === "Edit" || e.tool_name === "Write") {
  const p = (e.tool_input as any)?.file_path;
  if (p) {
    logEvent(db, "file_edit", { path: String(p) });
    const abspath = isAbsolute(String(p)) ? String(p) : join(cwd, String(p));
    try { await reindexFile(db, cwd, abspath); } catch { /* ignore */ }
  }
}
```

- [ ] **Step 4: Build + test**

```bash
npx tsc && node --test dist/pillars/code_nav/incremental.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/pillars/code_nav/incremental.ts src/pillars/code_nav/incremental.test.ts src/pillars/compact_toc/hook.ts
git commit -m "feat(pillar5): incremental re-index on Edit/Write"
```

---

## Phase 7 — Pillar 6: Telemetry

### Task 7.1: 7-signal score

**Files:** Create `src/pillars/telemetry/score.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/telemetry/score.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore } from "./score.js";

test("good session >= 90", () => {
  const s = computeScore({ context_fill_pct: 20, stale_read_count: 0, bloat_byte_count: 0, duplicate_read_count: 0, compaction_count: 0, tool_call_count: 10, decision_count: 5 });
  assert.ok(s.score >= 90);
});

test("bad session <= 40", () => {
  const s = computeScore({ context_fill_pct: 95, stale_read_count: 15, bloat_byte_count: 500000, duplicate_read_count: 10, compaction_count: 3, tool_call_count: 200, decision_count: 0 });
  assert.ok(s.score <= 40);
});

test("weights sum = total", () => {
  const s = computeScore({ context_fill_pct: 50, stale_read_count: 5, bloat_byte_count: 100000, duplicate_read_count: 3, compaction_count: 1, tool_call_count: 30, decision_count: 2 });
  const sum = Object.values(s.signals).reduce((a, b) => a + b.weighted, 0);
  assert.ok(Math.abs(sum - s.score) < 0.01);
});
```

- [ ] **Step 2: Module**

```typescript
// src/pillars/telemetry/score.ts
export type Signals = {
  context_fill_pct: number;
  stale_read_count: number;
  bloat_byte_count: number;
  duplicate_read_count: number;
  compaction_count: number;
  tool_call_count: number;
  decision_count: number;
};

const WEIGHTS = {
  context_fill_degradation: 0.20, stale_reads: 0.20, bloated_results: 0.20,
  duplicates: 0.10, compaction_depth: 0.15, decision_density: 0.08, agent_efficiency: 0.07,
};

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

function compactionPenalty(n: number): number {
  if (n === 0) return 100;
  if (n === 1) return 90;
  if (n === 2) return 65;
  return 35;
}

export function computeScore(s: Signals): { score: number; signals: Record<string, { raw: number; weighted: number }> } {
  const fill = clamp(100 - s.context_fill_pct);
  const stale = clamp(100 - s.stale_read_count * 5);
  const bloat = clamp(100 - s.bloat_byte_count / 10000);
  const dup = clamp(100 - s.duplicate_read_count * 8);
  const comp = compactionPenalty(s.compaction_count);
  const density = clamp(s.decision_count === 0 ? 0 : (s.decision_count / Math.max(s.tool_call_count, 1)) * 500);
  const eff = clamp(100 - Math.max(0, s.tool_call_count - 30) * 2);
  const signals = {
    context_fill_degradation: { raw: fill, weighted: fill * WEIGHTS.context_fill_degradation },
    stale_reads: { raw: stale, weighted: stale * WEIGHTS.stale_reads },
    bloated_results: { raw: bloat, weighted: bloat * WEIGHTS.bloated_results },
    duplicates: { raw: dup, weighted: dup * WEIGHTS.duplicates },
    compaction_depth: { raw: comp, weighted: comp * WEIGHTS.compaction_depth },
    decision_density: { raw: density, weighted: density * WEIGHTS.decision_density },
    agent_efficiency: { raw: eff, weighted: eff * WEIGHTS.agent_efficiency },
  };
  const score = Object.values(signals).reduce((a, b) => a + b.weighted, 0);
  return { score, signals };
}
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/pillars/telemetry/score.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/pillars/telemetry/
git commit -m "feat(pillar6): 7-signal weighted score"
```

---

### Task 7.2: Trends DB + SessionEnd hook

**Files:** Create `src/pillars/telemetry/trends.ts`, `hook.ts`, `.test.ts`; modify `src/hook.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/pillars/telemetry/hook.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { logEvent } from "../compact_toc/events.js";
import { handleSessionEnd } from "./hook.js";
import { recentSessions } from "./trends.js";

test("SessionEnd writes trend row", async () => {
  const proj = mkdtempSync(join(tmpdir(), "ts-proj-"));
  const home = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    const db = openDb(proj);
    logEvent(db, "bash_run", { cmd: "ls" });
    logEvent(db, "file_read", { path: "a.ts" });
    logEvent(db, "decision", { text: "use RRF k=60" });
    db.close();
    await handleSessionEnd({ hook_event_name: "SessionEnd", cwd: proj } as any, home);
    const sessions = recentSessions(home, 10);
    assert.equal(sessions.length, 1);
    assert.ok(sessions[0]!.score > 0);
  } finally {
    rmSync(proj, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Trends module**

```typescript
// src/pillars/telemetry/trends.ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { runScript } from "../../storage/db.js";

const TRENDS_SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    ts_start INTEGER NOT NULL,
    ts_end INTEGER NOT NULL,
    score REAL NOT NULL,
    signals_json TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_ts ON sessions(ts_end)`,
];

function trendsPath(base = homedir()): string {
  const dir = join(base, ".claude", "tokenstack");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "trends.db");
}

function openTrends(base?: string): DatabaseSync {
  const db = new DatabaseSync(trendsPath(base));
  runScript(db, TRENDS_SCHEMA);
  return db;
}

export function writeSession(
  base: string | undefined,
  row: { project: string; ts_start: number; ts_end: number; score: number; signals: unknown }
): void {
  const db = openTrends(base);
  try {
    db.prepare("INSERT INTO sessions(project, ts_start, ts_end, score, signals_json) VALUES (?, ?, ?, ?, ?)")
      .run(row.project, row.ts_start, row.ts_end, row.score, JSON.stringify(row.signals));
  } finally { db.close(); }
}

export type SessionRow = { project: string; ts_start: number; ts_end: number; score: number; signals: unknown };

export function recentSessions(base?: string, limit = 20): SessionRow[] {
  const db = openTrends(base);
  try {
    const rows = db.prepare("SELECT project, ts_start, ts_end, score, signals_json FROM sessions ORDER BY id DESC LIMIT ?").all(limit) as { project: string; ts_start: number; ts_end: number; score: number; signals_json: string }[];
    return rows.map((r) => ({ ...r, signals: JSON.parse(r.signals_json) }));
  } finally { db.close(); }
}
```

- [ ] **Step 3: Hook module**

```typescript
// src/pillars/telemetry/hook.ts
import type { HookEvent, HookResponse } from "../../hook.js";
import { openDb } from "../../storage/db.js";
import { listEvents } from "../compact_toc/events.js";
import { computeScore, type Signals } from "./score.js";
import { writeSession, recentSessions } from "./trends.js";

export async function handleSessionEnd(e: HookEvent, base?: string): Promise<HookResponse> {
  const cwd = e.cwd ?? process.cwd();
  const db = openDb(cwd);
  try {
    const events = listEvents(db, 10000);
    if (events.length === 0) return {};
    const tsStart = events[0]!.ts;
    const tsEnd = events[events.length - 1]!.ts;
    const readPaths = events.filter((x) => x.kind === "file_read").map((x) => String(x.payload.path));
    const duplicateReads = readPaths.length - new Set(readPaths).size;
    const signals: Signals = {
      context_fill_pct: 50,
      stale_read_count: 0,
      bloat_byte_count: 0,
      duplicate_read_count: duplicateReads,
      compaction_count: events.filter((x) => x.kind === "bash_run" && String((x.payload as any).cmd ?? "").includes("/compact")).length,
      tool_call_count: events.length,
      decision_count: events.filter((x) => x.kind === "decision").length,
    };
    const { score, signals: detail } = computeScore(signals);
    writeSession(base, { project: cwd, ts_start: tsStart, ts_end: tsEnd, score, signals: { input: signals, detail } });
    return {};
  } finally { db.close(); }
}

export async function handleSessionStartShowLast(_e: HookEvent, base?: string): Promise<HookResponse> {
  const rows = recentSessions(base, 1);
  if (rows.length === 0) return {};
  return { additionalContext: `[tokenstack] Last session score: ${rows[0]!.score.toFixed(1)}/100` };
}
```

- [ ] **Step 4: Register**

In `src/hook.ts`:

```typescript
import { handleSessionEnd, handleSessionStartShowLast } from "./pillars/telemetry/hook.js";

register("SessionEnd", handleSessionEnd);

// replace existing SessionStart registration to include telemetry banner:
register("SessionStart", async (e) => {
  const a = await handleSessionStart(e);
  const b = await handleSessionStartToc(e);
  const c = await handleSessionStartShowLast(e);
  return mergeResponses(mergeResponses(a, b), c);
});
```

- [ ] **Step 5: Build + test**

```bash
npx tsc && node --test dist/pillars/telemetry/hook.test.js
```

- [ ] **Step 6: Commit**

```bash
git add src/hook.ts src/pillars/telemetry/
git commit -m "feat(pillar6): SessionEnd telemetry + SessionStart banner"
```

---

### Task 7.3: `/ts coach`

**Files:** Modify `src/cli/ts.ts`, `.test.ts`

- [ ] **Step 1: Add test**

Append to `src/cli/ts.test.ts`:

```typescript
test("ts coach prints trend", async () => {
  const base = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    const { writeSession } = await import("../pillars/telemetry/trends.js");
    writeSession(base, { project: "p", ts_start: 1, ts_end: 2, score: 82, signals: {} });
    const out = await runCli(["coach", "--home", base]);
    assert.match(out, /82/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Add case**

In `src/cli/ts.ts` switch:

```typescript
    case "coach": {
      const { recentSessions } = await import("../pillars/telemetry/trends.js");
      const rows = recentSessions(home, 10);
      if (rows.length === 0) return "(no sessions recorded yet)";
      const avg = rows.reduce((a, b) => a + b.score, 0) / rows.length;
      const lines = rows.map((r) => `${new Date(r.ts_end).toISOString().slice(0, 16)}  ${r.score.toFixed(1)}`);
      return `Last ${rows.length} sessions (avg ${avg.toFixed(1)}):\n${lines.join("\n")}`;
    }
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/cli/ts.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/ts.ts src/cli/ts.test.ts
git commit -m "feat(cli): /ts coach trend view"
```

---

## Phase 8 — Polish and ship

### Task 8.1: `/ts reset`

**Files:** Modify `src/cli/ts.ts`, `.test.ts`

- [ ] **Step 1: Failing test**

Append to `src/cli/ts.test.ts`:

```typescript
test("reset --cache clears read_cache", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-proj-"));
  try {
    const db = openDb(dir);
    db.prepare("INSERT INTO read_cache(abspath, mtime_ns, size, content_hash, brotli_content, served_at) VALUES (?,?,?,?,?,?)")
      .run("/x", 1, 1, "h", Buffer.from([1]), Date.now());
    db.close();
    await runCli(["reset", "--cache", "--cwd", dir]);
    const db2 = openDb(dir);
    const n = (db2.prepare("SELECT COUNT(*) AS c FROM read_cache").get() as { c: number }).c;
    db2.close();
    assert.equal(n, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Implement**

In `src/cli/ts.ts` switch:

```typescript
    case "reset": {
      const root = cwd ?? process.cwd();
      const flags = new Set(rest.filter((a) => a.startsWith("--")));
      if (flags.size === 0) throw new Error("usage: /ts reset [--cache|--index|--all]");
      const db = openDb(root);
      try {
        if (flags.has("--cache") || flags.has("--all")) db.prepare("DELETE FROM read_cache").run();
        if (flags.has("--index") || flags.has("--all")) {
          db.prepare("DELETE FROM symbols").run();
          db.prepare("DELETE FROM symbols_fts").run();
          db.prepare("DELETE FROM symbols_trigram").run();
        }
        return "reset complete";
      } finally { db.close(); }
    }
```

- [ ] **Step 3: Build + test**

```bash
npx tsc && node --test dist/cli/ts.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/ts.ts src/cli/ts.test.ts
git commit -m "feat(cli): /ts reset --cache|--index|--all"
```

---

### Task 8.2: SKILL.md

**Files:** Create `skills/tokenstack/SKILL.md`

- [ ] **Step 1: Write skill**

```markdown
---
name: tokenstack
description: Load when you need progressive-disclosure code search. Use /ts search <query> to find symbols, then /ts show <id> --level=N to escalate from signature (L1) to skeleton (L2) to full body (L3).
---

# tokenstack search workflow

When you need to find code by concept rather than exact path:

1. `/ts search <query>` — returns ranked hits as `path:lines  [kind] name  (id=...)` (L0)
2. For the most promising hits, `/ts show <id> --level=1` (signature, ~15 tokens)
3. If the signature is not enough, `/ts show <id> --level=2` (skeleton, ~60 tokens)
4. Only if you truly need the body, `/ts show <id> --level=3` (full, ~200+ tokens)

Rule of thumb: never jump straight to L3. Escalate on demand.

Mode control: `/ts status` to see what is active. `/ts mode <off|lite|full|ultra>` to change.

If a Bash command was filtered and you need the raw, note the `recover id=N` in the filtered output and run `/ts recover N`.
```

- [ ] **Step 2: Commit**

```bash
git add skills/tokenstack/SKILL.md
git commit -m "docs: SKILL.md for progressive-disclosure workflow"
```

---

### Task 8.3: Build dist, run full suite, update README

**Files:** modify `README.md`; rebuild dist/

- [ ] **Step 1: Clean rebuild**

```bash
rm -rf dist && npx tsc
```

- [ ] **Step 2: Run every test**

```bash
node --test "dist/**/*.test.js"
```

Expected: all pass.

- [ ] **Step 3: Update README**

Overwrite `README.md` with:

```markdown
# tokenstack

Claude Code plugin. Attacks token waste on five fronts at once — output verbosity, Bash output bloat, file re-read waste, compaction survival, and code navigation — synthesized from the best ideas across ten existing token-optimization projects.

**Status:** v0.1 shipped.

## Install

On any machine with Claude Code + Node 22.5+:

    /plugin marketplace add <YOUR-GITHUB-USER>/tokenstack
    /plugin install tokenstack

Zero npm dependencies at runtime. All state is local.

## Commands

- `/ts mode <off|lite|full|ultra>` — output-verbosity rules
- `/ts status` — what's active
- `/ts index` — index this project for search
- `/ts search <query>` — find symbols (L0 hits)
- `/ts show <id> --level=1|2|3` — escalate disclosure
- `/ts recover <id>` — pull raw Bash output if a filter was too aggressive
- `/ts coach` — session-score trend
- `/ts reset [--cache|--index|--all]` — nuke local state

## What it does

Five pillars + telemetry, active automatically once installed:

1. **Output rules** — injects mode-scaled discipline on every prompt (no preamble, no polish, no summary)
2. **Bash filters** — shrinks `git status`, `tsc`, `jest`, `eslint`, `docker ps`, `ls`, `find`, etc. before the output lands in context; raw is always recoverable
3. **File re-read delta** — unchanged re-reads return a one-line note; changed files return a small unified diff
4. **Compaction survival** — `/compact` no longer wipes your session state: a 2 KB XML table-of-contents with re-runnable queries is injected on the next session start
5. **Code navigation** — FTS5 + trigram hybrid search over your project's symbols, with L0→L3 progressive disclosure so you escalate from path-lines to signature to skeleton to body on demand
6. **Telemetry** — 7-signal session score + `/ts coach` for trend awareness

## Credits

Built on ideas synthesized from: caveman, rtk, code-review-graph, context-mode, claude-token-optimizer, token-optimizer (alex), token-optimizer-mcp (ooples), claude-context, claude-token-efficient, token-savior.

Full design: [`docs/specs/2026-04-24-tokenstack-design.md`](docs/specs/2026-04-24-tokenstack-design.md).

## License

MIT.
```

- [ ] **Step 4: Commit dist + README**

```bash
git add -A
git commit -m "chore: build dist/, update README"
```

- [ ] **Step 5: End-to-end smoke**

```bash
echo '{"hook_event_name":"SessionStart"}' | node dist/hook.js
echo '{"hook_event_name":"UserPromptSubmit"}' | node dist/hook.js
```

Expected: both return JSON with `additionalContext`.

---

### Task 8.4: Publish to GitHub

- [ ] **Step 1: User creates the public repo**

Claude can't authenticate for `gh`. Ask the user to either:
- Run `gh repo create tokenstack --public --source=/Users/sisin/Developer/tokenstack --remote=origin --description "Five-front token optimization for Claude Code" --push`
- OR create `tokenstack` on github.com and run:
  ```
  cd /Users/sisin/Developer/tokenstack
  git remote add origin https://github.com/<USERNAME>/tokenstack.git
  git branch -M main
  git push -u origin main
  ```

- [ ] **Step 2: Replace placeholder in README**

After push, edit `README.md` replacing `<YOUR-GITHUB-USER>` with the real username. Commit, push.

- [ ] **Step 3: Verify cross-machine install**

On the second machine, in Claude Code:

```
/plugin marketplace add <USERNAME>/tokenstack
/plugin install tokenstack
/ts status
/ts mode full
```

Expected: plugin installs, `/ts status` prints config, mode flip persists.

---

## Self-review

**Spec coverage** — every pillar in `2026-04-24-tokenstack-design.md` maps to tasks:

| Spec section | Tasks |
|---|---|
| Pillar 1: Output rules | 2.1–2.4 |
| Pillar 2: Bash filters | 3.1–3.5 |
| Pillar 3: File-read delta | 4.1–4.3 |
| Pillar 4: Compact TOC | 5.1–5.2 |
| Pillar 5: Code nav | 6.1–6.7 |
| Pillar 6: Telemetry | 7.1–7.3 |
| Hook wiring | 0.3–0.4 + incremental |
| Slash commands | 2.4, 3.4, 6.5, 7.3, 8.1 |
| Data model | 1.2 |
| Packaging | 0.3, 8.3 |
| Testing | node:test throughout |

**Open decisions resolved here:**

- Brotli level: `BROTLI_PARAM_QUALITY=4` (speed over ratio, in Task 4.2)
- Out-of-Claude CLI: yes — `dist/cli/ts.js` runs standalone (any task using `runCli`)
- Symbol ambiguity: symbols rooted at `(path, start_line, end_line)`; no cross-file resolution in v1
- SQL call style: single-statement `prepare(sql).run()`; multi-statement via the `runScript(db, statements: string[])` helper in `storage/db.ts`

**Placeholder scan:** none. Every code step shows full code. Every command shows expected output.

**Type consistency:** `HookEvent`/`HookResponse`, `Mode`, `Config`, `Symbol`, `Chunk`, `Hit`, `Signals`, `SessionRow` reused consistently across tasks.
