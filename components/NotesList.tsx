import React, {useState} from "react";
//import { useImmer } from 'use-immer';
import NotesListItem from "./NotesListItem";
import {NotesListItemProps} from "./NotesListItem";
import {useKeyPress} from '../lib/useKeyPress';

type Props = {
	feed: NotesListItemProps[]
}

const NotesList: React.FC<Props> = (props) => {

	const [notesFeed, setNotesFeed] = useState(props.feed);

	//const [focusId, setFocusId] = useState(null);
	const [isEditTitle, setIsEditTitle] = useState(false);
	const [lastKey, setLastKey] = useState(null);
	const [cursorPosition, setCursorPosition] = useState(null);

	// Initial notes order


	let initialOrder = [];

	for (let i = 0; i < notesFeed.length; i++) {

		initialOrder.push({
			id: notesFeed[i].id,
			position: i
		});

	}

	const [notesOrder, setNotesOrder] = useState(initialOrder);



	//setNotesOrder(initialOrder)

	//setListSort(nextListSort);


	function resortNotes(newFeed) {

		let notesNewOrder = [];

		for (let i = 0; i < newFeed.length; i++) {

			notesNewOrder.push({
				id: newFeed[i].id,
				position: i
			})

		}

		let firstIncrementIndex = null;
		let newId = null;

		for (let i = 0; i < notesNewOrder.length; i++) {

			if (notesNewOrder[i].id !== notesOrder[i].id) {

				firstIncrementIndex = i;

				newId = notesNewOrder[i].id;

				break;

			}

		}

		setNotesOrder(notesNewOrder)

		const body = { firstIncrementIndex, newId };

		fetch(`/api/resort-notes`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

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

				let newNote:NotesListItemProps = {
					id: crypto.randomUUID(),
					title: "",
					sort: cursorPosition + 1,
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

					//resortNotes(newFeed);

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
					isFocus={i === cursorPosition}
					isEdit={(i === cursorPosition && isEditTitle)}
					onCancel={(isNewParam) => {
						setIsEditTitle(false);
						if (isNewParam) {
							setNotesFeed(
								notesFeed.filter(n =>
									n.id !== note.id
								)
							);
							setCursorPosition(cursorPosition-1)
						}
					}}
					onEdit={() => {setIsEditTitle(false)}}
					onAdd={() => {
						setIsEditTitle(false);
						//resortNotes(notesFeed);
					}}
					isNew={note.isNew ? true : false}
				/>
			))}
		</div>

	);
};

export default NotesList;
