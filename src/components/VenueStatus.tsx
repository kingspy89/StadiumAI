import React, { useEffect, useState } from 'react';
import { Users, Car, MapPin, TrendingUp, ShieldAlert } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';

interface Zone {
  id: string;
  name: string;
  density: number;
  type: string;
}

export default function VenueStatus() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [totalAttendees, setTotalAttendees] = useState(0);
  const [volunteerCount, setVolunteerCount] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'zones'), (snap) => {
      if (!snap.empty) {
        const fetchedZones = snap.docs.map(d => ({ id: d.id, ...d.data() } as Zone));
        setZones(fetchedZones);
        
        // Mock a total attendee calculation based on zone density
        const avgDensity = fetchedZones.reduce((acc, z) => acc + z.density, 0) / (fetchedZones.length || 1);
        const maxCapacity = 33000; // Wankhede capacity
        setTotalAttendees(Math.floor((avgDensity / 100) * maxCapacity));
      }
    });

    // Fetch volunteer count dynamically
    const volUnsub = onSnapshot(collection(db, 'telegram_users'), (snap) => {
       setVolunteerCount(snap.size);
    });

    return () => {
      unsub();
      volUnsub();
    };
  }, []);

  const parkingNorth = zones.find(z => z.id === 'p1')?.density || 85;
  const parkingSouth = zones.find(z => z.id === 'p2')?.density || 30;

  return (
    <div className="flex flex-col h-full bg-[#111111] border border-neutral-800 p-0 rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-[#0a0a0a]">
        <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-neutral-400">Venue Overview</h2>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </div>
      
      <div className="p-4 flex-1 flex flex-col justify-center">
         <div className="bg-[#0a0a0a] border border-emerald-500/20 rounded-xl p-5 mb-4 flex items-center justify-between shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]">
            <div>
                <span className="font-serif italic text-xs text-emerald-500/80 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5" /> Total Attendees
                </span>
                <span className="font-mono font-bold text-4xl tracking-tighter text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">{totalAttendees.toLocaleString()}</span>
            </div>
            <div className="text-right border-l border-emerald-500/20 pl-4">
                <span className="font-serif italic text-[10px] text-emerald-500/50 uppercase tracking-widest">Wankhede Capacity</span>
                <span className="block font-mono font-bold text-neutral-500 mt-1 uppercase text-sm">33,000</span>
            </div>
         </div>

         <div className="bg-[#0a0a0a] border border-blue-500/20 rounded-xl p-5 mb-4 flex items-center justify-between shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]">
            <div>
                <span className="font-serif italic text-xs text-blue-500/80 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-3.5 h-3.5" /> Active Volunteers
                </span>
                <span className="font-mono font-bold text-3xl tracking-tighter text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                    {volunteerCount} 
                    <span className="text-xs font-normal text-blue-400/60 ml-3 italic font-serif">On-ground agents</span>
                </span>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-3 mt-auto">
            <div className={`bg-[#0a0a0a] border ${parkingNorth > 80 ? 'border-rose-500/30 shadow-[inset_0_0_15px_rgba(225,29,72,0.1)]' : 'border-neutral-800'} rounded-lg p-4 flex flex-col justify-center relative overflow-hidden`}>
                <div className={`absolute top-0 left-0 w-full h-1 ${parkingNorth > 80 ? 'bg-rose-500' : 'bg-neutral-600'} opacity-80`} style={{ width: `${parkingNorth}%` }}></div>
                <div className="flex items-center justify-between mb-2">
                   <Car className="w-4 h-4 text-neutral-500" />
                   <span className="font-serif italic text-[10px] text-neutral-500 uppercase tracking-widest">North Parking</span>
                </div>
                <span className={`font-mono text-xl font-bold ${parkingNorth > 80 ? 'text-rose-400' : 'text-neutral-300'}`}>{parkingNorth}% <span className="text-xs font-normal text-neutral-600">FULL</span></span>
            </div>
            <div className={`bg-[#0a0a0a] border ${parkingSouth > 80 ? 'border-rose-500/30' : 'border-emerald-500/30 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]'} rounded-lg p-4 flex flex-col justify-center relative overflow-hidden`}>
                <div className={`absolute top-0 left-0 w-full h-1 ${parkingSouth > 80 ? 'bg-rose-500' : 'bg-emerald-500'} opacity-80`} style={{ width: `${parkingSouth}%` }}></div>
                <div className="flex items-center justify-between mb-2">
                   <Car className="w-4 h-4 text-emerald-500/70" />
                   <span className="font-serif italic text-[10px] text-emerald-500/70 uppercase tracking-widest">South Parking</span>
                </div>
                <span className={`font-mono text-xl font-bold ${parkingSouth > 80 ? 'text-rose-400' : 'text-emerald-400'}`}>{parkingSouth}% <span className="text-xs font-normal text-emerald-500/50">FULL</span></span>
            </div>
         </div>
      </div>
    </div>
  );
}
