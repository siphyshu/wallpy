import 'server-only';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 through its S3-compatible API. Server only: the credentials
// can write to the buckets.
let client;

export function r2() {
  client ??= new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    // The SDK otherwise adds its own CRC32 checksum, and R2 accepts only one
    // checksum per upload: ours is the SHA-256 the key is named after.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  return client;
}

export const PUBLIC_BUCKET = 'wallpy-public';

/**
 * A presigned PUT for exactly one object. The SHA-256, content type and length
 * are signed as headers, so R2 rejects any upload whose bytes, type or size
 * differ from what the server approved.
 */
export async function presignPut({ key, sha256, mime, size, expiresIn = 300 }) {
  const checksum = Buffer.from(sha256, 'hex').toString('base64');
  const url = await getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: PUBLIC_BUCKET,
      Key: key,
      ContentType: mime,
      ContentLength: size,
      ChecksumSHA256: checksum,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
    {
      expiresIn,
      // The JS presigner leaves content-type out of the signature by default,
      // which would let a client upload text/html (stored XSS on the CDN domain).
      // Sign it explicitly, and keep these as headers (not query params) so the
      // client must send exactly the approved values. Verified against R2:
      // tampered bytes, other content types, extra bytes and a missing
      // checksum are all rejected.
      signableHeaders: new Set(['content-type', 'cache-control']),
      unhoistableHeaders: new Set(['x-amz-checksum-sha256', 'content-type', 'cache-control']),
    },
  );
  return {
    url,
    headers: {
      'Content-Type': mime,
      'x-amz-checksum-sha256': checksum,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  };
}
