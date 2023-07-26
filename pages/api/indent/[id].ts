import prisma from '../../../lib/prisma';

export default async function handle(req, res) {
	const noteId = req.query.id;
	const { parentId, newParentId, sort, oldSort } = req.body;
	const note = await prisma.note.update({
		where: { id: noteId },
		data: {
			parentId: newParentId,
			sort: sort
		},
	});

	const updateSort = await prisma.note.updateMany({
		where: {
			parentId: newParentId,
			sort: {
				gt: sort
			}
		},
		data: {
			sort: {
				increment: 1,
			}
		},
	});

	const updateParentsSort = await prisma.note.updateMany({
		where: {
			parentId: parentId,
			sort: {
				gt: oldSort
			}
		},
		data: {
			sort: {
				decrement: 1,
			}
		},
	});

	res.json(note);
}