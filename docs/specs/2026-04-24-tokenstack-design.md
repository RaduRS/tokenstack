# tokenstack — design spec

**Date:** 2026-04-24
**Status:** Approved for plan phase
**License:** MIT

## 1. Summary

A Claude Code plugin, Node 22+ TypeScript, zero npm runtime dependencies, installed via plugin marketplace. Targets five axes of token savings simultaneously, synthesized from the best ideas in 10 existing projects, with the explicit goal of being **above average on every axis** measured by those projects — not just one.

## 2. Goals

- Above-average on every "edge" represented in the survey (output verbosity, tool-output bloat, file re-read waste, compaction survival, code navigation)
- Single-command install on any machine with Claude Code + Node 22+
- Zero runtime npm dependencies (Node stdlib only: `node:sqlite`, `node:zlib`, `node:crypto`, `node:fs`)
- Measurable feedback loop via a 7-signal quality score
- Cross-platform: macOS + Windows

## 3. Non-goals (v1)

- MCP server (deferred to v2; easy wrapper if we want cross-agent later)
- Other agents (Cursor, Windsurf, Cline, etc.)
- Vector embeddings / ML (FTS5 + trigram fallback only)
- Remote sync of state between machines (state is local; repo itself is the sync)

## 4. Architecture

Single plugin, three surfaces into Claude Code:

