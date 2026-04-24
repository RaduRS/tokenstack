import type { Filter } from "../engine.js";

export const npmLs: Filter = {
  name: "npm-ls",
  match_command: /^(npm|pnpm|yarn)\s+ls/,
  stages: { ansi_strip: true, strip: /^│\s+│|^│\s+└──|^│\s+├──/, max_lines: 60 },
};
