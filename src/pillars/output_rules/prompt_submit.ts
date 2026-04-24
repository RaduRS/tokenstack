import type { HookEvent, HookResponse } from "../../hook.js";
import { loadConfig } from "../../storage/config.js";
import { homedir } from "node:os";

export async function handleUserPromptSubmit(_e: HookEvent, base = homedir()): Promise<HookResponse> {
  const cfg = loadConfig(base);
  if (cfg.mode === "off") return {};
  return { additionalContext: `[tokenstack ACTIVE: ${cfg.mode}] Continue applying output rules.` };
}
