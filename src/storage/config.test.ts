import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, saveConfig, defaultConfig } from "./config.js";

test("loadConfig returns defaults when missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    assert.deepEqual(loadConfig(dir), defaultConfig());
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("saveConfig round-trips", () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    saveConfig(dir, { mode: "ultra" });
    assert.equal(loadConfig(dir).mode, "ultra");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
