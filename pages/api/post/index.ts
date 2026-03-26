// pages/api/note/index.ts

import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// POST /api/note
// Required fields in body: title
// Optional fields in body: content
export default async function handle(req, res) {
  try {
    const { noteId, title, sort, parentId } = req.body;

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

    // 1) create note (Prisma 7: используем authorId)
    const result = await prisma.note.create({
      data: {
        id: noteId,
        title,
        sort,
        authorId: user.id,
        parentId,
      },
    });

    // 2) shift siblings sort
    await prisma.note.updateMany({
      where: {
        authorId: user.id,
        parentId,
        sort: { gt: sort - 1 },
        NOT: { id: noteId },
      },
      data: {
        sort: { increment: 1 },
      },
    });

    return res.json(result);
  } catch (e) {
    console.error('API /note create error:', e);
    return res.status(500).json({
      error: e?.message || String(e),
      name: e?.name,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    });
  }
}
