const WEIGHTS = {
    context_fill_degradation: 0.20, stale_reads: 0.20, bloated_results: 0.20,
    duplicates: 0.10, compaction_depth: 0.15, decision_density: 0.08, agent_efficiency: 0.07,
};
const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
function compactionPenalty(n) {
    if (n === 0)
        return 100;
    if (n === 1)
        return 90;
    if (n === 2)
        return 65;
    return 35;
}
export function computeScore(s) {
    const fill = clamp(100 - s.context_fill_pct);
    const stale = clamp(100 - s.stale_read_count * 5);
    const bloat = clamp(100 - s.bloat_byte_count / 10000);
    const dup = clamp(100 - s.duplicate_read_count * 8);
    const comp = compactionPenalty(s.compaction_count);
    const density = clamp(s.decision_count === 0 ? 0 : (s.decision_count / Math.max(s.tool_call_count, 1)) * 500);
    const eff = clamp(100 - Math.max(0, s.tool_call_count - 30) * 2);
    const signals = {
        context_fill_degradation: { raw: fill, weighted: fill * WEIGHTS.context_fill_degradation },
        stale_reads: { raw: stale, weighted: stale * WEIGHTS.stale_reads },
        bloated_results: { raw: bloat, weighted: bloat * WEIGHTS.bloated_results },
        duplicates: { raw: dup, weighted: dup * WEIGHTS.duplicates },
        compaction_depth: { raw: comp, weighted: comp * WEIGHTS.compaction_depth },
        decision_density: { raw: density, weighted: density * WEIGHTS.decision_density },
        agent_efficiency: { raw: eff, weighted: eff * WEIGHTS.agent_efficiency },
    };
    const score = Object.values(signals).reduce((a, b) => a + b.weighted, 0);
    return { score, signals };
}
