import React from "react";
import Router from "next/router";
import ReactMarkdown from "react-markdown";

export type NoteProps = {
  id: string;
  title: string;
  author: {
    name: string;
    email: string;
  } | null;
  content: string;
	createdAt: Date;
	order: number;
};

const Note: React.FC<{ note: NoteProps }> = ({ note }) => {
  const authorName = note.author ? note.author.name : "Unknown author";
  return (
    <div className="notes-item" id={note.id} onClick={() => Router.push("/n/[id]", `/n/${note.id}`)}>
      <div className="notes-item-title">{note.title}</div>
      <style jsx>{`
				
      `}</style>
    </div>
  );
};

export default Note;
