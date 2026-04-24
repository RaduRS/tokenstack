import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handlePreToolUseRead } from "./hook.js";
import { setCached } from "./cache.js";
import { openDb } from "../../storage/db.js";

const makeEvent = (dir: string, file: string) => ({
  hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: file }, cwd: dir,
} as any);

test("first read passthrough", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const f = join(dir, "a.txt");
    writeFileSync(f, "hello");
    assert.deepEqual(await handlePreToolUseRead(makeEvent(dir, f)), {});
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("unchanged re-read: block with note", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const f = join(dir, "a.txt");
    writeFileSync(f, "hello");
    const db = openDb(dir); setCached(db, f, "hello"); db.close();
    const r = await handlePreToolUseRead(makeEvent(dir, f));
    assert.equal(r.decision, "block");
    assert.ok(r.additionalContext?.includes("unchanged"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("small delta returns diff", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    const f = join(dir, "a.txt");
    const big = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    writeFileSync(f, big);
    const db = openDb(dir); setCached(db, f, big); db.close();
    await new Promise((r) => setTimeout(r, 15));
    writeFileSync(f, big.replace("line 42", "line XLII"));
    const r = await handlePreToolUseRead(makeEvent(dir, f));
    assert.ok(r.additionalContext?.includes("XLII") || r.additionalContext?.includes("line 42"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
