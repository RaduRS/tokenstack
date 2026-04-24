import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
export function defaultConfig() {
    return { mode: "lite", filters_enabled: true, delta_enabled: true };
}
export function configDir(base = homedir()) {
    return join(base, ".claude", "tokenstack");
}
export function loadConfig(base = homedir()) {
    const path = join(configDir(base), "config.json");
    if (!existsSync(path))
        return defaultConfig();
    try {
        return { ...defaultConfig(), ...JSON.parse(readFileSync(path, "utf8")) };
    }
    catch {
        return defaultConfig();
    }
}
export function saveConfig(base, cfg) {
    const dir = configDir(base);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    const current = loadConfig(base);
    writeFileSync(join(dir, "config.json"), JSON.stringify({ ...current, ...cfg }, null, 2));
}
