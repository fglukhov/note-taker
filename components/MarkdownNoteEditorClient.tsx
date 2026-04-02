import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { minimalSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';

type MarkdownNoteEditorProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
};

const overlapsRange = (
  selectionFrom: number,
  selectionTo: number,
  from: number,
  to: number,
): boolean => {
  // Treat caret as a point.
  if (selectionFrom === selectionTo) {
    return selectionFrom >= from && selectionFrom <= to;
  }
  return selectionFrom < to && selectionTo > from;
};

class BulletWidget extends WidgetType {
  private readonly label: string;

  constructor(label: string) {
    super();
    this.label = label;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-md-bullet';
    span.textContent = this.label;
    return span;
  }

  eq(other: BulletWidget): boolean {
    return other.label === this.label;
  }
}

let lastDecorationsKey: string | null = null;
let lastDecorationsSet = Decoration.none;

const MarkdownDecorations = (
  doc: string,
  selectionFrom: number,
  selectionTo: number,
) => {
  const docLen = doc.length;
  // Small (fast) string hash to make the decoration cache sensitive to content.
  // This prevents stale `.cm-md-heading-first/last` styles when the doc changes.
  let docHash = 0;
  for (let i = 0; i < docLen; i++) {
    docHash = (docHash * 31 + doc.charCodeAt(i)) | 0;
  }
  const key = `${docLen}:${docHash >>> 0}:${selectionFrom}:${selectionTo}`;
  if (key === lastDecorationsKey) return lastDecorationsSet;

  const ranges: any[] = [];

  const selFrom = selectionFrom;
  const selTo = selectionTo;

  const hide = (from: number, to: number) => {
    if (from >= to) return;
    const deco = Decoration.replace({});
    ranges.push((deco as any).range(from, to));
  };

  const mark = (from: number, to: number, className: string) => {
    if (from >= to) return;
    const deco = Decoration.mark({ class: className });
    ranges.push((deco as any).range(from, to));
  };

  const replaceWithWidget = (from: number, to: number, widget: WidgetType) => {
    if (from >= to) return;
    const deco = Decoration.replace({ widget });
    ranges.push((deco as any).range(from, to));
  };

  // Highlight: ==text==
  {
    const re = /==([\s\S]+?)==/g;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;
      const end = start + full.length;
      const contentStart = start + 2;
      const contentEnd = end - 2;
      const focused = overlapsRange(selFrom, selTo, start, end);

      mark(contentStart, contentEnd, 'cm-md-highlight');
      if (!focused) (hide(start, start + 2), hide(end - 2, end));
    }
  }

  // Bold: **text**
  {
    const re = /\*\*([\s\S]+?)\*\*/g;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;
      const end = start + full.length;
      const contentStart = start + 2;
      const contentEnd = end - 2;
      const focused = overlapsRange(selFrom, selTo, start, end);

      mark(contentStart, contentEnd, 'cm-md-bold');
      if (!focused) (hide(start, start + 2), hide(end - 2, end));
    }
  }

  // Strike: ~~text~~
  {
    const re = /~~([\s\S]+?)~~/g;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;
      const end = start + full.length;
      const contentStart = start + 2;
      const contentEnd = end - 2;
      const focused = overlapsRange(selFrom, selTo, start, end);

      mark(contentStart, contentEnd, 'cm-md-strike');
      if (!focused) (hide(start, start + 2), hide(end - 2, end));
    }
  }

  // Italic: *text* (not **text**)
  {
    const re = /\*(?!\*)([^*]+?)\*(?!\*)/g;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;
      const end = start + full.length;
      const contentStart = start + 1;
      const contentEnd = end - 1;
      const focused = overlapsRange(selFrom, selTo, start, end);

      mark(contentStart, contentEnd, 'cm-md-italic');
      if (!focused) hide(start, start + 1);
      if (!focused) hide(end - 1, end);
    }
  }

  // Inline code: `code`
  {
    const re = /`([^`]+?)`/g;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;
      const end = start + full.length;
      const contentStart = start + 1;
      const contentEnd = end - 1;
      const focused = overlapsRange(selFrom, selTo, start, end);

      mark(contentStart, contentEnd, 'cm-md-inline-code');
      if (!focused) hide(start, start + 1);
      if (!focused) hide(end - 1, end);
    }
  }

  // Links: [text](url)
  {
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;
      const end = start + full.length;
      const text = m[1] ?? '';
      const url = m[2] ?? '';

      const textStart = start + 1;
      const textEnd = textStart + text.length;

      const openBracketStart = start;
      const openBracketEnd = start + 1;
      const closeBracketStart = textEnd;
      const closeBracketEnd = textEnd + 1;
      const openParenStart = closeBracketEnd;
      const openParenEnd = closeBracketEnd + 1;
      const urlStart = openParenEnd;
      const urlEnd = urlStart + url.length;
      const closeParenStart = urlEnd;
      const closeParenEnd = urlEnd + 1;

      const focused = overlapsRange(selFrom, selTo, start, end);

      mark(textStart, textEnd, 'cm-md-link');

      if (!focused) {
        hide(openBracketStart, openBracketEnd);
        hide(closeBracketStart, closeBracketEnd);
        hide(openParenStart, openParenEnd);
        hide(urlStart, urlEnd);
        hide(closeParenStart, closeParenEnd);
      }
    }
  }

  // Headings: #..###### plus trailing space(s)
  {
    const re = /^( {0,3})(#{1,6})[ \t]+(.+)$/gm;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    type HeadingDeco = {
      contentStart: number;
      contentEnd: number;
      markerStart: number;
      markerEnd: number;
      level: number;
      focused: boolean;
    };

    const headings: HeadingDeco[] = [];

    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;

      const indent = m[1] ?? '';
      const hashes = m[2] ?? '';
      const text = m[3] ?? '';
      if (!text) continue;

      const level = hashes.length;
      const markerStart = start + indent.length;
      const textStartWithin = full.indexOf(text);
      if (textStartWithin < 0) continue;
      const markerEnd = start + textStartWithin;
      const contentStart = markerEnd;
      const contentEnd = contentStart + text.length;

      const focused = overlapsRange(selFrom, selTo, start, start + full.length);
      headings.push({
        contentStart,
        contentEnd,
        markerStart,
        markerEnd,
        level,
        focused,
      });
    }

    headings.forEach((h, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === headings.length - 1;
      const className = [
        'cm-md-heading',
        `cm-md-heading-level-${h.level}`,
        isFirst ? 'cm-md-heading-first' : '',
        isLast ? 'cm-md-heading-last' : '',
      ]
        .filter(Boolean)
        .join(' ');

      mark(h.contentStart, h.contentEnd, className);
      if (!h.focused) hide(h.markerStart, h.markerEnd);
    });
  }

  // Unordered lists: -, *, +
  {
    const re = /^( {0,3})([-*+])[ \t]+(.+)$/gm;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;

      const indent = m[1] ?? '';
      const marker = m[2] ?? '';
      const text = m[3] ?? '';

      const markerStart = start + indent.length;
      const textStartWithin = full.indexOf(text);
      if (textStartWithin < 0) continue;
      const markerEnd = start + textStartWithin;
      const contentStart = markerEnd;
      const contentEnd = contentStart + text.length;

      const focused = overlapsRange(selFrom, selTo, start, start + full.length);
      mark(contentStart, contentEnd, 'cm-md-list-item');

      if (!focused) {
        replaceWithWidget(markerStart, markerEnd, new BulletWidget('• '));
      }
    }
  }

  // Ordered lists: 1. 2. ...
  {
    const re = /^( {0,3})(\d+)\.[ \t]+(.+)$/gm;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;

      const indent = m[1] ?? '';
      const num = m[2] ?? '';
      const text = m[3] ?? '';

      const markerStart = start + indent.length;
      const textStartWithin = full.indexOf(text);
      if (textStartWithin < 0) continue;
      const markerEnd = start + textStartWithin;
      const contentStart = markerEnd;
      const contentEnd = contentStart + text.length;

      const focused = overlapsRange(selFrom, selTo, start, start + full.length);
      mark(contentStart, contentEnd, 'cm-md-list-item');

      if (!focused) {
        replaceWithWidget(markerStart, markerEnd, new BulletWidget(`${num}. `));
      }
    }
  }

  // Blockquotes: > text
  {
    const re = /^(\s{0,3})>\s?(.*)$/gm;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;
      const indent = m[1] ?? '';
      const text = m[2] ?? '';

      // Hide the whole `> ` prefix in render mode.
      const markerStart = start + indent.length;
      const textStartWithin = text ? full.indexOf(text) : full.length;
      const markerEnd =
        textStartWithin >= 0 ? start + textStartWithin : markerStart + 1;

      const focused = overlapsRange(selFrom, selTo, start, start + full.length);
      const contentStart = markerEnd;
      const contentEnd = contentStart + (text?.length ?? 0);

      mark(contentStart, contentEnd, 'cm-md-blockquote');
      if (!focused) hide(markerStart, markerEnd);
    }
  }

  // Code fences: ```lang\n...```
  {
    const re = /^( {0,3})```[^\n]*\n([\s\S]*?)\n\1```[ \t]*$/gm;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(doc)) !== null) {
      const full = m[0];
      const start = m.index ?? 0;
      const indent = m[1] ?? '';
      const code = m[2] ?? '';

      const openNewlineWithin = full.indexOf('\n');
      if (openNewlineWithin < 0) continue;
      const openingHideStart = start;
      const openingHideEnd = start + openNewlineWithin;

      const codeContentStart = openingHideEnd + 1;
      const codeContentEnd = codeContentStart + code.length;

      // The closing line starts with a newline at codeContentEnd (the one before the closing fence).
      const closingMarkerStart = codeContentEnd + 1; // skip the newline char
      const closingMarkerEnd = start + full.length;

      const focused = overlapsRange(selFrom, selTo, start, start + full.length);

      mark(codeContentStart, codeContentEnd, 'cm-md-codeblock');
      if (!focused) {
        hide(openingHideStart, openingHideEnd);
        hide(closingMarkerStart, closingMarkerEnd);
      }
    }
  }

  lastDecorationsKey = key;
  lastDecorationsSet = Decoration.set(ranges, true);
  return lastDecorationsSet;
};

const MarkdownNoteEditorClient: React.FC<MarkdownNoteEditorProps> = ({
  value,
  onChange,
  autoFocus,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const initialDocRef = useRef(value ?? '');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (viewRef.current) return;

    const state = EditorState.create({
      doc: initialDocRef.current,
      extensions: [
        minimalSetup,
        markdown(),
        EditorView.decorations.of((view) =>
          MarkdownDecorations(
            view.state.doc.toString(),
            view.state.selection.main.from,
            view.state.selection.main.to,
          ),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme(
          {
            '&.cm-editor': {
              height: '250px',
              // Match the list tasks font stack (see `NotesListItem.module.scss`).
              fontFamily:
                '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto, Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji", "Segoe UI Symbol"',
            },
            // CodeMirror renders text inside scroller/content; ensure font is applied there too.
            '& .cm-scroller, & .cm-content': {
              fontFamily:
                '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto, Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji", "Segoe UI Symbol"',
            },
            '& .cm-md-hide': {
              color: 'transparent',
            },
            '& .cm-md-bold': {
              fontWeight: '700',
            },
            '& .cm-md-italic': {
              fontStyle: 'italic',
            },
            '& .cm-md-strike': {
              textDecoration: 'line-through',
            },
            '& .cm-md-highlight': {
              backgroundColor: 'rgba(250, 204, 21, 0.35)',
              borderRadius: '3px',
              padding: '0 2px',
            },
            '& .cm-md-inline-code': {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              backgroundColor: 'rgba(0,0,0,0.08)',
              borderRadius: '3px',
              padding: '0 3px',
            },
            '& .cm-md-link': {
              color: 'rgb(59, 130, 246)',
              textDecoration: 'underline',
            },
            '& .cm-md-heading': {
              fontWeight: '700',
              textDecoration: 'none',
              display: 'inline-block',
              padding: '0.45em 0',
              lineHeight: '1.2',
            },

            '& .cm-md-heading-first': {
              paddingTop: '0',
            },

            '& .cm-md-heading-last': {
              paddingBottom: '0',
            },

            '& .cm-md-heading-level-1': {
              fontSize: '1.65em',
            },
            '& .cm-md-heading-level-2': {
              fontSize: '1.45em',
            },
            '& .cm-md-heading-level-3': {
              fontSize: '1.30em',
            },
            '& .cm-md-heading-level-4': {
              fontSize: '1.20em',
            },
            '& .cm-md-heading-level-5': {
              fontSize: '1.12em',
            },
            '& .cm-md-heading-level-6': {
              fontSize: '1.05em',
            },
            // CodeMirror generates some internal token classes with a non-Latin
            // prefix. In DevTools they look like `.ͼ7` and may apply underline;
            // override them so markdown headings render without underline.
            '& .ͼ7': {
              textDecoration: 'none',
              fontWeight: '700',
              display: 'inline-block',
              padding: '0.15em 0',
              lineHeight: '1.25',
            },
            '& .cm-md-list-item': {
              // Keep text style stable; bullet is rendered via widget.
              fontWeight: '400',
            },
            '& .cm-md-blockquote': {
              borderLeft: '3px solid rgba(0,0,0,0.25)',
              paddingLeft: '10px',
              fontStyle: 'italic',
            },
            '& .cm-md-codeblock': {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              backgroundColor: 'rgba(0,0,0,0.08)',
              borderRadius: '4px',
              padding: '2px 6px',
              display: 'inline-block',
            },
            '& .cm-md-bullet': {
              color: 'inherit',
              display: 'inline-block',
              width: '1.7em',
              textAlign: 'right',
              marginRight: '0.2em',
              userSelect: 'none',
            },
          },
          { dark: false },
        ),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    if (autoFocus) {
      requestAnimationFrame(() => {
        view.focus();
      });
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [autoFocus]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current === (value ?? '')) return;

    view.dispatch({
      changes: { from: 0, to: current.length, insert: value ?? '' },
    });
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const view = viewRef.current;
    if (!view) return;
    requestAnimationFrame(() => view.focus());
  }, [autoFocus]);

  return <div ref={containerRef} />;
};

export default MarkdownNoteEditorClient;
