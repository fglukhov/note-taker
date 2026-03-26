// pages/api/note/index.ts
import { getSession } from 'next-auth/react';
import prisma from '@/lib/prisma';

export const config = {
  api: { externalResolver: true },
};

export default async function handle(req, res) {
  try {
    const { feed, ids } = req.body;

    const session = await getSession({ req });
    if (!session?.user?.email) {
      return res
        .status(401)
        .json({ error: 'Unauthorized: no user email in session' });
    }

    // 1) находим user.id по email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user?.id) {
      return res
        .status(401)
        .json({ error: 'Unauthorized: user not found by email' });
    }

    const updateRow = (id, sort, parentId, complete, collapsed, title) => {
      return prisma.note.upsert({
        where: { id },

        update: {
          sort,
          parentId,
          complete: complete ?? false,
          collapsed: collapsed ?? false,
          title,
        },

        create: {
          id,
          sort,
          parentId,
          complete: complete ?? false,
          collapsed: collapsed ?? false,
          title,
          authorId: user.id, // <-- ключевая замена
        },
      });
    };

    const deleteRow = (id) => {
      return prisma.note.delete({ where: { id } });
    };

    // 2) ВАЖНО: вернуть промисы из map
    const results = await Promise.all(
      ids.map((id) => {
        const curNote = feed.find((n) => n.id === id);
        return curNote
          ? updateRow(
              id,
              curNote.sort,
              curNote.parentId,
              curNote.complete,
              curNote.collapsed,
              curNote.title,
            )
          : deleteRow(id);
      }),
    );

    return res.json(results);
  } catch (e) {
    console.error('API /note error:', e);
    return res.status(500).json({
      error: e?.message || String(e),
      name: e?.name,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    });
  }
}
