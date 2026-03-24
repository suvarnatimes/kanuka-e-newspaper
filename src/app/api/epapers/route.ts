import { Epaper } from '@/lib/models/Epaper';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

export async function GET() {
  try {
    if (!mongoose.connection.readyState) {
      await mongoose.connect(MONGODB_URI);
    }
    const epapers = await Epaper.find({}).sort({ date: -1 }).lean();
    return NextResponse.json(epapers);
  } catch (error: any) {
    console.error("Error fetching epapers:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
