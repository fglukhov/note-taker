import React, {
  ReactNode,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react';
import { useKeyPress } from '@/lib/useKeyPress';
import { applyInlineMarkdown, handleUrlPaste } from '@/lib/markdownInput';
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
};

const NotesListItem: React.FC<NotesListItemProps> = (props) => {
  const id = props.id;
  const parentId = props.parentId;
  const [title, setTitle] = useState(props.title);
  const sort = props.sort;
  const [prevTitle, setPrevTitle] = useState(props.title);
  const [isNew, setIsNew] = useState(props.isNew);
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

  useKeyPress(props.isFocus ? ['Escape', 'Delete'] : [], onKeyPress);

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

  //console.log(props)

  return (
    <div
      className={
        styles.notes_list_item +
        (props.isFocus ? ' ' + styles.focus : '') +
        (props.complete ? ' ' + styles.complete : '') +
        (props.collapsed ? ' ' + styles.collapsed : '')
      }
      id={props.id}
    >
      {/*<div>"collapsed: " + {props.collapsed && "true"}</div>*/}
      {/*<div>"children: " + {props.familyCount > 1 && "true"}</div>*/}
      <div
        className={styles.notes_list_item_title_wrapper}
        ref={titleWrapperRef}
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
                  if (handleUrlPaste(e, setTitle)) e.preventDefault();
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
          />
        );
      })}
    </div>
  );
};

export default NotesListItem;
