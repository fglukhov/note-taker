import React, {
  ReactNode,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react';
import { useDrag } from '@use-gesture/react';
import { useKeyPress } from '@/lib/useKeyPress';
import {
  applyInlineMarkdown,
  handleTitleMarkdownPaste,
} from '@/lib/markdownInput';
import { useAutoResizeTextarea } from '@/lib/useAutoResizeTextarea';
import { getFamily } from '@/lib/notesTree';
import styles from '@/components/NotesListItem.module.scss';
import { useNotes } from '@/components/NotesContext';
import Router from 'next/router';

import ReactMarkdown from 'react-markdown';
import { ChevronDown, FileText } from 'react-feather';

export type NotesListItemProps = {
  id: string;
  title: string;
  content?: string | null;
  authorId?: string | null;
  priority?: number | null;
  hasContent?: boolean;
  sort?: number;
  familyCount?: number;
  position?: number;
  parentPosition?: number;
  feed?: NotesListItemProps[];
  cursorPosition?: number;
  isEdit?: boolean;
  isEditTitle?: boolean;
  isFocus?: boolean;
  isNew?: boolean;
  children?: ReactNode;
  onFocus?: (id: string) => void;
  onSelect?: (
    noteId: string,
    position: number,
    startEditTitle?: boolean,
  ) => void;
  onCancel?: (
    isNewParam: boolean,
    noteId: string,
    parentId: string | undefined,
    sort: number | undefined,
  ) => void;
  onEdit?: (noteId: string, title: string) => void;
  onAdd?: (noteId: string, title: string) => void;
  onComplete?: (noteId: string, isComplete: boolean) => void;
  onDelete?: (
    noteId: string,
    parentId: string | undefined,
    sort: number | undefined,
  ) => void;
  parentId?: string;
  complete?: boolean;
  collapsed?: boolean;
  registerCollapsedRange?: (
    start: number,
    familyCount: number,
    collapsed?: boolean,
  ) => void;
  onToggleCollapse?: (noteId: string, position: number) => void;
  pendingDeleteId?: string | null;
  onRestore?: (noteId: string) => void;
};

const NotesListItem: React.FC<NotesListItemProps> = (props) => {
  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE_OFFSET = 120;
  const id = props.id;
  const parentId = props.parentId;
  const [title, setTitle] = useState(props.title);
  const sort = props.sort;
  const [prevTitle, setPrevTitle] = useState(props.title);
  const [isNew, setIsNew] = useState(props.isNew);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeOffsetRef = useRef(0);
  const isSwipeGestureActiveRef = useRef(false);
  const isEditing = props.isEdit && props.isFocus;
  const { callbackRef: titleTextareaCallbackRef } =
    useAutoResizeTextarea(title);
  const isLeaf = (props.familyCount ?? 1) === 1;
  const hasCommittedRef = useRef(false);

  useEffect(() => {
    hasCommittedRef.current = false;
    // When entering edit mode, sync title/prevTitle with the latest prop value.
    if (isEditing) {
      setTitle(props.title);
      setPrevTitle(props.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  //const { isInViewport, ref } = useInViewport();

  const eventKeyRef = useRef<string | null>(null);
  const titleWrapperRef = useRef<HTMLDivElement | null>(null);
  /** Avoid scrollIntoView on every parent re-render (e.g. modal close) while staying focused. */
  const hadFocusRef = useRef(false);

  const notesFeed = (useNotes() ?? []) as NotesListItemProps[];

  useLayoutEffect(() => {
    if (!props.isFocus) {
      hadFocusRef.current = false;
      return;
    }
    if (hadFocusRef.current) return;
    hadFocusRef.current = true;
    titleWrapperRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'start',
    });
  }, [props.isFocus]);

  // if (props.isFocus && !isOnScreen) {
  //
  //
  // 	if (elementRef.current != null) {
  //
  // 		console.log('need to scroll to: ' + title)
  // 		elementRef.current.scrollIntoView({
  // 			behavior: "smooth",
  // 			block: "nearest",
  // 			inline: "start"
  // 		});
  //
  // 	}
  //
  // }

  const onKeyPress = (event: KeyboardEvent): void => {
    eventKeyRef.current = event.code;

    if (eventKeyRef.current == 'Escape') {
      if (props.isFocus) {
        if (props.isEdit) {
          if (!isNew) {
            setTitle(prevTitle);
          }

          props.onCancel(isNew, id, parentId, sort);
        }
      }
    }
  };

  const commitTitle = () => {
    // Prevent double-save (e.g. `Enter` submit then `blur`).
    if (hasCommittedRef.current) return;
    hasCommittedRef.current = true;

    if (title) {
      if (!isNew) {
        props.onEdit?.(id, title);
        setPrevTitle(title);
      } else {
        setIsNew(false);
        setPrevTitle(title);
        props.onAdd?.(id, title);
      }
    } else {
      props.onDelete?.(id, parentId, sort);
    }
  };

  const resetSwipeState = () => {
    isSwipeGestureActiveRef.current = false;
    swipeOffsetRef.current = 0;
    setIsSwiping(false);
    setSwipeOffset(0);
  };

  useKeyPress(props.isFocus ? ['Escape', 'Delete'] : [], onKeyPress);

  const bindSwipe = useDrag(
    ({ down, first, movement: [mx], event }) => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth >= 768) return;
      if (isEditing) return;
      const isTouchGesture =
        ('pointerType' in event && event.pointerType === 'touch') ||
        event.type.startsWith('touch');

      if (first && !isTouchGesture) return;
      if (!isSwipeGestureActiveRef.current && !isTouchGesture) return;

      const nextOffset = Math.max(
        -MAX_SWIPE_OFFSET,
        Math.min(MAX_SWIPE_OFFSET, mx),
      );

      if (down) {
        isSwipeGestureActiveRef.current = true;
        setIsSwiping(true);
        swipeOffsetRef.current = nextOffset;
        setSwipeOffset(nextOffset);
        return;
      }

      if (!isSwipeGestureActiveRef.current) return;
      setIsSwiping(false);
      const finalOffset =
        Math.abs(nextOffset) > 0 ? nextOffset : swipeOffsetRef.current;
      if (Math.abs(finalOffset) >= SWIPE_THRESHOLD) {
        if (finalOffset > 0) {
          props.onComplete?.(id, !Boolean(props.complete));
        } else if (finalOffset < 0) {
          props.onDelete?.(id, parentId, sort);
        }
      }

      resetSwipeState();
    },
    {
      axis: 'x',
      filterTaps: true,
    },
  );
  const swipeProgress = Math.min(Math.abs(swipeOffset) / SWIPE_THRESHOLD, 1);
  const showLeftAction = swipeOffset > 0;
  const showRightAction = swipeOffset < 0;
  const completeActionLabel = props.complete ? 'Reopen' : 'Complete';

  if (props.isFocus) {
    props.onFocus(props.id);
  }

  const parentPosition = props.position ?? 0;
  const childNotes = notesFeed
    .filter((childNote) => childNote.parentId == props.id)
    .slice()
    // `sort` is the position inside the current parent.
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const priorityClass =
    props.priority === 1
      ? styles.priority_1
      : props.priority === 2
        ? styles.priority_2
        : props.priority === 3
          ? styles.priority_3
          : '';

  props.registerCollapsedRange?.(
    props.position,
    props.familyCount ?? 1,
    props.collapsed,
  );

  if (props.pendingDeleteId === id) {
    return (
      <div
        className={
          styles.notes_list_item +
          (props.parentId != 'root' ? ' ml-4 md:ml-8' : '') +
          ' ' +
          styles.pending_delete
        }
        id={props.id}
      >
        <button
          type="button"
          className={styles.restore_button}
          onClick={(e) => {
            e.stopPropagation();
            props.onRestore?.(id);
          }}
        >
          Restore
        </button>
      </div>
    );
  }

  //console.log(props)

  return (
    <div
      className={
        styles.notes_list_item +
        (props.isFocus ? ' ' + styles.focus : '') +
        (props.parentId != 'root' ? ' ml-4 md:ml-8' : '') +
        (props.complete ? ' ' + styles.complete : '') +
        (props.collapsed ? ' ' + styles.collapsed : '')
      }
      id={props.id}
    >
      {/*<div>"collapsed: " + {props.collapsed && "true"}</div>*/}
      {/*<div>"children: " + {props.familyCount > 1 && "true"}</div>*/}
      <div className={`${styles.notes_list_item_row} relative`}>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between md:hidden">
          <span
            className="inline-flex h-8 items-center rounded-md bg-(--accent) px-3 text-xs font-semibold uppercase tracking-wide leading-none text-white transition-opacity"
            style={{ opacity: showLeftAction ? swipeProgress : 0 }}
          >
            {completeActionLabel}
          </span>
          <span
            className="inline-flex h-8 items-center rounded-md bg-(--danger) px-3 text-xs font-semibold uppercase tracking-wide leading-none text-white transition-opacity"
            style={{ opacity: showRightAction ? swipeProgress : 0 }}
          >
            Delete
          </span>
        </div>
        <div
          className={styles.notes_list_item_title_wrapper}
          ref={titleWrapperRef}
          {...bindSwipe()}
          style={{
            touchAction: 'pan-y',
            transform: `translateX(${swipeOffset}px)`,
            transition: isSwiping
              ? 'none'
              : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
          onTouchEnd={resetSwipeState}
          onTouchCancel={resetSwipeState}
          onPointerCancel={resetSwipeState}
          onClick={
            !isEditing
              ? (e) => {
                  e.stopPropagation();
                  props.onSelect?.(id, parentPosition);
                }
              : undefined
          }
          onDoubleClick={
            !isEditing
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  props.onSelect?.(id, parentPosition, true);
                }
              : undefined
          }
        >
          {/*<div>Is in viewport: {isOnScreen ? 'true' : 'false'}</div>*/}
          {!isEditing ? (
            <>
              <div className={styles.notes_list_item_title}>
                {isLeaf && (
                  <label
                    className={styles.notes_list_item_complete_checkbox}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(props.complete)}
                      onChange={(e) => {
                        e.stopPropagation();
                        props.onComplete?.(id, e.target.checked);
                      }}
                      aria-label="Mark note complete"
                    />
                  </label>
                )}
                {
                  // <span
                  //   style={{
                  //     color: 'red',
                  //     fontSize: '12px',
                  //     paddingBottom: '3px',
                  //     paddingRight: '5px',
                  //   }}
                  // >
                  //   {props.sort}
                  // </span>
                }
                {/*<span style={{color: "red", fontSize: "12px",}}>{props.position + ": "}</span>*/}
                {props.familyCount > 1 && (
                  <div
                    className={styles.notes_list_item_arrow}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onToggleCollapse?.(id, props.position);
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <ChevronDown size={24} />
                  </div>
                )}
                <span
                  className={[
                    priorityClass,
                    /^#{1}\s/.test(props.title ?? '') ? styles.title_h1 : '',
                    /^#{2}\s/.test(props.title ?? '') ? styles.title_h2 : '',
                    /^#{3}\s/.test(props.title ?? '') ? styles.title_h3 : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <>{children}</>,
                      h1: ({ children }) => <>{children}</>,
                      h2: ({ children }) => <>{children}</>,
                      h3: ({ children }) => <>{children}</>,
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          {children}
                        </a>
                      ),
                    }}
                    allowedElements={[
                      'p',
                      'h1',
                      'h2',
                      'h3',
                      'strong',
                      'em',
                      'code',
                      'del',
                      's',
                      'a',
                    ]}
                    unwrapDisallowed
                  >
                    {props.title}
                  </ReactMarkdown>
                </span>
                {props.hasContent && (
                  <div
                    className={styles.notes_list_item_content_icon}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onSelect?.(id, parentPosition);
                      Router.push(
                        { pathname: '/', query: { note: id } },
                        undefined,
                        { shallow: true },
                      );
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <FileText size={16} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={styles.notes_list_item_form}>
                <textarea
                  rows={1}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  value={title}
                  onBlur={() => commitTitle()}
                  onPaste={(e) => {
                    if (handleTitleMarkdownPaste(e, setTitle))
                      e.preventDefault();
                  }}
                  onKeyDown={(e) => {
                    const isMod = e.metaKey || e.ctrlKey;
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      commitTitle();
                    } else if (isMod && e.key === 'b') {
                      e.preventDefault();
                      applyInlineMarkdown(e.currentTarget, '**', setTitle);
                    } else if (isMod && e.key === 'i') {
                      e.preventDefault();
                      applyInlineMarkdown(e.currentTarget, '*', setTitle);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      hasCommittedRef.current = true;
                      if (!isNew) setTitle(prevTitle);
                      props.onCancel(isNew, id, parentId, sort);
                    }
                  }}
                  ref={(el) => {
                    titleTextareaCallbackRef(el);
                    if (el && props.isFocus) {
                      el.focus({ preventScroll: true });
                    }
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {childNotes.map((childNote, i) => {
        const previousFamiliesCount = childNotes
          .slice(0, i)
          .reduce(
            (acc, prevChild) => acc + getFamily(prevChild.id, notesFeed).length,
            0,
          );
        const familyCount = getFamily(childNote.id, notesFeed).length;
        const position = parentPosition + 1 + previousFamiliesCount;

        return (
          <NotesListItem
            key={childNote.id}
            id={childNote.id}
            sort={childNote.sort}
            position={position}
            familyCount={familyCount}
            title={childNote.title}
            priority={childNote.priority}
            hasContent={childNote.hasContent}
            complete={childNote.complete}
            collapsed={childNote.collapsed}
            parentId={childNote.parentId}
            cursorPosition={props.cursorPosition}
            isFocus={position === props.cursorPosition}
            isEdit={position === props.cursorPosition && props.isEditTitle}
            isEditTitle={props.isEditTitle}
            onFocus={props.onFocus}
            onCancel={props.onCancel}
            onEdit={props.onEdit}
            onAdd={props.onAdd}
            onDelete={props.onDelete}
            isNew={childNote.isNew}
            registerCollapsedRange={props.registerCollapsedRange}
            onToggleCollapse={props.onToggleCollapse}
            onSelect={props.onSelect}
            onComplete={props.onComplete}
            pendingDeleteId={props.pendingDeleteId}
            onRestore={props.onRestore}
          />
        );
      })}
    </div>
  );
};

export default NotesListItem;
