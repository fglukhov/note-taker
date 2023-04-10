import React from "react"
import { GetStaticProps } from "next"
import Layout from "../components/Layout"
import Note, { NoteProps } from "../components/Note"
import prisma from '../lib/prisma';
import Router from "next/router";
import {getAllNotesIds} from "../lib/notes";

// index.tsx
export const getStaticProps: GetStaticProps = async () => {

	const paths = await getAllNotesIds();

	const feed = await prisma.note.findMany({
		include: {
			author: {
				select: { name: true },
			},
		},
	});

	return {
		props: { feed },
		revalidate: 10,
	};
};

type Props = {
  feed: NoteProps[]
}

const Notes: React.FC<Props> = (props) => {
  return (
    <Layout>
      <div className="page">
        <h1>Notes</h1>
        <main>
					<div className="notes-list">
						{props.feed.map((note) => (
							<Note key={note.id} note={note} />
						))}
					</div>
        </main>
      </div>
      <style jsx>{`
        
      `}</style>
    </Layout>
  )
}

export default Notes
