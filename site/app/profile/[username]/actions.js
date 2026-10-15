"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function generatePresignedUrl(fileName, contentType) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Unauthorized');
    }

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_USERS_BUCKET_NAME,
      Key: fileName,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // Generate the public URL on the server side
    const publicUrl = `https://${process.env.AWS_S3_USERS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    return { presignedUrl, publicUrl, success: true };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return { error: 'Failed to generate upload URL', success: false };
  }
}