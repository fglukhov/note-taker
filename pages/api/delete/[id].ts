// pages/api/post/[id].ts

import prisma from '../../../lib/prisma';
import {getSession} from "next-auth/react";

// DELETE /api/delete/:id
export default async function handle(req, res) {

	const noteId = req.query.id;

	const { id, title, sort, remainingIds, parentId } = req.body;

	const session = await getSession({ req });

	if (req.method === 'DELETE') {

		const updateSort = await prisma.note.updateMany({
			where: {
				// @ts-ignore
				authorId: session.user.id,
				parentId: parentId,
				sort: {
					gt: sort
				}
			},
			data: {
				sort: {
					decrement: 1,
				}
			},
		});

		const deleteNotes = await prisma.note.deleteMany({
			where: {
				NOT: {
					id: {
						in: remainingIds
					}
				}
			}
		});

		res.json(deleteNotes);

	} else {
		throw new Error(
			`The HTTP ${req.method} method is not supported at this route.`,
		);
	}
}