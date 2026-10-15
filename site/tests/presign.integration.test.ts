// Proves presignPut() pins bytes, type and size: R2 must reject every upload
// except the exact file the server approved. Runs against the real bucket, so
// it is skipped unless R2 credentials are present (e.g. via .env.local).
import { createHash } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { afterAll, describe, expect, it } from 'vitest';
import { PUBLIC_BUCKET, presignPut, r2 } from '@/lib/r2';

const hasR2 = Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);

describe.skipIf(!hasR2)('presignPut against R2', () => {
  const body = Buffer.from(`wallpy presign test ${Date.now()}`);
  const sha256 = createHash('sha256').update(body).digest('hex');
  const key = `_probe/${sha256}.jpg`;

  const put = async (data: Buffer, headers: Record<string, string>) => {
    const { url } = await presignPut({ key, sha256, mime: 'image/jpeg', size: body.length, expiresIn: 60 });
    const res = await fetch(url, { method: 'PUT', body: new Uint8Array(data), headers });
    return res.status;
  };

  afterAll(async () => {
    await r2().send(new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key }));
  });

  it('rejects tampered bytes of the same length', async () => {
    const { headers } = await presignPut({ key, sha256, mime: 'image/jpeg', size: body.length });
    const tampered = Buffer.from(body.toString().toUpperCase());
    expect(await put(tampered, headers)).toBe(400);
  });

  it('rejects an upload without the checksum header', async () => {
    const { headers } = await presignPut({ key, sha256, mime: 'image/jpeg', size: body.length });
    const { 'x-amz-checksum-sha256': _, ...rest } = headers;
    expect(await put(body, rest)).toBe(403);
  });

  it('rejects a different content type (stored XSS)', async () => {
    const { headers } = await presignPut({ key, sha256, mime: 'image/jpeg', size: body.length });
    expect(await put(body, { ...headers, 'Content-Type': 'text/html' })).toBe(403);
  });

  it('rejects a larger body', async () => {
    const { headers } = await presignPut({ key, sha256, mime: 'image/jpeg', size: body.length });
    expect(await put(Buffer.concat([body, Buffer.from('!')]), headers)).toBe(403);
  });

  it('accepts exactly the approved file', async () => {
    const { headers } = await presignPut({ key, sha256, mime: 'image/jpeg', size: body.length });
    expect(await put(body, headers)).toBe(200);
    const stored = await r2().send(new GetObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key }));
    const bytes = Buffer.from(await stored.Body!.transformToByteArray());
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
    expect(stored.ContentType).toBe('image/jpeg');
  });
});
