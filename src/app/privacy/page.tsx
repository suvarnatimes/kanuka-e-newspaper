import React from 'react';
import Link from 'next/link';
import { Newspaper, ChevronLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-4">Privacy Policy</h1>
        <p className="text-slate-500 mb-10 font-medium">Last Updated: March 2026</p>
        
        <div className="prose prose-lg prose-indigo max-w-none text-slate-600 space-y-8">
          
          <section>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">1. Information We Collect</h2>
            <p>
              We prioritize your digital privacy. Kanuka E-Newspaper operates primarily as a read-only platform for consumers. We do not require account creation to read daily editions, thereby minimizing personal data footprint. If you reach out to us via contact channels, we may securely retain that correspondence.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">2. Cookies and Tracking</h2>
            <p>
              We utilize essential local storage and strictly-necessary cookies to preserve your reading preferences (such as your last read page or zoom level). We do not deploy invasive cross-site tracking pixels or sell your behavioral data to third-party ad brokers. 
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">3. Content Sharing</h2>
            <p>
              When you use our native Crop & Share tool, the rasterized images are processed entirely on your device browser and exported via your native OS share sheet. We do not intercept, monitor, or log the snippets you choose to capture and send to your friends.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">4. Publisher Security</h2>
            <p>
              Our publisher environments operate under strict zero-trust architecture. Admin dashboards are secured via hardened HTTP-only cookies and bcrypt authentication limits to prevent brute-force attacks from compromising our publication pipelines.
            </p>
          </section>

        </div>
      </main>
    </div>
  );
}
