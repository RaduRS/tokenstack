import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { indexProject } from "./indexer.js";
import { searchSymbols } from "./search.js";

test("exact match", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/auth.ts"), "export function authenticate(user: string) { return user; }\n");
    writeFileSync(join(dir, "src/other.ts"), "export function unrelated() { return 42; }\n");
    const db = openDb(dir);
    await indexProject(db, dir);
    const hits = searchSymbols(db, "authenticate");
    assert.ok(hits.length > 0);
    assert.equal(hits[0]!.name, "authenticate");
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("typo via trigram fuzzy", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/auth.ts"), "export function authenticate(user: string) { return user; }\n");
    const db = openDb(dir);
    await indexProject(db, dir);
    const hits = searchSymbols(db, "authenitcate"); // transposed
    assert.ok(hits.length > 0);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("substring match", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ts-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/util.ts"), "export function computeDelta() {}\nexport function renderDelta() {}\n");
    const db = openDb(dir);
    await indexProject(db, dir);
    const hits = searchSymbols(db, "Delta");
    assert.ok(hits.length >= 2);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
