import type { HookEvent, HookResponse } from "../../hook.js";
import { loadConfig } from "../../storage/config.js";
import { rulesForMode } from "./rules.js";
import { homedir } from "node:os";

export async function handleSessionStart(_e: HookEvent, base = homedir()): Promise<HookResponse> {
  const cfg = loadConfig(base);
  const rules = rulesForMode(cfg.mode);
  if (!rules) return {};
  return { additionalContext: rules };
}