1. **Hooks** (7 phases): `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `PreCompact`, `SessionStart`, `Stop`, `SessionEnd`
2. **Slash commands**: `/ts` with subcommands
3. **Skill file**: `SKILL.md` with progressive-disclosure rules, loaded on demand

Storage:

- **Per-project state**: `<project>/.tokenstack/state.db` — SQLite (FTS5, symbol graph, read-cache, session events)
- **Global config**: `~/.claude/tokenstack/config.json` — mode, thresholds
- **Global trends**: `~/.claude/tokenstack/trends.db` — 7-signal scores across projects, for coaching

Data flow:

- Every **tool call** → hook dispatcher routes to the right pillar → returns filtered/cached/delta result via `additionalContext`
- Every **`/compact`** → snapshot written as re-runnable XML TOC → next session re-hydrates on demand via search
- Every **session end** → 7-signal score computed → coaching displayed at next `SessionStart`

## 5. Pillars

### Pillar 1 — Output-rules (caveman + drona23)

- Modes: `off` / `lite` / `full` / `ultra`
- `SessionStart` hook injects `CLAUDE.md`-style rules scaled to the active mode
- `UserPromptSubmit` hook re-asserts ACTIVE reminder if mode is non-off (caveman's drift fix)
- Rule set (synthesized):
  - No preamble ("I'll help you...", "Sure, here's...")
  - No trailing summaries unless asked
  - One-shot writes (don't rewrite incrementally when the full answer is short)
  - No polish on passing code
  - Tool-call budget warning at 40/50
  - Anti-hallucination: verify APIs before asserting
  - User override clause: explicit verbosity requests always win
- Persisted in `~/.claude/tokenstack/config.json`, toggled by `/ts mode <name>`

### Pillar 2 — Bash filter pipelines (rtk)

- `PreToolUse` hook on `Bash`
- Per-command TOML filter, 8-stage pipeline:
  1. ANSI strip
  2. Sequential regex `replace` with backrefs
  3. `match_output` short-circuit with `unless error` guard
  4. Line `strip`/`keep` regex
  5. Per-line char truncation
  6. `head_lines` / `tail_lines` with omission markers
  7. Absolute `max_lines` cap
  8. `on_empty` fallback message
- Ship with ~40 filters: `git`, `npm`/`pnpm`/`yarn`, `jest`/`vitest`, `tsc`, `eslint`, `docker`, `ls`, `find`, `grep`, `curl`
- **Tee recovery:** raw output persisted to `bash_tee` table — agent pulls via `/ts recover <id>` if filter was too aggressive
- Precedence: project `.tokenstack/filters.toml` > user global > shipped defaults

### Pillar 3 — File re-read delta (alex/token-optimizer's 97% win)

- `PreToolUse` hook on `Read`
- Cache key: `sha256(abspath + mtime_ns + size)`
- Cache value: full content compressed (Brotli via `node:zlib`) in SQLite
- On re-read:
  - Same hash → return NO-OP context "file unchanged since last read at `<ts>`"
  - Hash changed → compute unified diff, cap at 2000 lines / 1500 chars. If diff > 40% of original, fall through to full read.
  - Injected via `additionalContext` on hook response
- Exclusions: `.env*`, `.pem`, binary (magic-byte check)

### Pillar 4 — Compact-survival TOC (context-mode's killer idea)

- `PostToolUse` logs every meaningful event to `session_events`
- `PreCompact` hook scans events, writes XML `<session_resume>` with categorized sections:
  - Files recently edited (top 10)
  - Failing tests (if any)
  - Open TODOs
  - Key user decisions
- Each entry **embeds a re-runnable query** (e.g. `ts search "auth middleware"`), not raw data
- `SessionStart` after compact injects the TOC — zero context cost for state that isn't needed right now
- Total TOC size capped at 2 KB

### Pillar 5 — Code navigation (token-savior + claude-context)

- `/ts index` triggers project indexing
- AST chunking: regex-per-language (cheap, zero-dep) for JS/TS/JSX/TSX/Py/Go/Rust/Java/Ruby; TS compiler API only if user opts in
- Symbols extracted: functions, classes, methods, exports, imports
- Chunk cap: 2500 chars + 300 overlap (matches claude-context)
- Deterministic chunk ID: `sha256(relPath + startLine + endLine + content).slice(0,16)`
- Storage: SQLite FTS5 with Porter stemmer + trigram tokenizer, fused via RRF (k=60)
- **L0–L3 progressive disclosure** (token-savior):
  - **L0** (search hit): `relPath:lines` — ~1 token per hit
  - **L1** (signature): `name(params)` + first doc line — ~15 tokens
  - **L2** (skeleton): signature + doc + body outline — ~60 tokens
  - **L3** (full body): up to ~200+ tokens
- `/ts search <query>` returns L0; agent escalates via `/ts show <id> --level=1|2|3`
- Incremental re-index on file save via `PostToolUse` on `Write`/`Edit` (SHA-256 hash compare)

### Pillar 6 — Telemetry & coaching (alex's 7-signal)

- `SessionEnd` hook computes weighted score:
  - `context_fill_degradation` (20%)
  - `stale_reads` (20%)
  - `bloated_results` (20%)
  - `duplicates` (10%)
  - `compaction_depth` (15%)
  - `decision_density` (8%)
  - `agent_efficiency` (7%)
- Written to global `trends.db`
- `/ts coach` shows last N scores + top improvement suggestion
- `SessionStart` shows yesterday's score as a one-liner

## 6. Hook wiring (`hooks.json`)

```
PreToolUse      → dispatcher.ts → { Bash: pillar 2, Read: pillar 3 }
PostToolUse     → session logger (pillar 4) + incremental index (pillar 5)
UserPromptSubmit → mode tracker (pillar 1) + budget warnings
PreCompact      → TOC writer (pillar 4)
SessionStart    → inject rules (pillar 1) + TOC if exists (pillar 4) + last score (pillar 6)
SessionEnd      → telemetry writer (pillar 6)
Stop            → final score commit
```

## 7. Slash commands

`/ts` with subcommands:

- `mode <off|lite|full|ultra>` — output-rule mode
- `status` — current mode, cache stats, last score
- `search <query> [--lang=js]` — pillar 5 L0
- `show <id> [--level=0..3]` — escalate disclosure
- `index [--rebuild]` — index project
- `recover <cmd-id>` — pull raw Bash output from tee cache
- `coach` — telemetry insights
- `reset [--cache|--index|--all]` — nuke state

## 8. Data model (SQLite)

**Per-project** `.tokenstack/state.db`:

- `read_cache(abspath, mtime_ns, size, content_hash, brotli_content, served_at)`
- `bash_tee(id, cmd, raw_output, filtered_output, ts)`
- `session_events(id, ts, kind, payload_json)`
- `symbols(id, path, start_line, end_line, kind, name, content, content_hash)`
- `symbols_fts` (FTS5 virtual table)
- `symbols_trigram` (FTS5 trigram tokenizer)

**Global** `~/.claude/tokenstack/trends.db`:

- `sessions(id, project, ts_start, ts_end, score, signals_json)`

## 9. Packaging

- `.claude-plugin/plugin.json` manifest
- Single `dist/hook.js` pre-compiled entry (routed by `CLAUDE_HOOK_EVENT` env var)
- `tsc` at build time; `dist/` committed so no Node build on install
- `package.json` with `"private": false`, `"dependencies": {}` — `devDependencies` for `typescript` only

## 10. Testing

- Unit tests per pillar using Node's built-in `node:test` runner
- Integration tests: spin up a temp project, simulate hook stdin JSON, assert stdout JSON contract
- Acceptance: fixed prompt-set run with/without plugin, measured via Claude Code's reported token counts

## 11. Credits & license

MIT. Built on ideas synthesized from:

- juliusbrussee/caveman (MIT)
- rtk-ai/rtk (MIT)
- tirth8205/code-review-graph (MIT)
- mksglu/context-mode (ELv2 — ideas only, no code reused)
- nadimtuhin/claude-token-optimizer (MIT)
- alexgreensh/token-optimizer (PolyForm Noncommercial — ideas only, no code reused)
- ooples/token-optimizer-mcp (MIT)
- zilliztech/claude-context (MIT)
- drona23/claude-token-efficient (MIT)
- Mibayy/token-savior (MIT)

## 12. Open decisions (deferred to plan phase)

- Exact Brotli compression level (benchmark needed)
- Whether to ship an out-of-Claude CLI for `index`/`search` (probably yes; same code path)
- Symbol-resolution tier for ambiguous calls (likely "AMBIGUOUS" mark, not resolve)
