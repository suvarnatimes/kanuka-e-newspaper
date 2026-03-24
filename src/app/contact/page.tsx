import React from 'react';
import Link from 'next/link';
import { Newspaper, ChevronLeft, Mail, MapPin, Phone } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 font-sans">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-8">Contact Us</h1>
        
        <p className="text-lg text-slate-600 mb-12">
          Have a news tip, feedback on our platform, or interested in advertising? We'd love to hear from you. Reach out to the Kanuka editorial and support team through any of the channels below.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="bg-indigo-50 w-12 h-12 rounded-full flex items-center justify-center mb-6">
              <Mail className="text-indigo-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Email Us</h3>
            <p className="text-slate-500 mb-4">For general inquiries, editorial support, and feedback.</p>
            <a href="mailto:contact@kanukanews.com" className="text-indigo-600 font-bold hover:underline">
              contact@kanukanews.com
            </a>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="bg-emerald-50 w-12 h-12 rounded-full flex items-center justify-center mb-6">
              <Phone className="text-emerald-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Call the Newsroom</h3>
            <p className="text-slate-500 mb-4">For urgent news tips and press releases.</p>
            <a href="tel:+15551234567" className="text-emerald-600 font-bold hover:underline">
              +1 (555) 123-4567
            </a>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="bg-amber-50 w-12 h-12 rounded-full flex items-center justify-center shrink-0">
              <MapPin className="text-amber-600" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-1">Headquarters</h3>
              <p className="text-slate-500">
                Kanuka Media Tower, 100 Press Avenue<br />
                Metropolis, NY 10001
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
