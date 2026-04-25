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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${emergencies.length > 0 ? 'bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'} rounded-lg flex items-center justify-center`}>
            {emergencies.length > 0 ? <AlertTriangle className="w-6 h-6 text-white" /> : <Shield className="w-6 h-6 text-black" />}
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase">
            Stadium<span className={emergencies.length > 0 ? "text-rose-500" : "text-emerald-500"}>AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-full ${emergencies.length > 0 ? 'bg-rose-900/40 border-rose-500/50' : 'bg-neutral-900/80 border-white/5'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${emergencies.length > 0 ? 'bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.8)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`}></span>
            <span className={`text-[10px] md:text-xs font-semibold uppercase tracking-widest ${emergencies.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {emergencies.length > 0 ? 'EMERGENCY' : 'Sys Ok'}
            </span>
          </div>
          <div className="px-4 py-1.5 bg-neutral-900 border border-neutral-800 rounded-md text-xs hidden sm:block">
            <span className="text-neutral-500">VENUE:</span> NARENDRA MODI STADIUM
          </div>
        </div>
      </header>
      
      {emergencies.length > 0 && (
        <div className="mb-4 shrink-0 flex flex-col gap-2">
          {emergencies.map((em) => (
            <div key={em.id} className="bg-rose-500 border border-rose-400 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between text-rose-950 shadow-[0_0_30px_rgba(225,29,72,0.3)] animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-4">
                <div className="bg-rose-950 p-2 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{em.name} - IMMEDIATE ACTION REQUIRED</h3>
                  <p className="font-medium text-rose-900">{em.emergencyMsg}</p>
                </div>
              </div>
              {em.aiSuggestion && (
                <div className="bg-rose-950/20 px-4 py-2 border border-rose-400/50 rounded-lg text-rose-950 flex flex-col justify-center">
                   <p className="text-xs font-bold uppercase tracking-wider mb-1 opacity-70">AI SUGGESTION</p>
                   <p className="font-semibold">{em.aiSuggestion}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Grid: 12 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 h-[calc(100vh-100px)] min-h-[700px] w-full max-w-[1800px] mx-auto overflow-hidden pb-4">
        
        {/* Left Column (3/12) - Context & Status */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden h-full">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl shrink-0">
            <VenueStatus />
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl shrink-0">
            <AgentHealth />
          </div>
          <div className="bg-black border border-neutral-800 rounded-3xl flex-1 overflow-hidden">
            <AgentLogs />
          </div>
        </div>

        {/* Center Column (5/12) - Visuals & Admin */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-hidden h-full">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl flex-[3] relative overflow-hidden flex flex-col font-sans shadow-lg">
            <MapDashboard />
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl flex-[2] overflow-hidden flex flex-col">
            <AdminPanel />
          </div>
        </div>

        {/* Right Column (4/12) - Assistant Interface */}
        <div className="lg:col-span-4 bg-neutral-900 border border-neutral-800 rounded-3xl flex flex-col overflow-hidden shadow-lg h-full">
          <ChatInterface />
        </div>

      </div>
    </div>
  );
}
