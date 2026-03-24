import React from 'react';
import Link from 'next/link';
import { Newspaper, ChevronLeft } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 font-sans">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-8">About Kanuka</h1>
        
        <div className="prose prose-lg prose-indigo max-w-none text-slate-600 space-y-6">
          <p className="font-medium text-xl leading-relaxed text-slate-700">
            Welcome to the Kanuka E-Newspaper, your premier digital source for the latest headlines, local city news, and deeply researched editorial content.
          </p>
          
          <div className="h-px bg-slate-200 w-full my-8"></div>
          
          <h2 className="text-2xl font-bold text-slate-800 mt-8 mb-4">Our Mission</h2>
          <p>
            At Kanuka, we believe that journalism is the cornerstone of an informed society. Our mission is to seamlessly merge the nostalgia of traditional newspaper reading with the frictionless convenience of digital technology. We bring the paper straight to your screen, exactly as it was meant to be read.
          </p>

          <h2 className="text-2xl font-bold text-slate-800 mt-8 mb-4">The Digital Experience</h2>
          <p>
            Unlike typical scrolling news feeds, Kanuka leverages a state-of-the-art 3D E-Paper flipping engine. You get the curated, structured layout of a real broadsheet, empowering you to read cover-to-cover and even crop native excerpts to share directly to your social media platforms.
          </p>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mt-10">
            <h3 className="text-lg font-bold text-indigo-900 mb-2">Join Our Daily Readers</h3>
            <p className="text-indigo-800/80 mb-0">
              Thousands of users rely on Kanuka Daily. Check back every morning for the freshest editions.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
