import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEpaper extends Document {
  title: string;
  date: Date;
  edition: string;
  state: 'Andhra Pradesh' | 'Telangana';
  pdfUrl: string;
  imageUrls: string[];
}

const EpaperSchema: Schema = new Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  edition: { type: String, required: true },
  state: { type: String, enum: ['Andhra Pradesh', 'Telangana'], required: true },
  pdfUrl: { type: String, required: true },
  imageUrls: { type: [String], required: true },
}, { timestamps: true });

export const Epaper: Model<IEpaper> = mongoose.models.Epaper || mongoose.model<IEpaper>('Epaper', EpaperSchema);
