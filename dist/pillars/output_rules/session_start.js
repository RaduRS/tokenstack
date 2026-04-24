import { loadConfig } from "../../storage/config.js";
import { rulesForMode } from "./rules.js";
import { homedir } from "node:os";
export async function handleSessionStart(_e, base = homedir()) {
    const cfg = loadConfig(base);
    const rules = rulesForMode(cfg.mode);
    if (!rules)
        return {};
    return { additionalContext: rules };
}
