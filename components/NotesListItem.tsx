import React, {ReactNode, useState, useRef} from "react";
import {useKeyPress} from '../lib/useKeyPress';
import {getFamily, removeFamily} from "./NotesList";
import styles from './NotesListItem.module.scss'

export type NotesListItemProps = {
	id: string;
	title: string;
	sort?: number;
	familyCount?: number;
	position?: number;
	parentPosition?: number;
	feed?: NotesListItemProps[];
	cursorPosition?: number;
	isEdit?: boolean;
	isEditTitle?: boolean;
	isFocus?: boolean;
	isNew?: boolean;
	children?: ReactNode;
	onFocus?: (id) => any;
	onCancel?: (isNewParam, noteId, parentId, sort) => any;
	onEdit?: (noteId, title) => any;
	onAdd?: (noteId, title) => any;
	onComplete?: (noteId, isComplete) => any;
	onDelete?: (noteId) => any;
	parentId?: string;
	complete?: boolean;
}

const NotesListItem: React.FC<NotesListItemProps> = (props) => {

	const id = props.id;
	const parentId = props.parentId;
	const [title, setTitle] = useState(props.title);
	const sort = props.sort;
	const [prevTitle, setPrevTitle] = useState(props.title);
	const [isNew, setIsNew] = useState(props.isNew);
	//const [complete, setComplete] = useState(props.complete);



	const eventKeyRef = useRef(null);
	const lastKeyRef = useRef(null);

	//const [ignored, forceUpdate] = useReducer(x => x + 1, 0);




	const onKeyPress = (event) => {

		eventKeyRef.current = event.code;

		if (eventKeyRef.current == "Escape") {

			console.log("esc")

			event.preventDefault();

			if (props.isFocus) {

				console.log(props.isFocus)

				if (props.isEdit) {

					if (!isNew) {

						setTitle(prevTitle);

					}

					props.onCancel(isNew, id, parentId, sort);

				}

			}

		}





	}

	const editTitle = async (e: React.SyntheticEvent) => {

		e.preventDefault();

		if (!isNew) {

			// editing note

			try {
				const body = { title };

				setTitle(title);
				setPrevTitle(title);

				await fetch(`/api/edit/${id}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				});


			} catch (error) {
				console.error(error);
			}

		} else {

			// Adding new note

			try {
				const body = { id, title, sort, parentId };

				setIsNew(false);


				await fetch('/api/post', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				});


			} catch (error) {
				console.error(error);
			}

		}

	};

	useKeyPress([], onKeyPress);

	if (props.isFocus) {
		props.onFocus(props.id);
	}

	let position = props.position + 1;
	let familyCount = 0;

	return (

		<div className={styles.notes_list_item + (props.isFocus ? " "+styles.focus : "") + (props.complete ? " "+styles.complete : "")} id={props.id}>

			{!(props.isEdit && props.isFocus) ? (
				<div className={styles.notes_list_item_title_wrapper}>
					<div className="notes-item-title">
						{ title }
					</div>
				</div>
			) : (
				<div className={styles.notes_list_item_title_wrapper}>

					<div className={styles.notes_list_item_form}>

						<form onSubmit={(e) => {
							if (!isNew) {
								props.onEdit(id, title);
							} else {
								setIsNew(false);
								setPrevTitle(title);
								props.onAdd(id, title);
							}
							editTitle(e).catch((error) => {
								alert(error);
							});
						}}>
							<input
								autoFocus
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Title"
								type="text"
								value={title}
							/>
						</form>
					</div>
				</div>
			)}

			{props.feed.map((childNote, i) => {

				if (childNote.parentId == props.id) {

					if (i > 0) {
						position += familyCount;
					}

					familyCount = getFamily(childNote.id, props.feed).length;

					return (
						<NotesListItem
							key={childNote.id}
							id={childNote.id}
							sort={childNote.sort}
							position={position}
							familyCount={familyCount}
							title={childNote.title}
							complete={childNote.complete}
							feed={props.feed}
							parentId={childNote.parentId}
							cursorPosition={props.cursorPosition}
							isFocus={position === props.cursorPosition}
							isEdit={(position === props.cursorPosition && props.isEditTitle)}
							isEditTitle={props.isEditTitle}
							onFocus={props.onFocus}
							onComplete={props.onComplete}
							onCancel={props.onCancel}
							onEdit={props.onEdit}
							onAdd={props.onAdd}
							onDelete={props.onDelete}
							isNew={childNote.isNew}
						/>
					)

				}

			})}

		</div>

	)


}



export default NotesListItem;
