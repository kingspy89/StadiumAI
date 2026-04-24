import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Navigation, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function UserNavigation() {
  const [searchParams] = useSearchParams();
  const destination = searchParams.get('dest') || 'Gate A';
  const [zones, setZones] = useState<any[]>([]);

  useEffect(() => {
    // Optionally fetch zones to show dynamic info about destination
    if(db) {
       getDocs(collection(db, 'zones')).then(snap => {
         setZones(snap.docs.map(d => d.data()));
       }).catch(e => console.error(e));
    }
  }, []);

  const destZone = zones.find(z => z.name.toLowerCase() === destination.toLowerCase());

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans p-4 relative overflow-hidden">
      {/* Background visual flair */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
         <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500 rounded-full blur-[100px] transform translate-x-1/2 -translate-y-1/2"></div>
         <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-[100px] transform -translate-x-1/2 translate-y-1/2"></div>
      </div>

      <header className="relative z-10 flex items-center justify-center py-4 border-b border-white/10 mb-8">
         <h1 className="text-xl font-bold tracking-widest uppercase">Live Navigation</h1>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center max-w-sm mx-auto w-full">
         
         <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full p-6 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
            
            <p className="text-neutral-400 text-sm mb-2 uppercase tracking-wide">Navigating to</p>
            <h2 className="text-3xl font-bold mb-6">{destination}</h2>

            {destZone && (
               <div className="mb-6 p-3 bg-black/50 rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="text-sm text-neutral-400">Current Crowd Density</span>
                  <span className={`font-mono font-bold ${destZone.density > 80 ? 'text-red-400' : destZone.density > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                     {destZone.density}%
                  </span>
               </div>
            )}

            <div className="relative w-full h-48 bg-black/40 rounded-2xl border border-white/5 mb-6 overflow-hidden flex items-center justify-center">
               <MapPin className="w-8 h-8 text-emerald-500 absolute top-1/4" />
               <motion.div 
                 className="absolute inset-0 border-2 border-emerald-500/20 rounded-2xl"
                 animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
                 transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
               />
               <Navigation className="w-12 h-12 text-emerald-400 absolute bottom-1/4 animate-bounce" />
               
               <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                 <path d="M 100 120 C 150 120, 150 40, 200 40" fill="transparent" stroke="rgba(16, 185, 129, 0.5)" strokeWidth="4" strokeDasharray="8 8" className="animate-pulse" />
               </svg>
            </div>

            <button className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-wider rounded-xl transition-colors">
               Start Walking
            </button>
         </div>

         <div className="mt-8 text-center text-neutral-500 text-sm flex items-center gap-2">
            <Info size={16}/> Follow the AR arrows in your camera view (Demo)
         </div>
      </main>
    </div>
  );
}
