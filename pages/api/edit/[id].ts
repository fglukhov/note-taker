import prisma from '../../../lib/prisma';

export default async function handle(req, res) {
	const noteId = req.query.id;
	const { title, content } = req.body;
	const note = await prisma.note.update({
		where: { id: noteId },
		data: {
			title: title,
			content: content != null ? content : undefined,
		},
	});
	res.json(note);
}