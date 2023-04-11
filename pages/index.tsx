import React, {ReactNode, useState} from "react"
import { GetStaticProps } from "next"
import Layout from "../components/Layout"
import Note, { NoteProps } from "../components/Note"
import prisma from '../lib/prisma';
import {useKeyPress} from '../lib/useKeyPress';



// index.tsx
export const getStaticProps: GetStaticProps = async () => {

	const feed = await prisma.note.findMany({
		// orderBy: {
		// 	sort: 'asc',
		// },
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

const Notes: React.FC<Props> = (props) => {

	const [focusId, setFocusId] = useState(null);
	const [cursorPosition, setCursorPosition] = useState(null);

	console.log(cursorPosition)

	const onKeyPress = (event) => {



		if (event.key === "ArrowUp" && cursorPosition > 0) {
			setCursorPosition(cursorPosition-1);
		} else if (event.key === "ArrowDown" && cursorPosition < props.feed.length - 1 && cursorPosition !== null) {
			setCursorPosition(cursorPosition+1);
		} else if (event.key === "ArrowDown" && cursorPosition === null) {
			setCursorPosition(0);
		}



		//console.log(`key pressed: ${event.key}`);
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
								<Note note={note} />
							</NotesListItem>
						))}
					</div>
        </main>
      </div>
    </Layout>
  )
}

export default Notes
