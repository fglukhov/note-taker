# RootNote

A web app for notes and tasks with a tree structure and a keyboard-first workflow.

## Key features

- **Tree hierarchy** — notes and tasks are organized as parent/child trees, useful for planning and breaking work into smaller items.
- **Keyboard-driven** — core actions are available from the keyboard without constantly reaching for the mouse.
- **Markdown in titles** — note titles support markup for quick emphasis and structure.
- **Priorities** — set priorities on notes for ordering and focus.
- **Milkdown editor** — full markdown editing for note bodies, powered by [Milkdown](https://milkdown.dev/).
- **Encryption in transit to the database** — connections to the database use TLS, including when using [Supabase](https://supabase.com/).

## Tech stack

- **Next.js** — UI and API routes.
- **Prisma** — data access and migrations.
- **Supabase** — hosted PostgreSQL and related infrastructure.

## Authentication

Sign in with **GitHub** (NextAuth.js).

## Status

The project is in **alpha**: features and UI will keep evolving; expect changes and rough edges.
