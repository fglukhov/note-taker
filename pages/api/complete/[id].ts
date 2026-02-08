// pages/api/post/[id].ts

import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

// DELETE /api/complete/:id
export default async function handle(req, res) {
	try {
		const { completeIds, isComplete } = req.body;

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

		// обновляем только свои заметки
		const completeNotes = await prisma.note.updateMany({
			where: {
				authorId: user.id,
				id: { in: completeIds },
			},
			data: {
				complete: !isComplete,
			},
		});

		return res.json(completeNotes);
	} catch (e) {
		console.error("API /complete error:", e);
		return res.status(500).json({
			error: e?.message || String(e),
			name: e?.name,
			code: e?.code,
			meta: e?.meta,
			stack: e?.stack,
		});
	}
}
