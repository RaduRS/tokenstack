export const tsc = {
    name: "tsc",
    match_command: /^(npx\s+)?tsc\b/,
    stages: { ansi_strip: true, keep: /error\s+TS\d+|Found \d+ errors?/, on_empty: "(no type errors)", max_lines: 50 },
};
