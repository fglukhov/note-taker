import { createContext, useContext, useReducer } from 'react';

export const NotesContext = createContext(null);
export const NotesDispatchContext = createContext(null);

export function NotesProvider({ feed, children }) {
	const [tasks, dispatch] = useReducer(
		notesReducer,
		feed
	);

	return (
		<NotesContext.Provider value={feed}>
			<NotesDispatchContext.Provider value={dispatch}>
				{children}
			</NotesDispatchContext.Provider>
		</NotesContext.Provider>
	);
}

export function useNotes() {
	return useContext(NotesContext);
}

export function useNotesDispatch() {
	return useContext(NotesDispatchContext);
}

function notesReducer(notes, action) {
	switch (action.type) {
		case 'added': {
			return [
				// Items before the insertion point:
				...notes.slice(0, action.sort),
				// New item:
				{
					id: action.id,
					title: action.title,
					sort: action.sort,
					isNew: action.isNew
				},
				// Items after the insertion point:
				...notes.slice(action.sort)
			];
		}
		case 'cancel': {
			return [
				notes.filter(n =>
					n.id !== action.id
				)
			];
		}
		// case 'changed': {
		// 	return tasks.map(t => {
		// 		if (t.id === action.task.id) {
		// 			return action.task;
		// 		} else {
		// 			return t;
		// 		}
		// 	});
		// }
		// case 'deleted': {
		// 	return tasks.filter(t => t.id !== action.id);
		// }
		default: {
			throw Error('Unknown action: ' + action.type);
		}
	}
}