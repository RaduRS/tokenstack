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
