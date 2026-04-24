export const dockerPs = {
    name: "docker-ps",
    match_command: /^docker\s+(ps|container\s+ls)/,
    stages: { ansi_strip: true, truncate_chars: 120, max_lines: 30 },
};
