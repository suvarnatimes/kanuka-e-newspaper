'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Download, Scissors, ZoomIn, Save, X, Share2, Plus, Minus, Newspaper } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ReaderProps {
  epaper: {
    title: string;
    date: string;
    edition: string;
    imageUrls: string[];
    pdfUrl: string;
  };
}

// ─── Unified Responsive Reader (Mobile, Tablet, Desktop) ─────────────────────
const UnifiedReader: React.FC<ReaderProps> = ({ epaper }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1); // 1 to 3
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();

  const scrollRef = useRef<HTMLDivElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const totalPages = epaper.imageUrls.length;

  // Swipe detection for page turns
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => {
    // Only allow single-finger swipes for page turns
    // Also block if zooming or cropping
    if (e.touches.length !== 1 || zoom > 1 || isCropping) return; 
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (zoom > 1 || isCropping) return;
    // Ensure we are ending a single-finger gesture
    if (e.changedTouches.length !== 1) return;
    
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 50 && dy < 80) {
      if (dx < 0 && currentPage < totalPages - 1) { setCurrentPage(currentPage + 1); setZoom(1); }
      if (dx > 0 && currentPage > 0) { setCurrentPage(currentPage - 1); setZoom(1); }
    }
  };

  const getCropCoords = () => {
    if (!completedCrop || !completedCrop.width || completedCrop.width < 2 || !cropImgRef.current) return null;
    const el = cropImgRef.current;
    const rect = el.getBoundingClientRect();
    const renderedW = rect.width;
    const renderedH = rect.height;
    const { x: cx, y: cy, width: cw, height: ch } = completedCrop;
    const naturalW = el.naturalWidth;
    const naturalH = el.naturalHeight;
    const imgNaturalAspect = naturalW / naturalH;
    const elAspect = renderedW / renderedH;
    
    let drawW, drawH, offsetX, offsetY;
    if (imgNaturalAspect > elAspect) {
      drawW = renderedW; drawH = renderedW / imgNaturalAspect;
      offsetX = 0; offsetY = (renderedH - drawH) / 2;
    } else {
      drawH = renderedH; drawW = renderedH * imgNaturalAspect;
      offsetY = 0; offsetX = (renderedW - drawW) / 2;
    }
    
    const scaleX = naturalW / drawW;
    const scaleY = naturalH / drawH;
    const sx = Math.max(0, (cx - offsetX) * scaleX);
    const sy = Math.max(0, (cy - offsetY) * scaleY);
    const sw = Math.min(naturalW - sx, cw * scaleX);
    const sh = Math.min(naturalH - sy, ch * scaleY);

    return {
      sx: Math.round(sx),
      sy: Math.round(sy),
      sw: Math.round(sw),
      sh: Math.round(sh)
    };
  };

  const getCroppedBlob = async (): Promise<Blob | null> => {
    const coords = getCropCoords();
    if (!coords || !cropImgRef.current) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = coords.sw;
      canvas.height = coords.sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Use a cache-busting query to avoid cached responses without CORS
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = epaper.imageUrls[currentPage];
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = (e) => reject(new Error("Image load failed for canvas"));
      });

      ctx.drawImage(img, coords.sx, coords.sy, coords.sw, coords.sh, 0, 0, coords.sw, coords.sh);
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
      });
    } catch (err: any) {
      console.error("Client-side cropping failed:", err?.message || err);
      return null;
    }
  };

  // No pre-fetching needed for stateless approach

  const handleZoom = (direction: 'in' | 'out') => {
      setZoom(prev => direction === 'in' ? Math.min(prev + 0.5, 3) : Math.max(prev - 0.25, 0.5));
  };

  useEffect(() => {
      const handle = (e: KeyboardEvent) => {
          if (e.key === 'ArrowRight' && currentPage < totalPages - 1) { setCurrentPage(c => c + 1); setZoom(1); }
          if (e.key === 'ArrowLeft' && currentPage > 0) { setCurrentPage(c => c - 1); setZoom(1); }
          if (e.key === 'Escape') { setZoom(1); setIsCropping(false); }
      };
      window.addEventListener('keydown', handle);
      return () => window.removeEventListener('keydown', handle);
  }, [currentPage, totalPages]);

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative font-sans">
      <div className="flex items-center justify-between px-6 py-2 bg-slate-800 border-b border-white/5 shrink-0 z-50">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="flex items-baseline gap-2 overflow-hidden px-1">
            <h1 className="text-sm font-black text-white leading-tight uppercase tracking-tight truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">{epaper.title}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap opacity-80">{epaper.edition} · {format(parseISO(epaper.date), 'MMM do, yyyy')}</p>
          </div>
        </div>
        <div className="bg-white/10 px-3 py-1 rounded-xl border border-white/5 shrink-0">
           <span className="text-[10px] font-black text-white/90 tabular-nums">{currentPage + 1} / {totalPages}</span>
        </div>
      </div>

      <main 
        ref={scrollRef}
        className={`flex-1 overflow-auto bg-slate-900 flex items-start justify-center transition-all duration-300 ${zoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, select, .no-zoom') || isCropping) return;
            setZoom(prev => prev !== 1 ? 1 : 1.5);
        }}
      >
        <div 
          className="relative transition-all duration-500 ease-out flex items-center justify-center p-2 min-h-full"
          style={{ width: zoom >= 1 ? `${100 * zoom}%` : `${100 * zoom}%`, maxWidth: zoom > 1 ? 'none' : '1000px' }}
        >
          {isCropping ? (
             <div className="w-full h-full animate-in fade-in duration-300 no-zoom" style={{ touchAction: 'none' }}>
                <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} className="w-full h-full flex items-center justify-center">
                  <img ref={cropImgRef} src={epaper.imageUrls[currentPage]} alt="Crop" className="w-full h-auto object-contain rounded-lg shadow-2xl" />
                </ReactCrop>
             </div>
          ) : (
             <img src={epaper.imageUrls[currentPage]} alt={`Page ${currentPage + 1}`} className="w-full h-auto object-contain select-none shadow-2xl rounded-lg" draggable={false} />
          )}

          {zoom <= 1 && !isCropping && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); currentPage > 0 && setCurrentPage(c => c - 1); }} 
                className="fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 bg-transparent hover:bg-white/5 active:bg-indigo-600/20 backdrop-blur-none sm:backdrop-blur-sm rounded-xl border border-white/5 text-white/20 hover:text-white/60 transition-all shadow-none z-[60] no-zoom"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); currentPage < totalPages - 1 && setCurrentPage(c => c + 1); }} 
                className="fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 bg-transparent hover:bg-white/5 active:bg-indigo-600/20 backdrop-blur-none sm:backdrop-blur-sm rounded-xl border border-white/5 text-white/20 hover:text-white/60 transition-all shadow-none z-[60] no-zoom"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      </main>

      <footer className="shrink-0 bg-white border-t border-slate-200 z-[100] safe-pb pb-2 sm:pb-0 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between px-4 py-2 bg-white no-zoom">
          <div className="flex items-center gap-1 sm:gap-4 flex-1 justify-start">
            <ToolBtn onClick={() => { setIsCropping(!isCropping); setCrop(undefined); if (!isCropping) setZoom(1); }} icon={<Scissors size={20} strokeWidth={1.5} />} label="CLIP" active={isCropping} />
            <div className="relative">
              <ToolBtn onClick={() => setShowDatePicker(!showDatePicker)} icon={<Calendar size={20} strokeWidth={1.5} />} label="ARCH" active={showDatePicker} />
              {showDatePicker && (
                <div ref={datePickerRef} className="absolute bottom-full mb-4 left-0 bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-4 z-[110] animate-in slide-in-from-bottom-4">
                    <DayPicker mode="single" selected={parseISO(epaper.date)} onSelect={(d) => { if (d) window.location.href = `/epaper/${format(d, 'yyyy-MM-dd')}`; }} className="m-0 text-slate-800 text-sm" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="relative group/page">
                <select 
                  value={currentPage} 
                  onChange={(e) => { setCurrentPage(parseInt(e.target.value)); setZoom(1); }} 
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                >
                  {[...Array(totalPages)].map((_, i) => <option key={i} value={i}>PAGE {i + 1}</option>)}
                </select>
                <div className="bg-indigo-600 text-white rounded-2xl px-5 py-2 text-[10px] font-black shadow-lg shadow-indigo-200 flex items-center gap-2 transition-transform active:scale-95">
                   PAGE {currentPage + 1}
                </div>
             </div>

             <div className="hidden lg:flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-sm">
                <button onClick={() => handleZoom('out')} className="text-slate-400 hover:text-indigo-600 transition-all p-1"><Minus size={16} strokeWidth={3} /></button>
                <span className="text-[10px] font-black text-slate-500 min-w-[35px] text-center tabular-nums">{Math.round(zoom * 100)}%</span>
                <button onClick={() => handleZoom('in')} className="text-slate-400 hover:text-indigo-600 transition-all p-1"><Plus size={16} strokeWidth={3} /></button>
             </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-4 flex-1 justify-end">
            <div className="hidden lg:block">
              <ToolBtn onClick={() => zoom !== 1 ? setZoom(1) : handleZoom('in')} icon={<ZoomIn size={20} strokeWidth={1.5} />} label={zoom !== 1 ? 'RESET' : 'ZOOM'} active={zoom !== 1} />
            </div>
            <ToolBtn onClick={async () => { 
                const baseUrl = window.location.origin;
                const path = window.location.pathname;
                const fullUrl = `${baseUrl}${path}`;
                try { await navigator.share({ title: epaper.title, url: fullUrl }); } catch {} 
            }} icon={<Share2 size={20} strokeWidth={1.5} />} label="SHARE" />
            <a href={epaper.pdfUrl} download className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-indigo-600 transition-all group/pdf">
               <Download size={20} strokeWidth={1.5} className="transition-transform group-hover/pdf:translate-y-0.5" />
               <span className="text-[10px] font-bold uppercase tracking-tighter">PDF</span>
            </a>
          </div>
        </div>
      </footer>

      {isCropping && completedCrop && (completedCrop.width || 0) > 5 && (
        <div className="fixed bottom-0 left-0 right-0 z-[120] bg-white border-t border-indigo-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] no-zoom animate-in slide-in-from-bottom-full safe-pb flex items-center justify-between px-6 py-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Selection Active</span>
              <p className="text-[9px] font-bold text-slate-400">Ready to share or save</p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={async (e) => { 
                  const btn = e.currentTarget;
                  const originalText = btn.innerText;
                  btn.disabled = true;
                  btn.innerText = "...";

                  try {
                    const coords = getCropCoords();
                    if (!coords) return;
                    const baseUrl = window.location.origin;
                    const params = new URLSearchParams({
                      url: epaper.imageUrls[currentPage],
                      x: coords.sx.toString(),
                      y: coords.sy.toString(),
                      w: coords.sw.toString(),
                      h: coords.sh.toString(),
                      title: epaper.title,
                      edition: epaper.edition,
                      date: epaper.date,
                      page: (currentPage + 1).toString()
                    });
                    const shareUrl = `${baseUrl}/clip?${params.toString()}`;
                    const blob = await getCroppedBlob();
                    
                    if (!blob) {
                      if (navigator.share) await navigator.share({ title: epaper.title, url: shareUrl });
                      else { await navigator.clipboard.writeText(shareUrl); alert("Link copied!"); }
                      return;
                    }

                    const file = new File([blob], "kanuka-clip.jpg", { type: "image/jpeg" });
                    
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({
                        title: epaper.title,
                        text: `Check out this news from Kanuka E-Newspaper`,
                        url: shareUrl,
                        files: [file]
                      });
                    } else if (navigator.share) {
                      await navigator.share({ title: epaper.title, url: shareUrl });
                    } else {
                      await navigator.clipboard.writeText(shareUrl);
                      alert("Share link copied to clipboard!");
                    }
                  } catch (err) { } finally {
                    btn.disabled = false;
                    btn.innerText = originalText;
                  }
                }} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-5 py-2.5 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black shadow-lg transition-all flex-1 sm:flex-none disabled:opacity-50"
              >
                SHARE
              </button>

              <button 
                onClick={async () => { 
                  const coords = getCropCoords();
                  if (!coords) return;
                  const baseUrl = window.location.origin;
                  const params = new URLSearchParams({
                    url: epaper.imageUrls[currentPage],
                    x: coords.sx.toString(),
                    y: coords.sy.toString(),
                    w: coords.sw.toString(),
                    h: coords.sh.toString(),
                    title: epaper.title,
                    edition: epaper.edition,
                    date: epaper.date,
                    page: (currentPage + 1).toString()
                  });
                  const shareUrl = `${baseUrl}/clip?${params.toString()}`;
                  await navigator.clipboard.writeText(shareUrl);
                  alert("Link copied to clipboard!");
                }} 
                className="bg-slate-800 hover:bg-slate-900 text-white px-3 sm:px-5 py-2.5 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black shadow-lg transition-all flex-1 sm:flex-none"
              >
                COPY LINK
              </button>

              <button 
                onClick={async (e) => { 
                  const btn = e.currentTarget;
                  btn.disabled = true;
                  const blob = await getCroppedBlob();
                  if (blob) {
                    const downloadUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `kanuka-clip-${epaper.date}.jpg`;
                    a.click();
                    URL.revokeObjectURL(downloadUrl);
                  }
                  btn.disabled = false;
                }} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-5 py-2.5 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black shadow-lg transition-all flex-1 sm:flex-none disabled:opacity-50"
              >
                SAVE
              </button>
              <button 
                onClick={() => { setIsCropping(false); setCrop(undefined); setCompletedCrop(undefined); }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-500 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-sm transition-all"
              >
                <X size={14} />
              </button>
            </div>
        </div>
      )}
    </div>
  );
};

// Utility component for tools
function ToolBtn({ onClick, icon, label, active = false }: { onClick: () => void, icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 p-3 group transition-all active:scale-90 ${active ? 'text-indigo-600 translate-y-[-4px]' : 'text-slate-400 hover:text-indigo-600'}`}>
      <div className={`${active ? 'bg-indigo-50 p-2 rounded-xl' : ''} transition-all`}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
      </div>
      <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

const Reader: React.FC<ReaderProps> = ({ epaper }) => {
  return <UnifiedReader epaper={epaper} />;
};

export default Reader;
