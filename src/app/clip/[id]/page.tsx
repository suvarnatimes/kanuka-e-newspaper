import { connectToDatabase } from "@/lib/mongodb";
import { Clip } from "@/lib/models/Clip";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Metadata } from "next";
import Header from "@/components/Header";
import { Download, Printer, Share2, ArrowRight } from "lucide-react";

interface ClipPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ClipPageProps): Promise<Metadata> {
  const { id } = await params;
  await connectToDatabase();
  const clip = await Clip.findById(id);

  if (!clip) return { title: "Clip Not Found" };

  const formattedDate = format(new Date(clip.epaperDate), "PPP");
  const title = `News Clipping: ${clip.epaperTitle} - ${formattedDate}`;
  const description = `Important clipping from ${clip.epaperTitle} (${clip.edition} edition) published on ${formattedDate}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [clip.clipUrl],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [clip.clipUrl],
    },
  };
}

export default async function ClipPage({ params }: ClipPageProps) {
  const { id } = await params;
  await connectToDatabase();
  const clip = await Clip.findById(id);

  if (!clip) return notFound();

  const formattedDate = format(new Date(clip.epaperDate), "PPP");
  const epaperLink = `/epaper/${new Date(clip.epaperDate).toISOString().split("T")[0]}`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-10 space-y-10">
        {/* Banner with Context */}
        <div className="bg-indigo-600 rounded-[2.5rem] p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-indigo-100 text-xs font-black uppercase tracking-widest mb-2 opacity-80">Shared Article</p>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none mb-4">{clip.epaperTitle}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-wider">{clip.edition} EDITION</span>
                <span className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-wider">{formattedDate}</span>
                <span className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-wider">PAGE {clip.pageIndex}</span>
              </div>
            </div>
            
            <a href={epaperLink} className="flex items-center gap-3 bg-white text-indigo-600 px-6 py-4 rounded-3xl font-black text-sm transition-all hover:pr-8 hover:bg-slate-50 shadow-xl self-start sm:self-center group/btn active:scale-95">
              Read Full E-Paper <ArrowRight size={18} className="transition-transform group-hover/btn:translate-x-1" />
            </a>
          </div>
        </div>

        {/* Clip Preview Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <div className="bg-white rounded-[2.5rem] p-4 sm:p-8 shadow-2xl border border-slate-200 group/img relative">
               {/* Decorative shadow */}
               <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-[2.6rem] blur opacity-5 group-hover/img:opacity-10 transition duration-1000" />
               <img 
                 src={clip.clipUrl} 
                 alt="Clipped article" 
                 className="relative w-full h-auto rounded-2xl shadow-sm border border-slate-100 print:shadow-none"
               />
            </div>
          </div>

          {/* Action Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 sticky top-28 space-y-6">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest text-center">Clip Actions</h2>
              
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    const downloadUrl = `/api/download?url=${encodeURIComponent(clip.clipUrl)}&w=800&h=800`; // Filename is handled by API
                    window.open(downloadUrl, '_blank');
                  }}
                  className="flex items-center justify-center gap-3 w-full bg-slate-900 hover:bg-black text-white py-4 rounded-3xl font-black text-sm transition-all shadow-lg active:scale-95"
                >
                  <Download size={20} /> Save to Gallery
                </button>
                <button 
                  onClick={() => { window.print(); }}
                  className="flex items-center justify-center gap-3 w-full bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-100 py-4 rounded-3xl font-black text-sm transition-all active:scale-95"
                >
                  <Printer size={20} /> Print Article
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Share This Article</p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      const text = `${clip.epaperTitle}: ${clip.edition} edition - ${formattedDate}\n\nRead more at: `;
                      const url = typeof window !== 'undefined' ? window.location.href : '';
                      window.open(`https://wa.me/?text=${encodeURIComponent(text + url)}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-3xl font-black text-sm transition-all shadow-lg active:scale-95"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.27 9.27 0 01-4.487-1.159l-.322-.19-3.338.876.891-3.256-.208-.332A9.282 9.282 0 012.25 9.354c0-5.118 4.158-9.276 9.276-9.276 2.479 0 4.808.965 6.551 2.71a9.214 9.214 0 012.723 6.561c0 5.117-4.158 9.275-9.276 9.275z"/></svg>
                    Send on WhatsApp
                  </button>
                  <button 
                    onClick={() => { if (typeof window !== 'undefined') navigator.share({ title: clip.epaperTitle, url: window.location.href }); }}
                    className="flex items-center justify-center gap-3 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-4 rounded-3xl font-black text-sm transition-all active:scale-95"
                  >
                    <Share2 size={20} /> Other Share Options
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer branding */}
        <div className="text-center pb-20 opacity-40">
           <img src="/kanykalogo.jpg" alt="Kanuka Logo" className="h-8 mx-auto object-contain grayscale mb-2" />
           <p className="text-[10px] font-black uppercase tracking-[0.3em]">Modern Journalism. Traditional Values.</p>
        </div>
      </main>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          header, footer, .sidebar { display: none !important; }
          body { background: white !important; }
          main { p: 0 !important; max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
