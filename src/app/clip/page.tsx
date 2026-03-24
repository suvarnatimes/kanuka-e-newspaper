import { Metadata } from "next";
import Header from "@/components/Header";
import ClipViewer from "@/components/ClipViewer";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const url = params.url as string;
  const x = params.x as string;
  const y = params.y as string;
  const w = params.w as string;
  const h = params.h as string;
  const title = params.title as string || "News Clipping";
  const edition = params.edition as string || "";
  const date = params.date as string || "";

  // Stateless Social Preview: Point og:image to the /api/clip proxy
  // This gives the visual of the crop without storing anything.
  const previewUrl = `/api/clip?url=${encodeURIComponent(url)}&x=${x}&y=${y}&w=${w}&h=${h}`;
  const fullPreviewUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ''}${previewUrl}`;

  const pageTitle = `${title} - Kanuka E-Newspaper`;
  const description = `Read this clipped article from the ${edition} edition of Kanuka E-Newspaper, published on ${date}.`;

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      images: [fullPreviewUrl],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [fullPreviewUrl],
    },
  };
}

export default async function ClipPage({ searchParams }: Props) {
  const params = await searchParams;

  const url = params.url as string;
  const x = parseInt(params.x as string || "0");
  const y = parseInt(params.y as string || "0");
  const w = parseInt(params.w as string || "0");
  const h = parseInt(params.h as string || "0");
  const title = params.title as string || "";
  const date = params.date as string || "";
  const edition = params.edition as string || "";
  const page = params.page as string || "1";

  if (!url || !w || !h) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-10 text-center">
        <h1 className="text-2xl font-black text-slate-800 mb-4">Invalid Clipping Link</h1>
        <p className="text-slate-500 mb-8">This link is missing required parameters to render the article part.</p>
        <a href="/" className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg">Back to Home</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <ClipViewer 
        url={url}
        x={x}
        y={y}
        w={w}
        h={h}
        title={title}
        date={date}
        edition={edition}
        page={page}
      />
      <footer className="text-center pb-20 opacity-30">
         <img src="/kanykalogo.jpg" alt="Kanuka Logo" className="h-8 mx-auto object-contain grayscale mb-2 transition-all hover:grayscale-0" />
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Digital Edition</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          header, footer { display: none !important; }
          body { background: white !important; }
          main { padding: 0 !important; max-width: 100% !important; }
        }
      `}} />
    </div>
  );
}
