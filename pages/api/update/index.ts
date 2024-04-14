// pages/api/note/index.ts

import { getSession } from 'next-auth/react';
import {createClient} from "@supabase/supabase-js";

export const config = {
	api: {
		externalResolver: true,
	},
}

export default async function handle(req, res) {

	const { prevFeed, feed, ids } = req.body;

	const session = await getSession({ req });

	const supabase = createClient(
		process.env.NEXT_SUPABASE_URL!,
		process.env.NEXT_SUPABASE_ANON_KEY!
	);

	let updatedNotes = [];
	let deletedIds = [];

	ids.map((id) => {

		// TODO вставлять элемент с нужными полями

		let curNote = feed.find(n => n.id === id);

		if (curNote == undefined) {

			deletedIds.push(id)

		} else {

			updatedNotes.push({
				id: id,
				title: curNote.title,
				sort: curNote.sort,
				parentId: curNote.parentId,
				// @ts-ignore
				authorId: session.user.id,
				complete: curNote.complete ? curNote.complete : false,
				collapsed: curNote.collapsed ? curNote.collapsed : false,
			});

		}



	});

	//console.log("deletedNotes")
	//console.log(deletedIds)

	const resultsUpdated = await supabase
		.from('Note')
		.upsert(updatedNotes)
		.select()

	const resultsDeleted = await supabase
		.from('Note')
		.delete()
		.in('id', deletedIds)

	console.log("done")

	//console.log(results)

	// const updateRow = async (id, sort, parentId, complete, collapsed, title) => {
	//
	// 	prisma.note.upsert({
	// 		where: {
	// 			id: id,
	// 		},
	//
	// 		update: {
	// 			sort: sort,
	// 			parentId: parentId,
	// 			complete: complete,
	// 			collapsed: collapsed,
	// 			title: title,
	// 		},
	//
	// 		create: {
	// 			id: id,
	// 			sort: sort,
	// 			parentId: parentId,
	// 			complete: complete,
	// 			collapsed: collapsed,
	// 			title: title,
	// 			author: { connect: { email: session?.user?.email } },
	// 		}
	//
	// 	})
	//
	// }
	// const deleteRow = async (id) => {
	//
	// 	prisma.note.delete({
	// 		where: {
	// 			id: id,
	// 		},
	// 	})
	//
	// }

	// const results = await prisma.$transaction(
	//
	// 	ids.map(async (id) => {
	//
	// 		let curNote = feed.find(n => n.id === id);
	//
	// 		if (curNote == undefined) {
	//
	// 			await prisma.note.delete({
	// 				where: {
	// 					id: id,
	// 				},
	// 			})
	//
	// 		} else {
	//
	// 			await prisma.note.upsert({
	// 				where: {
	// 					id: id,
	// 				},
	//
	// 				update: {
	// 					sort: curNote.sort,
	// 					parentId: curNote.parentId,
	// 					complete: curNote.complete,
	// 					collapsed: curNote.collapsed,
	// 					title: curNote.title,
	// 				},
	//
	// 				create: {
	// 					id: curNote.id,
	// 					sort: curNote.sort,
	// 					parentId: curNote.parentId,
	// 					complete: curNote.complete,
	// 					collapsed: curNote.collapsed,
	// 					title: curNote.title,
	// 					author: { connect: { email: session?.user?.email } },
	// 				}
	//
	// 			});
	//
	// 		}
	//
	// 	})
	//
	// ).then(() => console.log("done"));

	// const results = await Promise.all(
	//
	// 	ids.map(async id => {
	// 		let curNote = feed.find(n => n.id === id);
	// 		if (curNote == undefined) {
	// 			await deleteRow(id)
	// 		} else {
	// 			await updateRow(id, curNote.sort, curNote.parentId, curNote.complete, curNote.collapsed, curNote.title)
	// 		}
	// 	})
	//
	// ).then(() => console.log("done"))

	res.json(resultsUpdated);


}


// Deploy test