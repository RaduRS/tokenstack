export function unifiedDiff(a: string, b: string): string {
  if (a === b) return "";
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const n = aLines.length;
  const m = bLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (aLines[i] === bLines[j]) dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      else dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: string[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) { out.push(` ${aLines[i]}`); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { out.push(`-${aLines[i]}`); i++; }
    else { out.push(`+${bLines[j]}`); j++; }
  }
  while (i < n) out.push(`-${aLines[i++]}`);
  while (j < m) out.push(`+${bLines[j++]}`);
  return out.join("\n");
}

export function diffSizeRatio(diff: string, originalLen: number): number {
  if (originalLen === 0) return 1;
  // Count only changed bytes (+/- lines), excluding context lines (leading space).
  let changed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") || line.startsWith("-")) changed += line.length;
  }
  return changed / originalLen;
}
