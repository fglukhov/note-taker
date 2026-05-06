'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crepe } from '@milkdown/crepe';
import { callCommand } from '@milkdown/kit/utils';
import type { CmdKey } from '@milkdown/kit/core';
import { editorViewCtx } from '@milkdown/kit/core';
import { uploadConfig } from '@milkdown/kit/plugin/upload';
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { languages as allLanguages } from '@codemirror/language-data';

import { githubLight } from '@uiw/codemirror-theme-github';
import { codeLangDetectPlugin } from '@/lib/codeLangDetect';
import { uploadImage } from '@/lib/uploadImage';
import { uploadImageFromUrl } from '@/lib/uploadImageFromUrl';

type Props = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
};

/* ── WYSIWYG Crepe editor ─────────────────────────────────────────────── */
const CrepeEditor: React.FC<{
  initialValue: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  onReady: (crepe: Crepe) => void;
}> = ({ initialValue, onChange, autoFocus, placeholder, onReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!containerRef.current) return;
    const pendingUploadSrc = new Set<string>();
    const processedSrc = new Set<string>();

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: initialValue,
      features: {
        [Crepe.Feature.Cursor]: false,
        [Crepe.Feature.BlockEdit]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: placeholder ?? 'Write something…',
          mode: 'block',
        },
        [Crepe.Feature.CodeMirror]: {
          languages: allLanguages,
          theme: githubLight,
        },
        [Crepe.Feature.ImageBlock]: {
          onUpload: async (file: File) => {
            const result = await uploadImage(file);
            return result.url;
          },
        },
      },
    });

    crepe.editor.use(codeLangDetectPlugin);
    crepe.editor.config((ctx) => {
      ctx.update(uploadConfig.key, (prev) => ({
        ...prev,
        enableHtmlFileUploader: true,
      }));
    });

    const promoteTempImagesToR2 = () => {
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const imageNodeTypes = [
          view.state.schema.nodes['image-block'],
          view.state.schema.nodes['image-inline'],
          view.state.schema.nodes.image,
        ].filter(Boolean);
        if (!imageNodeTypes.length) return;

        const candidates: Array<{ pos: number; src: string }> = [];
        view.state.doc.descendants((node, pos) => {
          if (!imageNodeTypes.includes(node.type)) return true;
          const src = typeof node.attrs.src === 'string' ? node.attrs.src : '';
          if (!src) return true;
          const isTempSrc = src.startsWith('blob:') || src.startsWith('data:');
          const isRemoteSrc =
            src.startsWith('http://') || src.startsWith('https://');
          const isAlreadyOwned =
            src.includes('/api/images/file/') ||
            src.includes('.r2.dev/') ||
            src.includes('.r2.cloudflarestorage.com/');
          if ((!isTempSrc && !isRemoteSrc) || isAlreadyOwned) return true;
          if (pendingUploadSrc.has(src) || processedSrc.has(src)) return true;
          candidates.push({ pos, src });
          return true;
        });

        for (const { pos, src } of candidates) {
          pendingUploadSrc.add(src);
          const isTempSrc = src.startsWith('blob:') || src.startsWith('data:');
          const uploadPromise = isTempSrc
            ? fetch(src)
                .then((response) => response.blob())
                .then((blob) => {
                  const file = new File([blob], 'pasted-image', {
                    type: blob.type || 'image/png',
                  });
                  return uploadImage(file);
                })
            : uploadImageFromUrl(src);

          uploadPromise
            .then((result) => {
              const currentNode = view.state.doc.nodeAt(pos);
              if (!currentNode || !imageNodeTypes.includes(currentNode.type))
                return;
              if (currentNode.attrs.src !== src) return;
              const tr = view.state.tr.setNodeMarkup(pos, undefined, {
                ...currentNode.attrs,
                src: result.url,
              });
              view.dispatch(tr);
              processedSrc.add(result.url);
            })
            .catch((error) => {
              console.error('Temporary image promotion failed:', error);
            })
            .finally(() => {
              pendingUploadSrc.delete(src);
              processedSrc.add(src);
              if (isTempSrc && src.startsWith('blob:')) {
                URL.revokeObjectURL(src);
              }
            });
        }
      });
    };

    crepe.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        promoteTempImagesToR2();
        onChangeRef.current(markdown);
      });
    });

    crepe.create().then(() => {
      onReadyRef.current(crepe);
      if (autoFocus) {
        containerRef.current
          ?.querySelector<HTMLElement>('.ProseMirror')
          ?.focus();
      }
    });

    return () => {
      crepe.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="crepe_container" />;
};

/* ── Source (plain textarea) editor ──────────────────────────────────── */
const SourceEditor: React.FC<{
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
}> = ({ value, onChange, autoFocus, placeholder, onPaste }) => (
  <textarea
    className="md_source_editor"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    autoFocus={autoFocus}
    placeholder={placeholder}
    spellCheck={false}
    onPaste={onPaste}
  />
);

