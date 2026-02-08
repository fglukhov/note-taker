import React, {ReactNode, useRef, useState} from "react"
import {GetServerSideProps} from "next"
import Layout from "../components/Layout"
import NotesList, {getFamily} from "../components/NotesList"
import {NotesListItemProps} from "../components/NotesListItem"
import prisma from '../lib/prisma';
import {getSession} from "next-auth/react";
import {NotesProvider} from "../components/NotesContext";

const mockNotes: NotesListItemProps[] = [
	// === Travel Project ===
	{
		id: "1",
		title: "Organize Family Trip",
		sort: 0,
		parentId: "root",
		collapsed: false,
		complete: false,
	},
	{
		id: "2",
		title: "Destination Research",
		sort: 0,
		parentId: "1",
		collapsed: false,
		complete: true,
	},
	{
		id: "3",
		title: "Italy",
		sort: 0,
		parentId: "2",
		collapsed: false,
		complete: true,
	},
	{
		id: "4",
		title: "Greece",
		sort: 1,
		parentId: "2",
		collapsed: false,
		complete: false,
	},
	{
		id: "5",
		title: "Booking",
		sort: 1,
		parentId: "1",
		collapsed: false,
		complete: false,
	},
	{
		id: "6",
		title: "Flights",
		sort: 0,
		parentId: "5",
		collapsed: false,
		complete: false,
	},
	{
		id: "7",
		title: "Hotels",
		sort: 1,
		parentId: "5",
		collapsed: false,
		complete: false,
	},

	// === Work Notes ===
	{
		id: "8",
		title: "Internal Tooling Improvements",
		sort: 1,
		parentId: "root",
		collapsed: true,
		complete: false,
	},
	{
		id: "9",
		title: "CI/CD pipeline update",
		sort: 0,
		parentId: "8",
		collapsed: false,
		complete: false,
	},
	{
		id: "10",
		title: "Monitoring",
		sort: 1,
		parentId: "8",
		collapsed: false,
		complete: false,
	},
	{
		id: "11",
		title: "Alerting thresholds",
		sort: 0,
		parentId: "10",
		collapsed: false,
		complete: true,
	},
	{
		id: "12",
		title: "Log aggregation",
		sort: 1,
		parentId: "10",
		collapsed: false,
		complete: false,
	},

	// === Reading Tracker ===
	{
		id: "13",
		title: "Reading Tracker",
		sort: 2,
		parentId: "root",
		collapsed: false,
		complete: false,
	},
	{
		id: "14",
		title: "Fiction",
		sort: 0,
		parentId: "13",
		collapsed: false,
		complete: false,
	},
	{
		id: "15",
		title: "1984 by George Orwell",
		sort: 0,
		parentId: "14",
		collapsed: false,
		complete: true,
	},
	{
		id: "16",
		title: "The Hobbit",
		sort: 1,
		parentId: "14",
		collapsed: false,
		complete: false,
	},
	{
		id: "17",
		title: "Non-fiction",
		sort: 1,
		parentId: "13",
		collapsed: true,
		complete: false,
	},
	{
		id: "18",
		title: "Sapiens by Yuval Noah Harari",
		sort: 0,
		parentId: "17",
		collapsed: false,
		complete: false,
	},
];


// index.tsx
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
		props: {feed, session}
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
				<main>
					<div>
						<h1>{props.session ? 'Notes' : 'Demo'}</h1>


						<NotesList feed={props.session ? props.feed : mockNotes} />


					</div>
				</main>
			</div>
		</Layout>
	)
}

export default Main
