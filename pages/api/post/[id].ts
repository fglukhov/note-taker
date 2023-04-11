// pages/api/post/[id].ts

import prisma from '../../../lib/prisma';

// DELETE /api/post/:id
export default async function handle(req, res) {
	const noteId = req.query.id;
	console.log(req.query.id)
	if (req.method === 'DELETE') {
		const note = await prisma.note.delete({
			where: { id: noteId },
		});
		res.json(note);
	} else {
		throw new Error(
			`The HTTP ${req.method} method is not supported at this route.`,
		);
	}
}