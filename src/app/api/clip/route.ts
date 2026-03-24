import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("url");
    const x = parseInt(searchParams.get("x") || "0");
    const y = parseInt(searchParams.get("y") || "0");
    const w = parseInt(searchParams.get("w") || "0");
    const h = parseInt(searchParams.get("h") || "0");

    if (!imageUrl || !w || !h) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Use eval to bypass Next.js Turbopack completely, forcing standard Node resolution
    const canvasPkg = eval('require')('@napi-rs/canvas');
    const { createCanvas, loadImage } = canvasPkg;

    // Fetch image from R2
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Failed to fetch image from source");
    const buffer = Buffer.from(await response.arrayBuffer());

    // Load image into canvas (loadImage is safer and handles buffers well)
    const img = await loadImage(buffer);

    // Create canvas for the crop
    console.log(`Clipping Request: x=${x}, y=${y}, w=${w}, h=${h}, url=${imageUrl}`);
    console.log(`Source Image Dimensions: ${img.width}x${img.height}`);

    if (x < 0 || y < 0 || x + w > img.width || y + h > img.height) {
       console.warn(`Crop out of bounds! Clipping may be blank. img=${img.width}x${img.height}, x=${x}, y=${y}, w=${w}, h=${h}`);
    }

    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");

    // Draw the cropped portion
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

    // Encode to JPEG
    const resultBuffer = await canvas.encode("jpeg", 90);
    console.log(`Encoded Clipping Size: ${resultBuffer.length} bytes`);

    if (resultBuffer.length < 1000) {
      console.error("Warning: Encoded clipping is suspiciously small. It might be blank.");
    }

    return new NextResponse(resultBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Clipping API Failure:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
