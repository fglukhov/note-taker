import React, {useState} from "react";
import NotesListItem from "./NotesListItem";
import {NoteProps} from "./Note";
import {useKeyPress} from '../lib/useKeyPress';

type Props = {
	feed: NoteProps[]
}

const NotesList: React.FC<Props> = (props) => {

	const [notesFeed, setNotesFeed] = useState(props.feed);
	
	const [focusId, setFocusId] = useState(null);
	const [isEditTitle, setIsEditTitle] = useState(false);
	const [lastKey, setLastKey] = useState(null);
	const [cursorPosition, setCursorPosition] = useState(null);

	async function resortNotes(notesFeed) {

		// console.log(notesFeed)
		//
		// await fetch(`/api/resort-notes`, {
		// 	method: 'POST',
		// 	headers: { 'Content-Type': 'application/json' },
		// 	id: JSON.stringify(notesFeed),
		// });

	}

	const onKeyPress = (event) => {

		let eventKey = event.key;

		// Setting last pressed key

		setLastKey(eventKey);

		let timeout = null;

		clearTimeout(timeout);

		// Setting timeout on key press

		timeout = setTimeout(function () {

			// Setting last pressed key to null if 1 second have passed

			setLastKey(null);

		}, 1000);

		if (!isEditTitle) {

			if (eventKey === "ArrowUp" || eventKey === "ArrowDown") {

				setLastKey(null);
				clearTimeout(timeout);

				if (eventKey === "ArrowUp" && cursorPosition > 0) {
					setCursorPosition(cursorPosition-1);
				} else if (eventKey === "ArrowDown" && cursorPosition < notesFeed.length - 1 && cursorPosition !== null) {
					setCursorPosition(cursorPosition+1);
				} else if (eventKey === "ArrowDown" && cursorPosition === null) {
					setCursorPosition(0);
				}

			}

			// Edit note title on "ee"

			if (eventKey === "e" && lastKey === "e") {

				clearTimeout(timeout);
				setLastKey(null);

				setTimeout(function () {

					setIsEditTitle(true);

				},10)

			}

		}

		if (eventKey == "Escape") {

			clearTimeout(timeout);
			setLastKey(null);

			//setIsEditTitle(false);

		}

		if (eventKey == "Enter") {

			if (!isEditTitle) {

				clearTimeout(timeout);
				setLastKey(null);

				let newNote:NoteProps = {
					id: crypto.randomUUID(),
					title: "",
					content: "",
					isNew: true
				}

				const insertAt = cursorPosition + 1; // Could be any index
				const newFeed = [
					// Items before the insertion point:
					...notesFeed.slice(0, insertAt),
					// New item:
					newNote,
					// Items after the insertion point:
					...notesFeed.slice(insertAt)
				];

				setTimeout(function () {

					setNotesFeed(newFeed);

					setIsEditTitle(true);

					setCursorPosition(cursorPosition + 1);

				}, 10);

			}
			

		}

	};


	useKeyPress([], onKeyPress);

	return (
		<div className="notes-list">
			<p>isEditTitle: {isEditTitle ? "true" : "false"}</p>
			{notesFeed.map((note, i) => (
				<NotesListItem
					key={note.id}
					id={note.id}
					sort={note.sort}
					title={note.title}
					isFocus={(i === cursorPosition ? true : false)}
					isEdit={((i === cursorPosition && isEditTitle) ? true : false)}
					onCancel={() => {
						setIsEditTitle(false);

					}}
					onEdit={() => {setIsEditTitle(false)}}
					onAdd={() => {
						setIsEditTitle(false);
						//resortNotes(notesFeed);
					}}
					isNew={note.isNew}
				/>
			))}
		</div>

	);
};

export default NotesList;
