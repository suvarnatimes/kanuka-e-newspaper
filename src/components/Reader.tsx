'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Download, Scissors, ZoomIn, Save, X, Share2, Plus, Minus, Newspaper } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { saveClip } from '@/app/actions/clip';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [clipBlob, setClipBlob] = useState<Blob | null>(null);
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [shareUrlReady, setShareUrlReady] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const totalPages = epaper.imageUrls.length;

  // Swipe detection for page turns
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1 || isCropping) return; 
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (zoom > 1 || isCropping) return;
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

  const getCroppedCanvas = async (): Promise<{ blob: Blob } | null> => {
    const coords = getCropCoords();
    if (!coords) return null;

    setIsProcessing(true);
    try {
      const apiUrl = `/api/clip?url=${encodeURIComponent(epaper.imageUrls[currentPage])}&x=${coords.sx}&y=${coords.sy}&w=${coords.sw}&h=${coords.sh}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Clip failed");
      const blob = await response.blob();
      setIsProcessing(false);
      return { blob };
    } catch (err) {
      console.error("Clipping API Failure:", err);
      setIsProcessing(false);
      return null;
    }
  };

  // Pre-fetch clip blob when crop changes (debounced)
  useEffect(() => {
    if (!completedCrop || !completedCrop.width || completedCrop.width < 10) {
      setClipBlob(null);
      setShareUrlReady(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await getCroppedCanvas();
      if (res) setClipBlob(res.blob);
    }, 600);
    return () => clearTimeout(timer);
  }, [crop]);

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
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-900 overflow-hidden relative font-sans">
      <div className="flex items-center justify-between px-6 py-2 bg-white/5 backdrop-blur-xl border-b border-white/10 shrink-0 z-50">
        <div className="flex items-center gap-4 overflow-hidden text-center sm:text-left">
          <div className="flex items-baseline gap-2 overflow-hidden px-1">
            <h1 className="text-sm font-black text-white leading-tight uppercase tracking-tight truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">{epaper.title}</h1>
            <span className="text-white/20 text-xs hidden xs:inline">|</span>
            <p className="text-[9px] sm:text-[10px] font-bold text-indigo-400 uppercase tracking-widest whitespace-nowrap opacity-80">{epaper.edition} · {format(parseISO(epaper.date), 'MMM do, yyyy')}</p>
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

      <footer className="shrink-0 bg-white/95 backdrop-blur-3xl border-t border-slate-200 z-[100] safe-pb">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50 no-zoom">
          <div className="flex items-center gap-0.5 sm:gap-1">
            <ToolBtn onClick={() => { setIsCropping(!isCropping); setCrop(undefined); if (!isCropping) setZoom(1); }} icon={<Scissors size={18} />} label="CLIP" active={isCropping} />
            <div className="relative">
              <ToolBtn onClick={() => setShowDatePicker(!showDatePicker)} icon={<Calendar size={18} />} label="ARCH" active={showDatePicker} />
              {showDatePicker && (
                <div ref={datePickerRef} className="absolute bottom-full mb-4 left-0 bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-4 z-[110] animate-in slide-in-from-bottom-4">
                    <DayPicker mode="single" selected={parseISO(epaper.date)} onSelect={(d) => { if (d) window.location.href = `/epaper/${format(d, 'yyyy-MM-dd')}`; }} className="m-0 text-slate-800 text-sm" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select 
                value={currentPage} 
                onChange={(e) => { setCurrentPage(parseInt(e.target.value)); setZoom(1); }} 
                className="bg-indigo-600 text-white rounded-xl px-3 py-1.5 text-[10px] font-black appearance-none cursor-pointer text-center outline-none shadow-md shadow-indigo-100 min-w-[80px]"
              >
                {[...Array(totalPages)].map((_, i) => <option key={i} value={i} className="bg-white text-slate-800 text-xs">PAGE {i + 1}</option>)}
              </select>
            </div>
            
            <div className="hidden md:flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
              <button onClick={() => handleZoom('out')} className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-all"><Minus size={14} /></button>
              <span className="text-[9px] font-black text-slate-500 w-7 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
              <button onClick={() => handleZoom('in')} className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-all"><Plus size={14} /></button>
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <ToolBtn onClick={() => zoom !== 1 ? setZoom(1) : handleZoom('in')} icon={<ZoomIn size={18} />} label={zoom !== 1 ? 'RESET' : 'ZOOM'} active={zoom !== 1} />
            <ToolBtn onClick={async () => { try { await navigator.share({ title: epaper.title, url: window.location.href }); } catch {} }} icon={<Share2 size={18} />} label="SHARE" />
            <a href={epaper.pdfUrl} download className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-indigo-600 transition-all"><Download size={18} /><span className="text-[9px] font-black uppercase tracking-tighter">PDF</span></a>
          </div>
        </div>
      </footer>

      {isCropping && completedCrop && (completedCrop.width || 0) > 5 && (
        <div className="fixed bottom-24 sm:bottom-32 left-1/2 -translate-x-1/2 z-[110] flex flex-col sm:flex-row items-center gap-2 sm:gap-4 bg-white/95 backdrop-blur-xl px-4 sm:px-8 py-3 sm:py-4 rounded-3xl sm:rounded-[2.5rem] border border-indigo-100 shadow-2xl no-zoom animate-in slide-in-from-bottom-10 w-[90%] sm:w-auto">
            <span className="text-[9px] sm:text-xs font-black text-indigo-600 uppercase tracking-widest">Selection Active</span>
            <div className="hidden sm:block w-px h-8 bg-slate-200" />
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <button 
                onClick={async () => { 
                  if (shareUrlReady) {
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: epaper.title,
                          text: `Check out this article from Kanuka E-Newspaper`,
                          url: shareUrlReady
                        });
                        setIsCropping(false);
                        setShareUrlReady(null);
                        setCrop(undefined);
                        setCompletedCrop(undefined);
                      } catch (err) {
                        // User cancelled or share failed, stay on page
                      }
                    } else {
                      await navigator.clipboard.writeText(shareUrlReady);
                      alert("Share link copied to clipboard!");
                    }
                    return;
                  }

                  const coords = getCropCoords();
                  if (!coords) return;

                  setIsProcessing(true);
                  try {
                    const result = await saveClip({
                      imageUrl: epaper.imageUrls[currentPage],
                      x: coords.sx,
                      y: coords.sy,
                      w: coords.sw,
                      h: coords.sh,
                      epaperTitle: epaper.title,
                      epaperDate: epaper.date,
                      edition: epaper.edition,
                      pageIndex: currentPage + 1
                    });

                    if (result.success && result.shareUrl) {
                      const fullUrl = result.shareUrl.startsWith('http') 
                        ? result.shareUrl 
                        : `${window.location.origin}${result.shareUrl}`;
                      
                      setShareUrlReady(fullUrl);
                    } else {
                      throw new Error(result.error);
                    }
                  } catch (err: any) {
                    console.error("Save Clip Failed:", err);
                    alert("Generating share link failed. Please try saving instead.");
                  } finally {
                    setIsProcessing(false);
                  }
                }} 
                disabled={isProcessing}
                className={`${shareUrlReady ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black shadow-lg transition-all flex-1 sm:flex-none ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
              >
                {isProcessing ? 'GENERATING...' : (shareUrlReady ? 'SHARE NOW' : 'SHARE CLIP')}
              </button>
              <button 
                onClick={() => { 
                  const coords = getCropCoords();
                  if (coords) {
                     const downloadUrl = `/api/download?url=${encodeURIComponent(epaper.imageUrls[currentPage])}&x=${coords.sx}&y=${coords.sy}&w=${coords.sw}&h=${coords.sh}`;
                     window.open(downloadUrl, '_blank');
                  }
                }} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black shadow-lg transition-all flex-1 sm:flex-none"
              >
                SAVE
              </button>
              <button 
                onClick={() => { setIsCropping(false); setCrop(undefined); setCompletedCrop(undefined); setShareUrlReady(null); }}
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
