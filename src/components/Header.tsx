import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  return (
    <header className="bg-white border-b border-secondary-100 sticky top-0 z-[100] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Image 
            src="/kanykalogo.jpg" 
            alt="Kanuka Logo" 
            width={180} 
            height={60} 
            className="h-14 w-auto object-contain"
            priority
          />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-6">
          <Link href="/" className="text-sm font-black text-slate-500 hover:text-indigo-600 transition-all px-3 py-2 rounded-xl hover:bg-slate-50">
            Home
          </Link>
          <Link href="/about" className="text-sm font-black text-slate-500 hover:text-indigo-600 transition-all px-3 py-2 rounded-xl hover:bg-slate-50">
            About
          </Link>
          <Link href="/contact" className="text-sm font-black text-slate-500 hover:text-indigo-600 transition-all px-3 py-2 rounded-xl hover:bg-slate-50">
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}
