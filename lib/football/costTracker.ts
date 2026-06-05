// Token pricing per million tokens [input, output]
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5-20251001': [0.80, 4],
  'claude-sonnet-4-6':          [3,    15],
  'claude-opus-4-8':            [15,   75],
};

export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const [inP, outP] = PRICES[model] ?? [15, 75];
  return (inputTokens * inP + outputTokens * outP) / 1_000_000;
}

// ── Client-side daily accumulator (localStorage) ──────────────────────────────
const DAILY_KEY = () => `diez_cost_${new Date().toISOString().slice(0, 10)}`;
const LIMIT = 2.00;

export function getDailySpend(): number {
  try { return parseFloat(localStorage.getItem(DAILY_KEY()) || '0'); } catch { return 0; }
}

export function addSpend(cost: number): number {
  try {
    const total = getDailySpend() + cost;
    localStorage.setItem(DAILY_KEY(), total.toFixed(6));
    return total;
  } catch { return 0; }
}

export function wouldExceedLimit(estimatedCost: number): boolean {
  return getDailySpend() + estimatedCost > LIMIT;
}

export function formatCost(n: number): string {
  return `$${n.toFixed(3)}`;
}
