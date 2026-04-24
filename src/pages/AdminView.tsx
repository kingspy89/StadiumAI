import React from 'react';
import MapDashboard from '../components/MapDashboard';
import ChatInterface from '../components/ChatInterface';
import AgentLogs from '../components/AgentLogs';
import { Shield } from 'lucide-react';
import AdminPanel from '../components/AdminPanel';
import VenueStatus from '../components/VenueStatus';
import AgentHealth from '../components/AgentHealth';
import { Link } from 'react-router-dom';

export default function AdminView() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <Shield className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase">
            Stadium<span className="text-emerald-500">AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2 bg-neutral-900/80 px-3 py-1.5 border border-white/5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-emerald-400">Sys Ok</span>
          </div>
          <div className="px-4 py-1.5 bg-neutral-900 border border-neutral-800 rounded-md text-xs hidden sm:block">
            <span className="text-neutral-500">VENUE:</span> NARENDRA MODI STADIUM
          </div>
        </div>
      </header>

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
