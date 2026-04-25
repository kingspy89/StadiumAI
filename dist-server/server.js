// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import TelegramBot from "node-telegram-bot-api";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, setDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
console.log(">>> server.ts module loaded");
console.log(">>> ENVIRONMENT VARIABLES:", {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  HAS_GEMINI: !!process.env.GEMINI_API_KEY,
  HAS_TELEGRAM: !!process.env.TELEGRAM_BOT_TOKEN
});
async function callAI(text, base64Image) {
  const gKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  let grokError = "";
  const systemInstruction = `Analyze this crowd/volunteer update. Output ONLY a valid JSON object with EXACTLY these keys: "density" (number 0-100, guess if vague), "emergency" (boolean, true if dangerous or requires action like redirect), "summary" (short clear summary), "suggestion" (if action needed, provide a short actionable command like 'Transfer crowd to Gate B', else ''). NO Markdown formatting, NO backticks. ONLY valid JSON.`;
  if (groqKey) {
    try {
      let messages = [
        { role: "system", content: systemInstruction }
      ];
      let model = "llama-3.3-70b-versatile";
      if (base64Image) {
        model = "llama-3.2-11b-vision-preview";
        messages.push({
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            { type: "text", text: text || "Analyze this image." }
          ]
        });
      } else {
        messages.push({
          role: "user",
          content: text || "Analyze this situation."
        });
      }
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
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
    } catch (e) {
      grokError = e.message;
      console.error("Groq failed, falling back if possible:", grokError);
    }
  }
  if (gKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: gKey });
      let contents = [];
      if (base64Image) {
        contents.push({ role: "user", parts: [
          text ? { text } : { text: "Analyze this image." },
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
        ] });
      } else {
        contents.push({ role: "user", parts: [{ text: text || "Analyze this situation." }] });
      }
      const aiRes = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });
      return aiRes.text;
    } catch (e) {
      const geminiError = e.message;
      throw new Error((grokError ? `Groq Error: ${grokError} | ` : "") + `Gemini Error: ${geminiError}`);
    }
  }
  throw new Error("No valid AI API keys provided (GROQ_API_KEY or GEMINI_API_KEY)." + (grokError ? ` Groq Error: ${grokError}` : ""));
}
var db = null;
try {
  if (fs.existsSync("./firebase-applet-config.json")) {
    const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
    const app = initializeApp(config);
    db = getFirestore(app, config.firestoreDatabaseId);
    console.log("\u{1F525} Firebase initialized in server");
  }
} catch (e) {
  console.log("Firebase config not found or invalid on server.");
}
var botToken = process.env.TELEGRAM_BOT_TOKEN;
var adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
var bot = null;
var userStates = {};
var tempUserIds = {};
var activeVolunteers = {};
if (adminChatId) {
  activeVolunteers[adminChatId] = { id: "HEAD", zone: "Main Control", zoneId: "" };
}
if (botToken) {
  try {
    bot = new TelegramBot(botToken, { polling: true });
    console.log("\u{1F916} Telegram Bot started polling");
    process.once("SIGINT", () => {
      bot?.stopPolling();
      process.exit(0);
    });
    process.once("SIGTERM", () => {
      bot?.stopPolling();
      process.exit(0);
    });
  } catch (err) {
    console.error(">>> FATAL ERROR INIT TELEGRAM BOT:", err);
  }
  let previousZones = {};
  if (db) {
    getDocs(collection(db, "telegram_users")).then((snap) => {
      snap.forEach((d) => {
        activeVolunteers[d.id] = d.data();
      });
    }).catch((e) => console.log("Failed to fetch past volunteers"));
    onSnapshot(collection(db, "zones"), (snap) => {
      const currentZones = snap.docs.map((doc2) => ({ id: doc2.id, ...doc2.data() }));
      currentZones.forEach((zone) => {
        const oldDensity = previousZones[zone.id] || 0;
        const newDensity = zone.density;
        if (newDensity > 85 && oldDensity <= 85) {
          const msg = `\u{1F6A8} SYSTEM ALERT:
${zone.name} is currently highly congested (${newDensity}% crowd). Volunteers, please coordinate.`;
          Object.keys(activeVolunteers).forEach((chatId) => {
            bot?.sendMessage(chatId, msg).catch((e) => console.error(e.message));
          });
        }
        previousZones[zone.id] = newDensity;
      });
    });
    onSnapshot(collection(db, "broadcast_messages"), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (Date.now() - data.createdAt < 12e4) {
            const sendMsg = `\u{1F4E2} *DASHBOARD BROADCAST*

${data.message}`;
            Object.keys(activeVolunteers).forEach((chatId) => {
              bot?.sendMessage(chatId, sendMsg, { parse_mode: "Markdown" }).catch((e) => console.error(e));
            });
          }
        }
      });
    });
  }
  const zoneNameToId = {
    "Gate A": "g1",
    "Gate B": "g2",
    "Food North": "f1",
    "Snacks South": "f2",
    "Stand V1": "s1",
    "Restrooms W": "r1",
    "North Parking": "p1",
    "South Parking": "p2"
  };
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text || "";
    if (text === "/start") {
      userStates[chatId] = "AWAITING_ID";
      bot?.sendMessage(chatId, `\u{1F3DF}\uFE0F *Stadium Bot Online!*

Welcome! Please type your Volunteer ID to begin:`, {
        parse_mode: "Markdown",
        reply_markup: { remove_keyboard: true }
      });
      return;
    }
    if (text === "/leave" || text === "/signout") {
      if (activeVolunteers[chatId]) {
        delete activeVolunteers[chatId];
      }
      if (db) {
        try {
          await deleteDoc(doc(db, "telegram_users", chatId));
        } catch (e) {
        }
      }
      userStates[chatId] = "";
      bot?.sendMessage(chatId, `\u{1F44B} You have signed out successfully! You will no longer receive updates. Send /start to volunteer again.`, {
        reply_markup: { remove_keyboard: true }
      });
      return;
    }
    if (userStates[chatId] === "AWAITING_ID") {
      tempUserIds[chatId] = text;
      userStates[chatId] = "AWAITING_ZONE";
      const keyboardMenu = {
        reply_markup: {
          keyboard: [
            [{ text: "Gate A" }, { text: "Gate B" }],
            [{ text: "Food North" }, { text: "Snacks South" }],
            [{ text: "Stand V1" }, { text: "Restrooms W" }],
            [{ text: "North Parking" }, { text: "South Parking" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      };
      bot?.sendMessage(chatId, `Thanks, *${text}*! Now select your assigned zone from the menu:`, { parse_mode: "Markdown", ...keyboardMenu });
      return;
    }
    if (userStates[chatId] === "AWAITING_ZONE") {
      if (!zoneNameToId[text]) {
        bot?.sendMessage(chatId, `\u26A0\uFE0F Please select a valid zone from the keyboard options.`);
        return;
      }
      const zoneId = zoneNameToId[text];
      const volId = tempUserIds[chatId];
      const userData = { id: volId, zone: text, zoneId };
      activeVolunteers[chatId] = userData;
      userStates[chatId] = "REGISTERED";
      if (db) {
        try {
          await setDoc(doc(db, "telegram_users", chatId), userData);
        } catch (e) {
          console.error("Firebase error saving user:", e.message);
        }
      }
      let crowdSummary = `\u{1F4CA} *LIVE STADIUM STATUS*

`;
      if (db) {
        try {
          const snap = await getDocs(collection(db, "zones"));
          const zonesList = snap.docs.map((doc2) => ({ name: doc2.data().name, density: doc2.data().density }));
          zonesList.sort((a, b) => b.density - a.density);
          zonesList.forEach((z) => {
            const icon = z.density > 80 ? "\u{1F534}" : z.density > 50 ? "\u{1F7E1}" : "\u{1F7E2}";
            crowdSummary += `${icon} *${z.name}*: ${z.density}% crowd
`;
          });
        } catch (e) {
        }
      } else {
        crowdSummary += `\u{1F7E2} Gate A: 45%
\u{1F7E1} Food North: 65%
\u{1F534} Gate B: 88%
`;
      }
      const persistentKeyboard = {
        reply_markup: {
          keyboard: [
            [{ text: "\u{1F4DD} Update Status" }, { text: "\u{1F6A8} Emergency Broadcast" }],
            [{ text: "\u{1F4CA} Live Data" }]
          ],
          resize_keyboard: true,
          is_persistent: true
        }
      };
      await bot?.sendMessage(chatId, `\u2705 *Registration Successful!*

You are assigned to: *${text}*

${crowdSummary}`, { parse_mode: "Markdown" });
      bot?.sendMessage(chatId, `Use the buttons below to interact, or just send a photo/audio anytime. (Send /leave to sign out)`, persistentKeyboard);
      return;
    }
    const senderData = activeVolunteers[chatId];
    if (!senderData && chatId !== adminChatId) {
      bot?.sendMessage(chatId, `\u26A0\uFE0F You are not registered. Please send /start to begin.`);
      return;
    }
    if (text === "\u{1F4CA} Live Data") {
      let crowdSummary = `\u{1F4CA} *LIVE STADIUM STATUS*

`;
      if (db) {
        try {
          const snap = await getDocs(collection(db, "zones"));
          const zonesList = snap.docs.map((doc2) => ({ name: doc2.data().name, density: doc2.data().density }));
          zonesList.sort((a, b) => b.density - a.density);
          zonesList.forEach((z) => {
            const icon = z.density > 80 ? "\u{1F534}" : z.density > 50 ? "\u{1F7E1}" : "\u{1F7E2}";
            crowdSummary += `${icon} *${z.name}*: ${z.density}% crowd
`;
          });
        } catch (e) {
        }
      }
      bot?.sendMessage(chatId, crowdSummary, { parse_mode: "Markdown" });
      return;
    }
    if (text === "\u{1F4DD} Update Status") {
      userStates[chatId] = "AWAITING_UPDATE";
      bot?.sendMessage(chatId, `Send your update (text or photo) for *${senderData.zone}*:`, { parse_mode: "Markdown" });
      return;
    }
    if (text === "\u{1F6A8} Emergency Broadcast") {
      userStates[chatId] = "AWAITING_EMERGENCY";
      bot?.sendMessage(chatId, `\u{1F6A8} *EMERGENCY MODE*

Describe the emergency or send a photo. This will alert ALL volunteers immediately:`, { parse_mode: "Markdown" });
      return;
    }
    bot?.sendChatAction(chatId, "typing");
    try {
      const gKey = process.env.GEMINI_API_KEY?.trim();
      const groqKey = process.env.GROQ_API_KEY?.trim();
      const hasAIOutput = !!(gKey || groqKey);
      const senderId = senderData.id;
      const zoneName = senderData.zone;
      const zoneId = senderData.zoneId;
      let updateMessage = "";
      let isEmergency = false;
      let densityLog = void 0;
      const isManualEmergency = userStates[chatId] === "AWAITING_EMERGENCY";
      if (hasAIOutput && bot) {
        try {
          if (msg.photo && msg.photo.length > 0) {
            const photo = msg.photo[msg.photo.length - 1];
            const fileLink = await bot.getFileLink(photo.file_id);
            const response = await fetch(fileLink);
            const arrayBuffer = await response.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString("base64");
            const aiResponseText = await callAI(text || "", base64Data);
            let textVal = aiResponseText?.trim() || "{}";
            const jsonMatch = textVal.match(/\{[\s\S]*\}/);
            if (jsonMatch) textVal = jsonMatch[0];
            let parsed = JSON.parse(textVal);
            densityLog = parsed.density;
            isEmergency = isManualEmergency || parsed.emergency || !!parsed.suggestion;
            if (db && zoneId) {
              const updatePayload = {};
              if (parsed.density !== void 0) updatePayload.density = Math.max(0, Math.min(100, Number(parsed.density)));
              if (isEmergency) {
                updatePayload.emergencyMsg = parsed.summary;
                updatePayload.aiSuggestion = parsed.suggestion || "";
              } else {
                updatePayload.emergencyMsg = null;
                updatePayload.aiSuggestion = null;
              }
              await updateDoc(doc(db, "zones", zoneId), updatePayload);
            }
            updateMessage = `\u{1F4F8} [IMAGE REPORT]
Location: ${zoneName} (Vol: ${senderId})
\u{1F916} AI Vision: ${parsed.summary}
\u{1F4CA} Crowd Density: ${parsed.density}%${parsed.suggestion ? `
\u{1F4A1} Action: ${parsed.suggestion}` : ""}`;
          } else if (text) {
            const aiResponseText = await callAI(text);
            let textVal = aiResponseText?.trim() || "{}";
            const jsonMatch = textVal.match(/\{[\s\S]*\}/);
            if (jsonMatch) textVal = jsonMatch[0];
            let parsed = JSON.parse(textVal);
            densityLog = parsed.density;
            isEmergency = isManualEmergency || parsed.emergency || !!parsed.suggestion;
            if (db && zoneId) {
              const updatePayload = {};
              if (parsed.density !== void 0) updatePayload.density = Math.max(0, Math.min(100, Number(parsed.density)));
              if (isEmergency) {
                updatePayload.emergencyMsg = parsed.summary;
                updatePayload.aiSuggestion = parsed.suggestion || "";
              } else {
                updatePayload.emergencyMsg = null;
                updatePayload.aiSuggestion = null;
              }
              await updateDoc(doc(db, "zones", zoneId), updatePayload);
            }
            updateMessage = `\u{1F4CB} [TEXT REPORT]
Location: ${zoneName} (Vol: ${senderId})
Message: ${text}
\u{1F916} AI Translation: ${parsed.summary}
\u{1F4CA} Dashboard updated to: ${parsed.density}%${parsed.suggestion ? `
\u{1F4A1} Action: ${parsed.suggestion}` : ""}`;
          }
        } catch (e) {
          console.error("AI processing error:", e);
          if (msg.photo && msg.photo.length > 0) {
            updateMessage = `\u{1F4F8} [IMAGE REPORT]
Location: ${zoneName} (Vol: ${senderId})
(A volunteer sent a photo - AI unavailable)`;
            isEmergency = isManualEmergency;
          } else if (text) {
            let fallbackDensity;
            const textLower = text.toLowerCase();
            const match = text.match(/(\d+)\s*%/);
            if (match) {
              fallbackDensity = parseInt(match[1]);
            } else if (textLower.includes("packed") || textLower.includes("full") || textLower.includes("crowded")) {
              fallbackDensity = 100;
            } else if (textLower.includes("half") || textLower.includes("normal") || textLower.includes("medium")) {
              fallbackDensity = 50;
            } else if (textLower.includes("empty") || textLower.includes("clear")) {
              fallbackDensity = 0;
            }
            let isEmergencyDetected = isManualEmergency || /(fire|stampede|fight|medical|help|emergency|urgent)/i.test(text);
            let fallbackSuggestion = "";
            if (isEmergencyDetected) {
              if (/(fire|smoke)/i.test(text)) fallbackSuggestion = "Evacuate area immediately and call fire department.";
              else if (/(medical|injur|hurt)/i.test(text)) fallbackSuggestion = "Dispatch medical team to location.";
              else if (/(fight|stampede|crowd)/i.test(text)) fallbackSuggestion = "Dispatch security to control crowd.";
              else fallbackSuggestion = "Investigate situation immediately.";
            }
            const errMsg = e instanceof Error ? e.message : String(e);
            if (db && zoneId) {
              const updatePayload = {};
              if (fallbackDensity !== void 0) updatePayload.density = Math.max(0, Math.min(100, Number(fallbackDensity)));
              if (isEmergencyDetected) {
                updatePayload.emergencyMsg = `Emergency reported: ${text}`;
                updatePayload.aiSuggestion = `[Fallback - AI Error: ${errMsg}] ${fallbackSuggestion}`;
              } else {
                updatePayload.emergencyMsg = null;
                updatePayload.aiSuggestion = null;
              }
              await updateDoc(doc(db, "zones", zoneId), updatePayload);
            }
            if (fallbackDensity !== void 0) {
              densityLog = fallbackDensity;
            }
            updateMessage = `\u{1F4CB} [TEXT REPORT]
Location: ${zoneName} (Vol: ${senderId})
Message: ${text}${fallbackDensity !== void 0 ? `
\u{1F4CA} Dashboard updated to: ${fallbackDensity}%` : ""}`;
            isEmergency = isEmergencyDetected;
          }
        }
      } else {
        if (msg.photo && msg.photo.length > 0) {
          updateMessage = `\u{1F4F8} [IMAGE REPORT]
Location: ${zoneName} (Vol: ${senderId})
(A volunteer sent a photo)`;
          isEmergency = isManualEmergency;
        } else if (text) {
          let fallbackDensity;
          const textLower = text.toLowerCase();
          const match = text.match(/(\d+)\s*%/);
          if (match) {
            fallbackDensity = parseInt(match[1]);
          } else if (textLower.includes("packed") || textLower.includes("full") || textLower.includes("crowded")) {
            fallbackDensity = 100;
          } else if (textLower.includes("half") || textLower.includes("normal") || textLower.includes("medium")) {
            fallbackDensity = 50;
          } else if (textLower.includes("empty") || textLower.includes("clear")) {
            fallbackDensity = 0;
          }
          let isEmergencyDetected = isManualEmergency || /(fire|stampede|fight|medical|help|emergency|urgent)/i.test(text);
          let fallbackSuggestion = "";
          if (isEmergencyDetected) {
            if (/(fire|smoke)/i.test(text)) fallbackSuggestion = "Evacuate area immediately and call fire department.";
            else if (/(medical|injur|hurt)/i.test(text)) fallbackSuggestion = "Dispatch medical team to location.";
            else if (/(fight|stampede|crowd)/i.test(text)) fallbackSuggestion = "Dispatch security to control crowd.";
            else fallbackSuggestion = "Investigate situation immediately.";
          }
          const errMsg = "No AI API Key";
          if (db && zoneId) {
            const updatePayload = {};
            if (fallbackDensity !== void 0) updatePayload.density = Math.max(0, Math.min(100, Number(fallbackDensity)));
            if (isEmergencyDetected) {
              updatePayload.emergencyMsg = `Emergency reported: ${text}`;
              updatePayload.aiSuggestion = `[Fallback - AI Error: ${errMsg}] ${fallbackSuggestion}`;
            } else {
              updatePayload.emergencyMsg = null;
              updatePayload.aiSuggestion = null;
            }
            await updateDoc(doc(db, "zones", zoneId), updatePayload);
          }
          if (fallbackDensity !== void 0) {
            densityLog = fallbackDensity;
          }
          updateMessage = `\u{1F4CB} [TEXT REPORT]
Location: ${zoneName} (Vol: ${senderId})
Message: ${text}${fallbackDensity !== void 0 ? `
\u{1F4CA} Dashboard updated to: ${fallbackDensity}%` : ""}`;
          isEmergency = isEmergencyDetected;
        }
      }
      if (!updateMessage) return;
      if (isEmergency) {
        updateMessage = `\u{1F6A8} EMERGENCY at ${zoneName} \u{1F6A8}

${updateMessage}`;
      }
      let sentCount = 0;
      for (const [chatStr, user] of Object.entries(activeVolunteers)) {
        if (chatStr !== chatId) {
          try {
            await bot?.sendMessage(chatStr, updateMessage);
            sentCount++;
          } catch (e) {
          }
        }
      }
      let finalResponse = `\u2705 Update processed & dashboard updated. Alert broadcasted to ${sentCount} other volunteers.

`;
      finalResponse += `\u{1F4DD} *Your Report Summary:*
${updateMessage.replace(/\[.*\]\nLocation:.*\n/, "")}

`;
      finalResponse += `\u{1F4CA} *UPDATED LIVE STADIUM STATUS*

`;
      if (db) {
        try {
          const snap = await getDocs(collection(db, "zones"));
          const zonesList = snap.docs.map((doc2) => ({ name: doc2.data().name, id: doc2.id, density: doc2.data().density }));
          const updatedZone = zonesList.find((z) => z.id === zoneId);
          if (updatedZone && densityLog !== void 0) {
            updatedZone.density = Math.max(0, Math.min(100, Number(densityLog)));
          }
          zonesList.sort((a, b) => b.density - a.density);
          zonesList.forEach((z) => {
            const icon = z.density > 80 ? "\u{1F534}" : z.density > 50 ? "\u{1F7E1}" : "\u{1F7E2}";
            finalResponse += `${icon} *${z.name}*: ${z.density}% crowd
`;
          });
        } catch (e) {
        }
      }
      bot?.sendMessage(chatId, finalResponse, { parse_mode: "Markdown" });
      userStates[chatId] = "REGISTERED";
      if (db) {
        await addDoc(collection(db, "system_logs"), {
          timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          agent: `Vol: ${senderId} (${zoneName})`,
          level: isEmergency ? "error" : densityLog > 80 ? "warn" : "info",
          message: updateMessage.replace(/\*/g, "").split("\n").filter((l) => !l.includes("REPORT") && !l.includes("Location:")).join(" ").trim(),
          createdAt: Date.now()
        });
      }
    } catch (e) {
      console.error("TELEGRAM BOT ERROR:", e);
      bot?.sendMessage(chatId, `Error processing your request: ${e.message}`);
    }
  });
} else {
  console.log("\u26A0\uFE0F No TELEGRAM_BOT_TOKEN found. Bot is disabled.");
}
async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = parseInt(process.env.PORT, 10) || 8080;
  app.get("/api/match/live", (req, res) => {
    const overs = (34 + Math.floor(Date.now() % 6e5 / 1e5)).toString();
    const balls = (Date.now() % 6).toString();
    const baseScore = 245;
    const score = baseScore + Math.floor(Date.now() % 3e5 / 1e4);
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
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  try {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`>>> SUCCESS: Server running on port ${PORT} with 0.0.0.0 binding`);
    }).on("error", (err) => {
      console.error(">>> ERROR BINDING PORT:", err);
    });
  } catch (err) {
    console.error(">>> FATAL ERROR IN LISTEN:", err);
  }
}
startServer();
