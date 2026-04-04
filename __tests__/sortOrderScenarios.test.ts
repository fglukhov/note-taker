/**
 * Regression / characterization tests for non-contiguous sibling `sort` values (UI shows red gaps).
 *
 * These tests intentionally mirror fragile patterns in `components/NotesList.tsx` (sibling lists built
 * from `filter` / `map` without sorting by `sort`) and batch sync behaviour, without importing React.
 */

import { describe, expect, it } from 'vitest';
import { getFamily } from '@/lib/notesTree';
import type { NotesListItemProps } from '@/components/NotesListItem';
import {
  applyPartialServerUpdate,
  assertAllSiblingsContiguous,
  siblingSortGapReason,
  sortedChildren,
} from './sortOrderTestHelpers';

/** Mirrors NotesList `handleIndent`: sibling order = `notesFeed.map` encounter order, not `sort`. */
function prevSiblingIdNotesListStyle(
  feed: NotesListItemProps[],
  focusId: string,
): string | null {
  const curNote = feed.find((n) => n.id === focusId);
  if (!curNote) return null;
  const parentId = curNote.parentId;
  const siblingsIds: string[] = [];
  feed.map((n) => {
    if (n.parentId === parentId) {
      siblingsIds.push(n.id);
    }
  });
  let prevSiblingId: string | null = null;
  siblingsIds.map((id, i) => {
    if (id === focusId && i > 0) {
      prevSiblingId = siblingsIds[i - 1];
    }
  });
  return prevSiblingId;
}

/** True order by `sort` under the same parent. */
function prevSiblingBySort(
  feed: NotesListItemProps[],
  focusId: string,
): string | null {
  const cur = feed.find((n) => n.id === focusId);
  if (!cur) return null;
  const sibs = sortedChildren(feed, cur.parentId ?? 'root');
  const idx = sibs.findIndex((n) => n.id === focusId);
  if (idx <= 0) return null;
  return sibs[idx - 1].id;
}

/** Mirrors NotesList `handleSort`: first branch uses sibling count, not max(sort). */
function lengthAllowsMoveDown(
  feed: NotesListItemProps[],
  focusId: string,
): boolean {
  const curNote = feed.find((n) => n.id === focusId);
  if (!curNote) return false;
  const curNoteSiblings = feed.filter((n) => n.parentId === curNote.parentId);
  return curNote.sort < curNoteSiblings.length - 1;
}

function swapPartnerDown(
  feed: NotesListItemProps[],
  focusId: string,
): NotesListItemProps | undefined {
  const curNote = feed.find((n) => n.id === focusId);
  if (!curNote) return undefined;
  return feed
    .filter((n) => n.parentId === curNote.parentId)
    .filter((n) => n.sort === curNote.sort + 1)[0];
}

function canMoveUpNotesListStyle(
  feed: NotesListItemProps[],
  focusId: string,
): boolean {
  const curNote = feed.find((n) => n.id === focusId);
  if (!curNote || curNote.sort <= 0) return false;
  const shifted = feed
    .filter((n) => n.parentId === curNote.parentId)
    .filter((n) => n.sort === curNote.sort - 1)[0];
  return shifted !== undefined;
}

describe('sort order: representation vs UI tree', () => {
  it('getFamily order matches sorted-by-sort children (stable tree walk)', () => {
    const feed: NotesListItemProps[] = [
      { id: 'p', title: 'P', sort: 0, parentId: 'root' },
      { id: 'c1', title: 'c1', sort: 1, parentId: 'p' },
      { id: 'c0', title: 'c0', sort: 0, parentId: 'p' },
    ];
    const fam = getFamily('p', feed);
    expect(fam.map((n) => n.id)).toEqual(['p', 'c0', 'c1']);
  });
});

describe('handleIndent-style prev sibling depends on array order (bug class)', () => {
  it('when notesFeed order differs from sort order, prevSibling is not the real previous sibling', () => {
    const feed: NotesListItemProps[] = [
      { id: 'B', title: 'B', sort: 1, parentId: 'root' },
      { id: 'A', title: 'A', sort: 0, parentId: 'root' },
      { id: 'C', title: 'C', sort: 2, parentId: 'root' },
    ];
    expect(prevSiblingIdNotesListStyle(feed, 'A')).toBe('B');
    expect(prevSiblingBySort(feed, 'A')).toBe(null);
    expect(prevSiblingBySort(feed, 'C')).toBe('B');
    expect(prevSiblingIdNotesListStyle(feed, 'C')).toBe('A');
  });
});

