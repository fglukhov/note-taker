import React, {ReactNode, useState} from "react"
import { GetServerSideProps } from "next"
import Layout from "../components/Layout"
import NotesList, {getFamily} from "../components/NotesList"
import { NotesListItemProps } from "../components/NotesListItem"

import {createClient} from "@supabase/supabase-js";

import {getSession} from "next-auth/react";

import Head from "next/head";
import Header from "../components/Header";

// index.tsx test
export const getServerSideProps: GetServerSideProps = async (context) => {

	const session = await getSession(context);

	let feed = [];

	if (session) {

		const supabase = createClient(
			process.env.NEXT_SUPABASE_URL!,
			process.env.NEXT_SUPABASE_ANON_KEY!
		);

		const notes = await supabase
			.from('Note')
			.select()
			// @ts-ignore
			.eq('authorId', session.user.id)
			.order('sort', { ascending: true });

		feed = notes.data;

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
		<>
			<Head>
				<title>Great plan</title>
			</Head>
			<Layout>
				<div className="page">
					<main>
						{props.session && (
							<div>
								{/*<h1>Notes</h1>*/}

								<NotesList feed={props.feed}/>

							</div>
						)}
					</main>
				</div>
			</Layout>
		</>
  )
}

export default Main
