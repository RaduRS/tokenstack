import type { Filter } from "../engine.js";

export const gitStatus: Filter = {
  name: "git-status",
  match_command: /^git\s+status/,
  stages: { ansi_strip: true, strip: /\(use "git add|\(use "git restore|\(use "git push|^\s*$/, max_lines: 80, on_empty: "(clean working tree)" },
};

export const gitLog: Filter = {
  name: "git-log",
  match_command: /^git\s+log/,
  stages: { ansi_strip: true, strip: /^(Author|AuthorDate|CommitDate|Commit):/, head_lines: 40 },
};

export const gitDiff: Filter = {
  name: "git-diff",
  match_command: /^git\s+diff/,
  stages: { ansi_strip: true, max_lines: 200 },
};
