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
    <div className="flex flex-col h-full p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Venue Overview</h2>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </div>
      
      <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4 mb-3 flex items-center justify-between">
         <div>
             <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wide flex items-center gap-1 mb-1">
                 <Users className="w-3.5 h-3.5" /> Total Attendees
             </span>
             <span className="font-black text-3xl tracking-tighter text-emerald-50">{totalAttendees.toLocaleString()}</span>
         </div>
         <div className="text-right">
             <span className="text-xs text-emerald-500/70 uppercase">Capacity</span>
             <span className="block font-bold text-neutral-400 mt-0.5">33,000</span>
         </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-4 flex items-center justify-between">
         <div>
             <span className="text-xs text-blue-400 font-semibold uppercase tracking-wide flex items-center gap-1 mb-1">
                 <ShieldAlert className="w-3.5 h-3.5" /> Active Volunteers
             </span>
             <span className="font-black text-2xl tracking-tighter text-blue-50">{volunteerCount} <span className="text-sm font-normal text-blue-400/60 ml-1">On-ground</span></span>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-auto">
         <div className="bg-neutral-800/30 border border-neutral-700/30 rounded-lg p-3 flex flex-col justify-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-red-400 rounded-t-lg opacity-80" style={{ width: `${parkingNorth}%` }}></div>
             <Car className="w-5 h-5 text-neutral-400 mb-2" />
             <span className="text-lg font-semibold">{parkingNorth}% Full</span>
             <span className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">North Parking</span>
         </div>
         <div className="bg-neutral-800/30 border border-neutral-700/30 rounded-lg p-3 flex flex-col justify-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400 rounded-t-lg opacity-80" style={{ width: `${parkingSouth}%` }}></div>
             <Car className="w-5 h-5 text-neutral-400 mb-2" />
             <span className="text-lg font-semibold">{parkingSouth}% Full</span>
             <span className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">South Parking</span>
         </div>
      </div>
    </div>
  );
}
