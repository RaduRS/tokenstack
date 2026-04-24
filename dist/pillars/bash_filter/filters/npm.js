export const npmLs = {
    name: "npm-ls",
    match_command: /^(npm|pnpm|yarn)\s+ls/,
    stages: { ansi_strip: true, strip: /^│\s+│|^│\s+└──|^│\s+├──/, max_lines: 60 },
};
