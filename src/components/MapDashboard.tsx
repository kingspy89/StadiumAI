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
  { id: 'g1', name: 'Gate A', density: 85, type: 'gate', x: 20, y: 10 },
  { id: 'g2', name: 'Gate B', density: 30, type: 'gate', x: 80, y: 10 },
  { id: 'f1', name: 'Food Court North', density: 95, type: 'food', x: 30, y: 40 },
  { id: 'f2', name: 'Snacks South', density: 40, type: 'food', x: 70, y: 40 },
  { id: 's1', name: 'Stand V1', density: 60, type: 'seating', x: 50, y: 60 },
  { id: 'r1', name: 'Restrooms West', density: 75, type: 'restroom', x: 10, y: 50 },
];

export default function MapDashboard() {
  const [zones, setZones] = useState<Zone[]>(fallbackZones);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'zones'), (snap) => {
      if (!snap.empty) {
        setZones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Zone)));
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Crowd Density Heatmap</h2>
        <span className="text-xs bg-black/40 px-2 py-1 rounded">Vision AI v4.2</span>
      </div>
      
      <div className="flex-1 relative bg-neutral-800/30 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center">
        {/* Mock Stadium Shape */}
        <div className="absolute inset-0 opacity-80 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-red-600/40 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-orange-500/30 rounded-full blur-3xl"></div>
          <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-yellow-500/20 rounded-full blur-3xl"></div>
          <div className="absolute inset-4 border-[12px] border-neutral-700/50 rounded-[60px] opacity-20"></div>
          <div className="absolute inset-12 border border-neutral-600/30 rounded-full"></div>
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
              transition={{ duration: 0.5, delay: Math.random() * 0.5 }}
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
                 className={`absolute w-32 h-32 rounded-full blur-2xl -z-10 ${
                    zone.density > 80 ? 'bg-rose-500/30' : 
                    zone.density > 50 ? 'bg-amber-500/20' : 
                    'bg-emerald-500/20'
                 }`}
               />

              <div className={`w-10 h-10 rounded-full flex items-center justify-center border backdrop-blur-md transition-all group-hover:scale-110 ${getColor(zone.density)}`}>
                {getIcon(zone.type)}
              </div>
              <div className="mt-2 bg-slate-800/80 backdrop-blur border border-slate-700/80 rounded px-2 py-1 text-center shadow-lg transform transition-all opacity-80 group-hover:opacity-100 group-hover:-translate-y-1">
                <p className="text-xs font-medium text-slate-200 whitespace-nowrap">{zone.name}</p>
                <div className="flex items-center gap-2 justify-center mt-0.5">
                   <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${zone.density}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-full rounded-full ${
                           zone.density > 80 ? 'bg-rose-500' : 
                           zone.density > 50 ? 'bg-amber-500' : 
                           'bg-emerald-500'
                        }`}
                      />
                   </div>
                   <span className="text-[10px] text-slate-400 w-6">{zone.density}%</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
