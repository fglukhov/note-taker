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
							<div key={note.id} className="notes-list-item">
								<Note note={note} />
							</div>
						))}
					</div>
        </main>
      </div>
      <style jsx>{`
        .notes-list-item {
          background: white;
          transition: box-shadow 0.1s ease-in;
					padding: 10px 20px;
        }

        .notes-list-item:hover {
          box-shadow: 1px 1px 3px #aaa;
        }

        .notes-list-item + .notes-list-item {
          margin-top: 1px;
        }
      `}</style>
    </Layout>
  )
}

export default Notes
