import React, { useState, useEffect } from 'react';
import MapDashboard from '../components/MapDashboard';
import ChatInterface from '../components/ChatInterface';
import AgentLogs from '../components/AgentLogs';
import { Shield, AlertTriangle } from 'lucide-react';
import AdminPanel from '../components/AdminPanel';
import VenueStatus from '../components/VenueStatus';
import AgentHealth from '../components/AgentHealth';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function AdminView() {
  const [emergencies, setEmergencies] = useState<any[]>([]);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'zones'));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const zonesWithEmergencies = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((z: any) => !!z.emergencyMsg);
        setEmergencies(zonesWithEmergencies);
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100 flex flex-col font-sans p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 shrink-0 border-b border-neutral-900 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${emergencies.length > 0 ? 'bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'} rounded-[10px] flex items-center justify-center`}>
            {emergencies.length > 0 ? <AlertTriangle className="w-6 h-6 text-white" /> : <Shield className="w-5 h-5 text-black" />}
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase font-mono">
            STADIUM<span className={emergencies.length > 0 ? "text-rose-500" : "text-emerald-500"}>_AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className={`flex items-center gap-2 px-4 py-2 border rounded border-neutral-800 bg-[#0a0a0a]`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${emergencies.length > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
            <span className={`text-[10px] md:text-[11px] font-mono uppercase tracking-[0.2em] ${emergencies.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {emergencies.length > 0 ? 'EMERGENCY STATE' : 'SYS_NOMINAL'}
            </span>
          </div>
          <div className="px-4 py-2 bg-[#0a0a0a] border border-neutral-800 rounded font-mono text-[11px] uppercase tracking-widest hidden sm:block">
            <span className="text-neutral-500 mr-2">LOC:</span>
            <span className="text-neutral-300">Narendra Modi Stadium</span>
          </div>
        </div>
      </header>
      
      {emergencies.length > 0 && (
        <div className="mb-4 shrink-0 flex flex-col gap-2">
          {emergencies.map((em) => (
            <div key={em.id} className="bg-[#1a0505] border border-rose-900/50 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between text-rose-100 shadow-[0_0_30px_rgba(225,29,72,0.1)] animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-4">
                <div className="bg-rose-950/50 border border-rose-900 p-2 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-sm tracking-widest text-rose-400 uppercase mb-1">{em.name} <span className="opacity-50 mx-2">|</span> IMMEDIATE ACTION REQUIRED</h3>
                  <p className="font-sans text-sm text-rose-200">{em.emergencyMsg}</p>
                </div>
              </div>
              {em.aiSuggestion && (
                <div className="bg-black/40 px-4 py-3 border border-rose-900/50 rounded-lg flex flex-col justify-center min-w-[300px]">
                   <p className="text-[10px] font-mono text-rose-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                     <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                     AI SUGGESTION
                   </p>
                   <p className="text-rose-200/90 font-sans text-sm">{em.aiSuggestion}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Grid: 12 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 h-[calc(100vh-100px)] min-h-[700px] w-full max-w-[1900px] mx-auto overflow-hidden pb-4">
        
        {/* Left Column (3/12) - Context & Status */}
        <div className="lg:col-span-3 flex flex-col gap-5 overflow-hidden h-full">
          <div className="shrink-0 flex flex-col">
            <VenueStatus />
          </div>
          <div className="shrink-0 flex flex-col">
            <AgentHealth />
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <AgentLogs />
          </div>
        </div>

        {/* Center Column (5/12) - Visuals & Admin */}
        <div className="lg:col-span-5 flex flex-col gap-5 overflow-hidden h-full">
          <div className="bg-[#111111] border border-neutral-800 rounded-3xl shrink-0 h-[460px] relative overflow-hidden flex flex-col font-sans mb-0">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-[#0a0a0a] absolute top-0 left-0 w-full z-10">
              <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-neutral-400">Heatmap Engine</h2>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-2.5 py-0.5 rounded-full uppercase tracking-widest font-mono">
                Live Data
              </span>
            </div>
            <div className="flex-1 relative pt-12">
               <MapDashboard />
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <AdminPanel />
          </div>
        </div>

        {/* Right Column (4/12) - Assistant Interface */}
        <div className="lg:col-span-4 rounded-3xl flex flex-col overflow-hidden h-full border border-neutral-800">
          <ChatInterface />
        </div>

      </div>
    </div>
  );
}
