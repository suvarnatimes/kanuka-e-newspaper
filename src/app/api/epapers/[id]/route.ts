import { Epaper } from '@/lib/models/Epaper';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from "@/lib/mongodb";

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
