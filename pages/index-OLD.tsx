import React, {ReactNode, useState} from "react"
import { GetStaticProps } from "next"
import Layout from "../components/Layout"
import Note, { NoteProps } from "../components/Note"
import prisma from '../lib/prisma';
import {useKeyPress} from '../lib/useKeyPress';
import Router from "next/router";

// index.tsx
export const getStaticProps: GetStaticProps = async () => {

	const feed = await prisma.note.findMany({
		orderBy: {
			sort: 'asc',
		},
		include: {
			author: {
				select: { name: true },
			},
		},
	});

	return {
		props: { feed },
		revalidate: 10,
	};

};

type NotesListItemProps = {
	id?: string;
	className: string;
	isFocus?: boolean;
	children?: ReactNode;
}

type NoteTitleFormProps = {
	id: string;
	title: string;
	// author: {
	// 	name: string;
	// 	email: string;
	// } | null;
	// content: string;
	// createdAt: Date;
	// sort: number;
}

type Props = {
	feed: NoteProps[]
}



const NotesListItem: React.FC<NotesListItemProps> = (props) => {
	return (
		<div className={props.className} id={props.id}>
			{props.children}
			<style jsx>{`
				.notes-list-item {
					background: white;
					transition: box-shadow 0.1s ease-in;
					padding: 10px 20px;
				}

				.notes-list-item.focus {
					background: #d1eaff;
				}

				.notes-list-item:hover {
					box-shadow: 1px 1px 3px #aaa;
				}

				.notes-list-item + .notes-list-item {
					margin-top: 1px;
				}
			`}</style>
		</div>
	)
}
const NoteTitleForm: React.FC<NoteTitleFormProps> = (props) => {

	const [title, setTitle] = useState(props.title);

	const editTitle = async (e: React.SyntheticEvent) => {
		e.preventDefault();

		try {
			const body = { title };
			await fetch(`/api/edit/${props.id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			await Router.push('/');
		} catch (error) {
			console.error(error);
		}
	};

	return (
		<form onSubmit={editTitle}>
			<input
				autoFocus
				onChange={(e) => setTitle(e.target.value)}
				placeholder="Title"
				type="text"
				value={title}
			/>
		</form>
	)
}

const Notes: React.FC<Props> = (props) => {

	const [isEditTitle, setIsEditTitle] = useState(false);
	const [lastKey, setLastKey] = useState(null);
	const [cursorPosition, setCursorPosition] = useState(null);

	// const [titles, setTitles] = useState([]);
	//
	// props.feed.map(note => (
	// 	titles.push({
	// 		id: note.id,
	// 		title: note.title,
	// 	})
	// ))

	const onKeyPress = (event) => {

		let eventKey = event.key;

		// Setting last pressed key

		setLastKey(eventKey);

		let timeout = null;

		clearTimeout(timeout);

		// Setting timeout on key press
		timeout = setTimeout(function () {

			// Setting last pressed key to null if 2 seconds have passed

			setLastKey(null);

		}, 2000);


		// Edit note title on "ee"


		if (!isEditTitle) {

			if (eventKey === "ArrowUp" && cursorPosition > 0) {
				setLastKey(null);
				clearTimeout(timeout);
				setCursorPosition(cursorPosition-1);
			} else if (eventKey === "ArrowDown" && cursorPosition < props.feed.length - 1 && cursorPosition !== null) {
				setLastKey(null);
				clearTimeout(timeout);
				setCursorPosition(cursorPosition+1);
			} else if (eventKey === "ArrowDown" && cursorPosition === null) {
				setLastKey(null);
				clearTimeout(timeout);
				setCursorPosition(0);
			}

		}

		if (eventKey === "e" && lastKey === "e") {

			clearTimeout(timeout);
			setIsEditTitle(true);
			setLastKey(null);

			//


			console.log("Edit title!")

		}

		if (eventKey == "Escape") {

			setLastKey(null);
			clearTimeout(timeout);

			setIsEditTitle(false);

		}


		console.log(`key pressed: ${event.key}`);
	};

	useKeyPress([], onKeyPress);

  return (
    <Layout>
      <div className="page">
        <h1>Notes</h1>
        <main>
					<div className="notes-list">
						{props.feed.map((note, i) => (
							<NotesListItem className={"notes-list-item " + (i === cursorPosition ? "focus" : "")} key={note.id} id={note.id}>
								{isEditTitle && (i === cursorPosition) ? (
									<NoteTitleForm id={note.id} title={note.title} />
								) : (
									<Note note={note}/>
								)}
							</NotesListItem>
						))}
					</div>
        </main>
      </div>
    </Layout>
  )
}

export default Notes
