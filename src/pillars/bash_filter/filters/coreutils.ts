import type { Filter } from "../engine.js";

export const lsLong: Filter = {
  name: "ls",
  match_command: /^ls(\s|$)/,
  stages: { ansi_strip: true, max_lines: 60, on_empty: "(empty)" },
};

export const findCmd: Filter = {
  name: "find",
  match_command: /^find\s+/,
  stages: { ansi_strip: true, max_lines: 80 },
};
