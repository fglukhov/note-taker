// pages/api/update/index.ts

import prisma from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export const config = {
	api: { externalResolver: true },
};

export default async function handle(req, res) {
	try {
		const { feed, ids } = req.body;

		// ============================
		// AUTH
		// ============================
		const session = await getServerSession(req, res, authOptions);

		if (!session?.user?.email) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const user = await prisma.user.findUnique({
			where: { email: session.user.email },
			select: { id: true },
		});

		if (!user?.id) {
			return res.status(401).json({ error: 'User not found' });
		}
		// ============================

		const updateRow = (
			id,
			sort,
			parentId,
			complete,
			collapsed,
			title
		) => {
			return prisma.note.upsert({
				where: { id },

				update: {
					sort,
					parentId,
					complete: complete ?? false,
					collapsed: collapsed ?? false,
					title,
				},

				create: {
					id,
					sort,
					parentId,
					complete: complete ?? false,
					collapsed: collapsed ?? false,
					title,
					authorId: user.id,
				},
			});
		};

		const deleteRow = (id) => {
			return prisma.note.delete({ where: { id } });
		};

		const results = await Promise.all(
			ids.map((id) => {
				const curNote = feed.find((n) => n.id === id);
				return curNote
					? updateRow(
						id,
						curNote.sort,
						curNote.parentId,
						curNote.complete,
						curNote.collapsed,
						curNote.title
					)
					: deleteRow(id);
			})
		);

		return res.json(results);
	} catch (e) {
		console.error('API /update error:', e);
		return res.status(500).json({
			error: e?.message || String(e),
			name: e?.name,
			code: e?.code,
			meta: e?.meta,
			stack: e?.stack,
		});
	}
}
