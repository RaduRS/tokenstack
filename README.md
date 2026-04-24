# tokenstack

A Claude Code plugin that attacks token waste on five fronts at once — output verbosity, Bash output bloat, file re-read waste, compaction survival, and code navigation — synthesized from the best ideas across ten existing token-optimization projects.

**Status:** in development. Design spec: [`docs/specs/2026-04-24-tokenstack-design.md`](docs/specs/2026-04-24-tokenstack-design.md).

## Install (once design ships)

```
/plugin marketplace add <github-user>/tokenstack
/plugin install tokenstack
```

## Why

Most token-optimization tools win on one axis and ignore the rest. tokenstack targets all five, each using the best technique from the survey, so you come out above average on every edge rather than peaking on one and losing on four.

## Credits

Built on ideas from: caveman, rtk, code-review-graph, context-mode, claude-token-optimizer, token-optimizer (alex), token-optimizer-mcp (ooples), claude-context, claude-token-efficient, token-savior. See `docs/specs/2026-04-24-tokenstack-design.md` for the full synthesis.

## License

MIT.
