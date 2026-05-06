export async function uploadImage(file: File) {
  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch('/api/images/upload', {
    method: 'POST',
    body: fd,
    credentials: 'same-origin',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Upload failed');

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
