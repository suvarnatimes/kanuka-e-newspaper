import { Epaper } from '@/lib/models/Epaper';
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from "@/lib/mongodb";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { processPdfToWebP } from "@/lib/pdfProcessor";
import { v4 as uuidv4 } from "uuid";

const MONGODB_URI = process.env.MONGODB_URI!;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60 seconds for processing updates with large PDFs

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const epaper = await Epaper.findById(id).lean();
    if (!epaper) return NextResponse.json({ error: "E-paper not found" }, { status: 404 });
    return NextResponse.json(epaper);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    
    // In a real app, we should also delete from R2, but for now we'll just delete the record
    const deleted = await Epaper.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "E-paper not found" }, { status: 404 });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
