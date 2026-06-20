/** Deterministic comparators — the backbone of byte-stable graph.json output (P5). */

/** Stable string comparison independent of locale. */
export function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Compare by a sequence of string keys, in order. */
export function byKeys<T>(...keys: ((item: T) => string)[]): (a: T, b: T) => number {
  return (a, b) => {
    for (const key of keys) {
      const cmp = byString(key(a), key(b));
      if (cmp !== 0) return cmp;
    }
    return 0;
  };
}

/** Return a new array sorted with the given comparator (does not mutate input). */
export function sorted<T>(items: readonly T[], cmp: (a: T, b: T) => number): T[] {
  return [...items].sort(cmp);
}
