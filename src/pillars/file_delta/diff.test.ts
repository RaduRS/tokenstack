import { test } from "node:test";
import assert from "node:assert/strict";
import { unifiedDiff } from "./diff.js";

test("identical returns empty", () => { assert.equal(unifiedDiff("a\nb", "a\nb"), ""); });
test("single change", () => { const d = unifiedDiff("a\nb\nc", "a\nB\nc"); assert.ok(d.includes("-b")); assert.ok(d.includes("+B")); });
test("insertion", () => { assert.ok(unifiedDiff("a\nc", "a\nb\nc").includes("+b")); });
test("deletion", () => { assert.ok(unifiedDiff("a\nb\nc", "a\nc").includes("-b")); });
