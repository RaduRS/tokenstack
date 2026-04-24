import { test } from "node:test";
import assert from "node:assert/strict";
import { runFilter } from "../engine.js";
import { FILTERS } from "./index.js";

function find(name: string) {
  const f = FILTERS.find((x) => x.name === name);
  if (!f) throw new Error(`no filter: ${name}`);
  return f;
}

test("git-status drops hint lines", () => {
  const raw = "On branch main\n(use \"git add ...\")\nmodified: a.ts";
  const out = runFilter(find("git-status"), raw);
  assert.ok(!out.includes("git add"));
  assert.ok(out.includes("modified"));
});

test("npm-ls collapses tree", () => {
  const raw = "a@1\n├── react@18\n│   ├── loose@1\n│   │   └── js-tokens@4\n│   └── sched@0\n└── dom@18";
  const out = runFilter(find("npm-ls"), raw);
  assert.ok(out.split("\n").length < raw.split("\n").length);
});

test("tsc keeps error lines", () => {
  const raw = "watch noise\nsrc/a.ts(10,3): error TS2322: x\nother noise\nsrc/b.ts(3,1): error TS2304: y";
  const out = runFilter(find("tsc"), raw);
  assert.ok(out.includes("TS2322"));
  assert.ok(out.includes("TS2304"));
  assert.ok(!out.includes("watch noise"));
});
