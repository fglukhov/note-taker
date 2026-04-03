import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import Layout from '@/components/Layout';
import NotesList from '@/components/NotesList';
import { NotesListItemProps } from '@/components/NotesListItem';
import prisma from '@/lib/prisma';
import { getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Modal from 'react-modal';
import ReactMarkdown from 'react-markdown';
import { X } from 'react-feather';
import MarkdownNoteEditor from '@/components/MarkdownNoteEditor';
import styles from './index.module.scss';

if (typeof document !== 'undefined') {
  Modal.setAppElement('#__next');
}

const mockNotes: NotesListItemProps[] = [
  // === Travel Project ===
  {
    id: '1',
    title: 'Organize Family Trip',
    sort: 0,
    parentId: 'root',
    collapsed: false,
    complete: false,
  },
  {
    id: '2',
    title: 'Destination Research',
    sort: 0,
    parentId: '1',
    collapsed: false,
    complete: true,
  },
  {
    id: '3',
    title: 'Italy',
    sort: 0,
    parentId: '2',
    collapsed: false,
    complete: true,
  },
  {
    id: '4',
    title: 'Greece',
    sort: 1,
    parentId: '2',
    collapsed: false,
    complete: false,
  },
  {
    id: '5',
    title: 'Booking',
    sort: 1,
    parentId: '1',
    collapsed: false,
    complete: false,
  },
  {
    id: '6',
    title: 'Flights',
    sort: 0,
    parentId: '5',
    collapsed: false,
    complete: false,
  },
  {
    id: '7',
    title: 'Hotels',
    sort: 1,
    parentId: '5',
    collapsed: false,
    complete: false,
  },

  // === Work Notes ===
  {
    id: '8',
    title: 'Internal Tooling Improvements',
    sort: 1,
    parentId: 'root',
    collapsed: true,
    complete: false,
  },
  {
    id: '9',
    title: 'CI/CD pipeline update',
    sort: 0,
    parentId: '8',
    collapsed: false,
    complete: false,
  },
  {
    id: '10',
    title: 'Monitoring',
    sort: 1,
    parentId: '8',
    collapsed: false,
    complete: false,
  },
  {
    id: '11',
    title: 'Alerting thresholds',
    sort: 0,
    parentId: '10',
    collapsed: false,
    complete: true,
  },
  {
    id: '12',
    title: 'Log aggregation',
    sort: 1,
    parentId: '10',
    collapsed: false,
    complete: false,
  },

  // === Reading Tracker ===
  {
    id: '13',
    title: 'Reading Tracker',
    sort: 2,
    parentId: 'root',
    collapsed: false,
    complete: false,
  },
  {
    id: '14',
    title: 'Fiction',
    sort: 0,
    parentId: '13',
    collapsed: false,
    complete: false,
  },
  {
    id: '15',
    title: '1984 by George Orwell',
    sort: 0,
    parentId: '14',
    collapsed: false,
    complete: true,
  },
  {
    id: '16',
    title: 'The Hobbit',
    sort: 1,
    parentId: '14',
    collapsed: false,
    complete: false,
  },
  {
    id: '17',
    title: 'Non-fiction',
    sort: 1,
    parentId: '13',
    collapsed: true,
    complete: false,
  },
  {
    id: '18',
    title: 'Sapiens by Yuval Noah Harari',
    sort: 0,
    parentId: '17',
    collapsed: false,
    complete: false,
  },
];

// index.tsx
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  let feed = [];

  if (session) {
    feed = await prisma.note.findMany({
      orderBy: {
        sort: 'asc',
      },
      where: {
        // @ts-ignore
        authorId: session.user.id,
      },
    });
  }

  return {
    props: { feed, session },
  };
};

type Props = {
  feed: NotesListItemProps[];
  session: any;
};

