// pages/api/note/index.ts

import { getSession } from 'next-auth/react';
import prisma from '../../../lib/prisma';

// POST /api/note
// Required fields in body: title
// Optional fields in body: content

export const config = {
	api: {
		externalResolver: true,
	},
}

export default async function handle(req) {

	const { firstIncrementIndex, newId } = req.body;
	const session = await getSession({ req });

	const updatePosts = await prisma.note.updateMany({
		where: {
			sort: {
				gt: firstIncrementIndex - 1
			},
			NOT: {
				id: newId
			},
			// @ts-ignore
			authorId: session.user.id
		},
		data: {
			sort: {
				increment: 1,
			}
		},
	})

}


// Deploy test