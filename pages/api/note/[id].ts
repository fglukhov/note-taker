import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// GET /api/note/:id
export default async function handle(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        error: `The HTTP ${req.method} method is not supported at this route.`,
      });
    }

    const noteId = String(req.query.id);

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

    const note = await prisma.note.findFirst({
      where: {
        id: noteId,
        authorId: user.id,
      },
      include: {
        author: {
          select: { name: true, email: true },
        },
      },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    return res.json({
      id: note.id,
      title: note.title,
      content: note.content,
      hasContent: note.hasContent,
      authorName: note.author?.name ?? 'Unknown author',
      authorEmail: note.author?.email ?? null,
    });
  } catch (e: any) {
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
