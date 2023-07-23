import React, {useState, useEffect, useRef} from "react";
//import { useImmer } from 'use-immer';
import NotesListItem from "./NotesListItem";
import {NotesListItemProps} from "./NotesListItem";
import {useKeyPress} from '../lib/useKeyPress';

type Props = {
	feed: NotesListItemProps[]
}

const NotesList: React.FC<Props> = (props) => {

	const eventKeyRef = useRef(null);
	const lastKeyRef = useRef(null);
	const focusId = useRef(null);

	const [cursorPosition, setCursorPosition] = useState(null);
	const [notesFeed, setNotesFeed] = useState(props.feed);

	const [isEditTitle, setIsEditTitle] = useState(false);

	const allChildIds = [];

	console.log(notesFeed)

	notesFeed.map(n => {
		n.childIds.map(cid => {
			allChildIds.push(cid);
		})
	});

	const onKeyPress = (event) => {

		eventKeyRef.current = event.key;

		console.log(eventKeyRef.current + " : " + lastKeyRef.current)

		let timeout = null;

		clearTimeout(timeout);

		// Setting timeout on key press

		timeout = setTimeout(function () {

			// Setting last pressed key to null if 1 second have passed

			lastKeyRef.current = null;

		}, 1000);

		if (!isEditTitle) {

			if (eventKeyRef.current === "ArrowUp" || eventKeyRef.current === "ArrowDown") {

				lastKeyRef.current = null;
				clearTimeout(timeout);

				if (eventKeyRef.current === "ArrowUp" && cursorPosition > 0) {
					setCursorPosition(cursorPosition - 1);
				} else if (eventKeyRef.current === "ArrowDown" && cursorPosition < notesFeed.length - 1 && cursorPosition !== null) {
					setCursorPosition(cursorPosition + 1);
				} else if (eventKeyRef.current === "ArrowDown" && cursorPosition === null) {
					setCursorPosition(0);
				}


			}

			// Edit note title on "ee"

			if (eventKeyRef.current === "e" && lastKeyRef.current === "e") {

				console.log('edit')

				clearTimeout(timeout);
				lastKeyRef.current = null;

				setTimeout(function () {

					setIsEditTitle(true);

				},1)

			}

			if (eventKeyRef.current == "Enter") {

				clearTimeout(timeout);
				lastKeyRef.current = null;

				// TODO перенести это в добавление вложенной заметки по Ctrl+Enter

				let newId = crypto.randomUUID();

				let parentId = null;

				if (event.shiftKey === true) {

					console.log(focusId.current)

					parentId = focusId.current;

				} else {

					parentId = notesFeed.filter((f, i) => {
						return f.sort === cursorPosition;
					})[0].parentId;

				}


				let newNote:NotesListItemProps = {
					id: newId,
					title: "",
					sort: cursorPosition + 1,
					isNew: true,
					childIds: []
				}

				const insertAt = cursorPosition + 1; // Could be any index
				let newFeed = [
					// Items before the insertion point:
					...notesFeed.slice(0, insertAt),
					// New item:
					newNote,
					// Items after the insertion point:
					...notesFeed.slice(insertAt)
				];

				if (parentId !== null) {

					newFeed = newFeed.map((n) => {

						if (n.id === parentId) {
							return {
								...n,
								childIds: [
									...n.childIds,
									newId
								]
							}
						} else {
							if (n.sort > cursorPosition && n.id != newId) {
								return {
									...n,
									sort: n.sort + 1
								}
							} else {
								return n;
							}
						}

					});

				}

				setTimeout(function () {

					setNotesFeed(newFeed);

					setIsEditTitle(true);

					setCursorPosition(cursorPosition + 1);

				}, 1);



			}

		} else {

			// clearTimeout(timeout);
			// lastKeyRef.current = null;

		}

		if (eventKeyRef.current == "Escape") {

			clearTimeout(timeout);
			lastKeyRef.current = null;

			//setIsEditTitle(false);

		}

		// Setting last pressed key

		lastKeyRef.current = eventKeyRef.current;

	};


	useKeyPress([], onKeyPress);

	const handleCancel = (isNewParam, noteId) => {

		setIsEditTitle(false);

		if (isNewParam) {

			let newFeed = notesFeed.map((n) => {

				if (n.sort > cursorPosition) {
					return {
						...n,
						sort: n.sort - 1
					}
				} else {
					return n;
				}

			});

			newFeed = newFeed.map((n) => {

				if (n.childIds.includes(noteId)) {
					return {
						...n,
						childIds: n.childIds.filter((id) => (id !== noteId))
					}
				} else {
					return n;
				}

			});

			newFeed = newFeed.filter(n =>
				n.id !== noteId
			);

			setNotesFeed(newFeed);

			setCursorPosition(cursorPosition - 1);

		}

	}

	const handleDelete = (noteId) => {

		console.log(notesFeed)

		let newFeed = notesFeed.map((n) => {

			if (n.childIds.includes(noteId)) {
				return {
					...n,
					childIds: n.childIds.filter((id) => (id !== noteId))
				}
			} else {
				return n;
			}

		});

		newFeed = newFeed.filter(n =>
			n.parentId !== noteId
		);

		newFeed = newFeed.filter(n =>
			n.id !== noteId
		);

		let deletedCount = notesFeed.length - newFeed.length;

		newFeed = newFeed.map((n, i) => {

			if (n.sort > cursorPosition) {
				return {
					...n,
					sort: n.sort - deletedCount
				}
			} else {
				return n;
			}

		});

		setNotesFeed(newFeed);

		setCursorPosition(cursorPosition)

	}

	return (
		<div className="notes-list">

			{notesFeed.map((note, i) => {

				if (!allChildIds.includes(note.id)) {

					let parentId = null;

					return (
						<NotesListItem

							key={note.id}
							id={note.id}
							sort={note.sort}
							title={note.title}
							feed={notesFeed}
							parentId={parentId}
							childIds={note.childIds}
							cursorPosition={cursorPosition}
							isFocus={note.sort === cursorPosition}
							isEdit={note.sort === cursorPosition && isEditTitle}
							isEditTitle={isEditTitle}
							onCancel={handleCancel}
							onFocus={(curId) => {
								focusId.current = curId;
							}}
							onEdit={() => {setIsEditTitle(false)}}
							onAdd={() => {
								setIsEditTitle(false);
							}}
							onDelete={handleDelete}
							isNew={note.isNew ? true : false}
						/>
					)

				}

			})}

		</div>

	);
};



export default NotesList;
