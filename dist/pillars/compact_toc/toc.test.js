import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { logEvent } from "./events.js";
import { buildToc } from "./toc.js";
test("categorized XML with re-runnable queries", () => {
    const dir = mkdtempSync(join(tmpdir(), "ts-"));
    try {
        const db = openDb(dir);
        logEvent(db, "file_edit", { path: "src/a.ts" });
        logEvent(db, "file_edit", { path: "src/b.ts" });
        logEvent(db, "test_fail", { name: "should do X" });
        logEvent(db, "todo", { text: "refactor Y" });
        const xml = buildToc(db);
        assert.ok(xml.startsWith("<session_resume"));
        assert.ok(xml.includes("src/a.ts"));
        assert.ok(xml.includes("/ts search"));
        assert.ok(xml.length < 2048);
        db.close();
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
