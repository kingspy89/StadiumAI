import React, { useEffect, useState } from 'react';
import { Trophy, Cloud, Wind, Droplets } from 'lucide-react';

export default function MatchOverview() {
  const [matchData, setMatchData] = useState<any>(null);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const res = await fetch('/api/match/live');
        const data = await res.json();
        setMatchData(data);
      } catch (err) {
        console.error("Match API Error:", err);
      }
    };
    
    fetchMatch();
    const interval = setInterval(fetchMatch, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!matchData) {
    return <div className="p-5 text-neutral-500 text-sm">Loading match data...</div>;
  }

  return (
    <div className="flex flex-col h-full p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Live Match Status</h2>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      </div>
      
      <div className="bg-neutral-800/40 border border-neutral-700/50 rounded-xl p-4 mb-4">
         <div className="flex justify-between items-center mb-3">
             <div className="flex items-center gap-2">
                 <div className="w-6 h-4 bg-sky-500 rounded-sm"></div>
                 <span className="font-bold text-lg">{matchData.teamA}</span>
             </div>
             <div className="text-right">
                 <span className="font-black text-2xl tracking-tighter">{matchData.scoreA}</span>
                 <span className="text-xs text-neutral-400 ml-2 block -mt-1">({matchData.oversA})</span>
             </div>
         </div>
         <div className="flex justify-between items-center">
             <div className="flex items-center gap-2">
                 <div className="w-6 h-4 bg-yellow-400 rounded-sm"></div>
                 <span className="font-bold text-lg text-neutral-400">{matchData.teamB}</span>
             </div>
             <div className="text-right">
                 <span className="font-bold text-lg text-neutral-500 tracking-tighter">{matchData.scoreB}</span>
             </div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-auto">
         <div className="bg-neutral-800/30 border border-neutral-700/30 rounded-lg p-3 flex flex-col items-center justify-center">
             <Cloud className="w-5 h-5 text-sky-400 mb-1" />
             <span className="text-lg font-semibold">{matchData.weather.temp}°C</span>
             <span className="text-[10px] text-neutral-500 uppercase tracking-widest">{matchData.weather.condition}</span>
         </div>
         <div className="bg-neutral-800/30 border border-neutral-700/30 rounded-lg p-3 flex flex-col items-center justify-center">
             <Droplets className="w-5 h-5 text-blue-400 mb-1" />
             <span className="text-lg font-semibold">{matchData.weather.humidity}%</span>
             <span className="text-[10px] text-neutral-500 uppercase tracking-widest">Humidity</span>
         </div>
      </div>
    </div>
  );
}
