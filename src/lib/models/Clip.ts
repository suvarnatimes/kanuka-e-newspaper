import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClip extends Document {
  clipUrl: string;       // URL to the cropped image on R2
  epaperTitle: string;
  epaperDate: Date;
  edition: string;
  pageIndex: number;
}

const ClipSchema: Schema = new Schema({
  clipUrl: { type: String, required: true },
  epaperTitle: { type: String, required: true },
  epaperDate: { type: Date, required: true },
  edition: { type: String, required: true },
  pageIndex: { type: Number, required: true },
}, { timestamps: true });

export const Clip: Model<IClip> = mongoose.models.Clip || mongoose.model<IClip>('Clip', ClipSchema);
