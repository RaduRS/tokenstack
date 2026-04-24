import type { Filter } from "../engine.js";

export const eslint: Filter = {
  name: "eslint",
  match_command: /^(npx\s+)?eslint\b/,
  stages: { ansi_strip: true, strip: /^\s*$/, keep: /error|warning|problem/i, max_lines: 80, on_empty: "(no lint findings)" },
};
