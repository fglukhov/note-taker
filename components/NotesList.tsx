import React, { useState, useEffect, useRef, useMemo } from 'react';
import NotesListItem from '@/components/NotesListItem';
import { NotesProvider } from '@/components/NotesContext';
import { NotesListItemProps } from '@/components/NotesListItem';
import { useKeyPress } from '@/lib/useKeyPress';
import { getFamily, removeFamily } from '@/lib/notesTree';
import NotesHotkeysHints from '@/components/NotesHotkeysHints';
import styles from '@/components/NotesList.module.scss';
import Router from 'next/router';

// TODO tidy up types
// TODO handle page reload on cmd+R
// TODO restore current position after reload and scroll to it

type Props = {
  feed: NotesListItemProps[];
};

let updateTimeout: ReturnType<typeof setTimeout> | null = null;
//let reorderInterval = null;
let timeout: ReturnType<typeof setTimeout> | null = null;

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

  const [isEditTitle, setIsEditTitle] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChanged, setIsChanged] = useState(false);

  const isChangedRef = useRef(isChanged);

  const hiddenRanges = useMemo(() => {
    const ranges: { start: number; end: number }[] = [];

    function visit(parentKey: string, position: number): number {
      const children = notesFeed.filter(
        (n) => (n.parentId ?? 'root') === parentKey,
      );
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

    notesFeed.map((n) => {
      if (n.parentId === curNote.parentId && n.sort > curNote.sort)
        updatedIds.current.push(n.id);
    });

    let newFeed = notesFeed.filter((n) => {
      return !removedIds.includes(n.id);
    });

    newFeed = newFeed.map((n) => {
      if (n.parentId === curNote.parentId && n.sort > curNote.sort) {
        return {
          ...n,
          sort: n.sort - 1,
        };
      } else {
        return n;
      }
    });

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
      sort: newSort,
      //position: insertAt,
      isNew: true,
      parentId: parentId,
    };

    let newFeed = [...notesFeed, newNote];

    newFeed = newFeed.map((n) => {
      if (n.sort >= newSort && n.id != newId && n.parentId == parentId) {
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

    newFeed.sort((a, b) => a.sort - b.sort);

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

    newFeed.sort((a, b) => a.sort - b.sort);

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
    Router.push('/n/[id]', `/n/${curNote.id}`);
  };

  const handleIndent = (event: KeyboardEvent, isCtrlCommand: boolean) => {
    if (!(eventKeyRef.current == 'ArrowRight' && isCtrlCommand)) {
      return;
    }

    event.preventDefault();
    clearPendingUpdateTimeout();

    let curNote = notesFeed.find((n) => n.id == focusId.current);
    let parentId = curNote.parentId;
    const siblingsIds = [];

    notesFeed.map((n) => {
      if (n.parentId == parentId) {
        siblingsIds.push(n.id);
      }
    });

    let prevSiblingId = null;

    siblingsIds.map((id, i) => {
      if (id === focusId.current && i > 0) {
        prevSiblingId = siblingsIds[i - 1];
      }
    });

    let newSiblingsCount = 0;

    notesFeed.map((n) => {
      if (n.parentId === prevSiblingId) {
        newSiblingsCount += 1;
      }
    });

    let newSort = newSiblingsCount;
    let newParentId = prevSiblingId;

    if (curNote.sort > 0 && prevSiblingId !== null) {
      const newFeed = notesFeed.map((n) => {
        if (n.id === curNote.id) {
          if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

          return {
            ...n,
            parentId: newParentId,
            sort: newSort,
          };
        } else if (n.parentId === curNote.parentId && n.sort > curNote.sort) {
          if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

          return {
            ...n,
            sort: n.sort - 1,
          };
        } else {
          return n;
        }
      });

      newFeed.sort((a, b) => a.sort - b.sort);

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
    let parentId = curNote.parentId;

    let curNoteSiblings = notesFeed.filter(
      (n) => n.parentId === curNote.parentId,
    );
    let parentFamily = getFamily(curNote.parentId, notesFeed);

    // @ts-ignore
    let curNoteFamily = removeFamily(curNote.id, parentFamily);

    let positionShift = 0;

    if (curNote.sort < curNoteSiblings.length - 1) {
      positionShift = curNoteFamily.length - 1;
    }

    if (parentId !== 'root') {
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
        } else if (n.parentId === newParentId && n.sort > curParent.sort) {
          if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

          return {
            ...n,
            sort: n.sort + 1,
          };
        } else if (n.parentId === parentId && n.sort > curNote.sort) {
          if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id);

          return {
            ...n,
            sort: n.sort - 1,
          };
        } else {
          return n;
        }
      });

      newFeed.sort((a, b) => a.sort - b.sort);

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
    let curNoteSiblings = notesFeed.filter(
      (n) => n.parentId === curNote.parentId,
    );

    let shiftedNote = null;

    if (eventKeyRef.current == 'ArrowUp') {
      if (curNote.sort > 0) {
        sortShift = -1;
        shiftedNote = curNoteSiblings.filter(
          (n) => n.sort == curNote.sort - 1,
        )[0];
      }
    } else if (eventKeyRef.current == 'ArrowDown') {
      if (curNote.sort < curNoteSiblings.length - 1) {
        sortShift = 1;
        shiftedNote = curNoteSiblings.filter(
          (n) => n.sort == curNote.sort + 1,
        )[0];
      }
    }

    if (sortShift != 0) {
      let shiftedNoteFamily = getFamily(shiftedNote.id, notesFeed);

      updatedIds.current.push(curNote.id);
      updatedIds.current.push(shiftedNote.id);

      let newFeed = notesFeed.map((n) => {
        if (n.id === curNote.id) {
          return {
            ...n,
            sort: n.sort + sortShift,
          };
        } else if (n.id === shiftedNote.id) {
          return {
            ...n,
            sort: n.sort - sortShift,
          };
        } else {
          return n;
        }
      });

      newFeed.sort((a, b) => a.sort - b.sort);

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

  const onKeyPress = (event: KeyboardEvent): void => {
    let isCtrlCommand = event.ctrlKey || event.metaKey;

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
          n.parentId == curNote.parentId &&
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
          n.parentId == curNote.parentId &&
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

      newFeed.sort((a, b) => a.sort - b.sort);

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
        if (n.sort > sort && n.parentId === parentId) {
          return {
            ...n,
            sort: n.sort - 1,
          };
        } else {
          return n;
        }
      });

      newFeed = newFeed.filter((n) => n.id !== noteId);

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

        <div className={styles.notes_list}>
          <NotesProvider feed={notesFeed}>
            {notesFeed.map((note, i) => {
              if (note.parentId === 'root') {
                const familyCount = getFamily(note.id, notesFeed).length;
                const position = notesFeed
                  .slice(0, i)
                  .reduce(
                    (acc, n) =>
                      n.parentId === 'root'
                        ? acc + getFamily(n.id, notesFeed).length
                        : acc,
                    0,
                  );

                return (
                  <NotesListItem
                    key={note.id}
                    id={note.id}
                    sort={note.sort}
                    position={position}
                    familyCount={familyCount}
                    title={note.title}
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
                    onEdit={handleEdit}
                    onAdd={handleEdit}
                    onDelete={handleDelete}
                    isNew={note.isNew}
                    onToggleCollapse={handleToggleCollapse}
                  />
                );
              }
            })}
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
