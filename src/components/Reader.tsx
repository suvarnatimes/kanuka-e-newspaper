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
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState<{ url: string, blob: Blob | null }>({ url: '', blob: null });

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
      // Use a server-side proxy to bypass browser CORS completely
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(epaper.imageUrls[currentPage])}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Image fetch failed: ${response.status} ${response.statusText}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Image decoding failed"));
        img.src = objectUrl;
      });
      
      ctx.drawImage(img, coords.sx, coords.sy, coords.sw, coords.sh, 0, 0, coords.sw, coords.sh);
      URL.revokeObjectURL(objectUrl);
      
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
                  
                  {crop && crop.width > 0 && (
                    <div 
                      className="absolute z-[130] flex items-center gap-px overflow-hidden rounded-lg shadow-2xl border border-white/20 no-zoom"
                      style={{ 
                        top: `${crop.y}%`, 
                        left: `${crop.x}%`,
                        transform: 'translateY(-100%) translateY(-8px)',
                        flexDirection: 'row'
                      }}
                    >
                      <button 
                        onClick={async (e) => { 
                          e.stopPropagation();
                          const blob = await getCroppedBlob();
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
                          
                          setShareData({
                             url: `${baseUrl}/clip?${params.toString()}`,
                             blob: blob
                          });
                          setShowShareModal(true);
                        }}
                        className="bg-white hover:bg-slate-50 text-slate-900 px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Share2 size={12} strokeWidth={2.5} />
                        Share
                      </button>
                      
                      <button 
                        onClick={async (e) => { 
                          e.stopPropagation();
                          const blob = await getCroppedBlob();
                          if (blob) {
                            const downloadUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = downloadUrl;
                            a.download = `kanuka-clip-${epaper.date}.jpg`;
                            a.click();
                            URL.revokeObjectURL(downloadUrl);
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors border-l border-white/10"
                      >
                        <Download size={12} strokeWidth={2.5} />
                        Save
                      </button>

                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsCropping(false); setCrop(undefined); setCompletedCrop(undefined); }}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors border-l border-white/10"
                      >
                        <X size={12} strokeWidth={2.5} />
                        Cancel
                      </button>
                    </div>
                  )}
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

      {/* Share Modal Overlay */}
      {showShareModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowShareModal(false)} />
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative z-10">
            <div className="p-8 pb-4">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 leading-tight">Share Clip</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Select Platform</p>
                </div>
                <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              {shareData.blob && (
                <div className="aspect-video w-full bg-slate-100 rounded-3xl mb-8 overflow-hidden border border-slate-100 shadow-inner">
                  <img src={URL.createObjectURL(shareData.blob)} alt="Preview" className="w-full h-full object-contain" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-8">
                 <SocialBtn 
                   color="bg-[#25D366]" 
                   label="WhatsApp" 
                   onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Check out this news from Kanuka E-Newspaper: ' + shareData.url)}`)} 
                 />
                 <SocialBtn 
                   color="bg-[#1877F2]" 
                   label="Facebook" 
                   onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`)} 
                 />
              </div>

              <button 
                onClick={async () => {
                   await navigator.clipboard.writeText(shareData.url);
                   alert("Link copied to clipboard!");
                }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all mb-4"
              >
                Copy Share Link
              </button>
            </div>
            <div className="bg-slate-50 p-4 text-center">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Stateless Image Sharing Enabled</p>
            </div>
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

function SocialBtn({ color, label, onClick }: { color: string, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full ${color} text-white p-4 rounded-2xl flex flex-col items-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all`}
    >
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

const Reader: React.FC<ReaderProps> = ({ epaper }) => {
  return <UnifiedReader epaper={epaper} />;
};

export default Reader;
