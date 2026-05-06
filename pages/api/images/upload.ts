import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { NextApiRequest, NextApiResponse } from 'next';
import type { PageConfig } from 'next';
import formidable from 'formidable';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
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

function parseForm(req: NextApiRequest): Promise<formidable.Files> {
  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: MAX_UPLOAD_BYTES,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, _fields, files) => {
      if (err) return reject(err);
      return resolve(files);
    });
  });
}

async function normalizeImage(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .rotate() // учитывает EXIF orientation (часто у фото с телефона)
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside', // в рамку 2048x2048, без обрезки
      withoutEnlargement: true, // маленькие картинки не растягиваем
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

    // AUTH
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

    const contentType = req.headers['content-type'] || '';

    if (!contentType.startsWith('multipart/form-data')) {
      return res.status(415).json({ error: 'Unsupported media type' });
    } else {
      const files = await parseForm(req);
      const rawFile = files.file;
      const file = Array.isArray(rawFile) ? rawFile[0] : rawFile;

      if (!file) {
        return res
          .status(400)
          .json({ error: 'File is required (field name: file)' });
      }

      if (!file.mimetype?.startsWith('image/')) {
        return res.status(400).json({ error: 'Only image files are allowed' });
      }

      const originalBuffer = await fs.readFile(file.filepath);
      await fs.unlink(file.filepath).catch(() => {});
      const normalizedBuffer = await normalizeImage(originalBuffer);

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
        file: {
          originalFilename: file.originalFilename,
          mimetype: 'image/webp',
          sizeBefore: file.size,
          sizeAfter: normalizedBuffer.length,
        },
        markdown: `![image](${finalUrl})`,
      });
    }
  } catch (e) {
    console.error('API /images/upload error:', e);
    if (e?.code === 1009 || e?.httpCode === 413) {
      return res
        .status(413)
        .json({ error: `File is too large (max ${MAX_UPLOAD_BYTES} bytes)` });
    }
    return res.status(500).json({
      error: e?.message || String(e),
      name: e?.name,
      code: e?.code,
      meta: e?.meta,
    });
  }
}

export const config: PageConfig = {
  api: {
    bodyParser: false,
  },
};
