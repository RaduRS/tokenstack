import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { getCached, setCached } from "./cache.js";

test("round-trip", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const db = openDb(dir);
    const f = join(dir, "x.txt");
    writeFileSync(f, "hello");
    setCached(db, f, "hello");
    assert.equal(getCached(db, f)?.content, "hello");
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("returns null on mtime change", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const db = openDb(dir);
    const f = join(dir, "x.txt");
    writeFileSync(f, "v1");
    setCached(db, f, "v1");
    // mutate — advance mtime by touching with a later timestamp
    await new Promise((r) => setTimeout(r, 15));
    writeFileSync(f, "v2");
    assert.equal(getCached(db, f), null);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
