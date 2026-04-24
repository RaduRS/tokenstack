import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveConfig } from "../../storage/config.js";
import { handleSessionStart } from "./session_start.js";
test("injects rules for full mode", async () => {
    const base = mkdtempSync(join(tmpdir(), "ts-home-"));
    try {
        saveConfig(base, { mode: "full" });
        const r = await handleSessionStart({ hook_event_name: "SessionStart" }, base);
        assert.ok(r.additionalContext?.includes("tokenstack mode: FULL"));
    }
    finally {
        rmSync(base, { recursive: true, force: true });
    }
});
test("silent on mode off", async () => {
    const base = mkdtempSync(join(tmpdir(), "ts-home-"));
    try {
        saveConfig(base, { mode: "off" });
        const r = await handleSessionStart({ hook_event_name: "SessionStart" }, base);
        assert.equal(r.additionalContext, undefined);
    }
    finally {
        rmSync(base, { recursive: true, force: true });
    }
});
