/** 最大余数法将真实数量映射到一百格；格数仅用于图形，精确占比仍使用原始数量。 */
export function allocateLanguageCells(counts: readonly number[]): number[] {
    const safeCounts = counts.map(count => Number.isFinite(count) && count > 0 ? count : 0);
    const total = safeCounts.reduce((sum, count) => sum + count, 0);
    if (!total) return counts.map(() => 0);
    const exact = safeCounts.map(count => count / total * 100);
    const cells = exact.map(Math.floor);
    const remaining = 100 - cells.reduce((sum, count) => sum + count, 0);
    const order = exact.map((value, index) => ({index, remainder: value - cells[index]}))
        .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (const {index} of order.slice(0, remaining)) cells[index]++;
    return cells;
}
