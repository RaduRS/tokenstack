import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { indexProject } from "./indexer.js";
import { reindexFile } from "./incremental.js";

test("re-index single file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), "export function one() { return 1; }\n");
    writeFileSync(join(dir, "src/b.ts"), "export function two() { return 2; }\n");
    const db = openDb(dir);
    await indexProject(db, dir);
    writeFileSync(join(dir, "src/a.ts"), "export function oneRenamed() { return 1; }\n");
    await reindexFile(db, dir, join(dir, "src/a.ts"));
    const names = (db.prepare("SELECT name FROM symbols").all() as { name: string }[]).map((r) => r.name).sort();
    assert.ok(names.includes("oneRenamed"));
    assert.ok(names.includes("two"));
    assert.ok(!names.includes("one"));
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
