import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../../storage/db.js";
import { logEvent } from "../compact_toc/events.js";
import { handleSessionEnd } from "./hook.js";
import { recentSessions } from "./trends.js";

test("SessionEnd writes trend row", async () => {
  const proj = mkdtempSync(join(tmpdir(), "ts-proj-"));
  const home = mkdtempSync(join(tmpdir(), "ts-home-"));
  try {
    const db = openDb(proj);
    logEvent(db, "bash_run", { cmd: "ls" });
    logEvent(db, "file_read", { path: "a.ts" });
    logEvent(db, "decision", { text: "use RRF k=60" });
    db.close();
    await handleSessionEnd({ hook_event_name: "SessionEnd", cwd: proj } as any, home);
    const sessions = recentSessions(home, 10);
    assert.equal(sessions.length, 1);
    assert.ok(sessions[0]!.score > 0);
  } finally {
    rmSync(proj, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
