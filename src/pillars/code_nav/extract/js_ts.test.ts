import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJsTs } from "./js_ts.js";

test("extracts function, class, method, variable", () => {
  const src = [
    "export function hello(name: string) { return 'hi ' + name; }",
    "export class Foo {",
    "  bar() { return 1; }",
    "  private baz(x: number): number { return x * 2; }",
    "}",
    "const arrow = (a: number) => a;",
  ].join("\n");
  const names = extractJsTs("x.ts", src).map((s) => s.name).sort();
  assert.ok(names.includes("hello"));
  assert.ok(names.includes("Foo"));
  assert.ok(names.includes("bar"));
  assert.ok(names.includes("baz"));
  assert.ok(names.includes("arrow"));
});

test("line numbers preserved", () => {
  const src = "\n\nexport function hello() { return 1; }\n";
  const h = extractJsTs("f.ts", src).find((s) => s.name === "hello")!;
  assert.equal(h.start_line, 3);
});
