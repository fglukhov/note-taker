// pages/api/note/index.ts

import { getSession } from 'next-auth/react';
import {createClient} from "@supabase/supabase-js";

export const config = {
	api: {
		externalResolver: true,
	},
}

export default async function handle(req, res) {

	const { feed, newId, ids } = req.body;

	const session = await getSession({ req });

	const supabase = createClient(
		process.env.NEXT_SUPABASE_URL!,
		process.env.NEXT_SUPABASE_ANON_KEY!
	);

	let updatedNotes = [];
	let addedNote = null;



	ids.map((id) => {

		let curNote = feed.find(n => n.id === id);

		if (id == newId) {

			addedNote = {
				id: id,
				title: curNote.title,
				sort: curNote.sort,
				parentId: curNote.parentId,
				// @ts-ignore
				authorId: session.user.id,
			}

		} else {

			updatedNotes.push({
				id: id,
				sort: curNote.sort,
			});


		}


	});

	//console.log("deletedNotes")
	//console.log(deletedIds)

	const resultsAdded = await supabase
		.from('Note')
		.insert(addedNote)
		.select()

	const resultsUpdated = await supabase
		.rpc(
			'update_notes_order',
			{payload: updatedNotes}
		);

	// const resultsUpdated = await supabase
	// 	.from('Note')
	// 	.upsert(updatedNotes)
	// 	.select()

	//console.log(updatedNotes)

	res.json(resultsUpdated);


}


// Deploy test