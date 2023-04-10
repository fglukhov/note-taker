import prisma from "./prisma";

export async function getAllNotesIds() {

	const feed = await prisma.note.findMany({
		include: {
			author: {
				select: { name: true },
			},
		},
	});

	let newFeed = feed.map((note) => ({
		params: { id: note.id },
	}))

	return feed.map((note) => ({
		params: { id: note.id },
	}))

}