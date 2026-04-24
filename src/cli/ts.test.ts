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
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("ts mode bogus rejects", async () => {
  const base = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    await assert.rejects(runCli(["mode", "bogus", "--home", base]));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("ts status prints mode", async () => {
  const base = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    const out = await runCli(["status", "--home", base]);
    assert.match(out, /mode/i);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("ts recover <id>", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-proj-"));
  try {
    const db = openDb(dir);
    db.prepare("INSERT INTO bash_tee(cmd, raw_output, filtered_output, ts) VALUES (?,?,?,?)").run("x", "RAW_HELLO", "", Date.now());
    db.close();
    const out = await runCli(["recover", "1", "--cwd", dir]);
    assert.ok(out.includes("RAW_HELLO"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
