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

	//console.log(notesFeed)

	const [isEditTitle, setIsEditTitle] = useState(false);
	const [lastKey, setLastKey] = useState(null);
	const [cursorPosition, setCursorPosition] = useState(-1);

	const allChildIds = [];

	notesFeed.map(n => {
		n.childIds.map(cid => {
			allChildIds.push(cid);
		})
	});

	console.log(allChildIds)

	// Initial notes order

	let initialOrder = [];

	for (let i = 0; i < notesFeed.length; i++) {

		initialOrder.push({
			id: notesFeed[i].id,
			position: i
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
					isNew: true,
					childIds: []
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
			{notesFeed.map((note, i) => {

				if (!allChildIds.includes(note.id)) {

					return (
						<NotesListItem
							key={note.id}
							id={note.id}
							sort={note.sort}
							title={note.title}
							feed={note.feed}
							childIds={note.childIds}
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
							}}
							onDelete={() => {
								setNotesFeed(
									notesFeed.filter(n =>
										n.id !== note.id
									)
								);
								setCursorPosition(cursorPosition)
							}}
							isNew={note.isNew ? true : false}
						/>
					)

				}

			})}

		</div>

	);
};

export default NotesList;
