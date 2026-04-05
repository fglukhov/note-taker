import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import NotesListItem from '@/components/NotesListItem';
import { NotesProvider } from '@/components/NotesContext';
import { NotesListItemProps } from '@/components/NotesListItem';
import { useKeyPress } from '@/lib/useKeyPress';
import { getFamily, removeFamily } from '@/lib/notesTree';
import NotesHotkeysHints from '@/components/NotesHotkeysHints';
import styles from '@/components/NotesList.module.scss';
import Router, { useRouter } from 'next/router';

// TODO tidy up types
// TODO handle page reload on cmd+R
// TODO restore current position after reload and scroll to it

export type FeedSyncFromModal = {
  rev: number;
  noteId: string;
  hasContent: boolean;
  title?: string;
};

type Props = {
  feed: NotesListItemProps[];
  /** After saving from the note modal, merge hasContent/title into the list row. */
  feedSyncFromModal?: FeedSyncFromModal | null;
};

let updateTimeout: ReturnType<typeof setTimeout> | null = null;
//let reorderInterval = null;
let timeout: ReturnType<typeof setTimeout> | null = null;

const parentKey = (pid: string | undefined | null) => pid ?? 'root';

const sameParent = (
  noteParent: string | undefined | null,
  targetParent: string | undefined | null,
) => parentKey(noteParent) === parentKey(targetParent);

/** Siblings under the same parent, ordered by `sort` then id (stable). */
const siblingsSortedByParent = (
  feed: NotesListItemProps[],
  parentId: string | undefined | null,
) => {
  const key = parentKey(parentId);
  return feed
    .filter((n) => parentKey(n.parentId) === key)
    .slice()
    .sort((a, b) => {
      const d = (a.sort ?? 0) - (b.sort ?? 0);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });
};

/** Reassign sort to 0..n-1 among direct children of `parentId` (canonical tree order). */
const renormalizeSortsForParent = (
  feed: NotesListItemProps[],
  parentId: string | undefined | null,
): NotesListItemProps[] => {
  const key = parentKey(parentId);
  const children = feed
    .filter((n) => parentKey(n.parentId) === key)
    .slice()
    .sort((a, b) => {
      const d = (a.sort ?? 0) - (b.sort ?? 0);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });
  const idToNewSort = new Map(children.map((c, i) => [c.id, i]));
  return feed.map((n) => {
    const ns = idToNewSort.get(n.id);
    if (ns === undefined) return n;
    return { ...n, sort: ns };
  });
};

const markSiblingsForSync = (
  feed: NotesListItemProps[],
  parentId: string | undefined | null,
  bucket: string[],
) => {
  const key = parentKey(parentId);
  for (const n of feed) {
    if (parentKey(n.parentId) === key && !bucket.includes(n.id)) {
      bucket.push(n.id);
    }
  }
};

