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
import { getFamily } from '@/lib/notesTree';
import styles from './index.module.scss';

if (typeof document !== 'undefined') {
  Modal.setAppElement('#__next');
}

/** Demo feed: same fields as Prisma `Note` used in the list + body (`content` / `hasContent`). */
const mockNotes: NotesListItemProps[] = [
  // === Travel project ===
  {
    id: '1',
    title: 'Family trip',
    content: '',
    sort: 0,
    parentId: 'root',
    collapsed: false,
    complete: false,
    hasContent: false,
    authorId: null,
  },
  {
    id: '2',
    title: 'Important this week: where we go and what to see',
    content: `**Shortlist**
- Rome / Florence — art & food
- Train between cities — book early

**Open questions**
- Exact dates with school holidays`,
    sort: 0,
    parentId: '1',
    collapsed: false,
    complete: false,
    priority: 2,
    hasContent: true,
    authorId: null,
  },
  {
    id: '3',
    title: 'Italy',
    content: `Been before — focus on **Tuscany** this time.

- [ ] Agriturismo options
- [ ] Car vs trains`,
    sort: 0,
    parentId: '2',
    collapsed: false,
    complete: true,
    hasContent: true,
    authorId: null,
  },
  {
    id: '4',
    title: 'Greece — only if we have time, no rush',
    content: '',
    sort: 1,
    parentId: '2',
    collapsed: false,
    complete: false,
    priority: 3,
    hasContent: false,
    authorId: null,
  },
  {
    id: '5',
    title: 'Booking',
    content: '',
    sort: 1,
    parentId: '1',
    collapsed: false,
    complete: false,
    isBold: true,
    hasContent: false,
    authorId: null,
  },
  {
    id: '6',
    title: 'Urgent: flights — fares are climbing',
    content: `Tracked on Google Flights — **+12%** vs last week on our dates.

Airline A: flexible fare still OK.
Airline B: basic only — skip.`,
    sort: 0,
    parentId: '5',
    collapsed: false,
    complete: false,
    priority: 1,
    hasContent: true,
    authorId: null,
  },
  {
    id: '7',
    title: 'Hotels — options and links are in the note',
    content: `| Area | Link | Rough € |
|------|------|--------|
| Center | (demo) | 120–180 |
| Near station | (demo) | 90–130 |

Free cancellation until 48h — prioritize.`,
    sort: 1,
    parentId: '5',
    collapsed: false,
    complete: false,
    hasContent: true,
    authorId: null,
  },

  // === Work ===
  {
    id: '8',
    title: 'Important: internal tooling — sync with the team',
    content: `### Next sync
- Pain: deploy times
- Proposal: one shared CLI wrapper

_No decisions — collect feedback first._`,
    sort: 1,
    parentId: 'root',
    collapsed: true,
    complete: false,
    priority: 2,
    isBold: true,
    hasContent: true,
    authorId: null,
  },
  {
    id: '9',
    title: 'CI/CD pipeline refresh',
    content: `Stages: **build → test → deploy**

- Add cache for deps
- Parallelize slow suite (split by folder)

Branch: \`chore/ci-speed\` (demo)`,
    sort: 0,
    parentId: '8',
    collapsed: false,
    complete: false,
    hasContent: true,
    authorId: null,
  },
  {
    id: '10',
    title: 'Monitoring — can wait until after the release',
    content: '',
    sort: 1,
    parentId: '8',
    collapsed: false,
    complete: false,
    priority: 3,
    hasContent: false,
    authorId: null,
  },
  {
    id: '11',
    title: 'Urgent: alert thresholds — prod is on fire',
    content: `**Symptom:** p95 latency + error spike on checkout API.

**Hypothesis:** DB pool exhausted — bump max + add timeout alert.

**Action:** hotfix thresholds tonight; proper fix tomorrow.`,
    sort: 0,
    parentId: '10',
    collapsed: false,
    complete: true,
    priority: 1,
    isBold: true,
    hasContent: true,
    authorId: null,
  },
  {
    id: '12',
    title: 'Log aggregation',
    content: `Stack: **Vector** → S3 → Athena for ad-hoc.

On-call runbook: wiki/demo-link (placeholder).`,
    sort: 1,
    parentId: '10',
    collapsed: false,
    complete: false,
    hasContent: true,
    authorId: null,
  },

  // === Reading ===
  {
    id: '13',
    title: 'Reading list',
    content: '',
    sort: 2,
    parentId: 'root',
    collapsed: false,
    complete: false,
    isBold: true,
    hasContent: false,
    authorId: null,
  },
  {
    id: '14',
    title: 'Fiction',
    content: '',
    sort: 0,
    parentId: '13',
    collapsed: false,
    complete: false,
    isBold: true,
    hasContent: false,
    authorId: null,
  },
  {
    id: '15',
    title: '1984 — finish by the weekend',
    content: `Part 1 done. Part 2 start after Ch. 5.

Themes to track: **surveillance**, language, truth.

Quote to revisit: *Who controls the past...*`,
    sort: 0,
    parentId: '14',
    collapsed: false,
    complete: true,
    priority: 2,
    hasContent: true,
    authorId: null,
  },
  {
    id: '16',
    title: 'The Hobbit',
    content: '',
    sort: 1,
    parentId: '14',
    collapsed: false,
    complete: false,
    isBold: true,
    hasContent: false,
    authorId: null,
  },
  {
    id: '17',
    title: 'Non-fiction',
    content: '',
    sort: 1,
    parentId: '13',
    collapsed: true,
    complete: false,
    hasContent: false,
    authorId: null,
  },
  {
    id: '18',
    title: 'Sapiens — someday, no deadline',
    content: `Skimmed intro — full read when travel planning settles.

Interesting bit: cognitive revolution vs fiction — ties to planning doc.`,
    sort: 0,
    parentId: '17',
    collapsed: false,
    complete: false,
    priority: 3,
    isBold: true,
    hasContent: true,
    authorId: null,
  },
];

