import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { logEvent, listEvents } from "./events.js";
test("log + list", () => {
    const dir = mkdtempSync(join(tmpdir(), "ts-"));
    try {
        const db = openDb(dir);
        logEvent(db, "file_edit", { path: "a.ts" });
        logEvent(db, "test_fail", { name: "t1" });
        const out = listEvents(db);
        assert.equal(out.length, 2);
        db.close();
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
