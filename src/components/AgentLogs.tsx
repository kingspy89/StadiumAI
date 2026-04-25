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
      limit(20)
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
    <div className="flex flex-col h-full font-mono overflow-hidden p-5 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.02)_2px,rgba(255,255,255,0.02)_4px)]">
      <div className="flex items-center gap-2 mb-3 shrink-0 pb-3 border-b border-white/5">
        <Terminal className="w-4 h-4 text-emerald-500" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-500">Live Orchestrator Feed</h2>
        <div className="ml-auto flex gap-1.5">
           <span className="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>
           <span className="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>
           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
      </div>
      
      <div className="flex-1 font-mono text-[11px] md:text-xs space-y-3 text-neutral-500 overflow-y-auto pr-2 custom-scrollbar" ref={scrollRef}>
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3"
            >
              <div className="shrink-0 text-neutral-600 hidden sm:block">[{log.timestamp}]</div>
              <div className="flex-1 leading-relaxed">
                <span className={`${getAgentColor(log.agent)} uppercase drop-shadow-[0_0_5px_currentColor]`}>
                  [{log.agent.substring(0, 4).toUpperCase()}]
                </span>{' '}
                <span className={`${log.level === 'error' ? 'text-red-500 font-bold' : log.level === 'warn' ? 'text-yellow-300' : log.level === 'action' ? 'text-emerald-200' : 'text-neutral-300'}`}>
                  {log.message}
                </span>
                {(log.level === 'warn' || log.level === 'error') && (
                   <span className="ml-2 inline-flex items-center text-red-500 animate-pulse">
                     ⚠️ ALERT
                   </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {logs.length === 0 && (
          <div className="flex gap-2 items-center text-neutral-600 mt-4">
            <span className="text-emerald-400 font-bold animate-pulse inline-block w-2 bg-emerald-400 h-3"></span> 
            <span className="italic pl-1">Awaiting signals stream...</span>
          </div>
        )}
      </div>
    </div>
  );
}