const DEMO_NOTE_STORAGE_PREFIX = 'demo-note:';
const DEMO_DELETED_IDS_KEY = 'demo-deleted-note-ids';

function readDemoDeletedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DEMO_DELETED_IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeDemoDeletedIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_DELETED_IDS_KEY, JSON.stringify(ids));
}

function readDemoNoteOverride(noteId: string): {
  title?: string;
  content?: string;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEMO_NOTE_STORAGE_PREFIX + noteId);
    if (!raw) return null;
    return JSON.parse(raw) as { title?: string; content?: string };
  } catch {
    return null;
  }
}

function writeDemoNoteOverride(
  noteId: string,
  title: string,
  content: string,
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    DEMO_NOTE_STORAGE_PREFIX + noteId,
    JSON.stringify({ title, content }),
  );
}

function getDemoNotePayload(noteId: string): {
  id: string;
  title: string;
  content: string;
  hasContent: boolean;
  authorName: string;
  authorEmail: string | null;
} | null {
  if (readDemoDeletedIds().includes(noteId)) return null;
  const row = mockNotes.find((n) => n.id === noteId);
  if (!row) return null;
  let title = row.title;
  let content = row.content ?? '';
  const o = readDemoNoteOverride(noteId);
  if (o) {
    if (typeof o.title === 'string') title = o.title;
    if (typeof o.content === 'string') content = o.content;
  }
  const hasContent = content.trim().length > 0;
  return {
    id: row.id,
    title,
    content,
    hasContent,
    authorName: '',
    authorEmail: null,
  };
}

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

  const [demoDeletedIds, setDemoDeletedIds] = useState<string[]>([]);

  useEffect(() => {
    queueMicrotask(() => setDemoDeletedIds(readDemoDeletedIds()));
  }, []);

  const demoFeed = useMemo(
    () => mockNotes.filter((n) => !demoDeletedIds.includes(n.id)),
    [demoDeletedIds],
  );

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

  /** Demo behaves like an owned note: same editor, auto-focus, same actions. */
  const canEditNoteLikeOwner =
    !userHasValidSession || (userHasValidSession && noteBelongsToUser);

  const [isEdit, setIsEdit] = useState(false);
  const [didAutoEnterEdit, setDidAutoEnterEdit] = useState(false);
  const shouldAutoEnterEdit = canEditNoteLikeOwner && !didAutoEnterEdit;
  const isEditUI = isEdit || shouldAutoEnterEdit;

  const [isTitleInputOpen, setIsTitleInputOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  const [feedSyncFromModal, setFeedSyncFromModal] = useState<{
    rev: number;
    noteId: string;
    hasContent: boolean;
    title?: string;
  } | null>(null);

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

    if (!props.session) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        const data = getDemoNotePayload(noteIdFromQuery);
        if (!data) {
          setNoteLoadError('Note not found');
          return;
        }
        setNote(data);
        setLoadedNoteId(data.id);
        setDraftTitle(data.title ?? '');
        setDraftContent(data.content ?? '');
        setIsEdit(false);
        setDidAutoEnterEdit(false);
        setIsTitleInputOpen(false);
      });
      return () => {
        cancelled = true;
      };
    }

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
  }, [noteIdFromQuery, router, isRouterReady, props.session]);

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

    if (!props.session) {
      writeDemoNoteOverride(note.id, body.title, body.content);
      const hasContent = body.content.length > 0;
      setNote((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          title: body.title,
          content: body.content,
          hasContent,
        };
      });
      setFeedSyncFromModal({
        rev: Date.now(),
        noteId: note.id,
        hasContent,
        title: body.title,
      });
      return {
        title: body.title,
        content: body.content,
        hasContent,
      };
    }

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

    setFeedSyncFromModal({
      rev: Date.now(),
      noteId: note.id,
      hasContent: Boolean(updated.hasContent),
      ...(typeof updated.title === 'string' ? { title: updated.title } : {}),
    });

    return updated;
  };

  const saveAndExit = () => {
    const canPersistOnClose = isEditUI && canEditNoteLikeOwner;

    if (typeof window !== 'undefined' && note?.id) {
      sessionStorage.setItem('notes:last-focus-id', String(note.id));
    }

    if (!canPersistOnClose) {
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
    if (!props.session) {
      if (typeof window !== 'undefined') {
        const toRemove = getFamily(id, mockNotes).map((n) => n.id);
        const next = Array.from(
          new Set([...readDemoDeletedIds(), ...toRemove]),
        );
        writeDemoDeletedIds(next);
        setDemoDeletedIds(next);
        for (const rid of toRemove) {
          localStorage.removeItem(DEMO_NOTE_STORAGE_PREFIX + rid);
        }
      }
      router.push('/');
      return;
    }
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

            <NotesList
              feed={props.session ? props.feed : demoFeed}
              feedSyncFromModal={feedSyncFromModal}
            />
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
                    {canEditNoteLikeOwner && (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btn_ghost}`}
                        onClick={handleCancelEdit}
                      >
                        Cancel edit
                      </button>
                    )}

                    {canEditNoteLikeOwner && (
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
              <ReactMarkdown>{note?.content ?? ''}</ReactMarkdown>
            )}

            {!isEditUI && (
              <div className={styles.actions_bar}>
                <div className={styles.actions_bar_left}>
                  {canEditNoteLikeOwner && (
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
                  {canEditNoteLikeOwner && (
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
