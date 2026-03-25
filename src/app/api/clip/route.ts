import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("url");
    const x = parseInt(searchParams.get("x") || "0");
    const y = parseInt(searchParams.get("y") || "0");
    const w = parseInt(searchParams.get("w") || "100");
    const h = parseInt(searchParams.get("h") || "100");

    if (!imageUrl || !w || !h) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Reuse cropping logic from a helper
    const resultBuffer = await cropImage(imageUrl, x, y, w, h);
    
    return new NextResponse(new Uint8Array(resultBuffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, x, y, w, h, date, edition } = await req.json();

    if (!imageUrl || !w || !h) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const resultBuffer = await cropImage(imageUrl, x, y, w, h);

    // Generate permanent key
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const key = `clips/${date || 'general'}/${edition || 'main'}/clip_${timestamp}_${random}.jpg`;

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: resultBuffer,
      ContentType: "image/jpeg",
    });

    await r2Client.send(uploadCommand);

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    return NextResponse.json({ url: publicUrl });

  } catch (error: any) {
    console.error("Clipping API POST Failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function cropImage(imageUrl: string, x: number, y: number, w: number, h: number): Promise<Buffer> {
  // Use eval to bypass Next.js Turbopack completely, forcing standard Node resolution
  const canvasPkg = eval('require')('@napi-rs/canvas');
  const { createCanvas, loadImage } = canvasPkg;

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Failed to fetch image from source");
  const buffer = Buffer.from(await response.arrayBuffer());

  const img = await loadImage(buffer);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return await canvas.encode("jpeg", 90);
}
