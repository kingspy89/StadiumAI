import express from 'express';
import { createServer as createViteServer } from 'vite';
import TelegramBot from 'node-telegram-bot-api';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, onSnapshot, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

import admin from 'firebase-admin';

async function callAI(text: string, base64Image?: string) {
  const gKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  let grokError = '';
  
  const systemInstruction = `Analyze this crowd/volunteer update. Output ONLY a valid JSON object with EXACTLY these keys: "density" (number 0-100, guess if vague), "emergency" (boolean, true if dangerous or requires action like redirect), "summary" (short clear summary), "suggestion" (if action needed, provide a short actionable command like 'Transfer crowd to Gate B', else ''). NO Markdown formatting, NO backticks. ONLY valid JSON.`;

  // Try Groq first if available
  if (groqKey) {
    try {
      let messages: any[] = [
        { role: 'system', content: systemInstruction }
      ];
      
      let model = 'llama-3.3-70b-versatile';
      
      if (base64Image) {
        model = 'llama-3.2-11b-vision-preview';
        messages.push({
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            { type: 'text', text: text || 'Analyze this image.' }
          ]
        });
      } else {
        messages.push({
          role: 'user',
          content: text || 'Analyze this situation.'
        });
      }

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq API error: ${res.status} - ${errText}`);
      }
      const data = await res.json();
      return data.choices[0].message.content;
    } catch (e: any) {
      grokError = e.message;
      console.error("Groq failed, falling back if possible:", grokError);
    }
  }

  // Fallback to Gemini
  if (gKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: gKey });
      let contents: any[] = [];
      if (base64Image) {
        contents.push({ role: 'user', parts: [
          text ? { text } : { text: "Analyze this image." },
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' }} 
        ]});
      } else {
        contents.push({ role: 'user', parts: [{ text: text || "Analyze this situation." }] });
      }
      
      const aiRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });
      return aiRes.text;
    } catch(e: any) {
      const geminiError = e.message;
      throw new Error((grokError ? `Groq Error: ${grokError} | ` : '') + `Gemini Error: ${geminiError}`);
    }
  }
  
  throw new Error("No valid AI API keys provided (GROQ_API_KEY or GEMINI_API_KEY)." + (grokError ? ` Groq Error: ${grokError}` : ''));
}

// Firebase Setup
let db: any = null;
try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log("🔥 Firebase Admin initialized with service account file");
  } else {
    // Fallback to Google Application Default Credentials (e.g. for Cloud Run)
    admin.initializeApp();
    db = admin.firestore();
    console.log("🔥 Firebase Admin initialized with Application Default Credentials");
  }
} catch (e) {
  console.error('Firebase Admin initialization error:', e);
}

// Telegram Bot Setup
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
let bot: TelegramBot | null = null;
const userStates: Record<string, string> = {};
const tempUserIds: Record<string, string> = {};
const activeVolunteers: Record<string, { id: string, zone: string, zoneId: string }> = {};

if (adminChatId) {
  activeVolunteers[adminChatId] = { id: 'HEAD', zone: 'Main Control', zoneId: '' };
}

if (botToken) {
  bot = new TelegramBot(botToken, { polling: true });
  console.log("🤖 Telegram Bot started polling");

  process.once('SIGINT', () => { bot?.stopPolling(); process.exit(0); });
  process.once('SIGTERM', () => { bot?.stopPolling(); process.exit(0); });

  let previousZones: Record<string, number> = {};

  if (db) {
    // Fetch registered volunteers on boot
    db.collection('telegram_users').get().then((snap: any) => {
       snap.forEach((d: any) => { activeVolunteers[d.id] = d.data(); });
    }).catch((e: any) => console.log("Failed to fetch past volunteers"));

    db.collection('zones').onSnapshot((snap: any) => {
      const currentZones = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      currentZones.forEach(zone => {
         const oldDensity = previousZones[zone.id] || 0;
         const newDensity = zone.density;
         if (newDensity > 85 && oldDensity <= 85) {
            const msg = `🚨 SYSTEM ALERT:\n${zone.name} is currently highly congested (${newDensity}% crowd). Volunteers, please coordinate.`;
            Object.keys(activeVolunteers).forEach(chatId => {
               bot?.sendMessage(chatId, msg).catch(e => console.error(e.message));
            });
         }
         previousZones[zone.id] = newDensity;
      });
    });

    db.collection('broadcast_messages').onSnapshot((snap: any) => {
       snap.docChanges().forEach((change: any) => {
          if (change.type === 'added') {
             const data = change.doc.data();
             if (Date.now() - data.createdAt < 120000) { // Only send if it was created in the last 2 minutes
                const sendMsg = `📢 *DASHBOARD BROADCAST*\n\n${data.message}`;
                Object.keys(activeVolunteers).forEach(chatId => {
                   bot?.sendMessage(chatId, sendMsg, { parse_mode: 'Markdown' }).catch(e=>console.error(e));
                });
             }
          }
       });
    });
  }

  const zoneNameToId: Record<string, string> = {
    'Gate A': 'g1', 'Gate B': 'g2', 
    'Food North': 'f1', 'Snacks South': 'f2',
    'Stand V1': 's1', 'Restrooms W': 'r1',
    'North Parking': 'p1', 'South Parking': 'p2'
  };

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text || '';

    // Volunteer Registration Flow
    if (text === '/start') {
      userStates[chatId] = 'AWAITING_ID';
      bot?.sendMessage(chatId, `🏟️ *Stadium Bot Online!*\n\nWelcome! Please type your Volunteer ID to begin:`, {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      });
      return;
    }

    if (text === '/leave' || text === '/signout') {
       if (activeVolunteers[chatId]) {
          delete activeVolunteers[chatId];
       }
       if (db) {
          try { await db.collection('telegram_users').doc(chatId).delete(); } catch(e){}
       }
       userStates[chatId] = '';
       bot?.sendMessage(chatId, `👋 You have signed out successfully! You will no longer receive updates. Send /start to volunteer again.`, {
          reply_markup: { remove_keyboard: true }
       });
       return;
    }

    if (userStates[chatId] === 'AWAITING_ID') {
      tempUserIds[chatId] = text;
      userStates[chatId] = 'AWAITING_ZONE';
      const keyboardMenu = {
        reply_markup: {
          keyboard: [
             [{ text: 'Gate A' }, { text: 'Gate B' }],
             [{ text: 'Food North' }, { text: 'Snacks South' }],
             [{ text: 'Stand V1' }, { text: 'Restrooms W' }],
             [{ text: 'North Parking' }, { text: 'South Parking' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      };
      bot?.sendMessage(chatId, `Thanks, *${text}*! Now select your assigned zone from the menu:`, { parse_mode: 'Markdown', ...keyboardMenu });
      return;
    }

    if (userStates[chatId] === 'AWAITING_ZONE') {
       if (!zoneNameToId[text]) {
          bot?.sendMessage(chatId, `⚠️ Please select a valid zone from the keyboard options.`);
          return;
       }
       const zoneId = zoneNameToId[text];
       const volId = tempUserIds[chatId];
       
       const userData = { id: volId, zone: text, zoneId };
       activeVolunteers[chatId] = userData;
       userStates[chatId] = 'REGISTERED';
       
       if (db) {
            try {
            await db.collection('telegram_users').doc(chatId).set(userData);
        } catch (e: any) {
            console.warn('Failed to set telegram user:', e.message);
        } 
       }
       
       // Send Live Crowd Data
       let crowdSummary = `📊 *LIVE STADIUM STATUS*\n\n`;
       if (db) {
          try {
             const snap = await db.collection('zones').get();
             const zonesList = snap.docs.map((doc: any) => ({ name: doc.data().name, density: doc.data().density }));
             zonesList.sort((a, b) => b.density - a.density);
             zonesList.forEach(z => {
                const icon = z.density > 80 ? '🔴' : (z.density > 50 ? '🟡' : '🟢');
                crowdSummary += `${icon} *${z.name}*: ${z.density}% crowd\n`;
             });
          } catch(e) {}
       } else {
          crowdSummary += `🟢 Gate A: 45%\n🟡 Food North: 65%\n🔴 Gate B: 88%\n`;
       }
       
       const persistentKeyboard = {
          reply_markup: {
             keyboard: [
                [{ text: '📝 Update Status' }, { text: '🚨 Emergency Broadcast' }],
                [{ text: '📊 Live Data' }]
             ],
             resize_keyboard: true,
             is_persistent: true
          }
       };

       await bot?.sendMessage(chatId, `✅ *Registration Successful!*\n\nYou are assigned to: *${text}*\n\n${crowdSummary}`, { parse_mode: 'Markdown' });
       
       bot?.sendMessage(chatId, `Use the buttons below to interact, or just send a photo/audio anytime. (Send /leave to sign out)`, persistentKeyboard);
       return;
    }

    const senderData = activeVolunteers[chatId];
    if (!senderData && chatId !== adminChatId) {
        // We only trigger this if it's not a slash command, avoiding chat spam if another bot handles it.
        // Wait, if it's an unrecognized text, we just say register.
        bot?.sendMessage(chatId, `⚠️ You are not registered. Please send /start to begin.`);
        return;
    }

    if (text === '📊 Live Data') {
       let crowdSummary = `📊 *LIVE STADIUM STATUS*\n\n`;
       if (db) {
          try {
             const snap = await getDocs(collection(db, 'zones'));
             const zonesList = snap.docs.map(doc => ({ name: doc.data().name, density: doc.data().density }));
             zonesList.sort((a, b) => b.density - a.density);
             zonesList.forEach(z => {
                const icon = z.density > 80 ? '🔴' : (z.density > 50 ? '🟡' : '🟢');
                crowdSummary += `${icon} *${z.name}*: ${z.density}% crowd\n`;
             });
          } catch(e) {}
       }
       bot?.sendMessage(chatId, crowdSummary, { parse_mode: 'Markdown' });
       return;
    }

    if (text === '📝 Update Status') {
       userStates[chatId] = 'AWAITING_UPDATE';
       bot?.sendMessage(chatId, `Send your update (text or photo) for *${senderData.zone}*:`, { parse_mode: 'Markdown' });
       return;
    }

    if (text === '🚨 Emergency Broadcast') {
       userStates[chatId] = 'AWAITING_EMERGENCY';
       bot?.sendMessage(chatId, `🚨 *EMERGENCY MODE*\n\nDescribe the emergency or send a photo. This will alert ALL volunteers immediately:`, { parse_mode: 'Markdown' });
       return;
    }

    bot?.sendChatAction(chatId, 'typing');

      // Process Broadcasts and AI Estimation
    try {
      const gKey = process.env.GEMINI_API_KEY?.trim();
      const groqKey = process.env.GROQ_API_KEY?.trim();
      const hasAIOutput = !!(gKey || groqKey);
      
      const senderId = senderData.id;
      const zoneName = senderData.zone;
      const zoneId = senderData.zoneId;

      let updateMessage = '';
      let isEmergency = false;
      let densityLog: number | undefined = undefined;

      const isManualEmergency = userStates[chatId] === 'AWAITING_EMERGENCY';

      if (hasAIOutput && bot) {
         try {
            if (msg.photo && msg.photo.length > 0) {
               const photo = msg.photo[msg.photo.length - 1]; 
               const fileLink = await bot.getFileLink(photo.file_id);
               const response = await fetch(fileLink);
               const arrayBuffer = await response.arrayBuffer();
               const base64Data = Buffer.from(arrayBuffer).toString('base64');
               
               const aiResponseText = await callAI(text || '', base64Data);
               let textVal = aiResponseText?.trim() || "{}";
               const jsonMatch = textVal.match(/\{[\s\S]*\}/);
               if (jsonMatch) textVal = jsonMatch[0];
               
               let parsed = JSON.parse(textVal);
               densityLog = parsed.density;
               isEmergency = isManualEmergency || parsed.emergency || !!parsed.suggestion;
               
               if (db && zoneId) {
                   const updatePayload: any = {};
                   if (parsed.density !== undefined) updatePayload.density = Math.max(0, Math.min(100, Number(parsed.density)));
                   if (isEmergency) {
                      updatePayload.emergencyMsg = parsed.summary;
                      updatePayload.aiSuggestion = parsed.suggestion || '';
                   } else {
                      updatePayload.emergencyMsg = null;
                      updatePayload.aiSuggestion = null;
                   }
                   try {
                  await db.collection('zones').doc(zoneId).update(updatePayload);
                } catch (e) {
                  console.warn('Firestore update failed (AI block):', e.message);
                }
               }
               
               updateMessage = `📸 [IMAGE REPORT]\nLocation: ${zoneName} (Vol: ${senderId})\n🤖 AI Vision: ${parsed.summary}\n📊 Crowd Density: ${parsed.density}%${parsed.suggestion ? `\n💡 Action: ${parsed.suggestion}` : ''}`;
            } else if (text) {
               const aiResponseText = await callAI(text);
               let textVal = aiResponseText?.trim() || "{}";
               const jsonMatch = textVal.match(/\{[\s\S]*\}/);
               if (jsonMatch) textVal = jsonMatch[0];
               
               let parsed = JSON.parse(textVal);
               densityLog = parsed.density;
               isEmergency = isManualEmergency || parsed.emergency || !!parsed.suggestion;
               
               if (db && zoneId) {
                   const updatePayload: any = {};
                   if (parsed.density !== undefined) updatePayload.density = Math.max(0, Math.min(100, Number(parsed.density)));
                   if (isEmergency) {
                      updatePayload.emergencyMsg = parsed.summary;
                      updatePayload.aiSuggestion = parsed.suggestion || '';
                   } else {
                      updatePayload.emergencyMsg = null;
                      updatePayload.aiSuggestion = null;
                   }
                   try {
                  await db.collection('zones').doc(zoneId).update(updatePayload);
                } catch (e) {
                  console.warn('Firestore update failed (AI text block):', e.message);
                }
               }
               
               updateMessage = `📋 [TEXT REPORT]\nLocation: ${zoneName} (Vol: ${senderId})\nMessage: ${text}\n🤖 AI Translation: ${parsed.summary}\n📊 Dashboard updated to: ${parsed.density}%${parsed.suggestion ? `\n💡 Action: ${parsed.suggestion}` : ''}`;
            }
         } catch(e: any) {
            console.error("AI processing error:", e);
            // Fallback to non-AI implementation inside the fallback logic
            const textLower = (text || '').toLowerCase();
            const emergencyKeywords = ['fire', 'emergency', 'evacuat', 'help', 'danger', 'accident', 'injury', 'hurt', 'critical', 'urgent', 'medical', 'fight', 'stampede', 'flood'];
            const hasEmergencyKeyword = emergencyKeywords.some(kw => textLower.includes(kw));
            isEmergency = isManualEmergency || hasEmergencyKeyword;

            if (msg.photo && msg.photo.length > 0) {
               updateMessage = `📸 [IMAGE REPORT]\nLocation: ${zoneName} (Vol: ${senderId})\n(A volunteer sent a photo - AI unavailable)`;
            } else if (text) {
               let fallbackDensity: number | undefined;
               const match = text.match(/(\d+)\s*%/);
               if (match) {
                  fallbackDensity = parseInt(match[1]);
               } else if (textLower.includes('packed') || textLower.includes('full') || textLower.includes('crowded') || textLower.includes('overflow')) {
                  fallbackDensity = 90;
               } else if (textLower.includes('half') || textLower.includes('normal') || textLower.includes('medium')) {
                  fallbackDensity = 50;
               } else if (textLower.includes('empty') || textLower.includes('clear') || textLower.includes('quiet')) {
                  fallbackDensity = 10;
               }

               let isEmergencyDetected = isEmergency || /(fire|stampede|fight|medical|help|emergency|urgent)/i.test(text);
               let fallbackSuggestion = '';
               if (isEmergencyDetected) {
                  if (/(fire|smoke)/i.test(text)) fallbackSuggestion = 'Evacuate area immediately and call fire department.';
                  else if (/(medical|injur|hurt)/i.test(text)) fallbackSuggestion = 'Dispatch medical team to location.';
                  else if (/(fight|stampede|crowd)/i.test(text)) fallbackSuggestion = 'Dispatch security to control crowd.';
                  else fallbackSuggestion = 'Investigate situation immediately.';
               }

               const errMsg = e instanceof Error ? e.message : String(e);
               const updatePayload: any = {};
               if (fallbackDensity !== undefined) {
                  densityLog = fallbackDensity;
                  updatePayload.density = Math.max(0, Math.min(100, Number(fallbackDensity)));
               }
               
               if (isEmergencyDetected) {
                  updatePayload.emergencyMsg = `Emergency reported: ${text}`;
                  updatePayload.aiSuggestion = `[Fallback - AI Error: ${errMsg}] ${fallbackSuggestion}`;
               } else {
                  updatePayload.emergencyMsg = null;
                  updatePayload.aiSuggestion = null;
               }

               if (db && zoneId) {
                  try {
                     await db.collection('zones').doc(zoneId).update(updatePayload);
                  } catch (e: any) {
                     console.warn('Firestore update failed (fallback text block):', e.message);
                  }
               }

               const emergencyTag = isEmergencyDetected ? '🚨 EMERGENCY DETECTED\n' : '';
               updateMessage = `📋 [TEXT REPORT]\n${emergencyTag}Location: ${zoneName} (Vol: ${senderId})\nMessage: ${text}${fallbackDensity !== undefined ? `\n📊 Dashboard updated to: ${fallbackDensity}%` : ''}`;
               isEmergency = isEmergencyDetected;
            }
         }
      } else {
         // No AI key present fallback - keyword-based detection
         const noAiTextLower = (text || '').toLowerCase();
         const emergencyKws = ['fire', 'emergency', 'evacuat', 'help', 'danger', 'accident', 'injury', 'hurt', 'critical', 'urgent', 'medical', 'fight', 'stampede', 'flood'];
         const hasEmergencyKw = emergencyKws.some(kw => noAiTextLower.includes(kw));
         isEmergency = isManualEmergency || hasEmergencyKw;

         if (msg.photo && msg.photo.length > 0) {
            updateMessage = `📸 [IMAGE REPORT]\nLocation: ${zoneName} (Vol: ${senderId})\n(Photo received)`;
         } 
         else if (text) {
            let fallbackDensity: number | undefined;
            const match = text.match(/(\d+)\s*%/);
            if (match) {
               fallbackDensity = parseInt(match[1]);
            } else if (noAiTextLower.includes('packed') || noAiTextLower.includes('full') || noAiTextLower.includes('crowded') || noAiTextLower.includes('overflow')) {
               fallbackDensity = 90;
            } else if (noAiTextLower.includes('half') || noAiTextLower.includes('normal') || noAiTextLower.includes('medium')) {
               fallbackDensity = 50;
            } else if (noAiTextLower.includes('empty') || noAiTextLower.includes('clear') || noAiTextLower.includes('quiet')) {
               fallbackDensity = 10;
            }

            let isEmergencyDetected = isEmergency || /(fire|stampede|fight|medical|help|emergency|urgent)/i.test(text);
            let fallbackSuggestion = '';
            if (isEmergencyDetected) {
               if (/(fire|smoke)/i.test(text)) fallbackSuggestion = 'Evacuate area immediately and call fire department.';
               else if (/(medical|injur|hurt)/i.test(text)) fallbackSuggestion = 'Dispatch medical team to location.';
               else if (/(fight|stampede|crowd)/i.test(text)) fallbackSuggestion = 'Dispatch security to control crowd.';
               else fallbackSuggestion = 'Investigate situation immediately.';
            }

            const errMsg = "No AI API Key";
            const noAiPayload: any = {};
            if (fallbackDensity !== undefined) {
               densityLog = fallbackDensity;
               noAiPayload.density = Math.max(0, Math.min(100, Number(fallbackDensity)));
            }
            
            if (isEmergencyDetected) {
               noAiPayload.emergencyMsg = `Emergency reported: ${text}`;
               noAiPayload.aiSuggestion = `[Fallback - AI Error: ${errMsg}] ${fallbackSuggestion}`;
            } else {
               noAiPayload.emergencyMsg = null;
               noAiPayload.aiSuggestion = null;
            }

            if (db && zoneId && Object.keys(noAiPayload).length > 0) {
                try {
                  await db.collection('zones').doc(zoneId).update(noAiPayload);
                } catch (e: any) {
                  console.warn('Firestore update failed (fallback):', e.message);
                }
            }

            const emergencyTagNoAi = isEmergencyDetected ? '🚨 EMERGENCY DETECTED\n' : '';
            updateMessage = `📋 [TEXT REPORT]\n${emergencyTagNoAi}Location: ${zoneName} (Vol: ${senderId})\nMessage: ${text}${fallbackDensity !== undefined ? `\n📊 Dashboard updated to: ${fallbackDensity}%` : ''}`;
            isEmergency = isEmergencyDetected;
         }
      }

      if (!updateMessage) return;

      if (isEmergency) {
         updateMessage = `🚨 EMERGENCY at ${zoneName} 🚨\n\n${updateMessage}`;
      }

      // 1. Broadcast to other chats
      let sentCount = 0;
      for (const [chatStr, user] of Object.entries(activeVolunteers)) {
         if (chatStr !== chatId) {
            try {
               await bot?.sendMessage(chatStr, updateMessage);
               sentCount++;
            } catch (e) {}
         }
      }
      
      let finalResponse = `✅ Update processed & dashboard updated. Alert broadcasted to ${sentCount} other volunteers.\n\n`;
      finalResponse += `📝 *Your Report Summary:*\n${updateMessage.replace(/\[.*\]\nLocation:.*\n/, '')}\n\n`;
      finalResponse += `📊 *UPDATED LIVE STADIUM STATUS*\n\n`;
       // Build live stadium status for response
       try {
          if (db) {
             const snap = await db.collection('zones').get();
             const zonesList = snap.docs.map((doc: any) => ({ name: doc.data().name, id: doc.id, density: doc.data().density }));
             const updatedZone = zonesList.find(z => z.id === zoneId);
             if (updatedZone && densityLog !== undefined) {
                updatedZone.density = Math.max(0, Math.min(100, Number(densityLog)));
             }
             zonesList.sort((a, b) => b.density - a.density);
             zonesList.forEach(z => {
                const icon = z.density > 80 ? '🔴' : (z.density > 50 ? '🟡' : '🟢');
                finalResponse += `${icon} *${z.name}*: ${z.density}% crowd\n`;
             });
          }
       } catch (e) {
          console.warn('Failed to fetch zones for dashboard:', e.message);
          finalResponse += '\n⚠️ Unable to retrieve live zone data.';
       }

      bot?.sendMessage(chatId, finalResponse, { parse_mode: 'Markdown' });
      
      // Reset State
      userStates[chatId] = 'REGISTERED';

      // 2. Update Dashboard Logs
      if (db) {
         try {
            await db.collection('system_logs').add({
               timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
               agent: `Vol: ${senderId} (${zoneName})`,
               level: isEmergency ? 'error' : (densityLog > 80 ? 'warn' : 'info'),
               message: updateMessage.replace(/\*/g, '').split('\n').filter(l => !l.includes('REPORT') && !l.includes('Location:')).join(' ').trim(),
               createdAt: Date.now()
            });
         } catch (e) {
            console.warn('Firestore log addition failed:', e.message);
         }
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
