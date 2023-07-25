// pages/api/post/[id].ts

import prisma from '../../../lib/prisma';
import {getSession} from "next-auth/react";

// DELETE /api/delete/:id
export default async function handle(req, res) {

	const noteId = req.query.id;

	const { id, title, sort, remainingIds, deletedCount } = req.body;

	const session = await getSession({ req });

	if (req.method === 'DELETE') {

		const deleteNotes = await prisma.note.deleteMany({
			where: {
				NOT: {
					id: {
						in: remainingIds
					}
				}
			}
		});

		const updateSort = await prisma.note.updateMany({
			where: {
				// @ts-ignore
				authorId: session.user.id,
				sort: {
					gt: sort
				}
			},
			data: {
				sort: {
					decrement: deletedCount,
				}
			},
		});

		res.json(deleteNotes);

	} else {
		throw new Error(
			`The HTTP ${req.method} method is not supported at this route.`,
		);
	}
}