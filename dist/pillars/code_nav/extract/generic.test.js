import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPython, extractGo, extractRust, extractJava, extractRuby } from "./generic.js";
test("python", () => {
    const s = extractPython("x.py", "def foo(x):\n    return x\n\nclass Bar:\n    pass\n");
    assert.ok(s.some((x) => x.name === "foo"));
    assert.ok(s.some((x) => x.name === "Bar"));
});
test("go", () => {
    const s = extractGo("x.go", "package main\nfunc Hello(n string) string {\n  return n\n}\n");
    assert.ok(s.some((x) => x.name === "Hello"));
});
test("rust", () => {
    const s = extractRust("x.rs", "pub fn alpha() {}\nstruct Beta;\n");
    assert.ok(s.some((x) => x.name === "alpha"));
    assert.ok(s.some((x) => x.name === "Beta"));
});
test("java", () => {
    const s = extractJava("X.java", "public class X {\n  public void foo() {}\n}\n");
    assert.ok(s.some((x) => x.name === "X"));
    assert.ok(s.some((x) => x.name === "foo"));
});
test("ruby", () => {
    const s = extractRuby("x.rb", "class X\n  def foo\n    1\n  end\nend\n");
    assert.ok(s.some((x) => x.name === "X"));
    assert.ok(s.some((x) => x.name === "foo"));
});
