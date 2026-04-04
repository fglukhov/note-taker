import React, {
  ReactNode,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react';
import { useKeyPress } from '@/lib/useKeyPress';
import { getFamily } from '@/lib/notesTree';
import styles from '@/components/NotesListItem.module.scss';
import { useNotes } from '@/components/NotesContext';
import Router from 'next/router';

import { ChevronDown, FileText } from 'react-feather';

export type NotesListItemProps = {
  id: string;
  title: string;
  content?: string | null;
  authorId?: string | null;
  priority?: number | null;
  isBold?: boolean;
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
  onToggleCollapse?: (noteId: string) => void;
};

const NotesListItem: React.FC<NotesListItemProps> = (props) => {
  const id = props.id;
  const parentId = props.parentId;
  const [title, setTitle] = useState(props.title);
  const sort = props.sort;
  const [prevTitle, setPrevTitle] = useState(props.title);
  const [isNew, setIsNew] = useState(props.isNew);
  const isEditing = props.isEdit && props.isFocus;
  const hasCommittedRef = useRef(false);

  useEffect(() => {
    // Reset commit guard when entering/leaving edit mode.
    hasCommittedRef.current = false;
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
              {
                <span
                  style={{
                    color: 'red',
                    fontSize: '12px',
                    paddingBottom: '3px',
                    paddingRight: '5px',
                  }}
                >
                  {props.sort}
                </span>
              }
              {/*<span style={{color: "red", fontSize: "12px",}}>{props.position + ": "}</span>*/}
              {props.familyCount > 1 && (
                <div
                  className={styles.notes_list_item_arrow}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggleCollapse?.(id);
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
                className={`${priorityClass} ${props.isBold ? styles.bold_text : ''}`}
              >
                {title}
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitTitle();
                }}
              >
                <input
                  //autoFocus
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  type="text"
                  value={title}
                  onBlur={() => {
                    commitTitle();
                  }}
                  onFocus={(e) => {
                    //e.preventDefault()
                  }}
                  ref={(el) => {
                    if (el !== null && props.isFocus) {
                      //console.log(el)

                      el.focus({
                        preventScroll: true,
                      });
                    }
                  }}
                />
              </form>
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
            isBold={childNote.isBold}
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
          />
        );
      })}
    </div>
  );
};

export default NotesListItem;
