// pages/api/note/index.ts

import { getSession } from 'next-auth/react';
import prisma from '../../../lib/prisma';

// POST /api/note
// Required fields in body: title
// Optional fields in body: content

export const config = {
	api: {
		externalResolver: true,
	},
}

export default async function handle(req, res) {

	const { prevFeed, feed, ids } = req.body;

	const session = await getSession({ req });

	const updateRow = async (id, sort, parentId, complete, title) => {

		await prisma.note.upsert({
			where: {
				id: id,
			},

			update: {
				sort: sort,
				parentId: parentId,
				complete: complete,
				title: title,
			},

			create: {
				id: id,
				sort: sort,
				parentId: parentId,
				title: title,
				author: { connect: { email: session?.user?.email } },
			}

		})

	}
	const deleteRow = async (id) => {

		await prisma.note.delete({
			where: {
				id: id,
			},
		})

	}



	const results = await Promise.all(

		ids.map(id => {
			let curNote = feed.find(n => n.id === id);
			if (curNote == undefined) {
				deleteRow(id)
			} else {
				updateRow(id, curNote.sort, curNote.parentId, curNote.complete, curNote.title)
			}
		})
	)

	res.json(results);

}


// Deploy test