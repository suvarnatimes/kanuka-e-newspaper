'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Download, Scissors, ZoomIn, Save, X, Share2, Plus, Minus, Newspaper, Facebook, Instagram, MessageSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import HTMLPageFlip from 'react-pageflip';
import QuickPinchZoom, { make3dTransformValue } from 'react-quick-pinch-zoom';

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
  const flipRef = useRef<any>(null);
  const pinchZoomRef = useRef<any>(null);
  const pinchTargetRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    if (pinchZoomRef.current) {
      pinchZoomRef.current.scaleTo({ scale: Math.min(zoom + 0.5, 4), duration: 250 });
    }
  };

  const handleZoomOut = () => {
    if (pinchZoomRef.current) {
      pinchZoomRef.current.alignCenter({ duration: 250 });
      setZoom(1);
    }
  };

  const totalPages = epaper.imageUrls.length;

  const onUpdate = React.useCallback(({ x, y, scale }: { x: number, y: number, scale: number }) => {
    const el = pinchTargetRef.current;
    if (el) {
      el.style.setProperty('transform', make3dTransformValue({ x, y, scale }));
    }
    setZoom(scale);
  }, []);

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
    <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden relative font-sans h-[100dvh]">
      {/* Header - Prajabhoomi Desktop Style */}
      <div className="bg-[#2D3436] px-4 py-3 flex items-center justify-start shrink-0 z-[100] shadow-md">
        <div className="bg-[#FEC401] px-1 mr-4 hidden sm:block h-6 w-1"></div>
        <h1 className="text-sm sm:text-lg font-black text-white uppercase tracking-tight">
          {epaper.title}-{format(parseISO(epaper.date), 'dd-MM-yyyy')}-{epaper.edition} - Page {currentPage + 1}
        </h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Desktop Thumbnail Strip */}
        <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 overflow-y-auto custom-scrollbar shadow-inner">
           <div className="p-4 space-y-6">
              {epaper.imageUrls.map((url, i) => (
                <button 
                  key={i} 
                  onClick={() => {
                     setCurrentPage(i);
                     handleZoomOut();
                     if (flipRef.current) flipRef.current.pageFlip().turnToPage(i);
                  }}
                  className={`w-full group focus:outline-none transition-all ${currentPage === i ? 'ring-2 ring-indigo-600 rounded-lg p-1' : 'opacity-70 hover:opacity-100'}`}
                >
                   <div className="aspect-[3/4] bg-slate-100 rounded border border-slate-200 overflow-hidden mb-2 shadow-sm group-hover:shadow-md transition-shadow">
                      <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                   </div>
                   <span className={`text-xs font-black uppercase tracking-widest ${currentPage === i ? 'text-indigo-600 font-black' : 'text-slate-500'}`}>
                      Page {i + 1}
                   </span>
                </button>
              ))}
           </div>
        </aside>

        {/* Main Content Area */}
        <main 
          ref={scrollRef}
          className={`flex-1 overflow-hidden bg-slate-100/30 flex items-center justify-center transition-all duration-300 relative`}
        >
          <div 
            className="w-full h-full p-2 flex items-center justify-center"
          >
            {isCropping ? (
               <div className="w-full h-full animate-in fade-in duration-300 no-zoom" style={{ touchAction: 'none' }}>
                  <ReactCrop 
                    crop={crop} 
                    onChange={c => setCrop(c)} 
                    onComplete={c => setCompletedCrop(c)}
                    className="w-full h-full flex items-center justify-center font-sans"
                    renderSelectionAddon={() => (
                      <div 
                        className="absolute left-0 -top-10 z-[200] flex items-center gap-px overflow-hidden rounded-lg shadow-2xl border border-white/20 no-zoom"
                        style={{ pointerEvents: 'auto' }}
                      >
                        <button 
                          onClick={async (e) => { 
                            e.stopPropagation();
                            const blob = await getCroppedBlob();
                            if (blob) {
                              setShareData({
                                 url: window.location.href,
                                 blob: blob
                              });
                              setShowShareModal(true);
                            }
                          }}
                          className="bg-white hover:bg-slate-50 text-slate-900 px-3 py-2 text-[10px] font-black flex items-center gap-1.5 transition-colors whitespace-nowrap"
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
                          className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 text-[10px] font-black flex items-center gap-1.5 transition-colors border-l border-white/10 whitespace-nowrap"
                        >
                          <Download size={12} strokeWidth={2.5} />
                          Save
                        </button>

                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsCropping(false); setCrop(undefined); setCompletedCrop(undefined); }}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-[10px] font-black flex items-center gap-1.5 transition-colors border-l border-white/10 whitespace-nowrap"
                        >
                          <X size={12} strokeWidth={2.5} />
                          Cancel
                        </button>
                      </div>
                    )}
                  >
                    <img ref={cropImgRef} src={epaper.imageUrls[currentPage]} alt="Crop" className="w-full h-auto object-contain rounded-lg shadow-2xl" />
                  </ReactCrop>
               </div>
            ) : (
              <div className={`w-full h-full ${zoom > 1 ? 'overflow-auto' : 'flex items-center justify-center'}`}>
                <QuickPinchZoom
                  ref={pinchZoomRef}
                  onUpdate={onUpdate}
                  draggableUnZoomed={false}
                  enabled={!isCropping}
                  maxZoom={4}
                  minZoom={1}
                  tapZoomFactor={0}
                >
                  <div ref={pinchTargetRef} className="w-full h-full flex items-center justify-center origin-center transition-all duration-300">
                    {/* @ts-ignore */}
                    <HTMLPageFlip
                      width={550}
                      height={800}
                      size="stretch"
                      minWidth={315}
                      maxWidth={1000}
                      minHeight={400}
                      maxHeight={1533}
                      maxShadowOpacity={0.5}
                      showCover={false}
                      mobileScrollSupport={true}
                      onFlip={(e: any) => setCurrentPage(e.data)}
                      className="page-flip-container shadow-2xl rounded-lg mx-auto"
                      style={{ display: 'block' }}
                      useMouseEvents={zoom === 1 && !isCropping}
                      useTouchEvents={zoom === 1 && !isCropping}
                      startPage={currentPage}
                      ref={flipRef}
                      display="single"
                      usePortrait={true}
                      showPageCorners={zoom === 1}
                      disableFlipByClick={zoom > 1}
                    >
                      {epaper.imageUrls.map((url, i) => (
                        <div key={i} className="page shadow-inner bg-white flex items-center justify-center overflow-hidden">
                          <img src={url} alt={`Page ${i + 1}`} className="w-full h-full object-contain pointer-events-none select-none" />
                        </div>
                      ))}
                    </HTMLPageFlip>
                  </div>
                </QuickPinchZoom>
              </div>
            )}

          {zoom <= 1 && !isCropping && (
            <>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (flipRef.current) {
                    /* @ts-ignore */
                    flipRef.current.pageFlip().flipPrev();
                  } else {
                    currentPage > 0 && setCurrentPage(c => c - 1);
                  }
                }} 
                className="fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 text-white transition-all z-[100] no-zoom shadow-2xl"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (flipRef.current) {
                    /* @ts-ignore */
                    flipRef.current.pageFlip().flipNext();
                  } else {
                    currentPage < totalPages - 1 && setCurrentPage(c => c + 1);
                  }
                }} 
                className="fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 text-white transition-all z-[100] no-zoom shadow-2xl"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      </main>

      <footer className="shrink-0 bg-white border-t border-slate-200 z-[100] safe-pb pb-2 sm:pb-0 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between px-4 py-2 bg-white no-zoom">
          <div className="flex items-center gap-1 sm:gap-4 flex-1 justify-start">
            <ToolBtn onClick={() => { setIsCropping(!isCropping); setCrop(undefined); if (!isCropping) handleZoomOut(); }} icon={<Scissors size={20} strokeWidth={1.5} />} label="CLIP" active={isCropping} />
            <div className="relative">
              <ToolBtn onClick={() => setShowDatePicker(!showDatePicker)} icon={<Calendar size={20} strokeWidth={1.5} />} label="ARCH" active={showDatePicker} />
              {showDatePicker && (
                <div ref={datePickerRef} className="absolute bottom-full mb-4 left-0 bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-4 z-[110] animate-in slide-in-from-bottom-4">
                    <DayPicker mode="single" selected={parseISO(epaper.date)} onSelect={(d) => { if (d) window.location.href = `/epaper/${format(d, 'yyyy-MM-dd')}`; }} className="m-0 text-slate-800 text-sm" />
                </div>
              )}
            </div>
            <div className="h-8 w-px bg-slate-100 mx-1 hidden sm:block" />
            <div className="flex items-center gap-1">
               <ToolBtn onClick={handleZoomIn} icon={<Plus size={20} strokeWidth={1.5} />} label="IN" />
               <ToolBtn onClick={handleZoomOut} icon={<Minus size={20} strokeWidth={1.5} />} label="OUT" />
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

      <footer className="shrink-0 bg-white border-t border-slate-200 z-[100] safe-pb pb-2 sm:pb-0 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">

      {/* Share Modal Overlay - Prajabhoomi "Pro" Style */}
      {showShareModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
          <div className="bg-white rounded-xl w-full max-w-[340px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative z-10 border border-slate-200">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-700">Share It</h3>
              <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-slate-200 rounded-md transition-colors bg-slate-200">
                <X size={16} className="text-slate-600" />
              </button>
            </div>

            <div className="p-4 flex flex-col items-center">
              {/* Image Preview */}
              {shareData.blob && (
                <div className="w-full aspect-[3/4] bg-slate-100 rounded-lg mb-4 overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center p-2">
                  <img src={URL.createObjectURL(shareData.blob)} alt="Preview" className="max-w-full max-h-full object-contain" />
                </div>
              )}

              {/* URL Box */}
              <div className="w-full relative mb-4">
                <input 
                  type="text" 
                  readOnly 
                  value={shareData.url}
                  className="w-full bg-slate-50 border border-slate-300 rounded text-[10px] py-2 px-3 pr-10 text-slate-500 font-mono focus:outline-none"
                  onClick={(e) => {
                     (e.target as HTMLInputElement).select();
                     navigator.clipboard.writeText(shareData.url);
                  }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                   <Share2 size={10} />
                </div>
              </div>

              {/* Social Icon Grid */}
              <div className="grid grid-cols-4 gap-1 w-full mb-6 overflow-hidden rounded-lg">
                 <SocialBtn 
                   color="bg-[#4267B2]" 
                   icon={<svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>}
                   onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`)} 
                 />
                 <SocialBtn 
                   color="bg-black" 
                   icon={<svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>}
                   onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareData.url)}`)} 
                 />
                 <SocialBtn 
                   color="bg-[#25D366]" 
                   icon={<svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 0 5.414 0 12.05c0 2.123.55 4.197 1.592 6.015L0 24l6.149-1.613a11.758 11.758 0 005.9 1.562h.005c6.634 0 12.05-5.414 12.05-12.05 0-3.212-1.251-6.234-3.527-8.51z"/></svg>}
                   onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Check out this news from Kanuka: ' + shareData.url)}`)} 
                 />
                 <SocialBtn 
                   color="bg-[#C13584]" 
                   icon={<svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.805.249 2.227.412.56.217.96.477 1.381.897.42.42.68.82.897 1.381.163.422.358 1.057.412 2.227.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.249 1.805-.412 2.227-.217.56-.477.96-.897 1.381-.42.42-.82.68-1.381.897-.422.163-1.057.358-2.227.412-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.805-.249-2.227-.412-.56-.217-.96-.477-1.381-.897-.42-.42-.68-.82-.897-1.381-.163-.422-.358-1.057-.412-2.227-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.054-1.17.249-1.805.412-2.227.217-.56.477-.96.897-1.381.42-.42.82-.68 1.381-.897.422-.163 1.057-.358 2.227-.412 1.266-.058-1.646-.07 4.85-.07zM12 0C8.741 0 8.333.014 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.741 0 12s.014 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126s1.337 1.078 2.126 1.384c.766.296 1.636.499 2.913.558C8.333 23.986 8.741 24 12 24s3.667-.014 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384s1.078-1.337 1.384-2.126c.296-.765.499-1.636.558-2.913.058-1.28.072-1.687.072-4.947s-.014-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126s-1.337-1.078-2.126-1.384c-.765-.296-1.636-.499-2.913-.558C15.667.012 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>}
                   onClick={() => {
                      navigator.clipboard.writeText(shareData.url);
                      alert("Link copied! You can now paste it into your Instagram story or message.");
                      window.open('https://instagram.com');
                   }} 
                 />
              </div>

              <div className="w-full">
                 <button 
                   onClick={() => {
                      if (shareData.blob) {
                         const downloadUrl = URL.createObjectURL(shareData.blob);
                         const a = document.createElement('a');
                         a.href = downloadUrl;
                         a.download = `kanuka-clip-${epaper.date}.jpg`;
                         a.click();
                         URL.revokeObjectURL(downloadUrl);
                      }
                   }}
                   className="w-full flex items-center justify-center gap-2 bg-[#4A69BD] hover:bg-[#3C55A5] text-white py-3 rounded-md text-[11px] font-bold shadow-md shadow-slate-100 transition-all active:scale-95"
                 >
                   <Download size={14} /> Download Image
                 </button>
              </div>
            </div>
            
            <div className="bg-white pb-6 text-center">
               <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Share to Social Network</p>
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
    <button onClick={onClick} className={`flex flex-col items-center gap-2 p-3 group transition-all active:scale-90 ${active ? 'text-indigo-600 translate-y-[-4px]' : 'text-slate-500 hover:text-indigo-600'}`}>
      <div className={`${active ? 'bg-indigo-50 p-2 rounded-xl text-indigo-600' : ''} transition-all`}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
      </div>
      <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function SocialBtn({ color, icon, onClick }: { color: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full ${color} text-white h-12 flex items-center justify-center shadow-sm hover:brightness-110 active:scale-95 transition-all`}
    >
      {icon}
    </button>
  );
}

const Reader: React.FC<ReaderProps> = ({ epaper }) => {
  return <UnifiedReader epaper={epaper} />;
};

export default Reader;
