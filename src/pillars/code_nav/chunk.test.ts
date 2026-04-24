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
