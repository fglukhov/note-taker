import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const KEY_RE = /notes\/[0-9a-f-]{36}\.webp/g;

export function extractR2Keys(
  markdown: string | null | undefined,
): Set<string> {
  if (!markdown) return new Set();
  return new Set(markdown.match(KEY_RE) ?? []);
}

export async function deleteR2Keys(
  keys: string[] | Set<string>,
): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) return;

  const arr = Array.isArray(keys) ? keys : Array.from(keys);
  if (arr.length === 0) return;

  const client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_S3_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });

  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: arr.map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );
}
