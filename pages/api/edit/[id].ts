// pages/api/note/[id].ts

import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export default async function handle(req, res) {
  try {
    const noteId = String(req.query.id);
    const { title, content } = req.body;

    // ============================
    // AUTH
    // ============================
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user?.id) {
      return res.status(401).json({ error: 'User not found' });
    }
    // ============================

    // обновляем только свою заметку
    const updated = await prisma.note.updateMany({
      where: {
        id: noteId,
        authorId: user.id,
      },
      data: {
        title,
        content: content != null ? content : undefined,
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // вернуть актуальную запись
    const note = await prisma.note.findFirst({
      where: {
        id: noteId,
        authorId: user.id,
      },
    });

    return res.json(note);
  } catch (e) {
    console.error('API /note update error:', e);
    return res.status(500).json({
      error: e?.message || String(e),
      name: e?.name,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    });
  }
}
