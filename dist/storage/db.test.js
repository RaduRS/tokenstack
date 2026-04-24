import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "./db.js";
test("openDb creates state.db with expected tables", () => {
    const dir = mkdtempSync(join(tmpdir(), "ts-"));
    try {
        const db = openDb(dir);
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' OR type='view'").all().map((t) => t.name);
        assert.ok(tables.includes("read_cache"));
        assert.ok(tables.includes("bash_tee"));
        assert.ok(tables.includes("session_events"));
        assert.ok(tables.includes("symbols"));
        db.close();
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
test("openDb is idempotent", () => {
    const dir = mkdtempSync(join(tmpdir(), "ts-"));
    try {
        openDb(dir).close();
        openDb(dir).close();
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
