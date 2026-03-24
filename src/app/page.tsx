'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { BookOpen, Calendar, MapPin, Search as SearchIcon, Newspaper, Loader2, RefreshCw } from 'lucide-react';

type Epaper = {
  _id: string;
  title: string;
  date: string;
  edition: string;
  state: 'Andhra Pradesh' | 'Telangana';
  imageUrls: string[];
  pdfUrl: string;
};

export default function Home() {
  const [epapers, setEpapers] = useState<Epaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [selectedState, setSelectedState] = useState<'All' | 'Andhra Pradesh' | 'Telangana'>('All');

  useEffect(() => {
    fetchEpapers();
  }, []);

  const fetchEpapers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/epapers');
      if (res.ok) {
        const data = await res.json();
        setEpapers(data);
      }
    } catch (err) {
      console.error("Error fetching epapers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEpapers = useMemo(() => {
    return epapers.filter(paper => {
      const matchesText = paper.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         paper.edition.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = !searchDate || paper.date.startsWith(searchDate);
      const matchesState = selectedState === 'All' || paper.state === selectedState;
      return matchesText && matchesDate && matchesState;
    });
  }, [epapers, searchQuery, searchDate, selectedState]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        


        {/* State Selection Toggles */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {(['All', 'Andhra Pradesh', 'Telangana'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedState(s)}
              className={`px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${
                selectedState === s 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              {s === 'All' ? 'Both Regions' : s}
            </button>
          ))}
        </div>

        {/* Search & Filter Bar */}
        <div className="max-w-4xl mx-auto mb-16 px-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-900/5 p-2 flex flex-col md:flex-row gap-2 border border-slate-100 ring-4 ring-indigo-50">
            <div className="flex-1 relative group">
              <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Search by title or region..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border-0 rounded-full pl-14 pr-6 py-4 text-base outline-none font-medium placeholder-slate-400"
              />
            </div>
            <div className="w-px h-10 bg-slate-100 hidden md:block self-center mx-2" />
            <div className="relative group">
              <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
              <input 
                type="date" 
                value={searchDate}
                onChange={e => setSearchDate(e.target.value)}
                className="w-full md:w-56 bg-white border-0 rounded-full pl-14 pr-8 py-4 text-base outline-none font-bold text-slate-700 cursor-pointer"
              />
            </div>
            { (searchQuery || searchDate || selectedState !== 'All') && (
              <button 
                onClick={() => { setSearchQuery(''); setSearchDate(''); setSelectedState('All'); }}
                className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-full font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} /> <span className="md:hidden">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Section */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
            <p className="font-black text-slate-400 text-sm uppercase tracking-widest">Loading Archive...</p>
          </div>
        ) : filteredEpapers.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-indigo-200 shadow-sm flex flex-col items-center justify-center max-w-2xl mx-auto">
            <div className="bg-indigo-50 p-6 rounded-full inline-block mb-6">
              <BookOpen size={48} className="text-indigo-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">No results found</h3>
            <p className="max-w-sm mx-auto text-slate-500 font-medium">Try adjusting your filters or check back later for new publications.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10">
            {filteredEpapers.map((paper) => {
              const formattedDate = paper.date.split('T')[0];
              const displayDate = format(parseISO(paper.date), 'MMMM do, yyyy');
              
              return (
                <Link 
                  href={`/epaper/${formattedDate}`} 
                  key={paper._id}
                  className="group relative flex flex-col bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 hover:border-indigo-200 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 ease-out hover:-translate-y-3"
                >
                  <div className="relative aspect-[1/1.414] w-full bg-slate-50 overflow-hidden">
                    <img 
                      src={paper.imageUrls[0]} 
                      alt={paper.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out"
                    />
                    
                    {/* Read Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-900/10 to-indigo-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    {/* Action Circle */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                      <div className="bg-white/95 backdrop-blur-md text-indigo-700 font-black px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 scale-90 group-hover:scale-100 transition-transform tracking-tight">
                        <BookOpen size={20} /> OPEN NOW
                      </div>
                    </div>

                    {/* Region Badges */}
                    <div className="absolute top-6 left-6 flex flex-col gap-2 z-10 scale-90 sm:scale-100">
                      <div className={`backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border flex items-center gap-2 ${paper.state === 'Telangana' ? 'bg-orange-50/90 text-orange-700 border-orange-100' : 'bg-blue-50/90 text-blue-700 border-blue-100'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest">{paper.state}</span>
                      </div>
                      <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-indigo-50 flex items-center gap-2">
                        <MapPin size={14} className="text-indigo-600" />
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{paper.edition}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-8 flex flex-col flex-1 bg-white relative">
                    <h3 className="text-xl font-black text-slate-800 mb-4 line-clamp-2 leading-[1.1] group-hover:text-indigo-600 transition-colors duration-300">
                      {paper.title}
                    </h3>
                    
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Published</span>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                          <Calendar size={16} className="text-indigo-500" />
                          {displayDate}
                        </div>
                      </div>
                      <div className="bg-indigo-50 h-8 w-8 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-xs ring-1 ring-indigo-100">
                        {paper.imageUrls.length}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
