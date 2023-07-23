import React, {ReactNode, useState} from "react"
import { GetServerSideProps } from "next"
import Layout from "../components/Layout"
import NotesList from "../components/NotesList"
import { NotesListItemProps } from "../components/NotesListItem"
import prisma from '../lib/prisma';
import {getSession} from "next-auth/react";

// index.tsx test
export const getServerSideProps: GetServerSideProps = async (context) => {

	const session = await getSession(context);

	let feed = [];

	if (session) {

		feed = await prisma.note.findMany({
			orderBy: {
				sort: 'asc',
			},
			where: {
				// @ts-ignore
				authorId: session.user.id
			}
		});



	}

	return {
		props: { feed, session }
	};

};

type Props = {
	feed: NotesListItemProps[],
	session: any,
}

const Main: React.FC<Props> = (props) => {

  return (
    <Layout>
      <div className="page">
        <h1>Notes</h1>
        <main>
					{props.session && (
						<NotesList feed={props.feed} />
					)}
        </main>
      </div>
    </Layout>
  )
}

export default Main
