import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';

const MAX_IMAGE_DIMENSION = 2048;
const WEBP_QUALITY = 80;

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

function buildObjectKey(): string {
  return `notes/${crypto.randomUUID()}.webp`;
}

async function normalizeImage(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
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

    const sourceUrl = String(req.body?.url ?? '');
    if (!sourceUrl) {
      return res.status(400).json({ error: 'url is required' });
    }

    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res
        .status(400)
        .json({ error: 'Only http/https URLs are allowed' });
    }

    const remoteResponse = await fetch(parsed.toString());
    if (!remoteResponse.ok) {
      return res
        .status(400)
        .json({
          error: `Failed to fetch source image (${remoteResponse.status})`,
        });
    }

    const remoteType = remoteResponse.headers.get('content-type') || '';
    if (!remoteType.startsWith('image/')) {
      return res.status(400).json({ error: 'Source URL is not an image' });
    }

    const sourceBuffer = Buffer.from(await remoteResponse.arrayBuffer());
    const normalizedBuffer = await normalizeImage(sourceBuffer);

    const objectKey = buildObjectKey();
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: objectKey,
        Body: normalizedBuffer,
        ContentType: 'image/webp',
      }),
    );

    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
    const fallbackUrl = `/api/images/file/${objectKey}`;
    const finalUrl = publicBaseUrl
      ? `${publicBaseUrl}/${objectKey}`
      : fallbackUrl;

    return res.status(200).json({
      ok: true,
      key: objectKey,
      url: finalUrl,
      markdown: `![image](${finalUrl})`,
      file: {
        originalFilename: null,
        mimetype: 'image/webp',
        sizeBefore: sourceBuffer.length,
        sizeAfter: normalizedBuffer.length,
      },
    });
  } catch (e: any) {
    console.error('API /images/import-url error:', e);
    return res.status(500).json({
      error: e?.message || String(e),
      name: e?.name,
      code: e?.code,
    });
  }
}
