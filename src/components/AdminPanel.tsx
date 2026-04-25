import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, addDoc } from 'firebase/firestore';
import { Camera, Loader2, Send } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface Zone {
  id: string;
  name: string;
  density: number;
  type: string;
  x: number;
  y: number;
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
          
          const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY });
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

  if (loading) return <div className="text-neutral-400 text-sm p-4">Loading admin...</div>;

  return (
    <div className="flex flex-col h-full bg-neutral-900 p-5 rounded-3xl border border-transparent">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Live Crowd Simulator</h2>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
          Firebase Sync
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

      <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 custom-scrollbar mb-4">
        {zones.map(zone => (
          <div key={zone.id} className="bg-black/30 border border-white/5 p-3 rounded-xl flex items-center justify-between group hover:border-white/10 transition-colors">
            <div className="flex-1 min-w-0 pr-2">
              <p className="font-semibold text-sm text-neutral-200 truncate flex items-center gap-2">
                 {zone.name}
                 <button 
                   onClick={() => handleCaptureClick(zone.id)}
                   disabled={analyzingMode !== null}
                   className="text-neutral-500 hover:text-emerald-400 disabled:opacity-50 transition-colors"
                   title="Upload CCTV Image for Vision AI Analysis"
                 >
                   {analyzingMode === zone.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" /> : <Camera className="w-3.5 h-3.5" />}
                 </button>
              </p>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{zone.type}</p>
            </div>
            <div className="flex items-center gap-3 w-[50%] justify-end shrink-0">
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={zone.density} 
                onChange={(e) => updateDensity(zone.id, parseInt(e.target.value))}
                className="w-full max-w-[100px] h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer border border-neutral-700
                           [&:focus]:outline-none
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                           [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
              />
              <span className={`font-mono text-xs w-9 text-right font-medium ${zone.density > 80 ? 'text-red-400' : zone.density > 50 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {zone.density}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-white/10 shrink-0">
         <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">Volunteer Broadcast</h3>
         <div className="flex gap-2">
            <input 
              type="text" 
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Message to volunteers..."
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
            />
            <button
               onClick={handleBroadcast}
               disabled={!broadcastMsg.trim()}
               className="bg-emerald-500 text-black p-2 rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-colors flex items-center justify-center w-10"
            >
               <Send className="w-4 h-4" />
            </button>
         </div>
      </div>
    </div>
  );
}
