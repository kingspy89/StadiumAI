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
    <div className="flex flex-col h-full w-full relative group perspective-container">
      <div className="flex justify-between items-start mb-4 z-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Crowd Density 3D Heatmap</h2>
        <span className="text-xs bg-black/40 px-2 py-1 rounded text-emerald-400 border border-emerald-500/20">Live Sync</span>
      </div>
      
      {/* 3D Isometric container */}
      <div className="flex-1 relative border border-transparent rounded-xl flex items-center justify-center perspective-[1500px] overflow-hidden">
        {/* The tilted stadium */}
        <motion.div 
          initial={{ rotateX: 65, rotateZ: -30, scale: 0.7 }}
          animate={{ rotateX: 65, rotateZ: -30, scale: 0.8 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="relative w-[300px] h-[450px] transform-style-3d"
        >
          {/* Outer Ring / Tier 3 */}
          <div className="absolute inset-[-60px] border-[30px] border-neutral-900 rounded-[140px] shadow-[0_20px_60px_rgba(0,0,0,0.8)]" style={{ transform: 'translateZ(-40px)' }}></div>
          {/* Middle Ring / Tier 2 */}
          <div className="absolute inset-[-30px] border-[30px] border-neutral-800 rounded-[110px] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]" style={{ transform: 'translateZ(-20px)' }}></div>
          {/* Inner Ring / Tier 1 */}
          <div className="absolute inset-[0px] border-[20px] border-neutral-700/80 rounded-[80px] shadow-[inset_0_0_30px_rgba(0,0,0,0.9)]" style={{ transform: 'translateZ(0px)' }}></div>
          
          {/* The Pitch */}
          <div className="absolute inset-[20px] bg-emerald-900/40 rounded-[60px] border-[4px] border-emerald-500/30 overflow-hidden" style={{ transform: 'translateZ(5px)' }}>
            {/* Pitch Markings */}
            <div className="absolute inset-x-0 top-1/2 h-0 border-t border-emerald-500/40"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-emerald-500/40 rounded-full"></div>
            {/* Penalty boxes */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 border border-emerald-500/40 border-t-0"></div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-16 border border-emerald-500/40 border-b-0"></div>
          </div>

          {/* Zones rendered in 3D space */}
          {zones.map((zone) => {
            const getColor = (density: number) => {
              if (density > 80) return 'text-rose-500 bg-rose-500/20 shadow-[0_0_20px_rgba(225,29,72,0.6)] border-rose-500/50';
              if (density > 50) return 'text-amber-500 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.5)] border-amber-500/50';
              return 'text-emerald-500 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.5)] border-emerald-500/50';
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
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: Math.random() * 0.3 }}
                key={zone.id}
                className={`absolute flex flex-col items-center justify-center group`}
                style={{ 
                  left: `${zone.x}%`, 
                  top: `${zone.y}%`, 
                  transform: 'translate(-50%, -50%) translateZ(40px) rotateX(-65deg) rotateZ(30deg)' 
                }}
              >
                {/* 3D Pillar indicator based on density */}
                <div className="absolute bottom-6 w-1.5 bg-gradient-to-t from-transparent to-white/30 rounded-full opacity-60" style={{ height: `${zone.density * 0.8}px` }}></div>

                <div className={`relative w-8 h-8 rounded-full flex items-center justify-center border backdrop-blur-md transition-all group-hover:scale-125 z-10 ${getColor(zone.density)}`}>
                  {getIcon(zone.type)}
                </div>
                
                {/* Info popup */}
                <div className="absolute bottom-full mb-2 bg-black/90 backdrop-blur-xl border border-slate-700/80 rounded-lg px-3 py-2 text-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] transform transition-all opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 pointer-events-none z-50">
                  <p className="text-xs font-bold text-white whitespace-nowrap mb-1">{zone.name}</p>
                  <div className="flex items-center gap-2 justify-center">
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
                     <span className="text-[10px] font-mono font-bold text-slate-300">{zone.density}%</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
