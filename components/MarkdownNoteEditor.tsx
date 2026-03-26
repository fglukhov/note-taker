import React from 'react';
import dynamic from 'next/dynamic';

const MarkdownNoteEditorClient = dynamic(
  () => import('./MarkdownNoteEditorClient'),
  { ssr: false },
);

type MarkdownNoteEditorProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
};

export default MarkdownNoteEditorClient as React.FC<MarkdownNoteEditorProps>;
