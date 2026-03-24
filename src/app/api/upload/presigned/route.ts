import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { key, contentType } = await req.json();
    if (!key || !contentType) {
      return NextResponse.json({ error: "Key and ContentType are required" }, { status: 400 });
    }

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("Presigned URL error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
