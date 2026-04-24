import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, updateDoc, doc, addDoc } from 'firebase/firestore';
import { Coffee, Shield, CheckCircle, Clock, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

interface Order {
  id: string;
  item: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  timestamp: number;
  userId: string;
}

export default function CafeManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(collection(db, 'cafe_orders'), (snap) => {
      const fetchedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      setOrders(fetchedOrders.sort((a, b) => b.timestamp - a.timestamp));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const updateOrderStatus = async (id: string, status: Order['status']) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'cafe_orders', id), { status });
    } catch (e) {
      console.error(e);
    }
  };

  const addMockOrder = async () => {
    if (!db) return;
    const items = ['Burger & Fries', 'Cold Coffee', 'Hot Dog', 'Nachos', 'Soda'];
    await addDoc(collection(db, 'cafe_orders'), {
      item: items[Math.floor(Math.random() * items.length)],
      status: 'pending',
      timestamp: Date.now(),
      userId: `user_${Math.floor(Math.random() * 1000)}`
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans p-4 md:p-6">
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center cursor-pointer hover:bg-amber-400 transition-colors">
            <Coffee className="w-6 h-6 text-black" />
          </Link>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase">
            Cafe<span className="text-amber-500">Manager</span>
          </h1>
        </div>
        <div className="flex gap-4">
          <button onClick={addMockOrder} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-sm transition">
            + New Walk-in Order
          </button>
          <Link to="/" className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-sm text-neutral-400 hover:text-white transition">
            Admin Dashboard
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        {/* Pending Orders */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col">
          <h2 className="font-semibold mb-4 text-orange-400 flex items-center gap-2"><Clock size={18}/> Pending</h2>
          <div className="flex flex-col gap-3 overflow-y-auto">
            {orders.filter(o => o.status === 'pending').map(o => (
              <motion.div key={o.id} layout className="p-3 bg-neutral-800/50 rounded-xl border border-white/5">
                <p className="font-medium">{o.item}</p>
                <div className="flex justify-between mt-3 text-xs">
                  <span className="text-neutral-500">{new Date(o.timestamp).toLocaleTimeString()}</span>
                  <button onClick={() => updateOrderStatus(o.id, 'preparing')} className="text-orange-400 hover:text-orange-300">Start Preparing →</button>
                </div>
              </motion.div>
            ))}
            {orders.filter(o => o.status === 'pending').length === 0 && <p className="text-neutral-500 text-sm">No pending orders.</p>}
          </div>
        </div>

        {/* Preparing */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col">
          <h2 className="font-semibold mb-4 text-emerald-400 flex items-center gap-2"><Activity size={18}/> Preparing</h2>
          <div className="flex flex-col gap-3 overflow-y-auto">
            {orders.filter(o => o.status === 'preparing').map(o => (
              <motion.div key={o.id} layout className="p-3 bg-emerald-900/20 rounded-xl border border-emerald-500/20">
                <p className="font-medium">{o.item}</p>
                <div className="flex justify-between mt-3 text-xs">
                  <span className="text-neutral-500">{new Date(o.timestamp).toLocaleTimeString()}</span>
                  <button onClick={() => updateOrderStatus(o.id, 'ready')} className="text-emerald-400 hover:text-emerald-300">Mark Ready →</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Ready */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col">
          <h2 className="font-semibold mb-4 text-sky-400 flex items-center gap-2"><CheckCircle size={18}/> Ready for Pickup</h2>
          <div className="flex flex-col gap-3 overflow-y-auto">
            {orders.filter(o => o.status === 'ready').map(o => (
              <motion.div key={o.id} layout className="p-3 bg-sky-900/20 rounded-xl border border-sky-500/20">
                <p className="font-medium">{o.item}</p>
                <div className="flex justify-between mt-3 text-xs">
                  <span className="text-neutral-500">{new Date(o.timestamp).toLocaleTimeString()}</span>
                  <button onClick={() => updateOrderStatus(o.id, 'completed')} className="text-sky-400 hover:text-sky-300">Complete ✓</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
