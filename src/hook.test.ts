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
