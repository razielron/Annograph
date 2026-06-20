/** Small formatting helpers for console output. */

export function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`;
}

export function plural(n: number, singular: string, plural?: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural ?? singular + "s"}`;
}

/** Render a simple two-column key/value block. */
export function kvBlock(rows: [string, string][]): string {
  const width = Math.max(...rows.map(([k]) => k.length));
  return rows.map(([k, v]) => `  ${k.padEnd(width)}  ${v}`).join("\n");
}
