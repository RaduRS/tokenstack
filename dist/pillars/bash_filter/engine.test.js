import { test } from "node:test";
import assert from "node:assert/strict";
import { runFilter } from "./engine.js";
test("ansi strip", () => {
    const f = { match_command: /.*/, stages: { ansi_strip: true } };
    assert.equal(runFilter(f, "\x1b[31mRED\x1b[0m X"), "RED X");
});
test("replace chain", () => {
    const f = { match_command: /.*/, stages: { replace: [{ pattern: /foo/g, replacement: "bar" }, { pattern: /b/g, replacement: "B" }] } };
    assert.equal(runFilter(f, "foofoo"), "BarBar");
});
test("head_lines with marker", () => {
    const f = { match_command: /.*/, stages: { head_lines: 2 } };
    assert.equal(runFilter(f, "a\nb\nc\nd"), "a\nb\n... 2 more lines truncated ...");
});
test("tail_lines", () => {
    const f = { match_command: /.*/, stages: { tail_lines: 2 } };
    assert.equal(runFilter(f, "a\nb\nc\nd"), "... 2 earlier lines truncated ...\nc\nd");
});
test("keep regex", () => {
    const f = { match_command: /.*/, stages: { keep: /foo/ } };
    assert.equal(runFilter(f, "foo\nbar\nfoo2"), "foo\nfoo2");
});
test("strip regex", () => {
    const f = { match_command: /.*/, stages: { strip: /^\s*$/ } };
    assert.equal(runFilter(f, "a\n\nb\n \nc"), "a\nb\nc");
});
test("on_empty fallback", () => {
    const f = { match_command: /.*/, stages: { keep: /nope/, on_empty: "(no matches)" } };
    assert.equal(runFilter(f, "a\nb"), "(no matches)");
});
