import React, {ReactNode, useState} from "react";
import {useKeyPress} from '../lib/useKeyPress';
import {useReducer} from "react";

export type NotesListItemProps = {
	id: string;
	title: string;
	sort?: number;
	isEdit?: boolean;
	isFocus?: boolean;
	isNew?: boolean;
	children?: ReactNode;
	onCancel?: (isNewParam) => any;
	onEdit?: () => any;
	onAdd?: () => any;
	onDelete?: () => any;
}

const NotesListItem: React.FC<NotesListItemProps> = (props) => {

	const id = props.id;
	const [title, setTitle] = useState(props.title);
	const sort = props.sort;
	const [prevTitle, setPrevTitle] = useState(props.title);
	const [isNew, setIsNew] = useState(props.isNew);

	//const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

	const deleteNote = async () => {
		console.log('Delete note ' + id)

		const body = { id, title, sort };

		await fetch(`/api/delete/${id}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

	}

	const onKeyPress = (event) => {
		let eventKey = event.key;

		console.log(eventKey);

		if (eventKey == "Escape") {

			if (props.isEdit) {

				if (!isNew) {

					setTitle(prevTitle);

				}

				props.onCancel(isNew);

			}


		}

		if (eventKey == "Delete") {

			if (!props.isEdit && props.isFocus) {

				deleteNote().then(() => {
					props.onDelete();
				});

			}

		}

	}


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
				const body = { id, title, sort };

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

	return (

		<div className={"notes-list-item " + (props.isFocus ? "focus" : "")} id={props.id}>

			{/*{(isNew) ? "NEW" : "OLD"}*/}

			{!(props.isEdit && props.isFocus) ? (
				<div className="notes-item-title">
					{title}
				</div>
			) : (
				<div>

					<div className="notes-item-title-form">
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

			<style jsx>{`
				.notes-list-item {
					background: white;
					transition: box-shadow 0.1s ease-in;
					padding: 10px 20px;
				}

				.notes-list-item.focus {
					background: #d1eaff;
				}

				.notes-list-item:hover {
					box-shadow: 1px 1px 3px #aaa;
				}

				.notes-list-item + .notes-list-item {
					margin-top: 1px;
				}
			`}</style>

		</div>

	)


}


export default NotesListItem;
