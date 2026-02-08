import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // ⚠️ если файл лежит в pages/api/*, путь подправь

export default async function handle(req, res) {
	try {
		const noteId = String(req.query.id);
		const { parentId, newParentId, sort, oldSort } = req.body;

		// AUTH
		const session = await getServerSession(req, res, authOptions);
		if (!session?.user?.email) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const user = await prisma.user.findUnique({
			where: { email: session.user.email },
			select: { id: true },
		});

		if (!user?.id) {
			return res.status(401).json({ error: "User not found" });
		}

		// обновляем только свою заметку
		const updated = await prisma.note.updateMany({
			where: { id: noteId, authorId: user.id },
			data: {
				parentId: newParentId,
				sort: sort,
			},
		});

		if (updated.count === 0) {
			return res.status(404).json({ error: "Note not found" });
		}

		// двигаем сорт у новых соседей (только у этого юзера)
		await prisma.note.updateMany({
			where: {
				authorId: user.id,
				parentId: newParentId,
				NOT: { id: noteId },
				sort: { gt: sort },
			},
			data: {
				sort: { increment: 1 },
			},
		});

		// двигаем сорт у старых соседей (только у этого юзера)
		await prisma.note.updateMany({
			where: {
				authorId: user.id,
				parentId: parentId,
				sort: { gt: oldSort },
			},
			data: {
				sort: { decrement: 1 },
			},
		});

		// возвращаем актуальную запись
		const note = await prisma.note.findFirst({
			where: { id: noteId, authorId: user.id },
		});

		return res.json(note);
	} catch (e) {
		console.error("API /note move error:", e);
		return res.status(500).json({
			error: e?.message || String(e),
			name: e?.name,
			code: e?.code,
			meta: e?.meta,
			stack: e?.stack,
		});
	}
}
