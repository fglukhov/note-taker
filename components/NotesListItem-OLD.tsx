import React, {ReactNode, useState} from "react";
import {useKeyPress} from '../lib/useKeyPress';
//import {useReducer} from "react";
//import ReactMarkdown from "react-markdown";
//import children = ReactMarkdown.propTypes.children;

export type NotesListItemProps = {
	id: string;
	title: string;
	sort?: number;
	parentPosition?: number;
	feed?: NotesListItemProps[];
	cursorPosition?: number;
	isEdit?: boolean;
	isEditTitle?: boolean;
	isFocus?: boolean;
	isNew?: boolean;
	children?: ReactNode;
	onFocus?: (id) => any;
	onCancel?: (isNewParam, noteId) => any;
	onEdit?: () => any;
	onAdd?: () => any;
	onDelete?: (noteId, parentId, childIds) => any;
	parentId?: string;
	childIds: string[];
}

const NotesListItem: React.FC<NotesListItemProps> = (props) => {

	const id = props.id;
	const parentId = props.parentId;
	const childIds = props.childIds;
	const [title, setTitle] = useState(props.title);
	const sort = props.sort;
	const [prevTitle, setPrevTitle] = useState(props.title);
	const [isNew, setIsNew] = useState(props.isNew);

	//const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

	const deleteNote = async () => {

		const body = { id, title, sort, parentId, childIds };

		await fetch(`/api/delete/${id}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

	}

	const onKeyPress = (event) => {
		let eventKey = event.key;

		// console.log(eventKey);
		// console.log(props.isFocus);

		if (eventKey == "Escape") {

			if (props.isFocus) {

				if (props.isEdit) {

					if (!isNew) {

						setTitle(prevTitle);

					}

					props.onCancel(isNew, id);

				}

			}

		}

		if (eventKey == "Delete") {

			if (!props.isEdit && props.isFocus) {

				deleteNote().then(() => {
					props.onDelete(id, parentId, childIds);
				});

			}

		}

	}

	// test

	// важно: здесь ставим стейт со старым заголовком и используем его при отмене или Esc

	const editTitle = async (e: React.SyntheticEvent) => {
		e.preventDefault();

		if (!isNew) {

			// editing note

			try {
				const body = { title };
				await fetch(`/api/edit/${id}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				});

				setTitle(title);
				setPrevTitle(title);

			} catch (error) {
				console.error(error);
			}

		} else {

			// Adding new note

			try {
				const body = { id, title, sort, parentId };

				await fetch('/api/post', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				});

				setIsNew(false);

			} catch (error) {
				console.error(error);
			}

		}



	};

	useKeyPress([], onKeyPress);

	if (props.isFocus) {
		props.onFocus(props.id);
	}

	return (

		<div className={"notes-list-item " + (props.isFocus ? "focus" : "")} id={props.id}>

			{!(props.isEdit && props.isFocus) ? (
				<div className="notes-list-item-title-wrapper">
					<div className="notes-item-title">
						{ props.sort + ": " + title }
					</div>
				</div>
			) : (
				<div className="notes-list-item-title-wrapper">

					<div className="notes-item-title-form">
						<div>{ props.sort }</div>
						<form onSubmit={(e) => {
							editTitle(e).then(() => {
								if (!isNew) {
									props.onEdit();
								} else {
									setIsNew(false);
									setPrevTitle(title);
									props.onAdd();
								}
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

			{props.childIds && (

				// TODO выводим список детей

				<div>

					{props.childIds.map((c, i) => {

						let childNote = props.feed.filter(f => {
							return f.id === c
						})[0];

						childNote.parentId = props.id;
						// childNote.parentId = "test";

						return (
							<NotesListItem
								key={childNote.id}
								id={childNote.id}
								sort={childNote.sort}
								title={childNote.title}
								feed={props.feed}
								parentId={childNote.parentId}
								childIds={childNote.childIds}
								cursorPosition={props.cursorPosition}
								isFocus={childNote.sort === props.cursorPosition}
								isEdit={(childNote.sort === props.cursorPosition && props.isEditTitle)}
								isEditTitle={props.isEditTitle}
								onFocus={props.onFocus}
								onCancel={props.onCancel}
								onEdit={props.onEdit}
								onAdd={props.onAdd}
								onDelete={props.onDelete}
								isNew={childNote.isNew ? true : false}
							/>
						)

					})}

				</div>

			)}

			<style jsx>{`
				.notes-list-item {
				}
				
				.notes-list-item-title-wrapper {
					background: white;
					transition: box-shadow 0.1s ease-in;
					padding: 10px 20px;
				}

				.notes-list-item.focus > .notes-list-item-title-wrapper {
					background: #d1eaff;
				}

				.notes-list-item:hover {
					box-shadow: 1px 1px 3px #aaa;
				}

				.notes-list-item + .notes-list-item {
					margin-top: 1px;
				}
				
				.notes-list-item .notes-list-item {
					margin-left: 30px;
					margin-top: 1px;
				}
				
			`}</style>

		</div>

	)


}


export default NotesListItem;
