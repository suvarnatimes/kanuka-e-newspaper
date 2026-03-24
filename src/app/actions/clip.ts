"use server";

import { connectToDatabase } from "@/lib/mongodb";
import { Clip } from "@/lib/models/Clip";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

interface SaveClipParams {
  imageUrl: string;
  x: number;
  y: number;
  w: number;
  h: number;
  epaperTitle: string;
  epaperDate: string;
  edition: string;
  pageIndex: number;
}

export async function saveClip(params: SaveClipParams) {
  try {
    const { imageUrl, x, y, w, h, epaperTitle, epaperDate, edition, pageIndex } = params;

    // Load canvas dynamically to bypass potential Turbopack module resolution issues
    // Standard Node require inside eval forces it to commonjs resolve at runtime
    const canvasPkg = eval('require')('@napi-rs/canvas');
    const { createCanvas, loadImage } = canvasPkg;

    // Fetch the original e-paper page image
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Failed to fetch source image");
    const buffer = Buffer.from(await response.arrayBuffer());

    // Load and crop
    const img = await loadImage(buffer);
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

    // Encode cropped image to JPEG
    const resultBuffer = await canvas.encode("jpeg", 90);
    const clipId = uuidv4();
    const clipKey = `clips/${clipId}.jpg`;

    // Upload cropped part to R2
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: clipKey,
      Body: resultBuffer,
      ContentType: "image/jpeg",
    }));

    const clipUrl = `${R2_PUBLIC_URL}/${clipKey}`;

    // Save metadata to MongoDB
    await connectToDatabase();
    const clip = new Clip({
      clipUrl,
      epaperTitle,
      epaperDate: new Date(epaperDate),
      edition,
      pageIndex,
    });
    await clip.save();

    return { 
      success: true, 
      clipId: clip._id.toString(),
      shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/clip/${clip._id}`
    };

  } catch (error: any) {
    console.error(">>> [ERROR] saveClip failed:", error);
    return { success: false, error: error.message || "Failed to process clip" };
  }
}
