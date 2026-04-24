# tokenstack

Claude Code plugin. Attacks token waste on five fronts at once — output verbosity, Bash output bloat, file re-read waste, compaction survival, and code navigation — synthesized from the best ideas across ten existing token-optimization projects.

**Status:** v0.1 shipped.

## Install

On any machine with Claude Code + Node 22.5+:

    /plugin marketplace add RaduRS/tokenstack
    /plugin install tokenstack@tokenstack

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
5. **Code navigation** — hybrid search (exact + LIKE + trigram fuzzy, fused via RRF) over your project's symbols, with L0→L3 progressive disclosure so you escalate from path-lines to signature to skeleton to body on demand
6. **Telemetry** — 7-signal session score + `/ts coach` for trend awareness

## Credits

Built on ideas synthesized from: caveman, rtk, code-review-graph, context-mode, claude-token-optimizer, token-optimizer (alex), token-optimizer-mcp (ooples), claude-context, claude-token-efficient, token-savior.

Full design: [`docs/specs/2026-04-24-tokenstack-design.md`](docs/specs/2026-04-24-tokenstack-design.md).

## License

MIT.
