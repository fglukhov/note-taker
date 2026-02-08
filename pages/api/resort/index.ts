// pages/api/note/index.ts

import prisma from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export const config = {
	api: {
		externalResolver: true,
	},
};

export default async function handle(req, res) {
	try {
		const { firstIncrementIndex, newId } = req.body;

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

		const updatePosts = await prisma.note.updateMany({
			where: {
				authorId: user.id,
				sort: {
					gt: firstIncrementIndex - 1,
				},
				NOT: {
					id: newId,
				},
			},
			data: {
				sort: {
					increment: 1,
				},
			},
		});

		return res.json({ updated: updatePosts.count });
	} catch (e) {
		console.error("API /note error:", e);
		return res.status(500).json({
			error: e?.message || String(e),
			name: e?.name,
			code: e?.code,
			meta: e?.meta,
			stack: e?.stack,
		});
	}
}
