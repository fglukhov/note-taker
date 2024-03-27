import React, {useState, useEffect, useRef} from "react";
//import { useImmer } from 'use-immer';
import NotesListItem from "./NotesListItem";
import {NotesListItemProps} from "./NotesListItem";
import {useKeyPress} from '../lib/useKeyPress';
import styles from './NotesList.module.scss'

type Props = {
	feed: NotesListItemProps[]
}

let updateTimeout = null;
let reorderInterval = null;
let timeout = null;

const NotesList: React.FC<Props> = (props) => {

	const savedReorderCallback = useRef(null);
	const updatedIds = useRef([]);
	const savedUpdatedIds = useRef([]);

	const prevFeed = useRef(props.feed);

	const eventKeyRef = useRef(null);
	const lastKeyRef = useRef(null);
	const focusId = useRef(null);
	const prevFocusId = useRef(null);

	const prevCursorPosition = useRef(null);
	const prevTitle = useRef(null);

	const [cursorPosition, setCursorPosition] = useState(null);
	const [notesFeed, setNotesFeed] = useState(props.feed);

	const [isEditTitle, setIsEditTitle] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [isChanged, setIsChanged] = useState(false);

	function reorderCallback() {

		if (isChanged && !isUpdating) {

			console.log(savedUpdatedIds.current)

			setIsChanged(false);
			setIsUpdating(true);

			reorderNotes(prevFeed.current, notesFeed, savedUpdatedIds.current).then(() => {
				setIsUpdating(false);
			});

		}

	}

	useEffect(() => {
		savedReorderCallback.current = reorderCallback;
	});

	useEffect(() => {

		function tick() {
			savedReorderCallback.current();
		}

		let reorderInterval = setInterval(tick, 1000);

		return () => clearInterval(reorderInterval);

	},[]);

	const onKeyPress = (event) => {

		if ((event.ctrlKey || event.metaKey) && !isEditTitle) {
			event.preventDefault();
		}

		let isCtrlCommand = event.ctrlKey || event.metaKey;

		eventKeyRef.current = event.code;


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

			// Indent

			if (eventKeyRef.current == "ArrowRight" && isCtrlCommand && !isEditTitle) {

				if (updateTimeout) {
					clearTimeout(updateTimeout);
				}

				let curNote = notesFeed.find(n => n.id==focusId.current);

				let parentId = curNote.parentId;

				const siblingsIds = [];

				notesFeed.map(n => {

					if (n.parentId == parentId) {
						siblingsIds.push(n.id)
					}

				});

				let prevSiblingId = null;

				siblingsIds.map((id, i) => {

					if (id === focusId.current && i > 0) {

						prevSiblingId = siblingsIds[i-1];

					}

				});

				// Считаем количество прямых детей нового родительского элемента

				let newSiblingsCount = 0;

				notesFeed.map(n => {
					if (n.parentId === prevSiblingId) {
						newSiblingsCount += 1;
					}
				});

				let newSort = newSiblingsCount;

				let newParentId = prevSiblingId;

				if (curNote.sort > 0 && prevSiblingId !== null) {

					const newFeed = notesFeed.map((n, i) => {
						if (n.id === curNote.id) {

							if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id)

							return {
								...n,
								parentId: newParentId,
								sort: newSort
							}
						} else if (n.parentId === curNote.parentId && n.sort > curNote.sort) {

							if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id)

							return {
								...n,
								sort: n.sort - 1
							}

						} else {

							return n;
						}

					});

					//updatedIds.current

					newFeed.sort((a,b) => a.sort - b.sort);

					updateTimeout = setTimeout(function () {

						setIsChanged(true);

						savedUpdatedIds.current = updatedIds.current;

						updatedIds.current = [];

					}, 1000);

					//setIsChanged(true)

					prevFeed.current = newFeed;

					setNotesFeed(newFeed);

					// indentNote(curNote.id, parentId, newParentId, newSort, curNote.sort).then(() => {
					// 	setNotesFeed(newFeed);
					// });

				}

			}

			// Unindent

			if (eventKeyRef.current == "ArrowLeft" && isCtrlCommand && !isEditTitle) {

				if (updateTimeout) {
					clearTimeout(updateTimeout);
				}

				let curNote = notesFeed.find(n => n.id==focusId.current);
				let parentId = curNote.parentId;

				console.log(curNote)

				let curNoteSiblings = notesFeed.filter(n => n.parentId === curNote.parentId);

				let parentFamily = getFamily(curNote.parentId, notesFeed);

				// @ts-ignore
				let curNoteFamily = removeFamily(curNote.id, parentFamily);

				let positionShift = 0;

				console.log(curNote)

				if (curNote.sort < curNoteSiblings.length-1) {
					positionShift = curNoteFamily.length - 1;
				}

				if (parentId !== "root") {

					let curParent =	notesFeed.find(n => n.id==parentId);
					let newParentId = curParent.parentId;

					let newSort = curParent.sort + 1;

					let newFeed = notesFeed.map((n, i) => {
						if (n.id === curNote.id) {

							if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id)

							return {
								...n,
								isNew: false,
								parentId: newParentId,
								sort: newSort
							}
						} else if (n.parentId === newParentId && n.sort > curParent.sort) {

							if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id)

							return {
								...n,
								sort: n.sort + 1
							}
						} else if (n.parentId === parentId && n.sort > curNote.sort) {

							if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id)

							return {
								...n,
								sort: n.sort - 1
							}
						} else {
							return n;
						}

					});

					newFeed.sort((a,b) => a.sort - b.sort);

					let newCursorPosition = null;

					updateTimeout = setTimeout(function () {

						setIsChanged(true);

						savedUpdatedIds.current = updatedIds.current;

						updatedIds.current = [];

					}, 1000);

					prevFeed.current = newFeed;

					setNotesFeed(newFeed);
					setCursorPosition(cursorPosition + positionShift)


					// unindentNote(curNote.id, parentId, newParentId, newSort, curNote.sort, curParent.sort).then(() => {
					// 	setNotesFeed(newFeed);
					// 	setCursorPosition(cursorPosition + positionShift)
					// });

				}

			}

			// Complete

			if (eventKeyRef.current == "Space" && !isEditTitle) {

				if (updateTimeout) {
					clearTimeout(updateTimeout);
				}

				let curNote = notesFeed.find(n => n.id==focusId.current);

				// @ts-ignore
				let removedFeed = removeFamily(curNote.id, notesFeed);

				let remainingIds = removedFeed.map(n => (n.id));

				let allIds = notesFeed.map(n => (n.id));

				let completeIds = [];

				allIds.map((id) => {
					if (!remainingIds.includes(id)) {
						completeIds.push(id);
					}
				});

				let newFeed = notesFeed.map(n => {

					if (completeIds.includes(n.id)) {

						if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id)

						return {
							...n,
							complete: !curNote.complete
						}

					} else {
						return n;
					}


				});

				updateTimeout = setTimeout(function () {

					setIsChanged(true);

					savedUpdatedIds.current = updatedIds.current;

					updatedIds.current = [];

				}, 1000);

				prevFeed.current = newFeed;

				setNotesFeed(newFeed);

			}

			// Delete

			if (eventKeyRef.current == "Delete" && !isEditTitle) {

				if (updateTimeout) {
					clearTimeout(updateTimeout);
				}

				let curNote = notesFeed.find(n => n.id==focusId.current);

				const currentSort = notesFeed.find(n => n.id == curNote.id).sort;

				// @ts-ignore
				let removedFeed = removeFamily(curNote.id, notesFeed);

				let remainingIds = removedFeed.map(n => (n.id));

				let allIds = notesFeed.map(n => (n.id));

				let removedIds = [];

				allIds.map((id) => {
					if (!remainingIds.includes(id)) {
						removedIds.push(id);
					}
				});

				//const deletedCount = notesFeed.length - newFeed.length;

				console.log(removedIds)

				notesFeed.map(n => {
					if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id)
				})

				let newFeed = notesFeed.filter(n => {

					return !removedIds.includes(n.id)

				});

				updateTimeout = setTimeout(function () {

					setIsChanged(true);

					savedUpdatedIds.current = updatedIds.current;

					updatedIds.current = [];

					if (cursorPosition > newFeed.length - 1) {
						setCursorPosition(newFeed.length - 1)
					}

				}, 1000);

				prevFeed.current = newFeed;

				setNotesFeed(newFeed);

			}

			if (eventKeyRef.current == "Enter") {

				prevFocusId.current = focusId.current;
				prevCursorPosition.current = cursorPosition;

				clearTimeout(timeout);
				lastKeyRef.current = null;

				let newId = crypto.randomUUID();

				let curElement = notesFeed.find(n => n.id==focusId.current);

				if (curElement !== undefined) {

					prevTitle.current = curElement.title;
				}



				let parentId;

				let insertChild = false;

				let newSort = 0;

				if (!notesFeed.length) {

					parentId = "root";

				} else {

					if (event.shiftKey === true) {

						insertChild = true;

						parentId = curElement.id;

					} else {

						parentId = curElement.parentId;

						newSort = curElement.sort + 1;

					}

				}

				let insertAt;

				if (!notesFeed.length) {

					insertAt = 0;

				} else {

					if (insertChild) {

						// Вложенный элемент всегда вставляется на следующую позицию за текущей

						insertAt = cursorPosition + 1;

					} else {

						insertAt = cursorPosition + getFamily(curElement.id, notesFeed).length

					}

				}

				let newNote:NotesListItemProps = {
					id: newId,
					title: "",
					sort: newSort,
					position: insertAt,
					isNew: true,
					parentId: parentId
				}

				let newFeed = [
					...notesFeed,
					newNote,
				];

				newFeed = newFeed.map((n) => {

					if (n.sort >= newSort && n.id != newId && n.parentId == parentId) {
						return {
							...n,
							sort: n.sort + 1
						}
					} else {
						return n;
					}

				});

				newFeed.sort((a,b) => a.sort - b.sort);

				setTimeout(function () {

					setCursorPosition(insertAt);
					setIsEditTitle(true);
					setNotesFeed(newFeed);

				}, 1);

			}

		} else {

			// clearTimeout(timeout);
			// lastKeyRef.current = null;

		}

		if (eventKeyRef.current == "Escape") {

			clearTimeout(timeout);
			lastKeyRef.current = null;



		}

		lastKeyRef.current = eventKeyRef.current;

	};

	useKeyPress([], onKeyPress);

	// const indentNote = async (noteId: String, parentId: String, newParentId: String, sort: number, oldSort: number) => {
	//
	// 	try {
	// 		const body = { parentId, newParentId, sort, oldSort };
	// 		await fetch(`/api/indent/${noteId}`, {
	// 			method: 'POST',
	// 			headers: { 'Content-Type': 'application/json' },
	// 			body: JSON.stringify(body),
	// 		});
	//
	// 	} catch (error) {
	// 		console.error(error);
	// 	}
	//
	// };


	// TODO feed and updatedIds are parameters
	const reorderNotes = async (prevFeed, feed, ids) => {

		//console.log('reorder')

		const body = { prevFeed, feed, ids };

		try {
			await fetch('/api/update/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

		} catch (error) {
			console.error(error);
		}

	};

	//reorderNotes()

	// const unindentNote = async (noteId: String, parentId: String, newParentId: String, sort: number, oldSort: number, parentSort: number) => {
	//
	// 	try {
	// 		const body = { parentId, newParentId, sort, oldSort, parentSort };
	// 		await fetch(`/api/unindent/${noteId}`, {
	// 			method: 'POST',
	// 			headers: { 'Content-Type': 'application/json' },
	// 			body: JSON.stringify(body),
	// 		});
	//
	// 	} catch (error) {
	// 		console.error(error);
	// 	}
	//
	// };

	const handleEdit = (noteId, title) => {

		let newFeed = notesFeed.map((n) => {
			if (n.id === noteId) {
				return {
					...n,
					title: title
				}
			} else {
				return n;
			}
		});

		setTimeout(function () {
			setNotesFeed(newFeed);
			setIsEditTitle(false);
		},1);


	}

	const handleAdd = async (noteId, parentId, title, sort) => {

		let newFeed = notesFeed.map((n) => {
			if (n.id === noteId) {
				return {
					...n,
					title: title
				}
			} else {
				return n;
			}
		});

		setNotesFeed(newFeed);
		setIsEditTitle(false);

		try {

			const body = { noteId, title, sort, parentId };

			setIsUpdating(true);

			await fetch('/api/post', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			setIsUpdating(false);

		} catch (error) {
			console.error(error);
		}

	}

	const handleCancel = (isNewParam, noteId, parentId, sort) => {

		setIsEditTitle(false);

		console.log('isNewParam: '+isNewParam)

		if (isNewParam) {

			let newFeed = notesFeed.map((n) => {

				if (n.sort > sort && n.parentId === parentId) {
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

			console.log(newFeed)

			setTimeout(function () {
				setNotesFeed(newFeed);
				setCursorPosition(prevCursorPosition.current);
			},1);

		}

	}

	const handleDelete = (noteId, parentId, sort) => {



	}

	let position = 0;
	let familyCount = 0;

	return (
		<div className="row">
			<div className={`col ${styles.notes_list_col_1}`}>
				{/*<div>{isUpdating ? "true" : "false"}</div>*/}

				{!notesFeed.length && (
					<div className="new-note-hint">
						Press&nbsp;<span>Enter</span>&nbsp;to add your first note!
					</div>
				)}

				<div className={styles.notes_list}>

					{notesFeed.map((note, i) => {

						if (note.parentId === "root") {

							if (i > 0) {
								position += familyCount;
							}

							note.position = position;

							familyCount = getFamily(note.id, notesFeed).length;

							return (
								<NotesListItem

									key={note.id}
									id={note.id}
									sort={note.sort}
									position={position}
									familyCount={familyCount}
									title={note.title}
									complete={note.complete}
									feed={notesFeed}
									parentId={note.parentId}
									cursorPosition={cursorPosition}
									isFocus={note.position === cursorPosition}
									isEdit={note.position === cursorPosition && isEditTitle}
									isEditTitle={isEditTitle}
									onCancel={handleCancel}
									onFocus={(curId) => {
										focusId.current = curId;
									}}
									onEdit={handleEdit}
									onAdd={handleAdd}
									//onDelete={handleDelete}
									isNew={note.isNew}
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
								<div className={styles.key}>↑</div><div className={styles.key}>↓</div>
							</div>
							<div className={styles.hints_item_descr}>
								Navigate
							</div>
						</div>
						<div className={styles.hints_item}>
							<div className={styles.hints_item_key}>
								<div className={styles.key}>Ctrl + →</div>
							</div>
							<div className={styles.hints_item_descr}>
								Indent
							</div>
						</div>
						<div className={styles.hints_item}>
							<div className={styles.hints_item_key}>
								<div className={styles.key}>Ctrl + ←</div>
							</div>
							<div className={styles.hints_item_descr}>
								Outdent
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
				(id,
					// @ts-ignore
					[...r, ...more],
					s.add(node.id),
					[]
				)
		} else
			return removeFamily    // 3
				(id,
					more,
					s,
					[...r, node]
				)
	}


export const getFamily = (id: String, feed: NotesListItemProps[]) => {

	let familyFeed = []

	// @ts-ignore
	let noFamilyFeed = removeFamily(id, feed);

	let remainingIds = noFamilyFeed.map(n => (n.id));

	let allIds = feed.map(n => (n.id));

	let familyIds = [];

	allIds.map((id) => {
		if (!remainingIds.includes(id)) {
			familyIds.push(id);
		}
	});

	familyFeed = feed.filter(n => familyIds.includes(n.id));

	return familyFeed;

}

export default NotesList;
