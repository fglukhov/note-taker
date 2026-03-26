// pages/api/post/[id].ts

import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

// UPDATE /api/post/:id
export default async function handle(req, res) {
  try {
    if (req.method !== 'PUT' && req.method !== 'PATCH') {
      return res.status(405).json({
        error: `The HTTP ${req.method} method is not supported at this route.`,
      });
    }

    const postId = String(req.query.id);
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

    // обновляем только свой пост
    const updated = await prisma.post.updateMany({
      where: {
        id: postId,
        authorId: user.id,
      },
      data: {
        title,
        content,
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // вернуть актуальный пост
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        authorId: user.id,
      },
    });

    return res.json(post);
  } catch (e) {
    console.error('API /post/[id] update error:', e);
    return res.status(500).json({
      error: e?.message || String(e),
      name: e?.name,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    });
  }
}
