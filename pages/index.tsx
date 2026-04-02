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
        className="noteModal"
        overlayClassName="noteModalOverlay"
      >
        {!isNoteReady ? (
          <div className="modalLoading">
            {noteLoadError ? `Error: ${noteLoadError}` : 'Loading...'}
          </div>
        ) : (
          <div className="modalInner">
            <div className="modalHeader">
              {isEditUI ? (
                isTitleInputOpen ? (
                  <input
                    ref={titleInputRef}
                    className="modalTitleInput"
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Title"
                    type="text"
                    value={draftTitle}
                    onBlur={() => setIsTitleInputOpen(false)}
                  />
                ) : (
                  <h2
                    className="modalTitle modalTitleClickable"
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
                <h2 className="modalTitle">{note?.title}</h2>
              )}
              <button
                type="button"
                className="closeButton"
                onClick={saveAndExit}
                aria-label="Close"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {isEditUI ? (
              <form onSubmit={editData} className="editorForm">
                <MarkdownNoteEditor
                  value={draftContent}
                  onChange={(val) => setDraftContent(val)}
                  placeholder="Content"
                  autoFocus
                />
                <div className="editFooter">
                  <div className="editFooterLeft">
                    {userHasValidSession && noteBelongsToUser && (
                      <button
                        type="button"
                        className="btn btnGhost"
                        onClick={handleCancelEdit}
                      >
                        Cancel edit
                      </button>
                    )}

                    {userHasValidSession && noteBelongsToUser && (
                      <button
                        type="button"
                        className="btn btnDanger"
                        onClick={() => void deleteNote(note.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  <div className="editFooterRight">
                    <input
                      disabled={!draftTitle}
                      type="submit"
                      value="Save"
                      className="btn btnPrimary"
                    />
                  </div>
                </div>
              </form>
            ) : (
              <>
                <p className="authorLine">
                  By {note?.authorName || 'Unknown author'}
                </p>
                <ReactMarkdown>{note?.content ?? ''}</ReactMarkdown>
              </>
            )}

            {!isEditUI && (
              <div className="actionsBar">
                <div className="actionsBarLeft">
                  {userHasValidSession && noteBelongsToUser && (
                    <button
                      type="button"
                      className="btn btnSecondary"
                      onClick={() => {
                        setIsEdit(true);
                        setIsTitleInputOpen(false);
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>

                <div className="actionsBarRight">
                  {userHasValidSession && noteBelongsToUser && (
                    <button
                      type="button"
                      className="btn btnDanger"
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

        <style jsx>{`
          .modalLoading {
            padding: 24px;
            color: rgba(0, 0, 0, 0.65);
            font-weight: 600;
          }

          :global(.noteModalOverlay) {
            background: rgba(0, 0, 0, 0.35);
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
          }

          :global(.noteModal) {
            background: #fff;
            width: min(760px, 100%);
            max-height: 90vh;
            overflow: auto;
            border-radius: 14px;
            padding: 1.5rem 1.5rem;
            outline: none;
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18);
            color: rgba(0, 0, 0, 0.9);
          }

          .modalHeader {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 1rem;
          }

          .modalTitle {
            font-size: 1.25rem;
            font-weight: 700;
            margin: 0;
            line-height: 1.2;
            padding-right: 0.5rem;
          }

          .closeButton {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            border-radius: 10px;
            border: 1px solid rgba(0, 0, 0, 0.12);
            background: transparent;
            color: rgba(0, 0, 0, 0.75);
            cursor: pointer;
            transition:
              background 120ms ease,
              border-color 120ms ease,
              transform 120ms ease;
            flex: 0 0 auto;
          }

          .closeButton:hover {
            background: rgba(0, 0, 0, 0.04);
            border-color: rgba(0, 0, 0, 0.2);
            transform: translateY(-1px);
          }

          .authorLine {
            margin: 0 0 0.75rem 0;
            color: rgba(0, 0, 0, 0.65);
          }

          .modalInner {
            font-family:
              -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
              Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
              'Segoe UI Symbol';
          }

          .modalInner :global(h1),
          .modalInner :global(h2),
          .modalInner :global(h3),
          .modalInner :global(h4),
          .modalInner :global(h5),
          .modalInner :global(h6) {
            text-decoration: none;
          }

          .modalTitleInput {
            width: 100%;
            font-size: 1.05rem;
            font-weight: 700;
            padding: 0.75rem 0.9rem;
            border-radius: 10px;
            border: 0.125rem solid rgba(0, 0, 0, 0.2);
            outline: none;
            background: rgba(255, 255, 255, 1);
          }

          .modalTitleClickable {
            cursor: pointer;
            user-select: none;
          }

          .modalTitleClickable:hover {
            text-decoration: underline;
          }

          .editorForm {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          textarea {
            width: 100%;
            padding: 0.5rem;
            margin: 0.5rem 0;
            border-radius: 0.25rem;
            border: 0.125rem solid rgba(0, 0, 0, 0.2);
          }

          .actionsBar {
            margin-top: 1.25rem;
            display: flex;
            gap: 0.75rem;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }

          .actionsBarLeft,
          .actionsBarRight {
            display: flex;
            gap: 0.75rem;
            align-items: center;
          }

          .editFooter {
            display: flex;
            gap: 0.75rem;
            align-items: center;
            justify-content: space-between;
            margin-top: 0.25rem;
          }

          .editFooterLeft,
          .editFooterRight {
            display: flex;
            gap: 0.75rem;
            align-items: center;
          }

          .btn {
            border: 0;
            border-radius: 12px;
            padding: 0.85rem 1.15rem;
            font-weight: 600;
            cursor: pointer;
            transition:
              transform 120ms ease,
              filter 120ms ease,
              background 120ms ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
            width: auto;
          }

          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }

          .btnPrimary {
            background: #0070f3;
            color: #fff;
          }

          .btnPrimary:hover {
            filter: brightness(0.97);
            transform: translateY(-1px);
          }

          .btnSecondary {
            background: rgba(0, 0, 0, 0.06);
            color: rgba(0, 0, 0, 0.85);
            border: 1px solid rgba(0, 0, 0, 0.08);
          }

          .btnSecondary:hover {
            background: rgba(0, 0, 0, 0.08);
            transform: translateY(-1px);
          }

          .btnGhost {
            background: transparent;
            color: rgba(0, 0, 0, 0.85);
            border: 1px solid rgba(0, 0, 0, 0.14);
          }

          .btnGhost:hover {
            background: rgba(0, 0, 0, 0.04);
            transform: translateY(-1px);
          }

          .btnDanger {
            background: #e11d48;
            color: #fff;
          }

          .btnDanger:hover {
            filter: brightness(0.98);
            transform: translateY(-1px);
          }
        `}</style>
      </Modal>
    </Layout>
  );
};

export default Main;
