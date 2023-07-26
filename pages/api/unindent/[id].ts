import prisma from '../../../lib/prisma';

export default async function handle(req, res) {
	const noteId = req.query.id;
	const { parentId, newParentId, sort, oldSort, parentSort } = req.body;

	const note = await prisma.note.update({
		where: { id: noteId },
		data: {
			parentId: newParentId,
			sort: sort
		},
	});

	const updateNewSiblingsSort = await prisma.note.updateMany({
		where: {
			NOT: {
				id: noteId
			},
			parentId: newParentId,
			sort: {
				gt: parentSort
			}
		},
		data: {
			sort: {
				increment: 1,
			}
		},
	});

	const updateOldSiblingsSort = await prisma.note.updateMany({
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