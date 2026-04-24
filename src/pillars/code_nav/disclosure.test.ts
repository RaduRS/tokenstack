import { test } from "node:test";
import assert from "node:assert/strict";
import { disclose } from "./disclosure.js";

const sym = { id: "abc", path: "src/x.ts", start_line: 1, end_line: 10, kind: "function", name: "doThing",
  content: "function doThing(a: number, b: string): boolean {\n  // compute it\n  return a > 0 && b.length > 0;\n}", score: 1 };

test("L0", () => { assert.match(disclose(sym, 0), /src\/x\.ts:1-10/); });
test("L1", () => { assert.ok(disclose(sym, 1).includes("doThing(a: number, b: string)")); });
test("L2 longer than L1", () => { assert.ok(disclose(sym, 2).length > disclose(sym, 1).length); });
test("L3 is full body", () => { assert.equal(disclose(sym, 3), sym.content); });
