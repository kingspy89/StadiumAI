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
      
      const generateMockResponse = (input: string, zones: any[]) => {
        const lowerInput = input.toLowerCase();
        let message = `Hello! I'm your StadiumAI Concierge. `;
        let dest = '';
        
        if (lowerInput.includes('food') || lowerInput.includes('eat') || lowerInput.includes('hungry')) {
          const foodZones = zones.filter(z => z.type === 'food').sort((a,b) => a.density - b.density);
          if (foodZones.length > 0) {
            dest = foodZones[0].name;
            message += `Based on live crowd data, the least crowded food area is ${dest} (only ${foodZones[0].density}% capacity). I recommend heading there!`;
          } else {
            message += `Check out the food courts on the live map for the best options.`;
          }
        } 
        else if (lowerInput.includes('restroom') || lowerInput.includes('bathroom') || lowerInput.includes('toilet') || lowerInput.includes('washroom')) {
          const rrZones = zones.filter(z => z.type === 'restroom').sort((a,b) => a.density - b.density);
          if (rrZones.length > 0) {
            dest = rrZones[0].name;
            message += `The least crowded restroom is at ${dest} (${rrZones[0].density}% capacity).`;
          } else {
             message += `Please check the live map for the nearest restroom with low congestion!`;
          }
        }
        else if (lowerInput.includes('gate') || lowerInput.includes('enter') || lowerInput.includes('exit')) {
          const gateZones = zones.filter(z => z.type === 'gate').sort((a,b) => a.density - b.density);
          if (gateZones.length > 0) {
             dest = gateZones[0].name;
             message += `For the fastest path, use ${dest} which currently has ${gateZones[0].density}% crowd density.`;
          } else {
             message += `You can find the most open gates on the live map.`;
          }
        }
        else {
          message += `I can help you find the least crowded restrooms, food stalls, and gates. Just ask me!`;
        }

        if (dest) {
          // Construct the navigation link
          const appUrl = 'https://ais-pre-jbmuwftq4kxthod735k5gu-869592050378.asia-southeast1.run.app';
          message += `\n\n🗺️ Live Navigation:\n${appUrl}/user?dest=${encodeURIComponent(dest)}`;
        }

        return message;
      };

      if (gKey && gKey.length > 10) {
        try {
          const ai = new GoogleGenAI({ apiKey: gKey });
          const zonesStatus = zonesCache.map(z => `- ${z.name}: ${z.density}% capacity (${z.type || 'zone'})`).join('\n');
          
          const systemPrompt = `You are StadiumAI Bot, an advanced AI concierge on Telegram. You assist users inside the stadium.
LIVE STATUS:
${zonesStatus}

Answer the user directly and concisely. If they ask about congestion, restroom, or food, check the LIVE STATUS and refer them to the least crowded option. Be friendly and helpful!

IMPORTANT: If you recommend a specific zone, gate, food court, or restroom, YOU MUST append a Live Navigation link to your response in exactly this format:
🗺️ Live Navigation:
https://ais-pre-jbmuwftq4kxthod735k5gu-869592050378.asia-southeast1.run.app/user?dest=[URL_ENCODED_ZONE_NAME]`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: text,
            config: {
              systemInstruction: systemPrompt
            }
          });

          if (db) {
             await addDoc(collection(db, 'system_logs'), {
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                agent: 'Attendee Assistant',
                level: 'action',
                message: `Telegram user asked: "${text.substring(0,20)}...". Replied with directions using AI.`,
                createdAt: Date.now()
             });
          }

          bot?.sendMessage(chatId, response.text || generateMockResponse(text, zonesCache));
        } catch (apiError: any) {
          console.error("Gemini API Error:", apiError.message);
          bot?.sendMessage(chatId, generateMockResponse(text, zonesCache));
        }
      } else {
        bot?.sendMessage(chatId, generateMockResponse(text, zonesCache));
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
