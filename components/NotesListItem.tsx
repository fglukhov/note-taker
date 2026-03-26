import React, { ReactNode, useState, useRef } from 'react';
import { useKeyPress } from '@/lib/useKeyPress';
import { getFamily } from '@/components/NotesList';
import styles from '@/components/NotesListItem.module.scss';
import { useNotes } from '@/components/NotesContext';

import { ChevronDown } from 'react-feather';

export type NotesListItemProps = {
  id: string;
  title: string;
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
};

const NotesListItem: React.FC<NotesListItemProps> = (props) => {
  const id = props.id;
  const parentId = props.parentId;
  const [title, setTitle] = useState(props.title);
  const sort = props.sort;
  const [prevTitle, setPrevTitle] = useState(props.title);
  const [isNew, setIsNew] = useState(props.isNew);

  //const { isInViewport, ref } = useInViewport();

  const eventKeyRef = useRef<string | null>(null);

  const notesFeed = useNotes() ?? [];

  const onElementRef = (node: HTMLDivElement | null): void => {
    if (node && props.isFocus) {
      node.scrollIntoView({
        //behavior: "smooth",
        block: 'nearest',
        inline: 'start',
      });
    }
  };

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

  const editTitle = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!props.isNew) {
      // editing note

      setTitle(title);
      setPrevTitle(title);
    } else {
      // Adding new note

      setIsNew(false);
    }
  };

  useKeyPress(props.isFocus ? ['Escape', 'Delete'] : [], onKeyPress);

  if (props.isFocus) {
    props.onFocus(props.id);
  }

  const parentPosition = props.position ?? 0;
  const childNotes = notesFeed.filter(
    (childNote) => childNote.parentId == props.id,
  );

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
      <div className={styles.notes_list_item_title_wrapper} ref={onElementRef}>
        {/*<div>Is in viewport: {isOnScreen ? 'true' : 'false'}</div>*/}
        {!(props.isEdit && props.isFocus) ? (
          <>
            {/*<div style={{color: "red", fontSize: "12px", paddingBottom: "3px"}}>{props.sort}</div>*/}
            <div className={styles.notes_list_item_title}>
              {/*<span style={{color: "red", fontSize: "12px",}}>{props.position + ": "}</span>*/}
              {props.familyCount > 1 && (
                <div className={styles.notes_list_item_arrow}>
                  <ChevronDown size={24} />
                </div>
              )}
              {title}
            </div>
          </>
        ) : (
          <>
            {/*<div style={{color: "red", fontSize: "12px", paddingBottom: "3px"}}>{props.sort}</div>*/}
            <div className={styles.notes_list_item_form}>
              <form
                onSubmit={(e) => {
                  if (title) {
                    if (!isNew) {
                      props.onEdit(id, title);
                    } else {
                      setIsNew(false);
                      setPrevTitle(title);
                      props.onAdd(id, title);
                    }
                    editTitle(e).then(() => {});
                  } else {
                    // TODO консоль выдает 'Form submission canceled because the form is not connected'

                    props.onDelete(id, parentId, sort);
                  }
                }}
              >
                <input
                  //autoFocus
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  type="text"
                  value={title}
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
          />
        );
      })}
    </div>
  );
};

export default NotesListItem;
