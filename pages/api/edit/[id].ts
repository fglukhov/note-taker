import prisma from '../../../lib/prisma';

export default async function handle(req, res) {
	const postId = req.query.id;
	const { title, content } = req.body;
	const post = await prisma.post.update({
		where: { id: postId },
		data: {
			title: title,
			content: content,
		},
	});
	res.json(post);
}