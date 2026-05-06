// pages/api/post/[id].ts

import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { extractR2Keys, deleteR2Keys } from '@/lib/r2Images';

// DELETE /api/delete/:id
export default async function handle(req, res) {
  try {
    if (req.method !== 'DELETE') {
      return res.status(405).json({
        error: `The HTTP ${req.method} method is not supported at this route.`,
      });
    }

    const noteId = String(req.query.id);
    const { sort, remainingIds, parentId } = req.body;

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

    // 1) поправить sort у соседей (только у этого юзера)
    await prisma.note.updateMany({
      where: {
        authorId: user.id,
        parentId,
        sort: { gt: sort },
      },
      data: {
        sort: { decrement: 1 },
      },
    });

    const notesToDelete = await prisma.note.findMany({
      where: {
        authorId: user.id,
        NOT: {
          id: {
            in: remainingIds,
          },
        },
      },
      select: {
        id: true,
        content: true,
      },
    });

    await prisma.$transaction([
      ...notesToDelete.map((note) =>
        prisma.noteDeletion.create({
          data: {
            noteId: note.id,
            authorId: user.id,
          },
        }),
      ),
      prisma.note.deleteMany({
        where: {
          authorId: user.id,
          NOT: {
            id: {
              in: remainingIds,
            },
          },
        },
      }),
    ]);

    const allKeys = new Set<string>();
    for (const note of notesToDelete) {
      extractR2Keys(note.content).forEach((k) => allKeys.add(k));
    }
    deleteR2Keys(Array.from(allKeys)).catch(console.error);

    return res.json({ deleted: notesToDelete.length });
  } catch (e) {
    console.error('API /delete error:', e);
    return res.status(500).json({
      error: e?.message || String(e),
      name: e?.name,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    });
  }
}
