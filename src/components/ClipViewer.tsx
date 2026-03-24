'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, Printer, Share2, ArrowRight, Loader2, Home, Newspaper } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ClipViewerProps {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  date: string;
  edition: string;
  page: string;
}

export default function ClipViewer({ url, x, y, w, h, title, date, edition, page }: ClipViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const drawClip = async () => {
      if (!canvasRef.current) return;
      setLoading(true);
      setError(null);

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Important for CORS
        img.src = url;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("Failed to load news page. Please ensure your connection is stable."));
        });

        const canvas = canvasRef.current;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context failed");

        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        setLoading(false);
      } catch (err: any) {
        console.error("Clipping Error:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    drawClip();
  }, [url, x, y, w, h]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `kanuka-clip-${date}.jpg`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    }, 'image/jpeg', 0.9);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Check out this article from Kanuka E-Newspaper`,
          url: window.location.href,
        });
      } catch (err) {
        // Silently fail on cancel
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  const formattedDate = date ? format(parseISO(date), 'PPP') : 'Unknown Date';
  const epaperLink = `/epaper/${date}`;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
        <div className="bg-red-50 p-6 rounded-full text-red-500">
           <Newspaper size={48} />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Preview Unavailable</h2>
        <p className="text-slate-500 max-w-md">{error}</p>
        <a href="/" className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg">
          <Home size={18} /> Back to Home
        </a>
      </div>
    );
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-10 space-y-8 animate-in fade-in duration-500">
      {/* Dynamic Banner */}
      <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-lg text-[10px] font-black uppercase tracking-widest">Shared Clipping</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight mb-4 truncate">{title || 'News Article'}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-wider">{edition} Edition</span>
              <span className="px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-wider">{formattedDate}</span>
              <span className="px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-wider">Page {page}</span>
            </div>
          </div>
          <a href={epaperLink} className="flex items-center gap-2 bg-white text-slate-900 px-6 py-4 rounded-3xl font-black text-sm transition-all hover:bg-slate-100 shadow-xl group/btn active:scale-95 whitespace-nowrap">
            Read Full Paper <ArrowRight size={18} className="transition-transform group-hover/btn:translate-x-1" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[2.5rem] p-3 sm:p-6 shadow-2xl border border-slate-200 relative min-h-[300px] flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 rounded-[2.5rem]">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Rendering Clip...</p>
              </div>
            )}
            <canvas 
              ref={canvasRef} 
              className="w-full h-auto rounded-2xl shadow-sm border border-slate-50 opacity-0 transition-opacity duration-300"
              style={{ opacity: loading ? 0 : 1 }}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col gap-4">
             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center mb-2">Clip Actions</h2>
             <button 
               onClick={handleDownload}
               className="flex items-center justify-center gap-3 w-full bg-slate-900 hover:bg-black text-white py-4 rounded-3xl font-black text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50"
               disabled={loading}
             >
               <Download size={20} /> Save Image
             </button>
             <button 
               onClick={() => window.print()}
               className="flex items-center justify-center gap-3 w-full bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-100 py-4 rounded-3xl font-black text-sm transition-all active:scale-95 disabled:opacity-50"
               disabled={loading}
             >
               <Printer size={20} /> Print
             </button>
             
             <div className="h-px bg-slate-100 my-2" />
             
             <button 
               onClick={handleShare}
               className="flex items-center justify-center gap-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-3xl font-black text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50"
               disabled={loading}
             >
               <Share2 size={20} /> Share Article
             </button>
             
             <button 
               onClick={() => {
                 const text = `${title} - ${edition} Edition (${formattedDate})`;
                 window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + window.location.href)}`, '_blank');
               }}
               className="flex items-center justify-center gap-3 w-full bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white py-4 rounded-3xl font-black text-sm transition-all active:scale-95 disabled:opacity-50"
               disabled={loading}
             >
               Share on WhatsApp
             </button>
          </div>

          <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100/50">
            <p className="text-[10px] leading-relaxed text-indigo-900/60 font-medium">
              This clipping is generated in your browser and is not stored on our servers. The link you share contains only the references to the original paper and your selected area.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
