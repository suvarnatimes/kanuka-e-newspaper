"use server";

import { connectToDatabase } from "@/lib/mongodb";
import { Epaper } from "@/lib/models/Epaper";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";

export async function startEpaperUpload(formData: FormData) {
  const startTime = Date.now();
  console.log(">>> [Sonic Speed] startEpaperUpload started");
  try {
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const dateStr = formData.get("date") as string;
    const edition = formData.get("edition") as string;
    const state = formData.get("state") as string;

    const date = new Date(dateStr);
    const fileId = uuidv4();
    const datePath = date.toISOString().split("T")[0];
    const pdfKey = `epapers/${datePath}/${fileId}/document.pdf`;
    
    // 1. Upload Original PDF (First step for any new/replaced publication)
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: pdfKey,
      Body: pdfBuffer,
      ContentType: "application/pdf"
    }));

    await connectToDatabase();
    
    // Create or Update Record Placeholder
    // We'll store the R2 base path in a temporary field if needed or just use the ID
    const epaper = new Epaper({
      title,
      date,
      edition,
      state,
      pdfUrl: `${R2_PUBLIC_URL}/${pdfKey}`,
      imageUrls: [] // Will be filled page by page
    });

    await epaper.save();
    
    return { success: true, epaperId: epaper._id.toString(), fileId, datePath };
  } catch (error: any) {
    console.error(">>> [ERROR] startEpaperUpload failed:", error);
    return { success: false, error: error.message };
  }
}

export async function appendEpaperPage(epaperId: string, pageIndex: number, fileId: string, datePath: string, formData: FormData) {
  try {
    const imgFile = formData.get("image") as File;
    const imgBuffer = Buffer.from(await imgFile.arrayBuffer());
    const imgKey = `epapers/${datePath}/${fileId}/page-${pageIndex}.webp`;
    
    // Upload to R2
    await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: imgKey,
        Body: imgBuffer,
        ContentType: "image/webp"
    }));

    const imageUrl = `${R2_PUBLIC_URL}/${imgKey}`;

    await connectToDatabase();
    // Use $set with index to ensure order if parallel uploads finish out of order
    // But since we want to be safe, we'll use a position-based update
    await Epaper.findByIdAndUpdate(epaperId, {
        $set: { [`imageUrls.${pageIndex - 1}`]: imageUrl }
    });

    return { success: true, imageUrl };
  } catch (error: any) {
    console.error(`>>> [ERROR] appendEpaperPage failed for page ${pageIndex}:`, error);
    return { success: false, error: error.message };
  }
}

export async function finishEpaperUpload(epaperId: string) {
  try {
      revalidatePath("/");
      revalidatePath("/admin");
      return { success: true };
  } catch (error: any) {
      return { success: false, error: error.message };
  }
}

// Keep a simplified version for metadata-only updates
export async function updateEpaperMetadata(id: string, updateData: any) {
    try {
        await connectToDatabase();
        const updated = await Epaper.findByIdAndUpdate(id, updateData, { new: true });
        revalidatePath("/");
        revalidatePath("/admin");
        return { success: true, data: JSON.parse(JSON.stringify(updated)) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