describe('handleSort-style: gaps break Ctrl+Arrow swaps', () => {
  it('with contiguous sorts, move down/up finds a partner', () => {
    const feed: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'b', title: 'b', sort: 1, parentId: 'root' },
      { id: 'c', title: 'c', sort: 2, parentId: 'root' },
    ];
    expect(lengthAllowsMoveDown(feed, 'a')).toBe(true);
    expect(swapPartnerDown(feed, 'a')).toBeDefined();
    expect(canMoveUpNotesListStyle(feed, 'b')).toBe(true);
  });

  it('with gaps (0,3,4), length check can pass while swap partner (sort+1) is missing — NotesList still sets sortShift=1', () => {
    const feed: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'b', title: 'b', sort: 3, parentId: 'root' },
      { id: 'c', title: 'c', sort: 4, parentId: 'root' },
    ];
    expect(siblingSortGapReason(feed, 'root')).not.toBe(null);
    expect(lengthAllowsMoveDown(feed, 'a')).toBe(true);
    expect(swapPartnerDown(feed, 'a')).toBeUndefined();
    expect(lengthAllowsMoveDown(feed, 'b')).toBe(false);
    expect(lengthAllowsMoveDown(feed, 'c')).toBe(false);
    expect(
      feed.filter((n) => n.parentId === 'root' && n.sort === 1)[0],
    ).toBeUndefined();
  });
});

describe('handleUnindent-style: sibling count vs max sort (bug class)', () => {
  it('uses sibling count instead of max sort index — gaps change the condition', () => {
    const feed: NotesListItemProps[] = [
      { id: 'p', title: 'p', sort: 0, parentId: 'root' },
      { id: 'x', title: 'x', sort: 0, parentId: 'p' },
      { id: 'y', title: 'y', sort: 5, parentId: 'p' },
    ];
    const sibs = feed.filter((n) => n.parentId === 'p');
    const y = feed.find((n) => n.id === 'y')!;
    const notesListCondition = y.sort < sibs.length - 1;
    const maxSort = Math.max(...sibs.map((n) => n.sort ?? 0));
    const rankByOrder = sortedChildren(feed, 'p').findIndex(
      (n) => n.id === 'y',
    );
    expect(notesListCondition).toBe(false);
    expect(rankByOrder).toBe(1);
    expect(maxSort).toBe(5);
  });
});

describe('insertNote-style global sort (NotesList line ~308)', () => {
  it('re-sorting the whole feed by `sort` only does not fix per-parent gaps', () => {
    let feed: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'b', title: 'b', sort: 3, parentId: 'root' },
    ];
    feed = feed.slice().sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0));
    expect(siblingSortGapReason(feed, 'root')).not.toBe(null);
  });
});

describe('partial /api/update merge races (out-of-order completion)', () => {
  it('full replay of an older snapshot restores deleted rows (still contiguous) — data comes back wrong, not necessarily a gap', () => {
    let server: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'b', title: 'b', sort: 1, parentId: 'root' },
      { id: 'c', title: 'c', sort: 2, parentId: 'root' },
    ];

    const afterDelete: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'c', title: 'c', sort: 1, parentId: 'root' },
    ];

    const staleBeforeDelete: NotesListItemProps[] = server;

    server = applyPartialServerUpdate(server, afterDelete, ['b', 'c']);
    expect(server.find((n) => n.id === 'b')).toBeUndefined();
    expect(() => assertAllSiblingsContiguous(server)).not.toThrow();

    server = applyPartialServerUpdate(server, staleBeforeDelete, ['b', 'c']);
    expect(server.find((n) => n.id === 'b')).toBeDefined();
    expect(() => assertAllSiblingsContiguous(server)).not.toThrow();
  });

  it('late partial update with stale `sort` for only some ids can open a gap (0 and 2 with two siblings)', () => {
    let server: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'b', title: 'b', sort: 1, parentId: 'root' },
      { id: 'c', title: 'c', sort: 2, parentId: 'root' },
    ];
    server = applyPartialServerUpdate(
      server,
      [
        { id: 'a', title: 'a', sort: 0, parentId: 'root' },
        { id: 'c', title: 'c', sort: 1, parentId: 'root' },
      ],
      ['b', 'c'],
    );
    expect(() => assertAllSiblingsContiguous(server)).not.toThrow();

    const staleCOnly: NotesListItemProps[] = [
      { id: 'c', title: 'c', sort: 2, parentId: 'root' },
    ];
    server = applyPartialServerUpdate(server, staleCOnly, ['c']);
    expect(siblingSortGapReason(server, 'root')).not.toBe(null);
  });

  it('two inserts at the same target index (overlapping batches) can leave duplicate sort values', () => {
    let server: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'b', title: 'b', sort: 1, parentId: 'root' },
    ];

    const client1: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'n1', title: 'n1', sort: 1, parentId: 'root' },
      { id: 'b', title: 'b', sort: 2, parentId: 'root' },
    ];

    const client2: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'b', title: 'b', sort: 1, parentId: 'root' },
      { id: 'n2', title: 'n2', sort: 1, parentId: 'root' },
    ];

    server = applyPartialServerUpdate(server, client1, ['n1', 'b']);
    server = applyPartialServerUpdate(server, client2, ['n2', 'b']);
    const sorts = sortedChildren(server, 'root').map((n) => n.sort ?? 0);
    const dup = sorts.length !== new Set(sorts).size;
    expect(dup).toBe(true);
  });
});

