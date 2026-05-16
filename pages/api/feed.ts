import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export const config = {
  api: { externalResolver: true },
};

export default async function handle(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    const [notes, lastNote, lastDeletion] = await Promise.all([
      prisma.note.findMany({
        orderBy: { sort: 'asc' },
        where: { authorId: user.id },
      }),
      prisma.note.findFirst({
        where: { authorId: user.id },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      prisma.noteDeletion.findFirst({
        where: { authorId: user.id },
        orderBy: { deletedAt: 'desc' },
        select: { deletedAt: true },
      }),
    ]);

    const noteTs = lastNote?.updatedAt?.getTime() ?? 0;
    const delTs = lastDeletion?.deletedAt?.getTime() ?? 0;
    const syncToken = new Date(Math.max(noteTs, delTs)).toISOString();

    return res.json({ notes, syncToken });
  } catch (e) {
    console.error('API /feed error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
