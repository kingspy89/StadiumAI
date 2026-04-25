import React, { useEffect, useState, useRef } from 'react';
import { Terminal, ShieldAlert, Zap, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, addDoc } from 'firebase/firestore';

interface LogEntry {
  id: string;
  timestamp: string;
  agent: 'Vision/Heatmap' | 'Concessions' | 'Attendee Assistant' | 'Orchestrator';
  level: 'info' | 'warn' | 'action' | 'error';
  message: string;
  createdAt: number;
}

export default function AgentLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'system_logs'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const fetchedLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry));
      setLogs(fetchedLogs.reverse());
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getAgentColor = (agent: string) => {
    if (agent.startsWith('Vol:')) return 'text-orange-400 font-bold';
    switch (agent) {
      case 'Vision/Heatmap': return 'text-emerald-400';
      case 'Concessions': return 'text-yellow-400';
      case 'Attendee Assistant': return 'text-blue-400';
      case 'Orchestrator': return 'text-fuchsia-400 font-bold';
      default: return 'text-neutral-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111111] p-0 border border-neutral-800 rounded-3xl overflow-hidden shrink-0">
      <div className="flex items-center gap-2 p-4 shrink-0 border-b border-neutral-800 bg-[#0a0a0a]">
        <Terminal className="w-4 h-4 text-emerald-500" />
        <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-emerald-500">System Logs</h2>
        <div className="ml-auto flex gap-1.5">
           <span className="w-1 h-3 rounded-sm bg-neutral-600"></span>
           <span className="w-1 h-3 rounded-sm bg-neutral-600"></span>
           <span className="w-1 h-3 rounded-sm bg-emerald-500 animate-pulse"></span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto no-scrollbar bg-[#050505]" ref={scrollRef}>
        <div className="flex flex-col font-mono text-[10px] md:text-xs text-neutral-500">
          <AnimatePresence>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`grid grid-cols-[80px_60px_1fr] items-start gap-2 p-2 border-b border-neutral-800 hover:bg-neutral-900 transition-colors ${log.level === 'error' ? 'bg-rose-950/20' : log.level === 'warn' ? 'bg-amber-950/10' : ''}`}
              >
                <div className="text-neutral-600 font-mono tracking-tighter self-stretch border-r border-neutral-800 pr-2 flex items-center">{log.timestamp}</div>
                <div className={`${getAgentColor(log.agent)} self-stretch border-r border-neutral-800 pr-2 flex items-center justify-center font-bold`}>
                  {log.agent.substring(0, 4).toUpperCase()}
                </div>
                <div className={`leading-relaxed pl-1 ${log.level === 'error' ? 'text-red-500 font-bold' : log.level === 'warn' ? 'text-yellow-300' : log.level === 'action' ? 'text-emerald-300' : 'text-neutral-300'}`}>
                  {log.message}
                  {(log.level === 'warn' || log.level === 'error') && (
                     <span className="ml-2 inline-block px-1.5 py-0.5 bg-red-500/20 text-red-500 rounded border border-red-500/30 text-[9px] uppercase tracking-wider animate-pulse">
                       System Alert
                     </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {logs.length === 0 && (
            <div className="flex gap-2 items-center text-neutral-600 mt-4 p-4">
              <span className="text-emerald-400 font-bold animate-pulse inline-block w-2 bg-emerald-400 h-3"></span> 
              <span className="italic pl-1 font-serif text-xs">Awaiting log stream...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
