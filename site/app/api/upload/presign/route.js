import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@/lib/supabase/server';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_PACKS_BUCKET_NAME;
const URL_EXPIRY = 15 * 60; // 15 minutes

export async function POST(request) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to upload.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { slug, files } = body;

    if (!slug || !files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: slug and files array' },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only.' },
        { status: 400 }
      );
    }

    // Generate presigned URLs for each file
    const presignedUrls = await Promise.all(
      files.map(async ({ key, contentType }) => {
        // Construct the full S3 key: {slug}/{key}
        const fullKey = `${slug}/${key}`;

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fullKey,
          ContentType: contentType,
        });

        const presignedUrl = await getSignedUrl(s3Client, command, {
          expiresIn: URL_EXPIRY,
        });

        return {
          key,
          fullKey,
          presignedUrl,
          publicUrl: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fullKey}`,
        };
      })
    );

    return NextResponse.json({
      success: true,
      slug,
      files: presignedUrls,
    });

  } catch (error) {
    console.error('Presign error:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URLs' },
      { status: 500 }
    );
  }
}

