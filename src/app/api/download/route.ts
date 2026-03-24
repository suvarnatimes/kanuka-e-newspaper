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

    // Proxy the clipping logic or just fetch and crop
    // To keep it simple and consistent, we use the same @napi-rs/canvas logic
    const canvasPkg = eval('require')('@napi-rs/canvas');
    const { createCanvas, loadImage } = canvasPkg;

    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Failed to fetch image");
    const buffer = Buffer.from(await response.arrayBuffer());

    const img = await loadImage(buffer);
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

    const resultBuffer = await canvas.encode("jpeg", 85);

    return new NextResponse(resultBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="kanuka-clipping.jpg"',
        "Cache-Control": "no-cache",
      },
    });

  } catch (error: any) {
    console.error("Download API Failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
