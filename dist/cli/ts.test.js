import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../storage/config.js";
import { runCli } from "./ts.js";
import { openDb } from "../storage/db.js";
test("ts mode ultra persists", async () => {
    const base = mkdtempSync(join(tmpdir(), "ts-home-"));
    try {
        const out = await runCli(["mode", "ultra", "--home", base]);
        assert.match(out, /mode.*ultra/i);
        assert.equal(loadConfig(base).mode, "ultra");
    }
    finally {
        rmSync(base, { recursive: true, force: true });
    }
});
test("ts mode bogus rejects", async () => {
    const base = mkdtempSync(join(tmpdir(), "ts-home-"));
    try {
        await assert.rejects(runCli(["mode", "bogus", "--home", base]));
    }
    finally {
        rmSync(base, { recursive: true, force: true });
    }
});
test("ts status prints mode", async () => {
    const base = mkdtempSync(join(tmpdir(), "ts-home-"));
    try {
        const out = await runCli(["status", "--home", base]);
        assert.match(out, /mode/i);
    }
    finally {
        rmSync(base, { recursive: true, force: true });
    }
});
test("ts recover <id>", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ts-proj-"));
    try {
        const db = openDb(dir);
        db.prepare("INSERT INTO bash_tee(cmd, raw_output, filtered_output, ts) VALUES (?,?,?,?)").run("x", "RAW_HELLO", "", Date.now());
        db.close();
        const out = await runCli(["recover", "1", "--cwd", dir]);
        assert.ok(out.includes("RAW_HELLO"));
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
test("ts coach prints trend", async () => {
    const base = mkdtempSync(join(tmpdir(), "ts-home-"));
    try {
        const { writeSession } = await import("../pillars/telemetry/trends.js");
        writeSession(base, { project: "p", ts_start: 1, ts_end: 2, score: 82, signals: {} });
        const out = await runCli(["coach", "--home", base]);
        assert.match(out, /82/);
    }
    finally {
        rmSync(base, { recursive: true, force: true });
    }
});
test("reset --cache clears read_cache", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ts-proj-"));
    try {
        const db = openDb(dir);
        db.prepare("INSERT INTO read_cache(abspath, mtime_ns, size, content_hash, brotli_content, served_at) VALUES (?,?,?,?,?,?)")
            .run("/x", 1, 1, "h", Buffer.from([1]), Date.now());
        db.close();
        await runCli(["reset", "--cache", "--cwd", dir]);
        const db2 = openDb(dir);
        const n = db2.prepare("SELECT COUNT(*) AS c FROM read_cache").get().c;
        db2.close();
        assert.equal(n, 0);
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
