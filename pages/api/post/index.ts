// pages/api/note/index.ts

import { getSession } from 'next-auth/react';
import prisma from '../../../lib/prisma';

// POST /api/note
// Required fields in body: title
// Optional fields in body: content
export default async function handle(req, res) {
	const { id, title, content, sort, parentId } = req.body;

	console.log(parentId)

	const session = await getSession({ req });
	const result = await prisma.note.create({
		data: {
			id: id,
			title: title,
			sort: sort,
			content: content,
			author: { connect: { email: session?.user?.email } },
			parentId: parentId,
		},
	});

	const updateSort = await prisma.note.updateMany({
		where: {
			// @ts-ignore
			authorId: session.user.id,
			sort: {
				gt: sort-1
			},
			NOT: {
				id: id
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