const NotesList: React.FC<Props> = (props) => {
  const reorderTimeoutRef = useRef<number | null>(null);

  const updatedIds = useRef<string[]>([]);
  const savedUpdatedIds = useRef<string[]>([]);

  const prevFeed = useRef(props.feed);
  const syncFeed = useRef<NotesListItemProps[] | null>(null);

  const eventKeyRef = useRef<string | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const focusId = useRef<string | null>(null);
  const prevFocusId = useRef<string | null>(null);

  const prevCursorPosition = useRef<number | null>(null);
  const saveCursorPosition = useRef<number | null>(null);
  const prevTitle = useRef<string | null>(null);

  const [cursorPosition, setCursorPosition] = useState(0);
  const [notesFeed, setNotesFeed] = useState(props.feed);

  const router = useRouter();
  const isNoteModalOpen = router.isReady && Boolean(router.query.note);

  const noteIdFromQuery = useMemo(() => {
    const raw = router.query.note;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return null;
  }, [router.query.note]);

  const notesListScrollRef = useRef<HTMLDivElement | null>(null);

  const [isEditTitle, setIsEditTitle] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChanged, setIsChanged] = useState(false);

  const isChangedRef = useRef(isChanged);

  const hiddenRanges = useMemo(() => {
    const ranges: { start: number; end: number }[] = [];

    function visit(parentKey: string, position: number): number {
      const children = notesFeed
        .filter((n) => (n.parentId ?? 'root') === parentKey)
        .slice()
        // `sort` is the position inside the current parent.
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      for (const note of children) {
        const familyCount = getFamily(note.id, notesFeed).length;
        if (note.collapsed && familyCount > 1) {
          ranges.push({
            start: position + 1,
            end: position + familyCount - 1,
          });
        }
        if (note.collapsed) {
          position += familyCount;
        } else {
          position = visit(note.id, position + 1);
        }
      }
      return position;
    }

    visit('root', 0);
    return ranges;
  }, [notesFeed]);

  function reorderCallback() {
    // TODO notes are not synchronized while a form is open, but syncing breaks sorting

    if (isChanged && !isUpdating) {
      console.log('refresh');

      setIsChanged(false);
      setIsUpdating(true);

      reorderNotes(prevFeed.current, syncFeed.current, savedUpdatedIds.current)
        .then(() => {
          setIsUpdating(false);
          if (syncFeed.current) {
            prevFeed.current = syncFeed.current.map((n) => ({ ...n }));
          }

          // If new changes appear while sending, send one more time.
          if (isChangedRef.current) {
            reorderCallback();
          }
        })
        .catch((err: unknown) => {
          console.error(err);

          setIsUpdating(false);

          // Retry as well if changes appeared while the request failed.
          if (isChangedRef.current) {
            reorderCallback();
          }
        });
    }
  }

  const scheduleSyncUpdate = () => {
    updateTimeout = setTimeout(function () {
      setIsChanged(true);
      savedUpdatedIds.current = updatedIds.current;
      updatedIds.current = [];
    }, 1000);
  };

  const handleDelete = () => {
    setIsEditTitle(false);

    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }

    let curNote = notesFeed.find((n) => n.id == focusId.current);

    // @ts-ignore
    let removedFeed = removeFamily(curNote.id, notesFeed);

    let remainingIds = removedFeed.map((n) => n.id);

    let allIds = notesFeed.map((n) => n.id);

    let removedIds = [];

    allIds.map((id) => {
      if (!remainingIds.includes(id)) {
        removedIds.push(id);
      }
    });

    removedIds.map((id) => {
      if (!updatedIds.current.includes(id)) updatedIds.current.push(id);
    });

    //const deletedCount = notesFeed.length - newFeed.length;

    let newFeed = notesFeed.filter((n) => {
      return !removedIds.includes(n.id);
    });

    newFeed = renormalizeSortsForParent(newFeed, curNote.parentId);
    markSiblingsForSync(newFeed, curNote.parentId, updatedIds.current);

    //console.log(newFeed)

    scheduleSyncUpdate();

    syncFeed.current = newFeed;

    setNotesFeed(newFeed);

    //console.log(cursorPosition +" : "+ newFeed.length)
    if (cursorPosition > newFeed.length - 1) {
      setCursorPosition(newFeed.length - 1);
    }
  };

  const insertNote = (
    event: KeyboardEvent | { shiftKey: boolean; altKey: boolean } | null,
  ): void => {
    if (event == null) {
      event = {
        shiftKey: false,
        altKey: false,
      };
    }

    // TODO extract into a function and reuse after submit to instantly add a new note

    prevFocusId.current = focusId.current;
    prevCursorPosition.current = cursorPosition;

    clearTimeout(timeout);
    lastKeyRef.current = null;

    let newId = crypto.randomUUID();

    let curNote = notesFeed.find((n) => n.id == focusId.current);

    if (curNote !== undefined) {
      prevTitle.current = curNote.title;
    }

    let parentId;

    let insertChild = false;

    let newSort = 0;

    if (!notesFeed.length) {
      parentId = 'root';
    } else {
      if (event.shiftKey === true) {
        insertChild = true;

        parentId = curNote.id;
      } else {
        parentId = curNote.parentId;

        if (event.altKey) {
          newSort = curNote.sort;
        } else {
          newSort = curNote.sort + 1;
        }
      }
    }

    let insertAt;

    if (!notesFeed.length) {
      insertAt = 0;
    } else {
      if (insertChild) {
        // A nested item is always inserted at the next position after current.

        insertAt = cursorPosition + 1;
      } else {
        if (!insertChild && event.altKey) {
          insertAt = cursorPosition;
        } else {
          insertAt = cursorPosition + getFamily(curNote.id, notesFeed).length;
        }
      }
    }

    let newNote: NotesListItemProps = {
      id: newId,
      title: '',
      priority: null,
      isBold: false,
      sort: newSort,
      //position: insertAt,
      isNew: true,
      parentId: parentId,
    };

    let newFeed = [...notesFeed, newNote];

    newFeed = newFeed.map((n) => {
      if (
        n.sort >= newSort &&
        n.id != newId &&
        sameParent(n.parentId, parentId)
      ) {
        return {
          ...n,
          sort: n.sort + 1,
        };
      } else if (insertChild && n.id == parentId) {
        return {
          ...n,
          collapsed: false,
        };
      } else {
        return n;
      }
    });

    newFeed = renormalizeSortsForParent(newFeed, parentId);
    markSiblingsForSync(newFeed, parentId, updatedIds.current);
    const newIdx = updatedIds.current.indexOf(newId);
    if (newIdx >= 0) updatedIds.current.splice(newIdx, 1);

    // TODO remove this timeout. It prevents the new note form from being submitted immediately.

    setTimeout(function () {
      setCursorPosition(insertAt);
      setIsEditTitle(true);
      setNotesFeed(newFeed);
    }, 1);
  };

  useEffect(() => {
    if (!isChanged) return;

    // If the user keeps interacting, reset the timer.
    if (reorderTimeoutRef.current) {
      clearTimeout(reorderTimeoutRef.current);
    }

    reorderTimeoutRef.current = window.setTimeout(() => {
      reorderCallback();
      reorderTimeoutRef.current = null;
    }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChanged, notesFeed]);

  useEffect(() => {
    isChangedRef.current = isChanged;
  }, [isChanged]);

  useEffect(() => {
    const patch = props.feedSyncFromModal;
    if (!patch) return;
    setNotesFeed((prev) =>
      prev.map((n) =>
        n.id === patch.noteId
          ? {
              ...n,
              hasContent: patch.hasContent,
              ...(patch.title !== undefined ? { title: patch.title } : {}),
            }
          : n,
      ),
    );
  }, [props.feedSyncFromModal]);

  const findPositionById = useCallback(
    (targetId: string): number | null => {
      let position = 0;

      const visit = (parentKey: string): number | null => {
        const children = notesFeed
          .filter((n) => (n.parentId ?? 'root') === parentKey)
          .slice()
          // `sort` is the position inside the current parent.
          .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

        for (const note of children) {
          if (note.id === targetId) {
            return position;
          }

          position += 1;
          const found = visit(note.id);
          if (found !== null) {
            return found;
          }
        }

        return null;
      };

      return visit('root');
    },
    [notesFeed],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!router.isReady) return;
    // URL `?note=` drives focus for the open note; do not override from session.
    if (router.query.note) return;

    const lastFocusId = sessionStorage.getItem('notes:last-focus-id');
    if (!lastFocusId) return;

    const restoredPosition = findPositionById(lastFocusId);
    if (restoredPosition !== null) {
      setCursorPosition(restoredPosition);
    }

    sessionStorage.removeItem('notes:last-focus-id');
  }, [notesFeed, findPositionById, router.isReady, router.query.note]);

  // After refresh with `/?note=<id>`, align list focus with the open note and expand ancestors.
  useEffect(() => {
    if (!router.isReady || !noteIdFromQuery) return;
    if (!notesFeed.some((n) => n.id === noteIdFromQuery)) return;

    const ancestorIds: string[] = [];
    let current: NotesListItemProps | undefined = notesFeed.find(
      (n) => n.id === noteIdFromQuery,
    );
    while (current?.parentId && current.parentId !== 'root') {
      const pid = current.parentId;
      ancestorIds.push(pid);
      current = notesFeed.find((n) => n.id === pid);
    }

    const collapsedAncestorIds = ancestorIds.filter((aid) => {
      const n = notesFeed.find((x) => x.id === aid);
      return n?.collapsed === true;
    });

    if (collapsedAncestorIds.length > 0) {
      setNotesFeed((prev) =>
        prev.map((n) =>
          collapsedAncestorIds.includes(n.id) ? { ...n, collapsed: false } : n,
        ),
      );
    }

    const restoredPosition = findPositionById(noteIdFromQuery);
    if (restoredPosition !== null) {
      setCursorPosition(restoredPosition);
      focusId.current = noteIdFromQuery;
    }
  }, [router.isReady, noteIdFromQuery, notesFeed, findPositionById]);

  useLayoutEffect(() => {
    if (!router.isReady || !noteIdFromQuery) return;
    const row = document.getElementById(noteIdFromQuery);
    if (!row) return;
    row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [router.isReady, noteIdFromQuery, notesFeed, cursorPosition]);

  const clearPendingUpdateTimeout = () => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
  };

  const setCollapsedState = (noteId: string, collapsed: boolean) => {
    clearPendingUpdateTimeout();

    const curNote = notesFeed.find((n) => n.id == noteId);
    if (!curNote) return;

    const newFeed = notesFeed.map((n) => {
      if (n.id === curNote.id) {
        if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

        return {
          ...n,
          collapsed,
        };
      }
      return n;
    });

    scheduleSyncUpdate();
    syncFeed.current = newFeed;
    setNotesFeed(newFeed);
  };

  const handleToggleCollapse = (noteId: string) => {
    const curNote = notesFeed.find((n) => n.id == noteId);
    if (!curNote) return;
    setCollapsedState(noteId, !curNote.collapsed);
  };

  const handleNavigate = (event: KeyboardEvent, isCtrlCommand: boolean) => {
    if (
      (eventKeyRef.current !== 'ArrowUp' &&
        eventKeyRef.current !== 'ArrowDown') ||
      isCtrlCommand
    ) {
      return;
    }

    event.preventDefault();

    lastKeyRef.current = null;
    clearTimeout(timeout);

    let curNote = notesFeed.find((n) => n.id == focusId.current);

    // @ts-ignore
    let curNoteFamily = getFamily(curNote.id, notesFeed);

    let positionShift = 0;

    if (curNote.collapsed && eventKeyRef.current == 'ArrowDown') {
      positionShift = curNoteFamily.length - 1;
    }

    if (eventKeyRef.current === 'ArrowUp' && cursorPosition > 0) {
      let nextPos = cursorPosition - 1;

      for (const range of hiddenRanges) {
        if (nextPos >= range.start && nextPos <= range.end) {
          nextPos = range.start - 1;
          break;
        }
      }

      setCursorPosition(nextPos);
      saveCursorPosition.current = nextPos;

      let navNote = notesFeed.find((n) => n.id == focusId.current);
      let navParentId = navNote.parentId;
      let navParents = [];

      while (navParentId != undefined && navParentId != 'root') {
        let navParent = notesFeed.find((n) => n.id == navParentId);

        navParents.push({
          id: navParentId,
          collapsed: navParent.collapsed,
        });

        navParentId = navParent.parentId;
      }

      let navParentsReverted = navParents.reverse();

      for (let i = 0; i < navParentsReverted.length; i++) {
        if (navParentsReverted[i].collapsed) {
          positionShift = getFamily(navParentsReverted[i].id, notesFeed).length;
          break;
        }
      }

      if (positionShift != 0) {
        setCursorPosition(saveCursorPosition.current - positionShift + 1);
      }
    } else if (
      eventKeyRef.current === 'ArrowDown' &&
      cursorPosition + positionShift < notesFeed.length - 1 &&
      cursorPosition !== null
    ) {
      setCursorPosition(cursorPosition + 1 + positionShift);
    } else if (eventKeyRef.current === 'ArrowDown' && cursorPosition === null) {
      setCursorPosition(0);
    }
  };

  const handleStartEditShortcut = () => {
    if (!(eventKeyRef.current === 'KeyE' && lastKeyRef.current === 'KeyE')) {
      return;
    }

    clearTimeout(timeout);
    lastKeyRef.current = null;

    setTimeout(function () {
      setIsEditTitle(true);
    }, 1);
  };

  const handleOpenNoteShortcut = () => {
    if (!(eventKeyRef.current === 'KeyN' && lastKeyRef.current === 'KeyN')) {
      return;
    }

    let curNote = notesFeed.find((n) => n.id == focusId.current);
    if (!curNote) return;
    Router.push({ pathname: '/', query: { note: curNote.id } }, undefined, {
      shallow: true,
    });
  };

  const handleIndent = (event: KeyboardEvent, isCtrlCommand: boolean) => {
    if (!(eventKeyRef.current == 'ArrowRight' && isCtrlCommand)) {
      return;
    }

    event.preventDefault();
    clearPendingUpdateTimeout();

    let curNote = notesFeed.find((n) => n.id == focusId.current);
    if (!curNote) return;

    const sibs = siblingsSortedByParent(notesFeed, curNote.parentId);
    const idx = sibs.findIndex((n) => n.id === focusId.current);
    const prevSiblingId = idx > 0 ? sibs[idx - 1].id : null;

    const newSiblingsCount = notesFeed.filter(
      (n) => n.parentId === prevSiblingId,
    ).length;
    const newSort = newSiblingsCount;
    const newParentId = prevSiblingId;

    if (idx > 0 && prevSiblingId !== null) {
      let newFeed = notesFeed.map((n) => {
        if (n.id === curNote.id) {
          if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

          return {
            ...n,
            parentId: newParentId,
            sort: newSort,
          };
        } else if (
          sameParent(n.parentId, curNote.parentId) &&
          n.sort > curNote.sort
        ) {
          if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

          return {
            ...n,
            sort: n.sort - 1,
          };
        } else {
          return n;
        }
      });

      newFeed = renormalizeSortsForParent(newFeed, curNote.parentId);
      newFeed = renormalizeSortsForParent(newFeed, newParentId);
      markSiblingsForSync(newFeed, curNote.parentId, updatedIds.current);
      markSiblingsForSync(newFeed, newParentId, updatedIds.current);

      scheduleSyncUpdate();

      syncFeed.current = newFeed;
      setNotesFeed(newFeed);
    }
  };

  const handleUnindent = (event: KeyboardEvent, isCtrlCommand: boolean) => {
    if (!(eventKeyRef.current == 'ArrowLeft' && isCtrlCommand)) {
      return;
    }

    event.preventDefault();
    clearPendingUpdateTimeout();

    let curNote = notesFeed.find((n) => n.id == focusId.current);
    if (!curNote) return;

    let parentId = curNote.parentId;

    let curNoteSiblings = siblingsSortedByParent(notesFeed, curNote.parentId);
    const sibIdx = curNoteSiblings.findIndex((n) => n.id === focusId.current);
    let parentFamily = getFamily(curNote.parentId, notesFeed);

    // @ts-ignore
    let curNoteFamily = removeFamily(curNote.id, parentFamily);

    let positionShift = 0;

    if (sibIdx >= 0 && sibIdx < curNoteSiblings.length - 1) {
      positionShift = curNoteFamily.length - 1;
    }

    if (parentKey(parentId) !== 'root') {
      let curParent = notesFeed.find((n) => n.id == parentId);
      let newParentId = curParent.parentId;
      let newSort = curParent.sort + 1;

      let newFeed = notesFeed.map((n) => {
        if (n.id === curNote.id) {
          if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

          return {
            ...n,
            isNew: false,
            parentId: newParentId,
            sort: newSort,
          };
        } else if (
          sameParent(n.parentId, newParentId) &&
          n.sort > curParent.sort
        ) {
          if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

          return {
            ...n,
            sort: n.sort + 1,
          };
        } else if (sameParent(n.parentId, parentId) && n.sort > curNote.sort) {
          if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

          return {
            ...n,
            sort: n.sort - 1,
          };
        } else {
          return n;
        }
      });

      newFeed = renormalizeSortsForParent(newFeed, parentId);
      newFeed = renormalizeSortsForParent(newFeed, newParentId);
      markSiblingsForSync(newFeed, parentId, updatedIds.current);
      markSiblingsForSync(newFeed, newParentId, updatedIds.current);

      scheduleSyncUpdate();

      syncFeed.current = newFeed;
      setNotesFeed(newFeed);
      setCursorPosition(cursorPosition + positionShift);
    }
  };

  const handleCollapse = (event: KeyboardEvent, isCtrlCommand: boolean) => {
    if (
      (eventKeyRef.current != 'ArrowRight' &&
        eventKeyRef.current != 'ArrowLeft') ||
      isCtrlCommand
    ) {
      return;
    }

    event.preventDefault();

    let collapsed = false;
    if (eventKeyRef.current == 'ArrowLeft') {
      collapsed = true;
    }

    let curNote = notesFeed.find((n) => n.id == focusId.current);
    if (!curNote) return;
    setCollapsedState(curNote.id, collapsed);
  };

  const handleSort = (event: KeyboardEvent, isCtrlCommand: boolean) => {
    if (
      (eventKeyRef.current != 'ArrowUp' &&
        eventKeyRef.current != 'ArrowDown') ||
      !isCtrlCommand
    ) {
      return;
    }

    event.preventDefault();
    clearPendingUpdateTimeout();

    let sortShift = 0;
    let curNote = notesFeed.find((n) => n.id == focusId.current);
    if (!curNote) return;

    const curNoteSiblings = siblingsSortedByParent(notesFeed, curNote.parentId);
    const sIdx = curNoteSiblings.findIndex((n) => n.id === curNote.id);

    let shiftedNote: NotesListItemProps | null = null;

    if (eventKeyRef.current == 'ArrowUp') {
      if (sIdx > 0) {
        sortShift = -1;
        shiftedNote = curNoteSiblings[sIdx - 1];
      }
    } else if (eventKeyRef.current == 'ArrowDown') {
      if (sIdx >= 0 && sIdx < curNoteSiblings.length - 1) {
        sortShift = 1;
        shiftedNote = curNoteSiblings[sIdx + 1];
      }
    }

    if (sortShift !== 0 && shiftedNote) {
      const shiftedNoteFamily = getFamily(shiftedNote.id, notesFeed);
      const curSort = curNote.sort ?? 0;
      const otherSort = shiftedNote.sort ?? 0;

      updatedIds.current.push(curNote.id);
      updatedIds.current.push(shiftedNote.id);

      let newFeed = notesFeed.map((n) => {
        if (n.id === curNote.id) {
          return {
            ...n,
            sort: otherSort,
          };
        } else if (n.id === shiftedNote.id) {
          return {
            ...n,
            sort: curSort,
          };
        } else {
          return n;
        }
      });

      newFeed = renormalizeSortsForParent(newFeed, curNote.parentId);
      markSiblingsForSync(newFeed, curNote.parentId, updatedIds.current);

      scheduleSyncUpdate();

      syncFeed.current = newFeed;
      setNotesFeed(newFeed);

      setCursorPosition(cursorPosition + sortShift * shiftedNoteFamily.length);
    }
  };

  const handleComplete = (event: KeyboardEvent) => {
    if (eventKeyRef.current != 'Space') {
      return;
    }

    event.preventDefault();
    clearPendingUpdateTimeout();

    let curNote = notesFeed.find((n) => n.id == focusId.current);

    // @ts-ignore
    let removedFeed = removeFamily(curNote.id, notesFeed);

    let remainingIds = removedFeed.map((n) => n.id);
    let allIds = notesFeed.map((n) => n.id);
    let completeIds = [];

    allIds.map((id) => {
      if (!remainingIds.includes(id)) {
        completeIds.push(id);
      }
    });

    let newFeed = notesFeed.map((n) => {
      if (completeIds.includes(n.id)) {
        if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

        return {
          ...n,
          complete: !curNote.complete,
        };
      } else {
        return n;
      }
    });

    scheduleSyncUpdate();
    syncFeed.current = newFeed;
    setNotesFeed(newFeed);
  };

  const handleLeafCompleteChange = (noteId: string, isComplete: boolean) => {
    const curNote = notesFeed.find((n) => n.id === noteId);
    if (!curNote) return;
    if (getFamily(noteId, notesFeed).length !== 1) return;

    clearPendingUpdateTimeout();

    const newFeed = notesFeed.map((n) => {
      if (n.id !== noteId) return n;
      if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);
      return { ...n, complete: isComplete };
    });

    scheduleSyncUpdate();
    syncFeed.current = newFeed;
    setNotesFeed(newFeed);
  };

  const handleDeleteShortcut = () => {
    if (eventKeyRef.current == 'Delete') {
      handleDelete();
    }
  };

  const handleInsertShortcut = (event: KeyboardEvent) => {
    if (eventKeyRef.current == 'Enter') {
      insertNote(event);
    }
  };

  const handlePriorityShortcut = (event: KeyboardEvent) => {
    const priorityByCode: Record<string, number> = {
      Digit1: 1,
      Numpad1: 1,
      Digit2: 2,
      Numpad2: 2,
      Digit3: 3,
      Numpad3: 3,
    };
    const nextPriority = priorityByCode[event.code];
    if (!nextPriority) {
      return;
    }

    const curNote = notesFeed.find((n) => n.id == focusId.current);
    if (!curNote) {
      return;
    }

    event.preventDefault();
    clearPendingUpdateTimeout();

    const updatedPriority =
      curNote.priority === nextPriority ? null : nextPriority;
    const newFeed = notesFeed.map((n) => {
      if (n.id !== curNote.id) {
        return n;
      }

      if (!updatedIds.current.includes(n.id)) {
        updatedIds.current.push(n.id);
      }

      return {
        ...n,
        priority: updatedPriority,
      };
    });

    scheduleSyncUpdate();
    syncFeed.current = newFeed;
    setNotesFeed(newFeed);
  };

  const handleBoldShortcut = (event: KeyboardEvent, isCtrlCommand: boolean) => {
    if (!(isCtrlCommand && eventKeyRef.current === 'KeyB')) {
      return;
    }

    const curNote = notesFeed.find((n) => n.id == focusId.current);
    if (!curNote) {
      return;
    }

    event.preventDefault();
    clearPendingUpdateTimeout();

    const newFeed = notesFeed.map((n) => {
      if (n.id !== curNote.id) {
        return n;
      }

      if (!updatedIds.current.includes(n.id)) {
        updatedIds.current.push(n.id);
      }

      return {
        ...n,
        isBold: !n.isBold,
      };
    });

    scheduleSyncUpdate();
    syncFeed.current = newFeed;
    setNotesFeed(newFeed);
  };

  const onKeyPress = (event: KeyboardEvent): void => {
    let isCtrlCommand = event.ctrlKey || event.metaKey;
    const target = event.target as HTMLElement | null;
    const isTypingTarget =
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.isContentEditable;

    if (isTypingTarget) {
      return;
    }

    if (isNoteModalOpen) {
      // Note modal is open; block list hotkeys/navigation.
      return;
    }

    eventKeyRef.current = event.code;

    clearTimeout(timeout);
    timeout = setTimeout(function () {
      lastKeyRef.current = null;
    }, 1000);

    if (!isEditTitle) {
      handleNavigate(event, isCtrlCommand);
      handleStartEditShortcut();
      handleOpenNoteShortcut();
      handleIndent(event, isCtrlCommand);
      handleUnindent(event, isCtrlCommand);
      handleCollapse(event, isCtrlCommand);
      handleSort(event, isCtrlCommand);
      handleComplete(event);
      handleDeleteShortcut();
      handleInsertShortcut(event);
      handlePriorityShortcut(event);
      handleBoldShortcut(event, isCtrlCommand);
    } else {
      // clearTimeout(timeout);
      // lastKeyRef.current = null;
    }

    if (eventKeyRef.current == 'Escape') {
      clearTimeout(timeout);
      lastKeyRef.current = null;
    }

    lastKeyRef.current = eventKeyRef.current;
  };

  useKeyPress([], onKeyPress);

  useEffect(() => {
    if (!router.isReady) return;

    const shouldLock = Boolean(router.query.note);

    if (!shouldLock) {
      // Restore body scroll if we previously locked it.
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
      return;
    }

    // Lock scroll to prevent underlying list/page scrolling.
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Keep window position when the scrollbar disappears (layout shift).
    if (typeof window !== 'undefined') {
      window.scrollTo(0, scrollY);
    }

    const el = notesListScrollRef.current;
    const prevent = (e: Event) => {
      e.preventDefault();
    };

    // Prevent wheel/touch scroll on the list container while modal is open.
    if (el) {
      el.addEventListener('wheel', prevent, { passive: false });
      el.addEventListener('touchmove', prevent, { passive: false } as any);
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      if (typeof window !== 'undefined') {
        const y = scrollY;
        requestAnimationFrame(() => {
          window.scrollTo(0, y);
        });
      }
      if (el) {
        el.removeEventListener('wheel', prevent as any);
        el.removeEventListener('touchmove', prevent as any);
      }
    };
  }, [router.isReady, router.query.note]);

  // TODO feed and updatedIds should be parameters
  const reorderNotes = async (
    prevFeed: NotesListItemProps[],
    feed: NotesListItemProps[] | null,
    ids: string[],
  ): Promise<void> => {
    const body = { prevFeed, feed, ids };

    try {
      await fetch('/api/update/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (noteId: string, title: string): void => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }

    let curNote = notesFeed.find((n) => n.id == noteId);

    let newFeed = notesFeed.map((n) => {
      if (n.id === noteId) {
        return {
          ...n,
          title: title,
          isNew: false,
        };
      } else {
        return n;
      }
    });

    setIsEditTitle(false);

    updatedIds.current.push(noteId);

    if (curNote.isNew) {
      newFeed.map((n) => {
        if (
          sameParent(n.parentId, curNote.parentId) &&
          n.sort >= curNote.sort &&
          n.id != noteId
        ) {
          updatedIds.current.push(n.id);
        }
      });

      const newId = crypto.randomUUID();

      newFeed = [
        ...newFeed,
        {
          id: newId,
          title: '',
          priority: null,
          isBold: false,
          sort: curNote.sort + 1,
          //position: insertAt,
          isNew: true,
          parentId: curNote.parentId,
        },
      ];

      syncFeed.current = newFeed;

      newFeed = newFeed.map((n) => {
        if (
          n.sort > curNote.sort &&
          sameParent(n.parentId, curNote.parentId) &&
          n.id != newId
        ) {
          return {
            ...n,
            sort: n.sort + 1,
          };
        } else {
          return n;
        }
      });

      newFeed = renormalizeSortsForParent(newFeed, curNote.parentId);
      markSiblingsForSync(newFeed, curNote.parentId, updatedIds.current);
      const placeholderIdx = updatedIds.current.indexOf(newId);
      if (placeholderIdx >= 0) updatedIds.current.splice(placeholderIdx, 1);

      setIsEditTitle(true);

      prevCursorPosition.current = cursorPosition;

      setCursorPosition(cursorPosition + 1);
    }

    scheduleSyncUpdate();

    syncFeed.current = newFeed;

    setNotesFeed(newFeed);
  };

  const handleCancel = (
    isNewParam: boolean,
    noteId: string,
    parentId: string | undefined,
    sort: number | undefined,
  ): void => {
    setIsEditTitle(false);

    if (isNewParam) {
      let newFeed = notesFeed.map((n) => {
        if (n.sort > sort && sameParent(n.parentId, parentId)) {
          return {
            ...n,
            sort: n.sort - 1,
          };
        } else {
          return n;
        }
      });

      newFeed = newFeed.filter((n) => n.id !== noteId);

      newFeed = renormalizeSortsForParent(newFeed, parentId);

      // updatedIds.current = updatedIds.current.filter(id => {id != noteId});
      //
      // console.log(updatedIds.current)

      //setTimeout(function () {
      setNotesFeed(newFeed);
      setCursorPosition(prevCursorPosition.current);
      //},1);
    }
  };

  return (
    <div className="row">
      <div className={`col ${styles.notes_list_col_1}`}>
        {/*<div>{isUpdating ? "true" : "false"}</div>*/}

        {!notesFeed.length && (
          <div className="new-note-hint">
            Press&nbsp;<span>Enter</span>&nbsp;to add your first note!
          </div>
        )}

        <div ref={notesListScrollRef} className={styles.notes_list}>
          <NotesProvider feed={notesFeed}>
            {(() => {
              const rootNotes = notesFeed
                .filter((n) => n.parentId === 'root')
                .slice()
                .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

              let positionCursor = 0;

              return rootNotes.map((note) => {
                const familyCount = getFamily(note.id, notesFeed).length;
                const position = positionCursor;
                positionCursor += familyCount;

                return (
                  <NotesListItem
                    key={note.id}
                    id={note.id}
                    sort={note.sort}
                    position={position}
                    familyCount={familyCount}
                    title={note.title}
                    priority={note.priority}
                    isBold={note.isBold}
                    hasContent={note.hasContent}
                    complete={note.complete}
                    collapsed={note.collapsed}
                    parentId={note.parentId}
                    cursorPosition={cursorPosition}
                    // isFocus={note.position === cursorPosition}
                    // isEdit={note.position === cursorPosition && isEditTitle}
                    isFocus={position === cursorPosition}
                    isEdit={position === cursorPosition && isEditTitle}
                    isEditTitle={isEditTitle}
                    onCancel={handleCancel}
                    onFocus={(curId) => {
                      focusId.current = curId;
                    }}
                    onSelect={(curId, position, startEditTitle) => {
                      // Clicking moves focus; double-click enters edit mode.
                      setIsEditTitle(Boolean(startEditTitle));
                      setCursorPosition(position);
                      focusId.current = curId;
                    }}
                    onEdit={handleEdit}
                    onAdd={handleEdit}
                    onDelete={handleDelete}
                    isNew={note.isNew}
                    onToggleCollapse={handleToggleCollapse}
                    onComplete={handleLeafCompleteChange}
                  />
                );
              });
            })()}
          </NotesProvider>
        </div>
      </div>
      <div className={`col ${styles.notes_list_col_2}`}>
        <NotesHotkeysHints />
      </div>
    </div>
  );
};

export default NotesList;
