// pages/api/post/[id].ts

import prisma from '../../../lib/prisma';
import {getSession} from "next-auth/react";

// DELETE /api/copmlete/:id
export default async function handle(req, res) {

	const { completeIds, isComplete } = req.body;

	const session = await getSession({ req });

	const completeNotes = await prisma.note.updateMany({
		where: {
			id: {
				in: completeIds
			}
		},
		data: {
			complete: !isComplete
		}
	});

	res.json(completeNotes);


}