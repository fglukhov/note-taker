// pages/api/note/index.ts

import { getSession } from 'next-auth/react';
import prisma from '../../../lib/prisma';

// POST /api/note
// Required fields in body: title
// Optional fields in body: content
export default async function handle(req, res) {

	const { noteId, title, sort, parentId } = req.body;

	console.log(noteId)

	const session = await getSession({ req });

	const result = await prisma.note.create({
		data: {
			id: noteId,
			title: title,
			sort: sort,
			author: { connect: { email: session?.user?.email } },
			parentId: parentId,
		},
	});

	const updateSort = await prisma.note.updateMany({
		where: {
			// @ts-ignore
			authorId: session.user.id,
			parentId: parentId,
			sort: {
				gt: sort-1
			},
			NOT: {
				id: noteId
			},
		},
		data: {
			sort: {
				increment: 1,
			}
		},
	})

	res.json(result);
}

// Deploy test