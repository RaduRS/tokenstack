import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handlePostToolUseBash, recover } from "./hook.js";
test("filters git status via PostToolUse", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ts-"));
    try {
        const r = await handlePostToolUseBash({
            hook_event_name: "PostToolUse", tool_name: "Bash",
            tool_input: { command: "git status" },
            tool_response: { stdout: "On branch main\n(use \"git add\")\nmodified: foo.ts" },
            cwd: dir,
        });
        assert.ok(r.additionalContext?.includes("modified"));
        assert.ok(!r.additionalContext?.includes("git add"));
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
test("recover pulls raw", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ts-"));
    try {
        await handlePostToolUseBash({
            hook_event_name: "PostToolUse", tool_name: "Bash",
            tool_input: { command: "git status" },
            tool_response: { stdout: "raw-xyz" }, cwd: dir,
        });
        assert.ok(recover(dir, 1)?.includes("raw-xyz"));
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
