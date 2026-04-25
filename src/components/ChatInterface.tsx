import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Smartphone, Paperclip, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
}

interface Zone {
  id: string;
  name: string;
  density: number;
}

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Hello! I am your StadiumAI Telegram bot 🏟️. This is the web simulator. Since you added your TELEGRAM_BOT_TOKEN to the secrets, you can also text me directly from your actual Telegram app!',
      timestamp: new Date(Date.now() - 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'zones'), (snap) => {
      if (!snap.empty) {
        setZones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Zone)));
      }
    });
    return () => unsub();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input;
    const newUserMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    const zonesStatus = zones.map(z => `- ${z.name}: ${z.density}% crowd`).join('\n');
    
    const venueContext = `You are the "Attendee Assistant Agent" for StadiumAI, a smart venue companion system. 
You communicate with stadium attendees via a Telegram bot interface. Be helpful, concise, and friendly.

Here is the CURRENT LIVE STATUS from the Orchestrator/Heatmap agents:
${zonesStatus}

- The user is currently sitting in Stand V1 (Block 4) and standing near Gate B right now.

When asked a question, provide direct, helpful advice based strictly on this live data. If they ask about Food or Restrooms, steer them to the option with the lowest crowd percentage. If they ask about entering, tell them the Gate with the lowest crowd. Act like an autonomous agent connected to the stadium's live CCTV feeds. KEEP RESPONSES SHORT AND PUNCHY like a Telegram message.`;

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("No API key");
      }
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: venueContext + "\n\nUser Question: " + userText }] }
        ]
      });

      const botText = response.text || "I'm having trouble connecting to the Orchestrator. Please try again.";
      
      const newBotMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: botText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, newBotMsg]);
    } catch (e) {
      let botResponse = `Hello! I'm your StadiumAI Concierge. `;
      const lowerInput = userText.toLowerCase();
      let dest = '';
      
      if (lowerInput.includes('food') || lowerInput.includes('eat') || lowerInput.includes('hungry')) {
        const foodZones = zones.filter(z => z.type === 'food').sort((a,b) => a.density - b.density);
        if (foodZones.length > 0) {
          dest = foodZones[0].name;
          botResponse += `Based on live crowd data, the least crowded food area is ${dest} (only ${foodZones[0].density}% crowd). I recommend heading there!`;
        } else {
          botResponse += `Check out the food courts on the live map for the best options.`;
        }
      } 
      else if (lowerInput.includes('restroom') || lowerInput.includes('bathroom') || lowerInput.includes('toilet') || lowerInput.includes('washroom')) {
        const rrZones = zones.filter(z => z.type === 'restroom').sort((a,b) => a.density - b.density);
        if (rrZones.length > 0) {
          dest = rrZones[0].name;
          botResponse += `The least crowded restroom is at ${dest} (${rrZones[0].density}% crowd).`;
        } else {
           botResponse += `Please check the live map for the nearest restroom with low congestion!`;
        }
      }
      else if (lowerInput.includes('gate') || lowerInput.includes('enter') || lowerInput.includes('exit')) {
        const gateZones = zones.filter(z => z.type === 'gate').sort((a,b) => a.density - b.density);
        if (gateZones.length > 0) {
           dest = gateZones[0].name;
           botResponse += `For the fastest path, use ${dest} which currently has ${gateZones[0].density}% crowd density.`;
        } else {
           botResponse += `You can find the most open gates on the live map.`;
        }
      }
      else {
        botResponse += `I can help you find the least crowded restrooms, food stalls, and gates. Just ask me!`;
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: botResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full font-sans bg-[#0E1621]">
      {/* Telegram Header */}
      <div className="bg-[#17212B] p-3 flex items-center gap-3 border-b border-[#101921]">
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white relative overflow-hidden">
          <Bot size={24} className="relative z-10" />
        </div>
        <div className="flex-1">
          <p className="text-white font-bold text-sm leading-none">StadiumAI Bot</p>
          <p className="text-blue-400 text-xs mt-1">bot</p>
        </div>
        <div className="bg-[#2B5278] text-white text-[10px] px-2 py-1 rounded uppercase tracking-wider font-semibold opacity-80 decoration-0">Telegram</div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0E1621] relative" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-matter.png")', opacity: 0.95 }}>
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="flex flex-col">
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm ${
                    msg.sender === 'user' 
                      ? 'bg-[#2B5278] text-white rounded-br-none self-end' 
                      : 'bg-[#182533] text-white rounded-bl-none self-start relative'
                  }`}
                >
                  {msg.text}
                  <span className={`text-[10px] opacity-60 inline-block align-bottom ml-2 float-right mt-1.5`}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
          {isTyping && (
             <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex justify-start"
             >
                <div className="bg-[#182533] rounded-2xl rounded-bl-none p-3 shadow-sm flex items-center gap-1.5">
                  <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full"></motion.div>
                  <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full"></motion.div>
                  <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full"></motion.div>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#17212B] flex items-center gap-2">
        <button className="text-[#6C7883] p-2 hover:text-white transition-colors">
          <Paperclip size={20} />
        </button>
        <div className="flex-1 bg-[#242F3D] rounded-xl flex items-center px-3 border border-transparent focus-within:border-[#2B5278] transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Write a message..."
            className="bg-transparent border-none outline-none text-white w-full text-sm py-3 placeholder:text-[#6C7883]"
          />
          <button className="text-[#6C7883] p-1 mr-1 hover:text-white transition-colors">
             <Smile size={20} />
          </button>
        </div>
        {input.trim() ? (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={handleSend}
            className="w-11 h-11 rounded-full bg-[#5288C1] flex items-center justify-center text-white hover:bg-[#5b95d3] transition-colors focus:outline-none shadow-md shrink-0"
          >
            <Send size={18} className="ml-1" />
          </motion.button>
        ) : (
          <div className="w-11"></div> // placeholder to prevent UI jumping
        )}
      </div>
    </div>
  );
}
