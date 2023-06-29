// pages/p/[id].tsx

import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import ReactMarkdown from 'react-markdown';
import Router from 'next/router';
import Layout from '../../components/Layout';
import { NoteProps } from '../../components/Note';
import { useSession } from 'next-auth/react';
import prisma from '../../lib/prisma';

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
	const note = await prisma.note.findUnique({
		where: {
			id: String(params?.id),
		},
		include: {
			author: {
				select: { name: true, email: true },
			},
		},
	});

	return {
		props: note,
	};
};

async function publishNote(id: string): Promise<void> {
	await fetch(`/api/publish/${id}`, {
		method: 'PUT',
	});
	await Router.push('/');
}

async function deleteNote(id: string): Promise<void> {
	await fetch(`/api/post/${id}`, {
		method: 'DELETE',
	});
	Router.push('/');
}

const Note: React.FC<NoteProps> = (props) => {
	const { data: session, status } = useSession();

	const [title, setTitle] = useState(props.title);
	const [content, setContent] = useState(props.content);

	const [isEdit, setIsEdit] = useState(false);

	const editData = async (e: React.SyntheticEvent) => {
		e.preventDefault();
		try {
			const body = { title, content };
			await fetch(`/api/edit/${props.id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			setIsEdit(false)
			//await Router.push('/drafts');
		} catch (error) {
			console.error(error);
		}
	};

	if (status === 'loading') {
		return <div>Authenticating ...</div>;
	}
	const userHasValidSession = Boolean(session);
	const noteBelongsToUser = session?.user?.email === props.author?.email;

	return (
		<Layout>
			<div>

				{isEdit ? (
					<form onSubmit={editData}>
						<input
							autoFocus
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Title"
							type="text"
							value={title}
						/>
						<textarea
							cols={50}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Content"
							rows={8}
							value={content}
						/>
						<input disabled={!title} type="submit" value="Save" />
					</form>
				) : (
					<>
						<h2>{title}</h2>
						<p>By {props?.author?.name || 'Unknown author'}</p>
						<ReactMarkdown children={content} />
					</>
				)}

				{
					!isEdit && userHasValidSession && noteBelongsToUser && (
						<button onClick={() => setIsEdit(true)}>Edit</button>
					)
				}

				{
					isEdit && userHasValidSession && noteBelongsToUser && (
						<button onClick={() => setIsEdit(false)}>Cancel edit</button>
					)
				}
				{
					userHasValidSession && noteBelongsToUser && (
						<button onClick={() => deleteNote(props.id)}>Delete</button>
					)
				}
			</div>
			<style jsx>{`
        .page {
          background: var(--geist-background);
          padding: 2rem;
        }

        .actions {
          margin-top: 2rem;
        }

        button {
          background: #ececec;
          border: 0;
          border-radius: 0.125rem;
          padding: 1rem 2rem;
        }

        button + button {
          margin-left: 1rem;
        }

				input[type='text'],
				textarea {
					width: 100%;
					padding: 0.5rem;
					margin: 0.5rem 0;
					border-radius: 0.25rem;
					border: 0.125rem solid rgba(0, 0, 0, 0.2);
				}

				input[type='submit'] {
					background: #ececec;
					border: 0;
					padding: 1rem 2rem;
				}
				
      `}</style>
		</Layout>
	);
};

export default Note;