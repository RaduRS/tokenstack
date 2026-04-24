import type { Filter } from "../engine.js";

export const jestVitest: Filter = {
  name: "jest-vitest",
  match_command: /^(npx\s+)?(jest|vitest)\b/,
  stages: { ansi_strip: true, keep: /✕|✗|FAIL|PASS\s+\S+|Tests:|Suites:|Duration/, head_lines: 30, on_empty: "(test runner output empty)" },
};
