// pages/api/note/index.ts

import { getSession } from 'next-auth/react';
import prisma from '../../../lib/prisma';

// POST /api/note
// Required fields in body: title
// Optional fields in body: content

export default async function handle(req, res) {

	const notesFeed = req.feed;

	for (let i=0; i < notesFeed; i++) {

		const note = await prisma.note.update({
			where: { id: notesFeed.id },
			data: {
				sort: i,
			}
		});

	}

}


// Deploy test