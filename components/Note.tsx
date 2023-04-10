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
};

const Note: React.FC<{ note: NoteProps }> = ({ note }) => {
  const authorName = note.author ? note.author.name : "Unknown author";
  return (
    <div className="notes-list-item" onClick={() => Router.push("/n/[id]", `/n/${note.id}`)}>
      <div className="notes-list-item-title">{note.title}</div>
      <style jsx>{`
				.notes-list-item {
					background: white;
					transition: box-shadow 0.1s ease-in;
					padding: 10px 20px;
				}

				.notes-list-item:hover {
					box-shadow: 1px 1px 3px #aaa;
				}

				.notes-list-item + .notes-list-item {
					margin-top: 1px;
				}
      `}</style>
    </div>
  );
};

export default Note;
