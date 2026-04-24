import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { indexProject } from "./indexer.js";

test("walks and inserts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), "export function alpha() { return 1; }\nexport class Beta {}\n");
    writeFileSync(join(dir, "src/b.ts"), "export const gamma = () => 2;\n");
    writeFileSync(join(dir, "README.md"), "# ignored\n");
    const db = openDb(dir);
    const n = await indexProject(db, dir);
    assert.ok(n >= 3);
    const c = (db.prepare("SELECT COUNT(*) AS c FROM symbols").get() as { c: number }).c;
    assert.ok(c >= 3);
    assert.ok(db.prepare("SELECT name FROM symbols WHERE name = 'alpha'").get());
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
