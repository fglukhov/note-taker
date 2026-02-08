// pages/api/post/[id].ts

import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

// DELETE /api/post/:id
export default async function handle(req, res) {
	try {
		const noteId = String(req.query.id);

		if (req.method !== "DELETE") {
			return res.status(405).json({
				error: `The HTTP ${req.method} method is not supported at this route.`,
			});
		}

		// ============================
		// AUTH
		// ============================
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
		// ============================

		// удаляем ТОЛЬКО свою заметку
		const result = await prisma.note.deleteMany({
			where: {
				id: noteId,
				authorId: user.id,
			},
		});

		if (result.count === 0) {
			return res.status(404).json({ error: "Note not found" });
		}

		return res.json({ deleted: true });
	} catch (e) {
		console.error("API /post/[id] error:", e);
		return res.status(500).json({
			error: e?.message || String(e),
			name: e?.name,
			code: e?.code,
			meta: e?.meta,
			stack: e?.stack,
		});
	}
}
