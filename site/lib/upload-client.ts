// Browser side of content-addressed uploads: hash the file, ask the server to
// sign a PUT for exactly that hash, then upload straight to R2.

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type SignedUpload = { key: string; url: string; headers: Record<string, string> };

/** Upload an avatar or cover; resolves to the R2 key to store on the profile. */
export async function uploadProfileImage(file: File): Promise<string> {
  const sha256 = await sha256Hex(file);
  const res = await fetch('/api/uploads/profile-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha256, size: file.size, mime: file.type }),
  });
  const signed: SignedUpload & { error?: string } = await res.json();
  if (!res.ok) throw new Error(signed.error || 'Upload failed');

  const put = await fetch(signed.url, { method: 'PUT', body: file, headers: signed.headers });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return signed.key;
}
