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

const Note: React.FC<{ note: NoteProps }> = ({note}) => {
	const authorName = note.author ? note.author.name : "Unknown author";

	//note.isEdit = true;

	return (
		<div className="notes-item">
			<div className="notes-item-title" id={note.id} onClick={() => Router.push("/n/[id]", `/n/${note.id}`)}>{note.title}</div>
		</div>

	);
};

export default Note;
