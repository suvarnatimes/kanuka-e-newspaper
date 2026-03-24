"use server";

import { connectToDatabase } from "@/lib/mongodb";
import { Epaper } from "@/lib/models/Epaper";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";

export async function startEpaperUpload(formData: FormData) {
  const startTime = Date.now();
  console.log(">>> startEpaperUpload started");
  try {
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const dateStr = formData.get("date") as string;
    const edition = formData.get("edition") as string;
    const state = formData.get("state") as string;
    const preUploadedPdfKey = formData.get("pdfKey") as string | null;

    const date = new Date(dateStr);
    const fileId = uuidv4();
    const datePath = date.toISOString().split("T")[0];
    let pdfUrl = "";

    if (preUploadedPdfKey) {
        pdfUrl = `${R2_PUBLIC_URL}/${preUploadedPdfKey}`;
    } else if (file) {
      const pdfKey = `epapers/${datePath}/${fileId}/document.pdf`;
      const pdfBuffer = Buffer.from(await file.arrayBuffer());
      console.log(`>>> uploading PDF to R2: ${pdfKey} (${pdfBuffer.length} bytes)`);
      
      try {
        await r2Client.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: pdfKey,
          Body: pdfBuffer,
          ContentType: "application/pdf"
        }));
        pdfUrl = `${R2_PUBLIC_URL}/${pdfKey}`;
      } catch (r2Err: any) {
        console.error(">>> R2 Upload Failed:", r2Err);
        throw new Error(`Cloud Storage Error: ${r2Err.message || 'Unknown R2 error'}`);
      }
    }

    if (!pdfUrl) {
      throw new Error("No PDF file or pre-uploaded key provided.");
    }

    console.log(">>> connecting to database...");
    await connectToDatabase();
    
    // Create or Update Record Placeholder
    const epaper = new Epaper({
      title,
      date,
      edition,
      state,
      pdfUrl: pdfUrl,
      imageUrls: [] // Will be filled page by page
    });

    await epaper.save();
    console.log(`>>> Epaper saved to DB: ${epaper._id}`);
    
    return { success: true, epaperId: epaper._id.toString(), fileId, datePath };
  } catch (error: any) {
    console.error(">>> [ERROR] startEpaperUpload failed:", error);
    return { success: false, error: `Server Error: ${error.message || 'Unknown error occured'}` };
  }
}

export async function appendEpaperPage(epaperId: string, pageIndex: number, fileId: string, datePath: string, formData: FormData) {
  try {
    const imgFile = formData.get("image") as File | null;
    const preUploadedImgUrl = formData.get("imageUrl") as string | null;
    let imageUrl = preUploadedImgUrl;

    if (!imageUrl && imgFile) {
        const imgBuffer = Buffer.from(await imgFile.arrayBuffer());
        const imgKey = `epapers/${datePath}/${fileId}/page-${pageIndex}.webp`;
        
        // Upload to R2
        await r2Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: imgKey,
            Body: imgBuffer,
            ContentType: "image/webp"
        }));
        imageUrl = `${R2_PUBLIC_URL}/${imgKey}`;
    }

    if (!imageUrl) {
        throw new Error("No image file or URL provided.");
    }

    await connectToDatabase();
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
