import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, addDoc } from 'firebase/firestore';
import { Camera, Loader2, Send, AlertTriangle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface Zone {
  id: string;
  name: string;
  density: number;
  type: string;
  x: number;
  y: number;
  emergencyMsg?: string | null;
  aiSuggestion?: string | null;
}

const initialZones: Zone[] = [
  { id: 'g1', name: 'Gate A', density: 85, type: 'gate', x: 20, y: 15 },
  { id: 'g2', name: 'Gate B', density: 30, type: 'gate', x: 80, y: 15 },
  { id: 'f1', name: 'Food North', density: 95, type: 'food', x: 25, y: 40 },
  { id: 'f2', name: 'Snacks South', density: 40, type: 'food', x: 75, y: 40 },
  { id: 's1', name: 'Stand V1', density: 60, type: 'seating', x: 50, y: 80 },
  { id: 'r1', name: 'Restrooms W', density: 75, type: 'restroom', x: 15, y: 65 },
  { id: 'p1', name: 'North Parking', density: 85, type: 'parking', x: 10, y: 10 },
  { id: 'p2', name: 'South Parking', density: 30, type: 'parking', x: 90, y: 10 },
];

export default function AdminPanel() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingMode, setAnalyzingMode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'zones'), (snap) => {
      if (snap.empty) {
        // Seed database
        initialZones.forEach((z) => {
          setDoc(doc(db, 'zones', z.id), {
            name: z.name,
            density: z.density,
            type: z.type,
            x: z.x,
            y: z.y
          });
        });
      } else {
        const fetchedZones = snap.docs.map(d => ({ id: d.id, ...d.data() } as Zone));
        setZones(fetchedZones.sort((a,b) => a.name.localeCompare(b.name)));
        
        // Add missing parking zones if they don't exist yet
        const hasParkingNorth = fetchedZones.some(z => z.id === 'p1');
        const hasParkingSouth = fetchedZones.some(z => z.id === 'p2');
        if (!hasParkingNorth) {
          const p1 = initialZones.find(z => z.id === 'p1');
          if (p1) {
            const { id, ...rest } = p1;
            setDoc(doc(db, 'zones', p1.id), rest);
          }
        }
        if (!hasParkingSouth) {
          const p2 = initialZones.find(z => z.id === 'p2');
          if (p2) {
            const { id, ...rest } = p2;
            setDoc(doc(db, 'zones', p2.id), rest);
          }
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const createLog = async (agent: string, level: string, message: string) => {
    await addDoc(collection(db, 'system_logs'), {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      agent,
      level,
      message,
      createdAt: Date.now()
    });
  };

  const updateDensity = async (id: string, newDensity: number, isVision: boolean = false) => {
    const zone = zones.find(z => z.id === id);
    await updateDoc(doc(db, 'zones', id), {
      density: newDensity
    });

    if (zone) {
      if (isVision) {
         await createLog('Vision/Heatmap', newDensity > 80 ? 'warn' : 'info', `Vision AI detected ${newDensity}% density at ${zone.name}.`);
         if (newDensity > 80) {
            setTimeout(() => createLog('Orchestrator', 'action', `High traffic detected at ${zone.name}. Redirecting nearby attendees.`), 1000);
         }
      } else if (Math.abs(zone.density - newDensity) > 10) {
         await createLog('Vision/Heatmap', newDensity > 80 ? 'warn' : 'info', `${zone.name} density shifted to ${newDensity}%.`);
      }
    }
  };

  const triggerEmergency = async (id: string, msg: string) => {
    const zone = zones.find(z => z.id === id);
    if (!zone) return;
    await updateDoc(doc(db, 'zones', id), {
      emergencyMsg: msg,
      density: Math.max(zone.density, 80) // Boost density so it shows vividly on heatmap
    });
    await createLog('Admin', 'warn', `Manual incident triggered at ${zone.name}.`);
  };

  const handleCaptureClick = (zoneId: string) => {
    setSelectedZone(zoneId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedZone) return;

    setAnalyzingMode(selectedZone);
    const z = zones.find(x => x.id === selectedZone);
    if (z) await createLog('Vision/Heatmap', 'info', `Processing new CCTV feed for ${z.name}...`);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = (reader.result as string).split(',')[1];
          
          const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      data: base64String,
                      mimeType: file.type
                    }
                  },
                  { text: 'You are a Vision AI crowd density estimator. Analyze the crowd in this image and estimate the density as a percentage from 0 to 100. 0 means completely empty, 100 means dangerously packed. Return ONLY an integer number between 0 and 100.' }
                ]
              }
            ]
          });

          const numText = response.text?.match(/\d+/)?.[0];
          if (numText) {
            let density = parseInt(numText);
            density = Math.max(0, Math.min(100, density));
            await updateDensity(selectedZone, density, true);
          } else {
            if (z) await createLog('Vision/Heatmap', 'warn', `Vision AI failed to get density for ${z.name}.`);
          }
        } catch (apiErr) {
          console.error("Vision AI Error:", apiErr);
          if (z) await createLog('Vision/Heatmap', 'warn', `Vision AI error for ${z.name}. (API key may be invalid).`);
        } finally {
          setAnalyzingMode(null);
          setSelectedZone(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      if (z) await createLog('Vision/Heatmap', 'warn', `Vision AI file read error for ${z.name}.`);
      setAnalyzingMode(null);
      setSelectedZone(null);
    }
  };

  const handleBroadcast = async () => {
     if (!broadcastMsg.trim()) return;
     try {
        await addDoc(collection(db, 'broadcast_messages'), {
           message: broadcastMsg,
           createdAt: Date.now()
        });
        await createLog('Orchestrator', 'action', `Broadcast sent: "${broadcastMsg}"`);
        setBroadcastMsg('');
     } catch(e) {
        console.error("Broadcast failed", e);
     }
  };

  if (loading) return <div className="text-neutral-400 font-mono text-xs p-5 uppercase tracking-widest">Initializing Control Data...</div>;

  return (
    <div className="flex flex-col h-full bg-[#111111] p-0 border border-neutral-800 rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-[#0a0a0a] shrink-0">
        <h2 className="text-[11px] font-mono uppercase tracking-[0.1em] text-neutral-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
          Live Crowd Simulator Core
        </h2>
        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-2.5 py-0.5 rounded-full uppercase tracking-widest font-mono">
          Sync: Active
        </span>
      </div>
      
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      <div className="flex-1 overflow-y-auto no-scrollbar pb-4 bg-[#111111]">
        <div className="grid grid-cols-[1.5fr_1fr_2fr_1fr] border-b border-neutral-800 p-3 bg-[#0a0a0a]/50 sticky top-0 z-10 backdrop-blur-md">
           <div className="font-serif italic text-[11px] uppercase tracking-widest text-neutral-500">Zone Name</div>
           <div className="font-serif italic text-[11px] uppercase tracking-widest text-neutral-500">Type</div>
           <div className="font-serif italic text-[11px] uppercase tracking-widest text-neutral-500 text-center">Crowd Density</div>
           <div className="font-serif italic text-[11px] uppercase tracking-widest text-neutral-500 text-right">Actions</div>
        </div>
        {zones.map(zone => (
          <div key={zone.id}>
            <div className={`grid grid-cols-[1.5fr_1fr_2fr_1fr] items-center p-3 border-b border-neutral-800 transition-colors hover:bg-neutral-900 ${zone.emergencyMsg ? 'bg-rose-950/20 hover:bg-rose-950/30' : ''}`}>
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="font-mono text-xs text-neutral-200 truncate">{zone.name}</span>
                {zone.emergencyMsg && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-pulse" />}
              </div>
              <div className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
                {zone.type}
              </div>
              <div className="flex items-center gap-3 justify-center px-4">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={zone.density} 
                  onChange={(e) => updateDensity(zone.id, parseInt(e.target.value))}
                  className="w-full max-w-[120px] h-1 bg-neutral-900 rounded-full appearance-none cursor-pointer border border-neutral-800
                             [&:focus]:outline-none
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 
                             [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-[1px]"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${zone.density > 80 ? '#f43f5e' : zone.density > 50 ? '#fbbf24' : '#10b981'} ${zone.density}%, transparent ${zone.density}%)`
                  }}
                />
                <span className={`font-mono text-xs w-9 text-right ${zone.density > 80 ? 'text-rose-400' : zone.density > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {(zone.density).toString().padStart(3, '0')}%
                </span>
              </div>
              <div className="flex items-center justify-end gap-1">
                 <button 
                   onClick={() => triggerEmergency(zone.id, 'High congestion detected manually.')}
                   className="text-neutral-500 hover:text-rose-400 transition-colors p-1.5 rounded hover:bg-neutral-800"
                   title="Trigger Incident Alert"
                 >
                   <AlertTriangle className="w-3.5 h-3.5" />
                 </button>
                 <button 
                   onClick={() => handleCaptureClick(zone.id)}
                   disabled={analyzingMode !== null}
                   className="text-neutral-500 hover:text-emerald-400 disabled:opacity-50 transition-colors p-1.5 rounded hover:bg-neutral-800"
                   title="Upload CCTV Image for Vision AI Analysis"
                 >
                   {analyzingMode === zone.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" /> : <Camera className="w-3.5 h-3.5" />}
                 </button>
                 <button
                   onClick={() => updateDensity(zone.id, 10)}
                   className="text-neutral-500 hover:text-sky-400 transition-colors p-1.5 rounded hover:bg-neutral-800 font-mono text-[9px] uppercase tracking-widest"
                   title="Clear Zone"
                 >
                   CLR
                 </button>
              </div>
            </div>
            {zone.emergencyMsg && (
              <div className="bg-rose-950/20 border-b border-rose-900/50 p-4">
                 <div className="flex justify-between items-start mb-3">
                   <div className="flex-1 pr-4">
                     <p className="font-mono text-[10px] text-rose-500 tracking-widest uppercase mb-1">Alert Detection</p>
                     <p className="text-xs text-rose-200 border-l-2 border-rose-500 pl-3 leading-relaxed">{zone.emergencyMsg}</p>
                   </div>
                   <div className="flex gap-2 shrink-0">
                     {zone.aiSuggestion && (
                       <button
                         onClick={async () => {
                            await createLog('Admin', 'action', `Executed AI Suggestion for ${zone.name}: ${zone.aiSuggestion}`);
                            await updateDoc(doc(db, 'zones', zone.id), { emergencyMsg: null, aiSuggestion: null });
                         }}
                         className="bg-indigo-950/50 border border-indigo-700/50 text-indigo-300 px-4 py-1.5 text-[10px] uppercase tracking-widest font-mono hover:bg-indigo-900/50 transition-colors"
                       >
                         Execute Action
                       </button>
                     )}
                     <button
                       onClick={async () => {
                          await updateDoc(doc(db, 'zones', zone.id), { emergencyMsg: null, aiSuggestion: null });
                          await createLog('Admin', 'action', `Resolved emergency at ${zone.name}.`);
                       }}
                       className="bg-neutral-900 border border-neutral-700 text-neutral-300 px-4 py-1.5 text-[10px] uppercase tracking-widest font-mono hover:bg-neutral-800 transition-colors"
                     >
                       Mark Resolved
                     </button>
                   </div>
                 </div>
                 {zone.aiSuggestion && (
                   <div className="mt-2 bg-black/40 border border-amber-900/30 p-3">
                     <p className="font-mono text-[10px] text-amber-500 tracking-widest uppercase mb-1 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                       Orchestrator Suggestion
                     </p>
                     <p className="text-xs text-amber-200/90 font-mono pl-3.5 leading-relaxed">{zone.aiSuggestion}</p>
                   </div>
                 )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-neutral-800 bg-[#0a0a0a] shrink-0">
         <h3 className="font-serif italic text-[11px] uppercase tracking-widest text-neutral-500 mb-3">Broadcast Relay</h3>
         <div className="flex gap-3 mb-4">
            <input 
              type="text" 
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Enter message to broadcast to all field volunteers..."
              className="flex-1 bg-[#111111] border border-neutral-800 px-4 py-2 text-xs font-mono text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500/50 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
            />
            <button
               onClick={handleBroadcast}
               disabled={!broadcastMsg.trim()}
               className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/50 px-6 py-2 text-[10px] uppercase tracking-widest font-mono hover:bg-emerald-500/20 disabled:opacity-30 disabled:border-neutral-800 disabled:text-neutral-500 disabled:bg-transparent transition-colors flex items-center gap-2"
            >
               <span>Transmit</span>
               <Send className="w-3 h-3" />
            </button>
         </div>

         <div className="flex gap-2 justify-between">
           <button 
             onClick={async () => {
                await createLog('Admin', 'action', 'Global Lockdown Initiated. All zones secured.');
                await addDoc(collection(db, 'broadcast_messages'), { message: 'GLOBAL LOCKDOWN INITIATED. Volunteers secure perimeters.', createdAt: Date.now() });
             }}
             className="bg-rose-950/40 text-rose-400 border border-rose-900/50 px-4 py-1.5 text-[9px] uppercase tracking-widest font-mono hover:bg-rose-900/60 transition-colors rounded flex-1"
           >
             Lockdown Protocol
           </button>
           <button 
             onClick={async () => {
                await createLog('Vision/Drone', 'info', 'Drone sweep dispatched across North and South parking.');
             }}
             className="bg-sky-950/40 text-sky-400 border border-sky-900/50 px-4 py-1.5 text-[9px] uppercase tracking-widest font-mono hover:bg-sky-900/60 transition-colors rounded flex-1"
           >
             Dispatch Drone Sweep
           </button>
           <button 
             onClick={async () => {
                await createLog('Admin', 'action', 'All zones reset to nominal baseline density.');
                zones.forEach(z => updateDoc(doc(db, 'zones', z.id), { density: Math.floor(Math.random() * 20) + 10, emergencyMsg: null }));
             }}
             className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 px-4 py-1.5 text-[9px] uppercase tracking-widest font-mono hover:bg-emerald-900/60 transition-colors rounded flex-1"
           >
             Reset Nominal Baseline
           </button>
         </div>
      </div>
    </div>
  );
}
