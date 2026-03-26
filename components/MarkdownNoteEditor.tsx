import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

type MarkdownNoteEditorProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
};

const MarkdownNoteEditor: React.FC<MarkdownNoteEditorProps> = ({
  value,
  onChange,
  autoFocus,
  placeholder,
}) => {
  const editorValue = useMemo(() => value ?? '', [value]);

  return (
    <MDEditor
      value={editorValue}
      onChange={(val) => onChange(val ?? '')}
      autoFocus={autoFocus}
      textareaProps={{ autoFocus, placeholder }}
      hideToolbar
      preview="edit"
      height={250}
    />
  );
};

export default MarkdownNoteEditor;
