import React, {useState, useEffect, useRef} from "react";
import NotesListItem from "./NotesListItem";
import {NotesProvider} from "./NotesContext";
import {NotesListItemProps} from "./NotesListItem";
import {useKeyPress} from '../lib/useKeyPress';
import styles from './NotesList.module.scss'
import Router from "next/router";

// TODO привести в порядок типы
// TODO обновление страницы по cmd+R
// TODO запоминаем текущую позицию при обновлении и скроллим к ней

type Props = {
	feed: NotesListItemProps[]
}

let updateTimeout: ReturnType<typeof setTimeout> | null = null;
//let reorderInterval = null;
let timeout: ReturnType<typeof setTimeout> | null = null;

const NotesList: React.FC<Props> = (props) => {

	const reorderTimeoutRef = useRef<number | null>(null);

	const updatedIds = useRef<string[]>([]);
	const savedUpdatedIds = useRef<string[]>([]);

	const prevFeed = useRef(props.feed);
	const syncFeed = useRef<NotesListItemProps[] | null>(null);

	const eventKeyRef = useRef<string | null>(null);
	const lastKeyRef = useRef<string | null>(null);
	const focusId = useRef<string | null>(null);
	const prevFocusId = useRef<string | null>(null);

	const prevCursorPosition = useRef<number | null>(null);
	const saveCursorPosition = useRef<number | null>(null);
	const prevTitle = useRef<string | null>(null);

	const [cursorPosition, setCursorPosition] = useState(0);
	const [notesFeed, setNotesFeed] = useState(props.feed);



	const [isEditTitle, setIsEditTitle] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [isChanged, setIsChanged] = useState(false);

	const isChangedRef = useRef(isChanged);


	const hiddenRangesRef = useRef<{start:number; end:number}[]>([]);



	function reorderCallback() {

		// TODO нехорошо, что заметки не синхронизируются при открытой форме, но в противном случае сбивается сортировка

		if (isChanged && !isUpdating) {

			console.log('refresh')

			setIsChanged(false);
			setIsUpdating(true);

			reorderNotes(prevFeed.current, syncFeed.current, savedUpdatedIds.current)
				.then(() => {
					setIsUpdating(false);

					// если пока отправляли — появились новые изменения, отправим ещё раз
					if (isChangedRef.current) {
						reorderCallback();
					}
				})
				.catch((err: unknown) => {
					console.error(err);

					setIsUpdating(false);

					// можно тоже повторить попытку, если во время ошибки были изменения
					if (isChangedRef.current) {
						reorderCallback();
					}
				});


		}

	}

	useEffect(() => {
		if (!isChanged) return;

		// если пользователь продолжает что-то делать — сбрасываем таймер
		if (reorderTimeoutRef.current) {
			clearTimeout(reorderTimeoutRef.current);
		}

		reorderTimeoutRef.current = window.setTimeout(() => {
			reorderCallback();
			reorderTimeoutRef.current = null;
		}, 800);
	}, [isChanged, notesFeed]);

	useEffect(() => {
		isChangedRef.current = isChanged;
	}, [isChanged]);




	const onKeyPress = (event: KeyboardEvent): void => {

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

				// @ts-ignore
				let curNoteFamily = getFamily(curNote.id, notesFeed);

				// TODO искать не соседей одного уровня, а все заметки по position

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


					let nextPos = cursorPosition - 1;

					// если попали внутрь любого скрытого диапазона — прыгаем на его начало
					for (const range of hiddenRangesRef.current) {
						if (nextPos > range.start && nextPos <= range.end) {
							nextPos = range.start;
							break;
						}
					}

					setCursorPosition(nextPos);
					saveCursorPosition.current = nextPos;

					let navNote = notesFeed.find(n => n.id == focusId.current);

					// TODO определить, есть ли у navNote свернутый родитель и посчитать размер его семьи

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

					for (let i = 0; i < navParentsReverted.length; i++) {
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

				event.preventDefault();

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

					const newFeed = notesFeed.map((n) => {
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

				event.preventDefault();

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

					let newFeed = notesFeed.map((n) => {
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

				event.preventDefault();

				let collapsed = false;

				if (eventKeyRef.current == "ArrowLeft") {
					collapsed = true;
				}

				if (updateTimeout) {
					clearTimeout(updateTimeout);
				}

				let curNote = notesFeed.find(n => n.id==focusId.current);

				let newFeed = notesFeed.map((n) => {
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

				event.preventDefault();

				if (updateTimeout) {
					clearTimeout(updateTimeout);
				}
				
				let sortShift = 0;

				let curNote = notesFeed.find(n => n.id==focusId.current);

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


	const insertNote = (event: KeyboardEvent | { shiftKey: boolean; altKey: boolean } | null): void => {

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
	const reorderNotes = async (prevFeed: NotesListItemProps[], feed: NotesListItemProps[] | null, ids: string[]): Promise<void> => {

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

	

	const handleEdit = (noteId: string, title: string): void => {

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

	const handleCancel = (isNewParam: boolean, noteId: string, parentId: string | undefined, sort: number | undefined): void => {

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

	const registerCollapsedRange = (start:number, familyCount:number, collapsed?:boolean) => {
		if (collapsed) {
			hiddenRangesRef.current.push({ start, end: start + familyCount - 1 });
		}
	};


	let position = 0;
	let familyCount = 0;

	hiddenRangesRef.current = [];

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

								//note.position = position;

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
										// isFocus={note.position === cursorPosition}
										// isEdit={note.position === cursorPosition && isEditTitle}
										isFocus={position === cursorPosition}
										isEdit={position === cursorPosition && isEditTitle}
										isEditTitle={isEditTitle}
										onCancel={handleCancel}
										onFocus={(curId) => {
											focusId.current = curId;
										}}
										onEdit={handleEdit}
										onAdd={handleEdit}
										onDelete={handleDelete}
										isNew={note.isNew}
										registerCollapsedRange={registerCollapsedRange}
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

export const removeFamily = (
	id: string,
	[node, ...more]: NotesListItemProps[] = [],
	s: Set<string> = new Set([id]),
	r: NotesListItemProps[] = []
): NotesListItemProps[] => {
	if (node === undefined)
		return r;
	const nextSet = new Set(s);
	nextSet.add(node.id);
	if (s.has(node.id) || (node.parentId != null && s.has(node.parentId))) {
		return removeFamily(id, [...r, ...more], nextSet, []);
	}
	return removeFamily(id, more, s, [...r, node]);
};

const buildChildrenIndex = (feed: NotesListItemProps[]) => {
	const childrenByParentId: Record<string, NotesListItemProps[]> = {};

	for (const n of feed) {
		const pid = (n.parentId ?? "root") as string;
		if (!childrenByParentId[pid]) childrenByParentId[pid] = [];
		childrenByParentId[pid].push(n);
	}

	// порядок детей по sort, чтобы было стабильно
	for (const pid in childrenByParentId) {
		childrenByParentId[pid].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
	}

	return childrenByParentId;
};


export const getFamily = (id: string, feed: NotesListItemProps[]) => {
	const childrenByParentId = buildChildrenIndex(feed);

	const self = feed.find(n => n.id === id);
	if (!self) return [];

	const result: NotesListItemProps[] = [self];
	const stack: string[] = [id];
	const visited = new Set<string>(); // защита от циклов

	while (stack.length) {
		const curId = stack.pop()!;
		if (visited.has(curId)) continue;
		visited.add(curId);

		const children = childrenByParentId[curId] ?? [];
		for (const ch of children) {
			result.push(ch);
			stack.push(ch.id);
		}
	}

	return result;
};





export default NotesList;
