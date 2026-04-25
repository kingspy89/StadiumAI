import React, { useState, useEffect, useRef } from 'react';
import { Activity, Users, Map as MapIcon, Coffee, DoorOpen, Zap, Car } from 'lucide-react';
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
  emergencyMsg?: string | null;
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
  const zonesRef = useRef<Zone[]>(fallbackZones);
  const [recentUpdates, setRecentUpdates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'zones'), (snap) => {
      if (!snap.empty) {
        const newZones = snap.docs.map(d => ({ id: d.id, ...d.data() } as Zone));
        
        const now = Date.now();
        setRecentUpdates(prev => {
           let updates = { ...prev };
           let changed = false;
           newZones.forEach(nz => {
              const old = zonesRef.current.find(p => p.id === nz.id);
              if (old && old.density !== nz.density) {
                  updates[nz.id] = now;
                  changed = true;
              }
           });
           return changed ? updates : prev;
        });

        zonesRef.current = newZones;
        setZones(newZones);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRecentUpdates(prev => {
         let changed = false;
         const next = { ...prev };
         for (const id in next) {
            if (now - next[id] > 4000) {
               delete next[id];
               changed = true;
            }
         }
         return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full w-full relative group">
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        
        {/* Flat 2D Narendra Modi Stadium Background */}
        <div className="relative w-[90%] max-w-[600px] h-[75%] aspect-[1.3/1] max-h-none rounded-[100%] border-[20px] md:border-[30px] border-[#1f2937]/50 bg-[#0a0a0a] shadow-[inset_0_0_80px_rgba(0,0,0,0.9)] flex items-center justify-center">
             
             {/* The Cricket Ground */}
             <div className="absolute w-[88%] h-[88%] rounded-[100%] bg-emerald-950/40 border border-emerald-500/10 shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
                 
                 {/* Radar Sweep Animation */}
                 <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                    className="absolute top-1/2 left-1/2 w-[50%] h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-emerald-400 origin-left z-0 pointer-events-none"
                    style={{ transform: 'translateY(-50%)' }}
                 />
                 <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                    className="absolute top-1/2 left-1/2 w-[50%] h-[50%] bg-gradient-to-br from-emerald-500/10 to-transparent origin-top-left z-0 pointer-events-none border-t border-emerald-500/20"
                 />

                 {/* Boundary Rope */}
                 <div className="absolute w-[80%] h-[80%] border-[2px] border-white/10 rounded-[100%] pointer-events-none z-10 shadow-[0_0_20px_rgba(255,255,255,0.05)]"></div>
                 {/* 30-Yard Circle */}
                 <div className="absolute w-[50%] h-[50%] border border-white/15 border-dashed rounded-[100%] pointer-events-none z-10"></div>
                 
                 {/* Center Cricket Pitch (22 yards) */}
                 <div className="absolute w-[6%] h-[20%] bg-[#4b3b2c] border border-[#a67b5b]/50 rounded-[4px] flex flex-col justify-between py-1 shadow-sm z-10 shadow-[#000]/50">
                     {/* Creases */}
                     <div className="w-full h-[1px] bg-white/40"></div>
                     <div className="w-full h-[1px] bg-white/40"></div>
                 </div>
             </div>

             {/* Zones */}
             {zones.map((zone) => {
               const isEmergency = !!zone.emergencyMsg;
               const isRecent = !!recentUpdates[zone.id];

               const getColor = (density: number) => {
                 if (density > 80) return 'text-rose-500 bg-rose-500/10 border-rose-500/30 shadow-[0_0_20px_rgba(225,29,72,0.3)]';
                 if (density > 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
                 return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
               };

               const getIcon = (type: string) => {
                 switch(type) {
                   case 'gate': return <DoorOpen className="w-4 h-4" />;
                   case 'food': return <Coffee className="w-4 h-4" />;
                   case 'restroom': return <Users className="w-4 h-4" />;
                   case 'parking': return <Car className="w-4 h-4" />;
                   default: return <Activity className="w-4 h-4" />;
                 }
               };

               const ringClass = isEmergency 
                 ? 'ring-4 ring-rose-500 animate-pulse' 
                 : isRecent 
                   ? 'ring-4 ring-sky-400/80 animate-pulse' 
                   : '';

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
                     className={`absolute w-24 h-24 rounded-full blur-[20px] -z-10 ${
                        zone.density > 80 ? 'bg-rose-500/40' : 
                        zone.density > 50 ? 'bg-amber-500/30' : 
                        'bg-emerald-500/30'
                     }`}
                   />

                   <div className={`w-10 h-10 rounded-full flex items-center justify-center border backdrop-blur-md transition-all group-hover:scale-110 z-10 ${getColor(zone.density)} ${ringClass}`}>
                     {getIcon(zone.type)}
                   </div>
                   
                   {isEmergency && (
                      <div className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-0.5 z-20 shadow-lg" title="Emergency Active">
                         <Activity className="w-3 h-3 animate-ping" />
                      </div>
                   )}
                   {!isEmergency && isRecent && (
                      <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-0.5 z-20 shadow-lg" title="Recently Updated">
                         <Zap className="w-3 h-3 outline-none" />
                      </div>
                   )}

                   <div className="absolute top-12 bg-[#050505]/95 backdrop-blur-xl border border-neutral-800 rounded px-3 py-2 text-center shadow-lg transform transition-all opacity-0 group-hover:opacity-100 group-hover:translate-y-1 z-50 pointer-events-none">
                     <p className="text-[10px] font-mono font-bold text-white uppercase tracking-widest mb-1.5">{zone.name}</p>
                     {isEmergency && <p className="text-[10px] text-rose-400 font-sans font-medium max-w-[120px] whitespace-normal leading-tight mb-2 uppercase">{zone.emergencyMsg}</p>}
                     <div className="flex items-center gap-2 justify-center mt-1">
                        <div className="w-16 h-1 bg-neutral-800/80 rounded-full overflow-hidden">
                           <div 
                             className={`h-full rounded-full ${
                                zone.density > 80 ? 'bg-rose-500' : 
                                zone.density > 50 ? 'bg-amber-400' : 
                                'bg-emerald-400'
                             }`}
                             style={{ width: `${zone.density}%` }}
                           />
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono font-bold w-6">{zone.density}%</span>
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
