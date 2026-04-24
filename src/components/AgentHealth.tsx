import React, { useEffect, useState } from 'react';
import { Network, Cpu, Database, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';

const agents = [
  { id: 'orchestrator', name: 'Orchestrator', icon: Network, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500' },
  { id: 'vision', name: 'Vision AI (CCTV)', icon: Cpu, color: 'text-emerald-400', bg: 'bg-emerald-500' },
  { id: 'nlp', name: 'Concierge LLM', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500' },
  { id: 'data', name: 'Logistics Sync', icon: Database, color: 'text-yellow-400', bg: 'bg-yellow-500' },
];

export default function AgentHealth() {
  const [loads, setLoads] = useState({
    orchestrator: 42,
    vision: 88,
    nlp: 25,
    data: 15,
  });

  // Simulate load fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setLoads(prev => ({
        orchestrator: Math.max(20, Math.min(95, prev.orchestrator + (Math.random() * 20 - 10))),
        vision: Math.max(60, Math.min(98, prev.vision + (Math.random() * 15 - 7))),
        nlp: Math.max(10, Math.min(70, prev.nlp + (Math.random() * 30 - 15))),
        data: Math.max(5,  Math.min(50, prev.data + (Math.random() * 10 - 5))),
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full p-5">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Agent Network Health</h2>
      </div>

      <div className="flex-1 flex flex-col justify-between space-y-2">
        {agents.map((agent) => {
          const Icon = agent.icon;
          const load = loads[agent.id as keyof typeof loads];
          const isHigh = load > 80;
          
          return (
            <div key={agent.id} className="bg-neutral-800/20 border border-neutral-700/30 rounded-xl p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${agent.color}`} />
                  <span className="text-xs font-medium text-neutral-300">{agent.name}</span>
                </div>
                <span className={`text-[10px] font-mono ${isHigh ? 'text-red-400 block animate-pulse' : 'text-neutral-500'}`}>
                  {load.toFixed(0)}% LOAD
                </span>
              </div>
              <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden flex">
                <motion.div 
                  animate={{ width: `${load}%` }}
                  transition={{ ease: "linear", duration: 2 }}
                  className={`h-full rounded-full ${isHigh ? 'bg-red-500' : agent.bg}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
