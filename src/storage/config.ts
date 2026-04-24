import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type Mode = "off" | "lite" | "full" | "ultra";

export type Config = {
  mode: Mode;
  filters_enabled: boolean;
  delta_enabled: boolean;
};

export function defaultConfig(): Config {
  return { mode: "lite", filters_enabled: true, delta_enabled: true };
}

export function configDir(base = homedir()): string {
  return join(base, ".claude", "tokenstack");
}

export function loadConfig(base = homedir()): Config {
  const path = join(configDir(base), "config.json");
  if (!existsSync(path)) return defaultConfig();
  try {
    return { ...defaultConfig(), ...JSON.parse(readFileSync(path, "utf8")) };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(base: string, cfg: Partial<Config>): void {
  const dir = configDir(base);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const current = loadConfig(base);
  writeFileSync(join(dir, "config.json"), JSON.stringify({ ...current, ...cfg }, null, 2));
}
