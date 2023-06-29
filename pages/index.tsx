import React, {ReactNode, useState} from "react"
import { GetStaticProps } from "next"
import Layout from "../components/Layout"
import NotesList from "../components/NotesList"
import { NoteProps } from "../components/Note"
import prisma from '../lib/prisma';


// index.tsx
export const getStaticProps: GetStaticProps = async () => {

	const feed = await prisma.note.findMany({
		orderBy: {
			sort: 'asc',
		},
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

const Main: React.FC<Props> = (props) => {

  return (
    <Layout>
      <div className="page">
        <h1>Notes</h1>
        <main>
					<NotesList feed={props.feed} />
        </main>
      </div>
    </Layout>
  )
}

export default Main
