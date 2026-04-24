import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveConfig } from "../../storage/config.js";
import { handleUserPromptSubmit } from "./prompt_submit.js";
test("reminds on active mode", async () => {
    const base = mkdtempSync(join(tmpdir(), "ts-home-"));
    try {
        saveConfig(base, { mode: "full" });
        const r = await handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit" }, base);
        assert.ok(r.additionalContext?.includes("ACTIVE"));
    }
    finally {
        rmSync(base, { recursive: true, force: true });
    }
});
test("silent on mode off", async () => {
    const base = mkdtempSync(join(tmpdir(), "ts-home-"));
    try {
        saveConfig(base, { mode: "off" });
        const r = await handleUserPromptSubmit({ hook_event_name: "UserPromptSubmit" }, base);
        assert.deepEqual(r, {});
    }
    finally {
        rmSync(base, { recursive: true, force: true });
    }
});