describe('insertNote-style strict parentId equality (==)', () => {
  it('skips sibling shift when new note parentId is root string but siblings use undefined', () => {
    const newId = 'new';
    const parentId = 'root';
    const newSort = 0;
    const feed: NotesListItemProps[] = [
      { id: 'x', title: 'x', sort: 0, parentId: undefined },
      { id: 'y', title: 'y', sort: 1, parentId: undefined },
    ];
    const newNote: NotesListItemProps = {
      id: newId,
      title: '',
      sort: newSort,
      parentId,
    };
    let newFeed = [...feed, newNote];
    newFeed = newFeed.map((n) => {
      if (n.sort >= newSort && n.id !== newId && n.parentId == parentId) {
        return { ...n, sort: n.sort + 1 };
      }
      return n;
    });
    expect(newFeed.find((n) => n.id === 'x')?.sort).toBe(0);
    expect(siblingSortGapReason(newFeed, 'root')).not.toBe(null);
  });
});

describe('API POST /api/post sibling shift predicate (characterization)', () => {
  /** Prisma: `sort: { gt: sort - 1 }` on insert — which indices shift for 0-based `sort`? */
  it('insert at sort=0 shifts every sibling with sort >= 0 (except new id)', () => {
    const insertSort = 0;
    const shouldShift = (s: number) => s > insertSort - 1;
    expect([0, 1, 2].filter(shouldShift)).toEqual([0, 1, 2]);
  });

  it('insert at sort=2 shifts sorts 2,3,...', () => {
    const insertSort = 2;
    const shouldShift = (s: number) => s > insertSort - 1;
    expect([0, 1, 2, 3].filter(shouldShift)).toEqual([2, 3]);
  });
});

describe('deterministic: wrong sibling array order (characterization)', () => {
  it('for three root siblings, NotesList-style prevSibling can disagree with sort order (indent target)', () => {
    const feed: NotesListItemProps[] = [
      { id: 'A', title: 'A', sort: 0, parentId: 'root' },
      { id: 'C', title: 'C', sort: 2, parentId: 'root' },
      { id: 'B', title: 'B', sort: 1, parentId: 'root' },
    ];
    expect(prevSiblingIdNotesListStyle(feed, 'C')).toBe('A');
    expect(prevSiblingBySort(feed, 'C')).toBe('B');
  });
});

describe('partial /api/update: only some ids updated', () => {
  it('updating just the moved note can duplicate `sort` with a stale sibling', () => {
    let server: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'b', title: 'b', sort: 1, parentId: 'root' },
      { id: 'c', title: 'c', sort: 2, parentId: 'root' },
    ];
    const clientAfterSwap: NotesListItemProps[] = [
      { id: 'a', title: 'a', sort: 0, parentId: 'root' },
      { id: 'b', title: 'b', sort: 2, parentId: 'root' },
      { id: 'c', title: 'c', sort: 1, parentId: 'root' },
    ];
    server = applyPartialServerUpdate(server, clientAfterSwap, ['c']);
    const sorts = sortedChildren(server, 'root').map((n) => n.sort ?? 0);
    expect(sorts.filter((s) => s === 1).length).toBeGreaterThan(1);
  });
});
