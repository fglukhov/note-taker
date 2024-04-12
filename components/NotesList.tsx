import React, {useState, useEffect, useRef, useContext} from "react";
import {NotesContext, useNotes} from "./NotesContext";
//import { useImmer } from 'use-immer';
import NotesListItem from "./NotesListItem";
import {NotesProvider} from "./NotesContext";
import {NotesListItemProps} from "./NotesListItem";
import {useKeyPress} from '../lib/useKeyPress';
import styles from './NotesList.module.scss'
import Router from "next/router";

type Props = {
	feed: NotesListItemProps[]
}

let updateTimeout = null;
//let reorderInterval = null;
let timeout = null;

const NotesList: React.FC<Props> = (props) => {

	const savedReorderCallback = useRef(null);
	const updatedIds = useRef([]);
	const savedUpdatedIds = useRef([]);

	const prevFeed = useRef(props.feed);
	const syncFeed = useRef(null);

	const eventKeyRef = useRef(null);
	const lastKeyRef = useRef(null);
	const focusId = useRef(null);
	const prevFocusId = useRef(null);

	const prevCursorPosition = useRef(null);
	const saveCursorPosition = useRef(null);
	const prevTitle = useRef(null);

	const [cursorPosition, setCursorPosition] = useState(0);
	const [notesFeed, setNotesFeed] = useState(props.feed);



	const [isEditTitle, setIsEditTitle] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [isChanged, setIsChanged] = useState(false);



	function reorderCallback() {

		// TODO нехорошо, что заметки не синхронизируются при открытой форме, но в противном случае сбивается сортировка

		if (isChanged && !isUpdating) {

			console.log('refresh')

			setIsChanged(false);
			setIsUpdating(true);

			reorderNotes(prevFeed.current, syncFeed.current, savedUpdatedIds.current).then(() => {
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

			if ((eventKeyRef.current === "ArrowUp" || eventKeyRef.current === "ArrowDown") && !isCtrlCommand) {

				event.preventDefault();

				lastKeyRef.current = null;
				clearTimeout(timeout);

				let curNote = notesFeed.find(n => n.id==focusId.current);

				let parentFamily = getFamily(curNote.parentId, notesFeed);

				// @ts-ignore
				let curNoteFamily = getFamily(curNote.id, notesFeed);

				let parentId = curNote.parentId;

				// const navIds = [];
				//
				// notesFeed.map(n => {
				//
				// 	if (n.parentId == parentId) {
				// 		navIds.push(n.id)
				// 	}
				//
				// });

				let prevNavId = null;

				notesFeed.map((n) => {

					if (n.position == cursorPosition - 1 && cursorPosition > 0) {

						prevNavId = n.id;

					}

				});


				// TODO искать не соседей одного уровня, а все заметки по position

				let prevNav = notesFeed.find(n => n.id==prevNavId);


				let positionShift = 0;

				if (curNote.collapsed && eventKeyRef.current == "ArrowDown") {

					positionShift = curNoteFamily.length - 1;

				}

				// if (prevNav !== undefined && prevNav.collapsed && eventKeyRef.current == "ArrowUp") {
				//
				// 	console.log(prevNav.title)
				//
				// 	let prevNoteFamily = getFamily(prevNavId, notesFeed);
				//
				// 	positionShift = prevNoteFamily.length - 1;
				//
				// }
					//console.log(cursorPosition)



				if (eventKeyRef.current === "ArrowUp" && cursorPosition > 0) {


					setCursorPosition(cursorPosition - 1);
					saveCursorPosition.current = cursorPosition - 1;

					let navNote = notesFeed.find(n => n.id == focusId.current);

					// TODO определить, есть ли у navNote свернутый родитель и посчитать размер его семьи

					let isCollapsedParent = false;

					let navParentId = navNote.parentId;

					let navParents = [];

					while (navParentId != undefined && navParentId != "root") {

						let navParent = notesFeed.find(n => n.id == navParentId);

						navParents.push({
							id: navParentId,
							collapsed: navParent.collapsed
						})

						navParentId = navParent.parentId;

					}

					let navParentsReverted = navParents.reverse();

					for (var i = 0; i < navParentsReverted.length; i++) {
						if (navParentsReverted[i].collapsed) {
							positionShift = getFamily(navParentsReverted[i].id, notesFeed).length;
							break;
						}
					}

					if (positionShift != 0) {
						setCursorPosition(saveCursorPosition.current - positionShift + 1);
					}

				} else if (eventKeyRef.current === "ArrowDown" && cursorPosition + positionShift < notesFeed.length - 1 && cursorPosition !== null) {
					setCursorPosition(cursorPosition + 1 + positionShift);
				} else if (eventKeyRef.current === "ArrowDown" && cursorPosition === null) {
					setCursorPosition(0);
				}

			}

			// Edit note title on "ee"

			if (eventKeyRef.current === "KeyE" && lastKeyRef.current === "KeyE" && !isEditTitle) {

				clearTimeout(timeout);
				lastKeyRef.current = null;

				setTimeout(function () {

					setIsEditTitle(true);

				},1)

			}

			// Open full note on "nn"

			if (eventKeyRef.current === "KeyN" && lastKeyRef.current === "KeyN" && !isEditTitle) {

				let curNote = notesFeed.find(n => n.id==focusId.current);

				Router.push("/n/[id]", `/n/${curNote.id}`)

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

					syncFeed.current = newFeed;

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

				let curNoteSiblings = notesFeed.filter(n => n.parentId === curNote.parentId);

				let parentFamily = getFamily(curNote.parentId, notesFeed);

				// @ts-ignore
				let curNoteFamily = removeFamily(curNote.id, parentFamily);

				let positionShift = 0;

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

					syncFeed.current = newFeed;

					setNotesFeed(newFeed);
					setCursorPosition(cursorPosition + positionShift)


					// unindentNote(curNote.id, parentId, newParentId, newSort, curNote.sort, curParent.sort).then(() => {
					// 	setNotesFeed(newFeed);
					// 	setCursorPosition(cursorPosition + positionShift)
					// });

				}

			}

			// Collapse

			if ((eventKeyRef.current == "ArrowRight" || eventKeyRef.current == "ArrowLeft") && !isCtrlCommand && !isEditTitle) {

				let collapsed = false;

				if (eventKeyRef.current == "ArrowLeft") {
					collapsed = true;
				}

				if (updateTimeout) {
					clearTimeout(updateTimeout);
				}

				let curNote = notesFeed.find(n => n.id==focusId.current);

				let newFeed = notesFeed.map((n, i) => {
					if (n.id === curNote.id) {

						if (!updatedIds.current.includes(n.id)) updatedIds.current.push(n.id)

						return {
							...n,
							collapsed: collapsed,
						}

					}
					else {
						return n;
					}

				});

				newFeed.sort((a,b) => a.sort - b.sort);

				updateTimeout = setTimeout(function () {

					setIsChanged(true);

					savedUpdatedIds.current = updatedIds.current;

					updatedIds.current = [];

				}, 1000);

				syncFeed.current = newFeed;

				setNotesFeed(newFeed);

			}


			// Sort

			if ((eventKeyRef.current == "ArrowUp" || eventKeyRef.current == "ArrowDown") && isCtrlCommand && !isEditTitle) {



				if (updateTimeout) {
					clearTimeout(updateTimeout);
				}
				
				let sortShift = 0;

				let curNote = notesFeed.find(n => n.id==focusId.current);
				let parentId = curNote.parentId;

				let curNoteSiblings = notesFeed.filter(n => n.parentId === curNote.parentId);

				let shiftedNote = null;

				if (eventKeyRef.current == "ArrowUp") {
					if (curNote.sort > 0) {
						sortShift = -1;

						shiftedNote = curNoteSiblings.filter(n => n.sort == curNote.sort-1)[0];

					}
				} else if (eventKeyRef.current == "ArrowDown") {

					if (curNote.sort < curNoteSiblings.length-1) {
						sortShift = 1;

						shiftedNote = curNoteSiblings.filter(n => n.sort == curNote.sort+1)[0];

					}
				}

				if (sortShift !=0) {
					let shiftedNoteFamily = getFamily(shiftedNote.id, notesFeed);

					updatedIds.current.push(curNote.id)
					updatedIds.current.push(shiftedNote.id)

					let newFeed = notesFeed.map((n) => {

						if (n.id === curNote.id) {
							return {
								...n,
								sort: n.sort + sortShift
							}
						} else if (n.id === shiftedNote.id) {
							return {
								...n,
								sort: n.sort - sortShift
							}
						} else {
							return n;
						}

					});

					newFeed.sort((a, b) => a.sort - b.sort);


					updateTimeout = setTimeout(function () {

						setIsChanged(true);

						savedUpdatedIds.current = updatedIds.current;

						updatedIds.current = [];

					}, 1000);

					syncFeed.current = newFeed;

					setNotesFeed(newFeed);

					setCursorPosition(cursorPosition + sortShift * shiftedNoteFamily.length)

				}
			}

			// Complete

			if (eventKeyRef.current == "Space" && !isEditTitle) {

				event.preventDefault();

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

				syncFeed.current = newFeed;

				setNotesFeed(newFeed);

			}

			// Delete

			if (eventKeyRef.current == "Delete" && !isEditTitle) {

				handleDelete();

			}

			if (eventKeyRef.current == "Enter" && !isEditTitle) {

				insertNote(event);

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


	const insertNote = (event) => {

		if (event == null) {

			event = {
				shiftKey: false,
				altKey: false
			}

		}

		// TODO вынести в функцию, которую вызывать и после сабмита, чтобы сразу добавлялась новая заметка

		prevFocusId.current = focusId.current;
		prevCursorPosition.current = cursorPosition;

		clearTimeout(timeout);
		lastKeyRef.current = null;

		let newId = crypto.randomUUID();

		let curNote = notesFeed.find(n => n.id==focusId.current);

		if (curNote !== undefined) {

			prevTitle.current = curNote.title;
		}



		let parentId;

		let insertChild = false;

		let newSort = 0;

		if (!notesFeed.length) {

			parentId = "root";

		} else {

			if (event.shiftKey === true) {

				insertChild = true;

				parentId = curNote.id;

			} else {

				parentId = curNote.parentId;

				if (event.altKey) {
					newSort = curNote.sort;
				} else {
					newSort = curNote.sort + 1;
				}


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

				if (!insertChild && event.altKey) {

					insertAt = cursorPosition

				} else {

					insertAt = cursorPosition + getFamily(curNote.id, notesFeed).length

				}

			}

		}

		let newNote:NotesListItemProps = {
			id: newId,
			title: "",
			sort: newSort,
			//position: insertAt,
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
			} else if (insertChild && n.id == parentId) {
				return {
					...n,
					collapsed: false
				}
			} else {
				return n;
			}

		});

		newFeed.sort((a,b) => a.sort - b.sort);

		// TODO подумать, как убрать этот таймаут. Он нужен для того, чтобы форма новой заметки сразу не отправлялась.

		setTimeout(function () {

			setCursorPosition(insertAt);
			setIsEditTitle(true);
			setNotesFeed(newFeed);

		}, 1);



	}


	// TODO feed and updatedIds are parameters
	const reorderNotes = async (prevFeed, feed, ids) => {

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

	

	const handleEdit = (noteId, title) => {

		if (updateTimeout) {
			clearTimeout(updateTimeout);
		}

		let curNote = notesFeed.find(n => n.id==noteId);

		let newFeed = notesFeed.map((n) => {
			if (n.id === noteId) {
				return {
					...n,
					title: title,
					isNew: false
				}
			} else {
				return n;
			}
		});


		setIsEditTitle(false);


		updatedIds.current.push(noteId);

		if (curNote.isNew) {

			newFeed.map(n => {

				if (n.parentId == curNote.parentId && n.sort >= curNote.sort && n.id != noteId) {

					updatedIds.current.push(n.id);

				}

			});

			const newId = crypto.randomUUID();

			newFeed = [
				...newFeed,
				{
					id: newId,
					title: "",
					sort: curNote.sort + 1,
					//position: insertAt,
					isNew: true,
					parentId: curNote.parentId
				}
			];

			syncFeed.current = newFeed;

			newFeed = newFeed.map((n) => {

				if (n.sort > curNote.sort  && n.parentId == curNote.parentId && n.id != newId) {
					return {
						...n,
						sort: n.sort + 1
					}
				} else {
					return n;
				}

			});

			newFeed.sort((a,b) => a.sort - b.sort);

			setIsEditTitle(true)

			prevCursorPosition.current = cursorPosition;

			setCursorPosition(cursorPosition + 1)

		}




		updateTimeout = setTimeout(function () {

			setIsChanged(true);

			savedUpdatedIds.current = updatedIds.current;

			updatedIds.current = [];

		}, 1000);

		syncFeed.current = newFeed;

		setNotesFeed(newFeed);

	}

	const handleCancel = (isNewParam, noteId, parentId, sort) => {

		setIsEditTitle(false);

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

			// updatedIds.current = updatedIds.current.filter(id => {id != noteId});
			//
			// console.log(updatedIds.current)

			//setTimeout(function () {
				setNotesFeed(newFeed);
				setCursorPosition(prevCursorPosition.current);
			//},1);

		}

	}

	const handleDelete = () => {

		setIsEditTitle(false);

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

		removedIds.map(id => {
			if (!updatedIds.current.includes(id)) updatedIds.current.push(id)
		})

		//const deletedCount = notesFeed.length - newFeed.length;

		notesFeed.map(n => {
			if (n.parentId === curNote.parentId && n.sort > curNote.sort) updatedIds.current.push(n.id)
		})

		let newFeed = notesFeed.filter(n => {

			return !removedIds.includes(n.id)

		});

		newFeed = newFeed.map((n) => {

			if (n.parentId === curNote.parentId && n.sort > curNote.sort) {
				return {
					...n,
					sort: n.sort - 1
				}
			} else {
				return n;
			}

		});

		//console.log(newFeed)

		updateTimeout = setTimeout(function () {

			setIsChanged(true);

			savedUpdatedIds.current = updatedIds.current;

			updatedIds.current = [];


		}, 1000);

		syncFeed.current = newFeed;

		setNotesFeed(newFeed);

		//console.log(cursorPosition +" : "+ newFeed.length)
		if (cursorPosition > newFeed.length - 1) {
			setCursorPosition(newFeed.length - 1)
		}

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



					<NotesProvider feed={notesFeed}>

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
										collapsed={note.collapsed}
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
										onAdd={handleEdit}
										onDelete={handleDelete}
										isNew={note.isNew}
									/>
								)

							}

						})}

					</NotesProvider>

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
								<div className={styles.key}>Alt + Enter</div>
							</div>
							<div className={styles.hints_item_descr}>
								Add above
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
								<div className={styles.key}>nn</div>
							</div>
							<div className={styles.hints_item_descr}>
								Open note
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
								<div className={styles.key}>←</div><div className={styles.key}>→</div>
							</div>
							<div className={styles.hints_item_descr}>
								Collapse/expand
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
								<div className={styles.key}>Ctrl + ↑</div>
								<div className={styles.key}>Ctrl + ↓</div>
							</div>
							<div className={styles.hints_item_descr}>
								Reorder notes
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
