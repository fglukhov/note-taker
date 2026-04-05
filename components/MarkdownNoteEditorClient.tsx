'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crepe } from '@milkdown/crepe';
import { callCommand } from '@milkdown/kit/utils';
import type { CmdKey } from '@milkdown/kit/core';
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

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: initialValue,
      features: {
        [Crepe.Feature.Cursor]: false,
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
      },
    });

    crepe.editor.use(codeLangDetectPlugin);

    crepe.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
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
}> = ({ value, onChange, autoFocus, placeholder }) => (
  <textarea
    className="md_source_editor"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    autoFocus={autoFocus}
    placeholder={placeholder}
    spellCheck={false}
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
        />
      )}
    </div>
  );
};

export default MarkdownNoteEditorClient;
