// pages/api/post/index.ts

import prisma from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

// POST /api/post
// Required fields in body: title
// Optional fields in body: content
export default async function handle(req, res) {
	try {
		if (req.method !== "POST") {
			return res.status(405).json({
				error: `The HTTP ${req.method} method is not supported at this route.`,
			});
		}

		const { title, content } = req.body;

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

		const result = await prisma.post.create({
			data: {
				title,
				content,
				authorId: user.id,
			},
		});

		return res.json(result);
	} catch (e) {
		console.error("API /post create error:", e);
		return res.status(500).json({
			error: e?.message || String(e),
			name: e?.name,
			code: e?.code,
			meta: e?.meta,
			stack: e?.stack,
		});
	}
}
