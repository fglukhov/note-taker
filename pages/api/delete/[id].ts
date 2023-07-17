// pages/api/post/[id].ts

import prisma from '../../../lib/prisma';
import {getSession} from "next-auth/react";

// DELETE /api/delete/:id
export default async function handle(req, res) {

	const noteId = req.query.id;

	const { id, title, sort } = req.body;

	console.log(sort)

	const session = await getSession({ req });

	if (req.method === 'DELETE') {
		const note = await prisma.note.delete({
			where: { id: noteId },
		});

		const updatePosts = await prisma.note.updateMany({
			where: {
				// @ts-ignore
				authorId: session.user.id,
				sort: {
					gt: sort
				}
			},
			data: {
				sort: {
					decrement: 1,
				}
			},
		})

		res.json(note);

	} else {
		throw new Error(
			`The HTTP ${req.method} method is not supported at this route.`,
		);
	}
}