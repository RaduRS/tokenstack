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
