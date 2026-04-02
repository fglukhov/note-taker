// pages/p/[id].tsx

import React, { useRef, useState } from 'react';
import Modal from 'react-modal';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
//import { GetStaticProps } from 'next';
import ReactMarkdown from 'react-markdown';
import Router from 'next/router';
import Layout from '@/components/Layout';
import { NoteProps } from '@/components/Note';
import { useSession } from 'next-auth/react';
import prisma from '@/lib/prisma';
import MarkdownNoteEditor from '@/components/MarkdownNoteEditor';
import { X } from 'react-feather';
//import {getAllNotesIds} from "@/lib/notes";

Modal.setAppElement('#__next');

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const note = await prisma.note.findUnique({
    where: {
      id: String(params?.id),
    },
    include: {
      author: {
        select: { name: true, email: true },
      },
    },
  });

  return {
    props: note,
  };
};

// export async function getStaticPaths() {
// 	const paths = await getAllNotesIds();
// 	return {
// 		paths,
// 		fallback: false,
// 	};
// }

async function deleteNote(id: string): Promise<void> {
  await fetch(`/api/post/${id}`, {
    method: 'DELETE',
  });
  Router.push('/');
}

const NoteExpanded: React.FC<NoteProps> = (props) => {
  const { data: session, status } = useSession();

  const router = useRouter();

  useEffect(() => {
    router.prefetch('/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [title, setTitle] = useState(props.title);
  const [content, setContent] = useState(props.content);
  const draftKey = `note-draft:${props.id}`;

  const [isEdit, setIsEdit] = useState(false);

  const [modalIsOpen, setIsOpen] = React.useState(true);

  // In edit mode the header title is rendered as text until user clicks it.
  const [isTitleInputOpen, setIsTitleInputOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const normalizeContent = (value: string | null | undefined): string => {
    const raw = value ?? '';
    return raw.trim().length > 0 ? raw : '';
  };

  const persistDraft = (draftTitle: string, draftContent: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      draftKey,
      JSON.stringify({ title: draftTitle, content: draftContent }),
    );
  };

  const clearDraft = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(draftKey);
  };

  const saveNote = async (draftTitle: string, draftContent: string) => {
    const body = { title: draftTitle, content: normalizeContent(draftContent) };
    await fetch(`/api/edit/${props.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const saveAndExit = () => {
    const canSave = isEditUI && userHasValidSession && noteBelongsToUser;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('notes:last-focus-id', String(props.id));
    }

    if (!canSave) {
      router.push('/');
      return;
    }

    const draftTitle = title;
    const draftContent = content ?? '';
    persistDraft(draftTitle, draftContent);

    // Optimistic close: navigate immediately, save in background.
    router.push('/');
    void saveNote(draftTitle, draftContent)
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
      const body = { title, content: normalizeContent(content) };
      await saveNote(body.title, body.content);
      clearDraft();
      setIsEdit(false);
      setIsTitleInputOpen(false);
      //await Router.push('/drafts');
    } catch (error) {
      console.error(error);
    }
  };

  const [didAutoEnterEdit, setDidAutoEnterEdit] = useState(false);

  const userHasValidSession = Boolean(session);
  const noteBelongsToUser = session?.user?.email === props.author?.email;

  const shouldAutoEnterEdit =
    status !== 'loading' &&
    userHasValidSession &&
    noteBelongsToUser &&
    !didAutoEnterEdit;

  const isEditUI = isEdit || shouldAutoEnterEdit;

  useEffect(() => {
    if (shouldAutoEnterEdit) {
      setIsEdit(true);
      setIsTitleInputOpen(false);
      setDidAutoEnterEdit(true);
    }
  }, [shouldAutoEnterEdit]);

  useEffect(() => {
    if (!isEditUI) {
      setIsTitleInputOpen(false);
      return;
    }

    if (isTitleInputOpen) {
      // Defer focus until input is actually in the DOM.
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
      });
    }
  }, [isEditUI, isTitleInputOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawDraft = localStorage.getItem(draftKey);
    if (!rawDraft) return;

    try {
      const parsed = JSON.parse(rawDraft) as {
        title?: string;
        content?: string;
      };
      if (typeof parsed.title === 'string') {
        setTitle(parsed.title);
      }
      if (typeof parsed.content === 'string') {
        setContent(parsed.content);
      }
    } catch {
      // Ignore malformed draft data.
    }
  }, [draftKey]);

  if (status === 'loading') {
    return <div>Authenticating ...</div>;
  }

  return (
    <Layout>
      <Modal
        className="noteModal"
        overlayClassName="noteModalOverlay"
        isOpen={modalIsOpen} // The modal should always be shown on page load, it is the 'page'
        onRequestClose={saveAndExit}
        contentLabel={title}
        shouldFocusAfterRender={false}
      >
        <div className="modalHeader">
          {isEditUI ? (
            isTitleInputOpen ? (
              <input
                ref={titleInputRef}
                className="modalTitleInput"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                type="text"
                value={title}
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
                {title}
              </h2>
            )
          ) : (
            <h2 className="modalTitle">{title}</h2>
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
              value={content}
              onChange={(val) => setContent(val)}
              placeholder="Content"
              autoFocus
            />
            <div className="editFooter">
              <div className="editFooterLeft">
                {userHasValidSession && noteBelongsToUser && (
                  <button
                    type="button"
                    className="btn btnGhost"
                    onClick={() => {
                      setIsEdit(false);
                      setIsTitleInputOpen(false);
                      setDidAutoEnterEdit(true);
                    }}
                  >
                    Cancel edit
                  </button>
                )}

                {userHasValidSession && noteBelongsToUser && (
                  <button
                    type="button"
                    className="btn btnDanger"
                    onClick={() => deleteNote(props.id)}
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="editFooterRight">
                <input
                  disabled={!title}
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
              By {props?.author?.name || 'Unknown author'}
            </p>
            <ReactMarkdown>{content}</ReactMarkdown>
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
                  onClick={() => deleteNote(props.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
      <style jsx>{`
        .page {
          background: var(--geist-background);
          padding: 2rem;
        }

        :global(.noteModalOverlay) {
          background: rgba(0, 0, 0, 0.35);
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

        .editorForm {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .authorLine {
          margin: 0 0 0.75rem 0;
          color: rgba(0, 0, 0, 0.65);
        }

        .actionsBar {
          margin-top: 1.25rem;
          display: flex;
          gap: 0.75rem;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }

        .actionsRow {
          display: flex;
          justify-content: flex-start;
        }

        .actionsBarLeft {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

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

        .editFooterLeft {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .editFooterRight {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        textarea {
          width: 100%;
          padding: 0.5rem;
          margin: 0.5rem 0;
          border-radius: 0.25rem;
          border: 0.125rem solid rgba(0, 0, 0, 0.2);
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

        .modalTitleClickable {
          cursor: pointer;
          user-select: none;
        }

        .modalTitleClickable:hover {
          text-decoration: underline;
        }
      `}</style>
    </Layout>
  );
};

export default NoteExpanded;
