export async function uploadImageFromUrl(sourceUrl: string) {
  const res = await fetch('/api/images/import-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ url: sourceUrl }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Import failed');

  return data as {
    ok: true;
    key: string;
    url: string;
    markdown: string;
    file: {
      originalFilename: string | null;
      mimetype: string;
      sizeBefore: number;
      sizeAfter: number;
    };
  };
}
