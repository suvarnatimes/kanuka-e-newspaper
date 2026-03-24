'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  UploadCloud, FileText, Loader2, CheckCircle, AlertCircle, 
  Newspaper, Lock, Mail, Search, Calendar as CalendarIcon, 
  Plus, Trash2, Edit2, LogOut, LayoutDashboard, ArrowLeft, 
  ChevronRight, ExternalLink
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

import { startEpaperUpload, appendEpaperPage, finishEpaperUpload, updateEpaperMetadata } from '@/app/actions/epaper';

type Epaper = {
  _id: string;
  title: string;
  date: string;
  edition: string;
  state: 'Andhra Pradesh' | 'Telangana';
  imageUrls: string[];
  pdfUrl: string;
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // View State: 'dashboard' | 'add' | 'edit'
  const [view, setView] = useState<'dashboard' | 'add' | 'edit'>('dashboard');
  const [currentEpaper, setCurrentEpaper] = useState<Epaper | null>(null);
  
  // Data State
  const [epapers, setEpapers] = useState<Epaper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [adminFilterState, setAdminFilterState] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [edition, setEdition] = useState('Main');
  const [state, setState] = useState<'Andhra Pradesh' | 'Telangana'>('Andhra Pradesh');
  
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error' | 'logging_in'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetch('/api/auth/verify')
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
          fetchEpapers();
        }
      })
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsCheckingAuth(false));
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
      console.error("Failed to fetch epapers", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('logging_in');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Invalid credentials');
      setIsAuthenticated(true);
      setStatus('idle');
      fetchEpapers();
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
  };

  const [renderProgress, setRenderProgress] = useState({ current: 0, total: 0 });

  const uploadToR2 = async (file: File | Blob, key: string, contentType: string) => {
    const res = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, contentType })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to get upload authorization");
    }
    const { url } = await res.json();

    const putRes = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType }
    });
    if (!putRes.ok) throw new Error("Cloud upload rejected by storage server");
    
    return true;
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === 'add' && !file) {
      setErrorMessage('Please select a PDF file.');
      return;
    }

    setStatus('submitting');
    setRenderProgress({ current: 0, total: 0 });
    setUploadProgress({ current: 0, total: 0 });
    
    try {
      // 1. Initial Metadata Update or Start New Upload
      if (view === 'edit' && !file) {
          // Meta-only update
          const result = await updateEpaperMetadata(currentEpaper!._id, { title, date, edition, state });
          if (!result.success) throw new Error(result.error);
          setSuccessMessage('Publication updated!');
      } else {
          // New upload or Replacement (Sonic Speed Mode)
          const pdfjsLib = await import('pdfjs-dist');
          // @ts-ignore
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

          const arrayBuffer = await file!.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          const numPages = pdf.numPages;

          const fileId = Math.random().toString(36).substring(2, 11);
          const datePath = new Date(date).toISOString().split("T")[0];
          const pdfKey = `epapers/${datePath}/${fileId}/document.pdf`;

          console.log(">>> [Direct Upload] Uploading PDF to R2 via Presigned URL...");
          await uploadToR2(file!, pdfKey, "application/pdf");

          // Start overall process (Metadata only now, no file)
          const startData = new FormData();
          startData.append('title', title);
          startData.append('date', date);
          startData.append('edition', edition);
          startData.append('state', state);
          startData.append('pdfKey', pdfKey); 

          console.log(">>> [Direct Upload] Initializing database record...");
          const init = await startEpaperUpload(startData);
          if (!init.success) throw new Error(init.error);

          const { epaperId } = init as any;
          setRenderProgress({ current: 0, total: numPages });
          setUploadProgress({ current: 0, total: numPages });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          // Sequential Rendering & Uploading Loop (Sequential is safer against "Failed to fetch" concurrency errors)
          for (let i = 1; i <= numPages; i++) {
              console.log(`>>> [Sonic Speed] Rendering page ${i}/${numPages}...`);
              setRenderProgress(prev => ({ ...prev, current: i }));
              
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 2.5 }); // Excellent HD balance
              
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              await page.render({ canvasContext: context!, viewport }).promise;

              const blob = await new Promise<Blob>((resolve) => {
                  canvas.toBlob((b) => resolve(b!), 'image/webp', 0.85); // Optimized HD WebP
              });

              // @ts-ignore
              if (page.cleanup) page.cleanup();

              console.log(`>>> [Sonic Speed] Uploading page ${i}/${numPages}...`);
              // Trigger Upload via Server Action
              const pageData = new FormData();
              pageData.append('image', new File([blob], `p${i}.webp`, { type: 'image/webp' }));
              
              const res = await appendEpaperPage(epaperId, i, fileId, datePath, pageData);
              if (!res.success) {
                  throw new Error(`Failed to upload page ${i}: ${res.error}`);
              }
              
              setUploadProgress(prev => ({ ...prev, current: i }));
          }

          // Finalize
          console.log(">>> [Sonic Speed] Finalizing publication...");
          await finishEpaperUpload(epaperId);
          setSuccessMessage(view === 'add' ? 'Newspaper published!' : 'Newspaper replaced!');
      }

      setStatus('success');
      fetchEpapers();
      setTimeout(() => {
        setView('dashboard');
        setStatus('idle');
        resetForm();
      }, 1500);
    } catch (err: any) {
      console.error("Sonic Speed Error:", err);
      setStatus('error');
      setErrorMessage(err.message || "A network error occurred. Please try again.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/epapers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEpapers(prev => prev.filter(p => p._id !== id));
      }
    } catch (err) {
      alert("Delete failed");
    }
  };

  const openEdit = (paper: Epaper) => {
    setCurrentEpaper(paper);
    setTitle(paper.title);
    setDate(paper.date.split('T')[0]);
    setEdition(paper.edition);
    setState(paper.state || 'Andhra Pradesh');
    setView('edit');
    setStatus('idle');
  };

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setDate('');
    setEdition('Main');
    setState('Andhra Pradesh');
    setCurrentEpaper(null);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const filteredEpapers = useMemo(() => {
    return epapers.filter(p => {
      const matchesText = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.edition.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = !searchDate || p.date.startsWith(searchDate);
      const matchesState = !adminFilterState || p.state === adminFilterState;
      return matchesText && matchesDate && matchesState;
    });
  }, [epapers, searchQuery, searchDate, adminFilterState]);

  if (isCheckingAuth) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg mb-4">
            <Lock className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-800">Admin Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Kanuka E-Newspaper Management</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all" placeholder="admin@kanuka.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition-all" placeholder="••••••••" />
            </div>
          </div>
          {status === 'error' && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2"><AlertCircle size={14} /> {errorMessage}</div>}
          <button type="submit" disabled={status === 'logging_in'} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group disabled:opacity-50">
            {status === 'logging_in' ? <Loader2 className="animate-spin" size={20} /> : <><span>Enter Dashboard</span> <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <main className="max-w-6xl mx-auto p-4 sm:p-8">
        {view === 'dashboard' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Publications</h1>
                <p className="text-slate-500 font-medium">Manage and monitor all published editions.</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { resetForm(); setView('add'); }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all active:scale-95 text-sm"
                >
                  <Plus size={20} /> Publish New Paper
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-3 text-slate-400 hover:text-red-600 rounded-2xl hover:bg-white border border-transparent hover:border-red-100 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
                  title="Sign Out"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by title or edition..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="date" 
                  value={searchDate}
                  onChange={e => setSearchDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all w-full md:w-auto"
                />
              </div>
              <div className="relative">
                <select 
                  value={adminFilterState}
                  onChange={e => setAdminFilterState(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all w-full md:w-auto appearance-none font-bold text-slate-600"
                >
                  <option value="">All States</option>
                  <option value="Andhra Pradesh">Andhra Pradesh</option>
                  <option value="Telangana">Telangana</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">Edition</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">Date</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">State</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">Region</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin inline-block text-indigo-500" /></td></tr>
                    ) : filteredEpapers.length === 0 ? (
                      <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold">No results found</td></tr>
                    ) : (
                      filteredEpapers.map(paper => (
                        <tr key={paper._id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0">
                                <img src={paper.imageUrls[0]} className="w-full h-full object-cover" />
                              </div>
                              <span className="font-bold text-slate-700 line-clamp-1">{paper.title}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-600">{format(parseISO(paper.date), 'MMM dd, yyyy')}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${paper.state === 'Telangana' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                              {paper.state}
                            </span>
                          </td>
                          <td className="px-6 py-4"><span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200">{paper.edition}</span></td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <a href={`/epaper/${paper.date.split('T')[0]}`} target="_blank" className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white transition-all"><ExternalLink size={18} /></a>
                              <button onClick={() => openEdit(paper)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-white transition-all"><Edit2 size={18} /></button>
                              <button onClick={() => handleDelete(paper._id, paper.title)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white transition-all"><Trash2 size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-indigo-600 font-bold mb-6 hover:-translate-x-1 transition-transform">
                <ArrowLeft size={20} /> Back to Publications
              </button>
              <button 
                onClick={handleLogout}
                className="p-2.5 text-slate-400 hover:text-red-600 rounded-xl hover:bg-white border border-transparent hover:border-red-100 transition-all shadow-sm"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 sticky top-24">
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg">
                  <UploadCloud className="text-white" size={32} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-800">{view === 'add' ? 'Publish Edition' : 'Update Edition'}</h1>
                  <p className="text-slate-500 font-medium text-sm">{view === 'add' ? 'Upload a PDF to rasterize and publish.' : 'Update metadata or replace files.'}</p>
                </div>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Edition Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="Kanuka Daily" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Region/Type</label>
                    <select value={edition} onChange={e => setEdition(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none appearance-none">
                      <option value="Main">Main Edition</option>
                      <option value="City">City Edition</option>
                      <option value="Special">Special Edition</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">State Category</label>
                    <select value={state} onChange={e => setState(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none appearance-none">
                      <option value="Andhra Pradesh">Andhra Pradesh</option>
                      <option value="Telangana">Telangana</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Publish Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-1">PDF Source {view === 'edit' && '(Optional)'}</label>
                  <label className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${file ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-500'}`}>
                    <input type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files && setFile(e.target.files[0])} />
                    {file ? (
                      <>
                        <FileText className="text-emerald-600 mb-2" size={32} />
                        <span className="text-sm font-bold text-emerald-800">{file.name}</span>
                        <span className="text-xs text-emerald-600/60 font-medium">Click to change</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="text-slate-400 mb-2" size={32} />
                        <span className="text-sm font-bold text-slate-600">Select PDF File</span>
                        <span className="text-xs text-slate-400 font-medium">Will be rasterized automatically</span>
                      </>
                    )}
                  </label>
                </div>

                {status === 'submitting' && renderProgress.total > 0 && (
                  <div className="space-y-4">
                    {/* Phase 1: Rendering */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-black uppercase tracking-tight text-slate-600">
                        <span>Phase 1: HD Rendering</span>
                        <span className="bg-indigo-50 px-2 py-0.5 rounded text-indigo-600">{renderProgress.current} / {renderProgress.total}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200 shadow-inner">
                        <div 
                          className="bg-indigo-600 h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                          style={{ width: `${(renderProgress.current / renderProgress.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Phase 2: Uploading */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-black uppercase tracking-tight text-slate-600">
                        <span>Phase 2: Sonic Transmission</span>
                        <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-600">{uploadProgress.current} / {uploadProgress.total}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200 shadow-inner">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                {status === 'error' && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2 animate-pulse"><AlertCircle size={16} /> {errorMessage}</div>}
                {status === 'success' && <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl text-xs font-bold border border-emerald-100 flex items-center gap-2"><CheckCircle size={16} /> {successMessage}</div>}

                <button type="submit" disabled={status === 'submitting'} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]">
                  {status === 'submitting' ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      {uploadProgress.total > 0 ? 
                        (uploadProgress.current === uploadProgress.total ? 'Finalizing...' : `Processing ${uploadProgress.current}/${uploadProgress.total}...`) 
                        : 'Starting Secure Session...'}
                    </>
                  ) : (view === 'add' ? <><Plus size={20}/> Publish New Edition</> : 'Save Final Changes')}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
