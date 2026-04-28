import React from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/src/components/ui/button';
import { useAuth } from '@/src/lib/AuthContext';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-green-50 text-green-900 font-sans flex flex-col overflow-hidden selection:bg-green-200 selection:text-green-900">
      <header className="h-16 bg-green-700 text-white flex items-center justify-between px-6 md:px-8 border-b-4 border-green-800 shrink-0 relative z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-sm flex items-center justify-center shadow-inner">
            <div className="w-4 h-4 bg-green-700"></div>
          </div>
          <h1 className="text-xl font-bold tracking-tight">POSTINGS REVIEWER <span className="font-light opacity-80 text-[10px] uppercase tracking-widest align-middle">| AI System</span></h1>
        </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/login')} variant="outline" className="border-2 border-white text-white bg-transparent hover:bg-white hover:text-green-800 text-[10px] tracking-widest font-bold uppercase transition-colors shadow-sm">Login</Button>
            <Button onClick={() => navigate('/register')} variant="default" className="border-2 border-white bg-white hover:bg-green-100 text-green-800 px-6 text-[10px] tracking-widest font-bold uppercase shadow-sm">Sign Up</Button>
          </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="py-24 px-6 md:px-12 text-center max-w-4xl mx-auto relative">
          <div className="absolute inset-0 bg-green-100/50 -z-10 rounded-full blur-[100px] scale-150"></div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-green-900 leading-[1.1] mb-6 uppercase">
            Recruitment Process<br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-800">Optimized by AI</span>
          </h1>
          <p className="text-base md:text-lg text-green-800 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
            Ingest candidate resumes and algorithmic job databases. Our deterministic AI engine processes natural language to output the highest probability matches with explainable scoring parameters.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                 <Button size="lg" className="h-14 px-10 text-sm border-0 bg-green-700 shadow-md transform hover:-translate-y-1 text-white" onClick={() => navigate('/login')}>
                   LOG IN
                 </Button>
                 <Button variant="outline" size="lg" className="h-14 px-10 text-sm border-2 border-green-700 text-green-800 bg-transparent hover:bg-green-700 hover:text-white shadow-sm transform hover:-translate-y-1" onClick={() => navigate('/register')}>
                   SIGN UP
                 </Button>
          </div>
        </section>

        <section className="bg-white border-t-2 border-b-2 border-green-200 py-24 px-6 md:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-green-600 mb-2">System Capabilities</h2>
              <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-green-900 uppercase">Automated Pipeline Modules</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                num="01"
                title="Semantic Analysis" 
                description="Natural language processing applied to candidate resumes to extract stack requirements, tenure, and keyword alignment automatically."
              />
              <FeatureCard 
                num="02"
                title="Galaxy Ingestion" 
                description="Securely mount large-scale job databases via API or Excel stream directly into your localized matching environment."
              />
              <FeatureCard 
                num="03"
                title="Reasoning Engine" 
                description="Outputs explainable matching rationales alongside probabilistic percentage scores, removing the black-box from recruitment."
              />
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t-4 border-green-800 py-6 text-center text-[10px] font-bold uppercase tracking-widest text-green-700 bg-green-50 shrink-0">
        <p>© 2026 POSTINGS REVIEWER. INTERNAL BUILD v2.1.4</p>
      </footer>
    </div>
  );
}

function FeatureCard({ num, title, description }: { num: string, title: string, description: string }) {
  return (
    <div className="bg-green-50 p-8 border-2 border-green-200 shadow-sm flex flex-col items-start text-left relative overflow-hidden group hover:border-green-400 transition-colors rounded-lg">
      <div className="text-[10px] font-black text-green-400 opacity-50 mb-6 border-b-2 border-green-200 pb-2 w-full uppercase tracking-widest">MODULE {num}</div>
      <h3 className="text-lg font-bold uppercase tracking-tight text-green-900 mb-3">{title}</h3>
      <p className="text-sm font-medium text-green-800 leading-relaxed">{description}</p>
    </div>
  )
}
