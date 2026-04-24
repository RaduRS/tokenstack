import { loadConfig } from "../../storage/config.js";
import { homedir } from "node:os";
export async function handleUserPromptSubmit(_e, base = homedir()) {
    const cfg = loadConfig(base);
    if (cfg.mode === "off")
        return {};
    return { additionalContext: `[tokenstack ACTIVE: ${cfg.mode}] Continue applying output rules.` };
}
