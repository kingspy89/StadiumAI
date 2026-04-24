import express from 'express';
import { createServer as createViteServer } from 'vite';
import TelegramBot from 'node-telegram-bot-api';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

// Firebase Setup
let db: any = null;
try {
  if (fs.existsSync('./firebase-applet-config.json')) {
    const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
    const app = initializeApp(config);
    db = getFirestore(app, config.firestoreDatabaseId);
    console.log("🔥 Firebase initialized in server");
  }
} catch (e) {
  console.log("Firebase config not found or invalid on server.");
}

// Telegram Bot Setup
const botToken = process.env.TELEGRAM_BOT_TOKEN;
let bot: TelegramBot | null = null;

if (botToken) {
  bot = new TelegramBot(botToken, { polling: true });
  console.log("🤖 Telegram Bot started polling");

  let zonesCache: any[] = [];
  if (db) {
    onSnapshot(collection(db, 'zones'), (snap) => {
      zonesCache = snap.docs.map(doc => doc.data());
    });
  }

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';

    // Typing action
    bot?.sendChatAction(chatId, 'typing');

    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (gKey) {
        const ai = new GoogleGenAI({ apiKey: gKey });
        const zonesStatus = zonesCache.map(z => `- ${z.name}: ${z.density}% capacity`).join('\n');
        
        const systemPrompt = `You are StadiumAI Bot, an advanced AI concierge on Telegram. You assist users inside the stadium.
LIVE STATUS:
${zonesStatus}

Answer the user directly and concisely. If they ask about congestion, restroom, or food, check the LIVE STATUS and refer them to the least crowded option. Be friendly and helpful!`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: text,
          config: {
            systemInstruction: systemPrompt
          }
        });

        // Add a log to Firebase if possible
        if (db) {
           await addDoc(collection(db, 'system_logs'), {
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              agent: 'Attendee Assistant',
              level: 'action',
              message: `Telegram user asked: "${text.substring(0,20)}...". Replied with directions.`,
              createdAt: Date.now()
           });
        }

        bot?.sendMessage(chatId, response.text || "I'm having trouble thinking right now.");
      } else {
        bot?.sendMessage(chatId, "I'm alive, but my AI brain (Gemini API Key) is offline.");
      }
    } catch (e: any) {
      console.error("TELEGRAM BOT ERROR:", e);
      bot?.sendMessage(chatId, `Error processing your request: ${e.message}`);
    }
  });
} else {
  console.log("⚠️ No TELEGRAM_BOT_TOKEN found. Bot is disabled.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mock Live Match API (Can be connected to CricAPI later)
  app.get("/api/match/live", (req, res) => {
    // We simulate live changes if no API key is provided
    const overs = (34 + Math.floor((Date.now() % 600000) / 100000)).toString();
    const balls = (Date.now() % 6).toString();
    const baseScore = 245;
    const score = baseScore + Math.floor((Date.now() % 300000) / 10000);
    
    res.json({
      teamA: "IND",
      teamB: "AUS",
      scoreA: `${score}/4`,
      oversA: `${overs}.${balls}`,
      statusA: "Batting",
      scoreB: "Yet to bat",
      statusB: "Bowling",
      weather: { temp: 32, humidity: 68, condition: "Clear Sky" }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    // Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
