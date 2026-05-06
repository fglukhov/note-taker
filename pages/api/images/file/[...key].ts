import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res
        .status(405)
        .json({ error: `Method ${req.method} not allowed` });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (
      !process.env.R2_BUCKET_NAME ||
      !process.env.R2_S3_ENDPOINT_URL ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY
    ) {
      return res.status(500).json({ error: 'R2 is not configured' });
    }

    const keyParts = req.query.key;
    const key = Array.isArray(keyParts) ? keyParts.join('/') : String(keyParts);
    if (!key) {
      return res.status(400).json({ error: 'Missing object key' });
    }

    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      }),
    );

    const body = result.Body;
    if (
      !body ||
      typeof body !== 'object' ||
      !('transformToByteArray' in body)
    ) {
      return res.status(500).json({ error: 'Invalid object response' });
    }

    const bytes = await body.transformToByteArray();
    if (result.ContentType) {
      res.setHeader('Content-Type', result.ContentType);
    }
    if (typeof result.ContentLength === 'number') {
      res.setHeader('Content-Length', String(result.ContentLength));
    }

    return res.status(200).send(Buffer.from(bytes));
  } catch (e: any) {
    if (
      e?.name === 'NoSuchKey' ||
      e?.$metadata?.httpStatusCode === 404 ||
      e?.Code === 'NoSuchKey'
    ) {
      return res.status(404).json({ error: 'Image not found' });
    }
    console.error('API /images/file error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
