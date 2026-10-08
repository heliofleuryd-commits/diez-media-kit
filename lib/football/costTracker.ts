// Token pricing per million tokens [input, output]
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5-20251001': [1,    5],
  'claude-sonnet-4-6':          [3,    15],
  'claude-sonnet-5-5':          [2,    10],
  'claude-opus-4-8':            [5,    25],
  'claude-opus-5-5':            [4,    20],
};

export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const [inP, outP] = PRICES[model] ?? [15, 75];
  return (inputTokens * inP + outputTokens * outP) / 1_000_000;
}

// Full usage-aware cost: cache writes cost 1.25× (5m) or 2× (1h) the input
// price, cache reads 0.1×.
export function calcUsageCost(model: string, u: {
  input_tokens: number; output_tokens: number;
  cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;
  cache_creation?: { ephemeral_1h_input_tokens: number } | null;
}): number {
  const [inP, outP] = PRICES[model] ?? [15, 75];
  const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const write5m = (u.cache_creation_input_tokens ?? 0) - write1h;
  const read = u.cache_read_input_tokens ?? 0;
  return (u.input_tokens * inP + write5m * inP * 1.25 + write1h * inP * 2 + read * inP * 0.1 + u.output_tokens * outP) / 1_000_000;
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
