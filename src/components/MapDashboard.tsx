import React, { useState, useEffect } from 'react';
import { Activity, Users, Map as MapIcon, Coffee, DoorOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

interface Zone {
  id: string;
  name: string;
  density: number; // 0 to 100
  type: 'gate' | 'food' | 'seating' | 'restroom';
  x: number;
  y: number;
}

const fallbackZones: Zone[] = [
  { id: 'g1', name: 'Gate A', density: 85, type: 'gate', x: 20, y: 15 },
  { id: 'g2', name: 'Gate B', density: 30, type: 'gate', x: 80, y: 15 },
  { id: 'f1', name: 'Food Court North', density: 95, type: 'food', x: 25, y: 40 },
  { id: 'f2', name: 'Snacks South', density: 40, type: 'food', x: 75, y: 40 },
  { id: 's1', name: 'Stand V1', density: 60, type: 'seating', x: 50, y: 65 },
  { id: 'r1', name: 'Restrooms West', density: 75, type: 'restroom', x: 10, y: 55 },
];

export default function MapDashboard() {
  const [zones, setZones] = useState<Zone[]>(fallbackZones);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'zones'), (snap) => {
      if (!snap.empty) {
        setZones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Zone)));
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="flex flex-col h-full w-full relative group">
      <div className="flex justify-between items-start mb-4 z-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Crowd Density Heatmap</h2>
        <span className="text-xs bg-black/40 px-2 py-1 rounded text-emerald-400 border border-emerald-500/20">Live Sync</span>
      </div>
      
      <div className="flex-1 relative bg-neutral-900/60 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center p-4">
        
        {/* Flat 2D Narendra Modi Stadium Background */}
        <div className="relative w-full max-w-[400px] aspect-square rounded-full border-[16px] border-orange-900/40 bg-neutral-800 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] flex items-center justify-center">
             
             {/* The Cricket Ground */}
             <div className="absolute inset-4 rounded-full bg-emerald-900/60 border border-emerald-500/20 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center">
                 {/* Boundary Rope */}
                 <div className="absolute inset-[10%] border-[2px] border-white/20 rounded-full pointer-events-none"></div>
                 {/* 30-Yard Circle */}
                 <div className="absolute inset-[25%] border border-white/30 border-dashed rounded-full pointer-events-none"></div>
                 
                 {/* Center Cricket Pitch (22 yards) */}
                 <div className="absolute w-[8%] h-[25%] bg-[#d2a679] border border-[#a67b5b] rounded-[2px] flex flex-col justify-between py-1 shadow-sm">
                     {/* Creases */}
                     <div className="w-full h-[1px] bg-white/80"></div>
                     <div className="w-full h-[1px] bg-white/80"></div>
                 </div>
             </div>

             {/* Zones */}
             {zones.map((zone) => {
               const getColor = (density: number) => {
                 if (density > 80) return 'text-rose-500 bg-rose-500/20 border-rose-500/50 shadow-[0_0_20px_rgba(225,29,72,0.4)]';
                 if (density > 50) return 'text-amber-500 bg-amber-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]';
                 return 'text-emerald-500 bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
               };

               const getIcon = (type: string) => {
                 switch(type) {
                   case 'gate': return <DoorOpen className="w-4 h-4" />;
                   case 'food': return <Coffee className="w-4 h-4" />;
                   case 'restroom': return <Users className="w-4 h-4" />;
                   default: return <Activity className="w-4 h-4" />;
                 }
               };

               return (
                 <motion.div
                   initial={{ scale: 0.8, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   transition={{ duration: 0.5, delay: Math.random() * 0.3 }}
                   key={zone.id}
                   className={`absolute flex flex-col items-center justify-center cursor-pointer group`}
                   style={{ left: `${zone.x}%`, top: `${zone.y}%`, transform: 'translate(-50%, -50%)' }}
                 >
                   {/* Heatmap blur effect underneath */}
                   <motion.div 
                     animate={{ 
                        scale: zone.density > 80 ? [1, 1.2, 1] : 1,
                        opacity: zone.density > 80 ? [0.4, 0.7, 0.4] : 0.4
                     }}
                     transition={{ repeat: Infinity, duration: 2 }}
                     className={`absolute w-24 h-24 rounded-full blur-2xl -z-10 ${
                        zone.density > 80 ? 'bg-rose-500/40' : 
                        zone.density > 50 ? 'bg-amber-500/30' : 
                        'bg-emerald-500/30'
                     }`}
                   />

                   <div className={`w-10 h-10 rounded-full flex items-center justify-center border backdrop-blur-md transition-all group-hover:scale-110 z-10 ${getColor(zone.density)} ${(zone as any).emergencyMsg ? 'ring-4 ring-rose-500 animate-pulse' : ''}`}>
                     {getIcon(zone.type)}
                   </div>
                   {(zone as any).emergencyMsg && (
                      <div className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-0.5 z-20 shadow-lg">
                         <Activity className="w-3 h-3 animate-ping" />
                      </div>
                   )}
                   <div className="absolute top-12 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded px-2 py-1 text-center shadow-lg transform transition-all opacity-0 group-hover:opacity-100 group-hover:translate-y-1 z-50 pointer-events-none">
                     <p className="text-xs font-bold text-white whitespace-nowrap mb-1">{zone.name}</p>
                     {(zone as any).emergencyMsg && <p className="text-[10px] text-rose-400 font-bold max-w-[120px] whitespace-normal leading-tight mb-1 uppercase">{(zone as any).emergencyMsg}</p>}
                     <div className="flex items-center gap-2 justify-center mt-1">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                           <div 
                             className={`h-full rounded-full ${
                                zone.density > 80 ? 'bg-rose-500' : 
                                zone.density > 50 ? 'bg-amber-500' : 
                                'bg-emerald-500'
                             }`}
                             style={{ width: `${zone.density}%` }}
                           />
                        </div>
                        <span className="text-[10px] text-slate-300 font-mono font-bold w-6">{zone.density}%</span>
                     </div>
                   </div>
                 </motion.div>
               );
             })}
        </div>
      </div>
    </div>
  );
}