const Main: React.FC<Props> = (props) => {
  const router = useRouter();

  const noteIdFromQuery = useMemo(() => {
    const raw = router.query.note;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return null;
  }, [router.query.note]);

  const isRouterReady = router.isReady;
  const isNoteModalOpenReady = isRouterReady && Boolean(noteIdFromQuery);

  const [note, setNote] = useState<{
    id: string;
    title: string;
    content: string;
    hasContent: boolean;
    authorName: string;
    authorEmail: string | null;
  } | null>(null);

  const [loadedNoteId, setLoadedNoteId] = useState<string | null>(null);
  const [noteLoadError, setNoteLoadError] = useState<string | null>(null);

  const isNoteReady = Boolean(note && loadedNoteId === noteIdFromQuery);

  const userHasValidSession = Boolean(props.session);
  const sessionEmail: string | undefined = props.session?.user?.email;
  const noteBelongsToUser = Boolean(
    sessionEmail && note?.authorEmail && sessionEmail === note.authorEmail,
  );

  const [isEdit, setIsEdit] = useState(false);
  const [didAutoEnterEdit, setDidAutoEnterEdit] = useState(false);
  const shouldAutoEnterEdit =
    userHasValidSession && noteBelongsToUser && !didAutoEnterEdit;
  const isEditUI = isEdit || shouldAutoEnterEdit;

  const [isTitleInputOpen, setIsTitleInputOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  // Modal needs appElement to be configured before first client render.

  useEffect(() => {
    if (!isRouterReady) return;
    if (!noteIdFromQuery) return;

    let cancelled = false;
    // Avoid synchronous state updates at the top of effect.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoadedNoteId(null);
      setNoteLoadError(null);
    });

    fetch(`/api/note/${noteIdFromQuery}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Failed to load note: ${r.status}`);
        }
        return (await r.json()) as {
          id: string;
          title: string;
          content: string;
          hasContent: boolean;
          authorName: string;
          authorEmail: string | null;
        };
      })
      .then((data) => {
        if (cancelled) return;
        setNote(data);
        setLoadedNoteId(data.id);
        setDraftTitle(data.title ?? '');
        setDraftContent(data.content ?? '');
        setIsEdit(false);
        setDidAutoEnterEdit(false);
        setIsTitleInputOpen(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setNoteLoadError(e?.message ?? 'Failed to load note');
      });

    return () => {
      cancelled = true;
    };
  }, [noteIdFromQuery, router, isRouterReady]);

  useEffect(() => {
    if (!shouldAutoEnterEdit) return;
    void Promise.resolve().then(() => {
      setIsEdit(true);
      setIsTitleInputOpen(false);
      setDidAutoEnterEdit(true);
    });
  }, [shouldAutoEnterEdit]);

  useEffect(() => {
    if (!isEditUI) {
      void Promise.resolve().then(() => setIsTitleInputOpen(false));
      return;
    }
    if (isTitleInputOpen) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
      });
    }
  }, [isEditUI, isTitleInputOpen]);

  const normalizeContent = (value: string | null | undefined): string => {
    const raw = value ?? '';
    return raw.trim().length > 0 ? raw : '';
  };

  const draftKey = note ? `note-draft:${note.id}` : null;

  const persistDraft = (
    draftTitleToPersist: string,
    draftContentToPersist: string,
  ) => {
    if (!draftKey) return;
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        title: draftTitleToPersist,
        content: draftContentToPersist,
      }),
    );
  };

  const clearDraft = () => {
    if (!draftKey) return;
    if (typeof window === 'undefined') return;
    localStorage.removeItem(draftKey);
  };

  const saveNote = async (
    draftTitleToSave: string,
    draftContentToSave: string,
  ) => {
    if (!note) return null;
    const body = {
      title: draftTitleToSave,
      content: normalizeContent(draftContentToSave),
    };
    const r = await fetch(`/api/edit/${note.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      throw new Error(`Failed to save note: ${r.status}`);
    }

    const updated = (await r.json()) as {
      title?: string;
      content?: string;
      hasContent?: boolean;
    };

    setNote((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        title: updated.title ?? prev.title,
        content: updated.content ?? prev.content,
        hasContent: Boolean(updated.hasContent),
      };
    });

    return updated;
  };

  const saveAndExit = () => {
    const canSave = isEditUI && userHasValidSession && noteBelongsToUser;

    if (typeof window !== 'undefined' && note?.id) {
      sessionStorage.setItem('notes:last-focus-id', String(note.id));
    }

    if (!canSave) {
      router.push('/');
      return;
    }

    if (!note) return;

    const draftTitleToPersist = draftTitle;
    const draftContentToPersist = draftContent ?? '';

    persistDraft(draftTitleToPersist, draftContentToPersist);

    // Optimistic close: navigate immediately, save in background.
    router.push('/');
    void saveNote(draftTitleToPersist, draftContentToPersist)
      .then(() => {
        clearDraft();
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const editData = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    try {
      const draftTitleToSave = draftTitle;
      const draftContentToSave = draftContent ?? '';
      await saveNote(draftTitleToSave, draftContentToSave);
      clearDraft();
      setIsEdit(false);
      setIsTitleInputOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteNote = async (id: string): Promise<void> => {
    await fetch(`/api/post/${id}`, {
      method: 'DELETE',
    });
    router.push('/');
  };

  const handleCancelEdit = () => {
    setIsEdit(false);
    setIsTitleInputOpen(false);
    setDidAutoEnterEdit(true);
  };

  useEffect(() => {
    if (!note || !draftKey) return;
    if (typeof window === 'undefined') return;

    const rawDraft = localStorage.getItem(draftKey);
    if (!rawDraft) return;

    try {
      const parsed = JSON.parse(rawDraft) as {
        title?: string;
        content?: string;
      };

      void Promise.resolve().then(() => {
        if (typeof parsed.title === 'string') {
          setDraftTitle(parsed.title);
        }
        if (typeof parsed.content === 'string') {
          setDraftContent(parsed.content);
        }
      });
    } catch {
      // Ignore malformed draft data.
    }
  }, [note, draftKey]);

  return (
    <Layout>
      <div className="page">
        <main>
          <div>
            <h1>{props.session ? 'Notes' : 'Demo'}</h1>

            <NotesList feed={props.session ? props.feed : mockNotes} />
          </div>
        </main>
      </div>

      <Modal
        isOpen={isNoteModalOpenReady}
        onRequestClose={saveAndExit}
        contentLabel={note?.title ?? 'Note'}
        shouldFocusAfterRender={false}
        ariaHideApp={false}
        shouldReturnFocusAfterClose={false}
        shouldCloseOnOverlayClick
        className={styles.note_modal}
        overlayClassName={styles.note_modal_overlay}
      >
        {!isNoteReady ? (
          <div className={styles.modal_loading}>
            {noteLoadError ? `Error: ${noteLoadError}` : 'Loading...'}
          </div>
        ) : (
          <div className={styles.modal_inner}>
            <div className={styles.modal_header}>
              {isEditUI ? (
                isTitleInputOpen ? (
                  <input
                    ref={titleInputRef}
                    className={styles.modal_title_input}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Title"
                    type="text"
                    value={draftTitle}
                    onBlur={() => setIsTitleInputOpen(false)}
                  />
                ) : (
                  <h2
                    className={`${styles.modal_title} ${styles.modal_title_clickable}`}
                    onClick={() => setIsTitleInputOpen(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setIsTitleInputOpen(true);
                      }
                    }}
                  >
                    {draftTitle}
                  </h2>
                )
              ) : (
                <h2 className={styles.modal_title}>{note?.title}</h2>
              )}
              <button
                type="button"
                className={styles.close_button}
                onClick={saveAndExit}
                aria-label="Close"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {isEditUI ? (
              <form onSubmit={editData} className={styles.editor_form}>
                <MarkdownNoteEditor
                  value={draftContent}
                  onChange={(val) => setDraftContent(val)}
                  placeholder="Content"
                  autoFocus
                />
                <div className={styles.edit_footer}>
                  <div className={styles.edit_footer_left}>
                    {userHasValidSession && noteBelongsToUser && (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btn_ghost}`}
                        onClick={handleCancelEdit}
                      >
                        Cancel edit
                      </button>
                    )}

                    {userHasValidSession && noteBelongsToUser && (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btn_danger}`}
                        onClick={() => void deleteNote(note.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  <div className={styles.edit_footer_right}>
                    <input
                      disabled={!draftTitle}
                      type="submit"
                      value="Save"
                      className={`${styles.btn} ${styles.btn_primary}`}
                    />
                  </div>
                </div>
              </form>
            ) : (
              <>
                <p className={styles.author_line}>
                  By {note?.authorName || 'Unknown author'}
                </p>
                <ReactMarkdown>{note?.content ?? ''}</ReactMarkdown>
              </>
            )}

            {!isEditUI && (
              <div className={styles.actions_bar}>
                <div className={styles.actions_bar_left}>
                  {userHasValidSession && noteBelongsToUser && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btn_secondary}`}
                      onClick={() => {
                        setIsEdit(true);
                        setIsTitleInputOpen(false);
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>

                <div className={styles.actions_bar_right}>
                  {userHasValidSession && noteBelongsToUser && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btn_danger}`}
                      onClick={() => void deleteNote(note.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default Main;
