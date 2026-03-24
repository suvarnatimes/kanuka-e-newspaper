import { connectToDatabase } from "@/lib/mongodb";
import { Epaper } from "@/lib/models/Epaper";
import { Metadata } from "next";
import { format, parseISO } from "date-fns";
import Reader from "@/components/Reader";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{
    date: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  await connectToDatabase();

  const searchDate = new Date(date);
  const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

  const epaper = await Epaper.findOne({
    date: { $gte: startOfDay, $lte: endOfDay },
  });

  if (!epaper) return { title: "Epaper Not Found" };

  const formattedDate = format(parseISO(date), "PPP");
  const title = `Epaper ${epaper.edition} - ${formattedDate}`;

  return {
    title,
    description: `${epaper.edition} edition of our e-paper for ${formattedDate}.`,
    openGraph: {
      title,
      images: [epaper.imageUrls[0]], // Thumbnail from first page
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [epaper.imageUrls[0]],
    },
  };
}

export default async function EpaperPage({ params }: PageProps) {
  const { date } = await params;
  
  await connectToDatabase();
  
  const searchDate = new Date(date);
  const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

  const epaperDoc = await Epaper.findOne({
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });

  if (!epaperDoc) {
    return notFound();
  }

  const epaperData = {
    title: epaperDoc.title,
    date: epaperDoc.date.toISOString(),
    edition: epaperDoc.edition,
    imageUrls: epaperDoc.imageUrls,
    pdfUrl: epaperDoc.pdfUrl,
  };

  return <Reader epaper={epaperData} />;
}