/* ── Formatting toolbar ───────────────────────────────────────────────── */
type ToolbarAction =
  | { type: 'heading'; level: number; label: string; title: string }
  | {
      type: 'mark';
      label: string;
      title: string;
      cmd: { key: CmdKey<unknown> };
    }
  | {
      type: 'block';
      label: string;
      title: string;
      cmd: { key: CmdKey<unknown> };
    }
  | { type: 'separator' };

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { type: 'heading', level: 1, label: 'H1', title: 'Heading 1' },
  { type: 'heading', level: 2, label: 'H2', title: 'Heading 2' },
  { type: 'heading', level: 3, label: 'H3', title: 'Heading 3' },
  { type: 'separator' },
  { type: 'mark', label: 'B', title: 'Bold', cmd: toggleStrongCommand },
  { type: 'mark', label: 'I', title: 'Italic', cmd: toggleEmphasisCommand },
  {
    type: 'mark',
    label: '<>',
    title: 'Inline code',
    cmd: toggleInlineCodeCommand,
  },
  { type: 'separator' },
  {
    type: 'block',
    label: '❝',
    title: 'Blockquote',
    cmd: wrapInBlockquoteCommand,
  },
  {
    type: 'block',
    label: '•',
    title: 'Bullet list',
    cmd: wrapInBulletListCommand,
  },
  {
    type: 'block',
    label: '1.',
    title: 'Ordered list',
    cmd: wrapInOrderedListCommand,
  },
];

const FormattingToolbar: React.FC<{ crepe: Crepe | null }> = ({ crepe }) => {
  const exec = useCallback(
    (action: ToolbarAction) => {
      if (!crepe || action.type === 'separator') return;
      if (action.type === 'heading') {
        crepe.editor.action(
          callCommand(wrapInHeadingCommand.key, action.level),
        );
      } else {
        crepe.editor.action(callCommand(action.cmd.key));
      }
    },
    [crepe],
  );

  return (
    <div className="md_fmt_toolbar">
      {TOOLBAR_ACTIONS.map((action, i) => {
        if (action.type === 'separator') {
          return <span key={i} className="md_fmt_sep" aria-hidden />;
        }
        const isHeading = action.type === 'heading';
        return (
          <button
            key={i}
            type="button"
            className={`md_fmt_btn${isHeading ? ' md_fmt_btn--heading' : ''}`}
            title={action.title}
            disabled={!crepe}
            onMouseDown={(e) => {
              // prevent blur before the command fires
              e.preventDefault();
              exec(action);
            }}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
};

/* ── Main export ──────────────────────────────────────────────────────── */
const MarkdownNoteEditorClient: React.FC<Props> = ({
  value,
  onChange,
  autoFocus,
  placeholder,
}) => {
  const [mode, setMode] = useState<'wysiwyg' | 'source'>('wysiwyg');
  const [wysiwygKey, setWysiwygKey] = useState(0);
  const [crepe, setCrepe] = useState<Crepe | null>(null);

  const handleToggle = useCallback(() => {
    setMode((m) => {
      if (m === 'source') {
        setWysiwygKey((k) => k + 1);
        setCrepe(null);
      }
      return m === 'wysiwyg' ? 'source' : 'wysiwyg';
    });
  }, []);

  const handleSourcePaste = useCallback<
    React.ClipboardEventHandler<HTMLTextAreaElement>
  >(
    async (e) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;

      e.preventDefault();

      const textarea = e.currentTarget;
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? start;

      try {
        const result = await uploadImage(file);
        const nextValue =
          value.slice(0, start) + result.markdown + value.slice(end);
        onChange(nextValue);

        requestAnimationFrame(() => {
          const pos = start + result.markdown.length;
          textarea.setSelectionRange(pos, pos);
        });
      } catch (error) {
        console.error('Image upload failed:', error);
      }
    },
    [onChange, value],
  );

  return (
    <div className="md_editor_wrap">
      <div className="md_editor_toolbar">
        {mode === 'wysiwyg' && <FormattingToolbar crepe={crepe} />}
        <button
          type="button"
          className="md_toggle_btn"
          onClick={handleToggle}
          title={
            mode === 'wysiwyg' ? 'Switch to source' : 'Switch to visual editor'
          }
        >
          {mode === 'wysiwyg' ? 'Source' : 'Visual'}
        </button>
      </div>

      {mode === 'wysiwyg' ? (
        <CrepeEditor
          key={wysiwygKey}
          initialValue={value}
          onChange={onChange}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onReady={setCrepe}
        />
      ) : (
        <SourceEditor
          value={value}
          onChange={onChange}
          autoFocus
          placeholder={placeholder}
          onPaste={handleSourcePaste}
        />
      )}
    </div>
  );
};

export default MarkdownNoteEditorClient;
