import React, {useState, useEffect, useRef} from "react";
//import { useImmer } from 'use-immer';
import NotesListItem from "./NotesListItem";
import {NotesListItemProps} from "./NotesListItem";
import {useKeyPress} from '../lib/useKeyPress';
import styles from './NotesList.module.scss'

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

	const onKeyPress = (event) => {

		eventKeyRef.current = event.code;

		console.log(event)

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

			if (eventKeyRef.current === "KeyE" && lastKeyRef.current === "KeyE") {

				clearTimeout(timeout);
				lastKeyRef.current = null;

				setTimeout(function () {

					setIsEditTitle(true);

				},1)

			}

			if (eventKeyRef.current == "Enter") {

				clearTimeout(timeout);
				lastKeyRef.current = null;

				let newId = crypto.randomUUID();

				const curElement = notesFeed.find(n => n.sort === cursorPosition);

				let parentId;

				let insertChild = false;

				if (!notesFeed.length) {

					parentId = "root";

				} else {

					if (event.shiftKey === true) {

						insertChild = true;

						parentId = focusId.current;

					} else {

						parentId = curElement.parentId;

					}

				}

				let insertAt;

				if (!notesFeed.length) {

					insertAt = 0;

				} else {

					if (insertChild) {

						// Вложенный элемент всегда вставляется на следующую позицию за текущей

						insertAt = curElement.sort + 1

					} else {

						const nextSibling = notesFeed.find(n => (n.parentId === parentId && n.sort > cursorPosition));

						if (nextSibling !== undefined) {

							insertAt = nextSibling.sort;

						} else {

							const closestParent = notesFeed.find(n => (n.id === parentId));
							let closestParentNextSibling;

							if (closestParent !== undefined) {

								// Есть общий родитель

								closestParentNextSibling = notesFeed.find(n => (n.parentId === closestParent.parentId && n.sort > cursorPosition));

								if (closestParentNextSibling !== undefined) {

									// Есть следующий за общим родителем элемент

									insertAt = closestParentNextSibling.sort

								} else {

									// Нет следующего за общим родителем элемента

									insertAt = notesFeed.length;

								}

							} else {

								// Нет общего родителя

								insertAt = notesFeed.length

							}

						}





					}

				}

				let newNote:NotesListItemProps = {
					id: newId,
					title: "",
					sort: insertAt,
					isNew: true,
					parentId: parentId
				}

				let newFeed = [
					// Items before the insertion point:
					...notesFeed.slice(0, insertAt),
					// New item:
					newNote,
					// Items after the insertion point:
					...notesFeed.slice(insertAt)
				];

				newFeed = newFeed.map((n) => {

					if (n.sort >= insertAt && n.id != newId) {
						return {
							...n,
							sort: n.sort + 1
						}
					} else {
						return n;
					}

				});


				setTimeout(function () {

					setNotesFeed(newFeed);

					setIsEditTitle(true);

					setCursorPosition(insertAt);

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

		// TODO Если добавлена не вложенная заметка, возвращать курсор на предыдущую

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

			newFeed = newFeed.filter(n =>
				n.id !== noteId
			);

			setNotesFeed(newFeed);

			setCursorPosition(cursorPosition - 1);

		}

	}

	const handleDelete = (noteId) => {

		const currentSort = notesFeed.find(n => n.id == noteId).sort;

		console.log("noteId: " + noteId)
		console.log("currentSort: " + currentSort)

		// @ts-ignore
		let newFeed = removeFamily(noteId, notesFeed);

		const deletedCount = notesFeed.length - newFeed.length;

		newFeed = newFeed.map(n => {
			if (n.sort > currentSort) {
				return {
					...n,
					sort: n.sort - deletedCount
				}
			} else {
				return n;
			}
		})
		setTimeout(function () {
			setNotesFeed(newFeed);
			if (cursorPosition > newFeed.length - 1) {
				setCursorPosition(newFeed.length - 1)
			}
		},1)


	}

	const handleComplete = (noteId, isComplete) => {

		// @ts-ignore
		let removedFeed = removeFamily(noteId, notesFeed);

		let remainingIds = removedFeed.map(n => (n.id));

		let allIds = notesFeed.map(n => (n.id));

		let completeIds = [];

		allIds.map((id) => {
			if (!remainingIds.includes(id)) {
				completeIds.push(id);
			}
		});

		console.log(isComplete)

		console.log(completeIds)

		let newFeed = notesFeed.map(n => {
			if (completeIds.includes(n.id)) {
				return {
					...n,
					complete: !isComplete
				}
			} else {
				return n;
			}
		});

		setTimeout(function () {
			setNotesFeed(newFeed);
		},1)

	}

	return (
		<div className="row">
			<div className={`col ${styles.notes_list_col_1}`}>
				<div className={styles.notes_list}>

					{notesFeed.map((note, i) => {

						if (note.parentId === "root") {

							return (
								<NotesListItem

									key={note.id}
									id={note.id}
									sort={note.sort}
									title={note.title}
									complete={note.complete}
									feed={notesFeed}
									parentId={note.parentId}
									cursorPosition={cursorPosition}
									isFocus={note.sort === cursorPosition}
									isEdit={note.sort === cursorPosition && isEditTitle}
									isEditTitle={isEditTitle}
									onCancel={handleCancel}
									onFocus={(curId) => {
										focusId.current = curId;
									}}
									onEdit={() => {
										setIsEditTitle(false)
									}}
									onAdd={() => {
										setIsEditTitle(false);
									}}
									onDelete={handleDelete}
									onComplete={handleComplete}
									isNew={note.isNew ? true : false}
								/>
							)

						}

					})}

				</div>
			</div>
			<div className={`col ${styles.notes_list_col_2}`}>
				<div className={styles.sidebar_hints}>
					<div className={styles.hints_list}>
						<div className={styles.hints_item}>
							<div className={styles.hints_item_key}>
								<div className={styles.key}>Enter</div>
							</div>
							<div className={styles.hints_item_descr}>
								Add note
							</div>
						</div>
						<div className={styles.hints_item}>
							<div className={styles.hints_item_key}>
								<div className={styles.key}>Shift + Enter</div>
							</div>
							<div className={styles.hints_item_descr}>
								Add a sub-item
							</div>
						</div>
						<div className={styles.hints_item}>
							<div className={styles.hints_item_key}>
								<div className={styles.key}>ee</div>
							</div>
							<div className={styles.hints_item_descr}>
								Edit title
							</div>
						</div>
						<div className={styles.hints_item}>
							<div className={styles.hints_item_key}>
								<div className={styles.key}>ee</div>
							</div>
							<div className={styles.hints_item_descr}>
								Edit title
							</div>
						</div>
						<div className={styles.hints_item}>
							<div className={styles.hints_item_key}>
								<div className={styles.key}>Spacebar</div>
							</div>
							<div className={styles.hints_item_descr}>
								Complete/reopen
							</div>
						</div>
						<div className={styles.hints_item}>
							<div className={styles.hints_item_key}>
								<div className={styles.key}>Del</div>
							</div>
							<div className={styles.hints_item_descr}>
								Delete
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

	);
};

export const removeFamily =
	(id,
	 [node, ...more] = [],
	 s = new Set([id]),
	 r = []
	) => {
		if (node === undefined)
			return r               // 1
		else if (s.has(node.id) || s.has(node.parentId)) {
			return removeFamily    // 2
				(id
					// @ts-ignore
					, [...r, ...more]
					, s.add(node.id)
					, []
				)
		} else
			return removeFamily    // 3
				(id
					, more
					, s
					, [...r, node]
				)
	}

export default NotesList;
