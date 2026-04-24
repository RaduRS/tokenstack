import type { Filter } from "../engine.js";

export const dockerPs: Filter = {
  name: "docker-ps",
  match_command: /^docker\s+(ps|container\s+ls)/,
  stages: { ansi_strip: true, truncate_chars: 120, max_lines: 30 },
};
