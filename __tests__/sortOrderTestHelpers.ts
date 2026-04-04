/**
 * Helpers for asserting sibling `sort` invariants (used only by tests).
 * UI shows `props.sort` in red; gaps like 0,3,4 under one parent are the reported bug.
 */

export type TestNote = {
  id: string;
  parentId?: string;
  sort?: number;
  title?: string;
};

const parentKey = (n: TestNote) => (n.parentId ?? 'root') as string;

/** Children ordered the same way as the app: by `sort` ascending. */
export function sortedChildren(feed: TestNote[], pid: string): TestNote[] {
  return feed
    .filter((n) => parentKey(n) === pid)
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

/**
 * `sort` values for siblings should be exactly 0..n-1 (order may have duplicates/gaps).
 * Returns a diagnostic string if broken, otherwise null.
 */
export function siblingSortGapReason(
  feed: TestNote[],
  pid: string,
): string | null {
  const children = sortedChildren(feed, pid);
  if (children.length === 0) return null;
  const got = children.map((c) => c.sort ?? 0);
  const expected = got.slice().sort((a, b) => a - b);
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== i) {
      return `parent=${pid}: expected sorts 0..${expected.length - 1}, got ${JSON.stringify(got)} (sorted: ${JSON.stringify(expected)})`;
    }
  }
  return null;
}

export function assertContiguousSiblings(
  feed: TestNote[],
  pid: string,
): asserts feed is TestNote[] {
  const reason = siblingSortGapReason(feed, pid);
  if (reason) throw new Error(reason);
}

export function allParents(feed: TestNote[]): string[] {
  const keys = new Set<string>();
  for (const n of feed) {
    keys.add(parentKey(n));
    if (n.parentId && n.parentId !== 'root') keys.add(n.parentId);
  }
  return Array.from(keys);
}

export function assertAllSiblingsContiguous(feed: TestNote[]): void {
  for (const pid of allParents(feed)) {
    assertContiguousSiblings(feed, pid);
  }
}

/** Apply /api/update-style merge: only `ids` rows are replaced from `clientFeed`. */
export function applyPartialServerUpdate<T extends { id: string }>(
  server: T[],
  clientFeed: T[],
  ids: string[],
): T[] {
  const byId = new Map(server.map((n) => [n.id, { ...n } as T]));
  for (const id of ids) {
    const fromClient = clientFeed.find((n) => n.id === id);
    if (fromClient) {
      byId.set(id, { ...fromClient });
    } else {
      byId.delete(id);
    }
  }
  return Array.from(byId.values());
}
