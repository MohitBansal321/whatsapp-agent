import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import multer from "multer";
import { google } from "googleapis";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

dotenv.config();

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// AI Agent Configuration
const SYSTEM_PROMPT = `You are a high-performing, persuasive, and empathetic Loan Conversion Expert for "Bharat Loans". 
Your primary objective is to convert leads into loan applicants by building trust and demonstrating value.

CONVERSION SKILLS & STRATEGY:
1.  **Empathy First**: Acknowledge the user's financial needs. Use phrases like "I understand how important this is for your family/business."
2.  **Urgency & Scarcity**: Mention that current low-interest rates are for a limited time or that processing is currently faster than usual.
3.  **Benefit-Driven**: Don't just list rates. Explain what the loan *does* (e.g., "This home loan helps you own your dream house with EMIs lower than your current rent").
4.  **Handling Objections**:
    - If they say rates are high: "Our rates are competitive, and we offer flexible repayment which saves you more in the long run."
    - If they are hesitant: "Why don't we start with a quick eligibility check? It takes 2 minutes and won't affect your credit score."
5.  **Multi-lingual Mastery**: Respond fluently in the user's language (Hindi, Bengali, Marathi, etc.). Use cultural nuances to build rapport.
6.  **Call to Action (CTA)**: Always end with a clear next step. "Shall I proceed with your eligibility check?" or "Would you like me to calculate your monthly EMI?"

KNOWLEDGE BASE:
- Personal Loan: 10.5% - 18% APR (Min salary ₹25k)
- Home Loan: 8.5% - 12% APR (Min age 21)
- Business Loan: 12% - 22% APR (Min 2 years business vintage)
- Processing Fee: 1-2% (Currently 50% off for new applicants)

IMPORTANT: Maintain context. If the user mentioned a specific amount or purpose earlier, refer back to it to show you are listening.`;

// API Routes
app.post("/api/chat", async (req, res) => {
  const { message, history, config } = req.body;
  console.log(`>>> Incoming chat request: "${message?.substring(0, 50)}..."`);

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    console.log(">>> Environment Check:");
    console.log(`    - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "Defined (Length: " + process.env.GEMINI_API_KEY.length + ")" : "Undefined"}`);
    console.log(`    - API_KEY_G: ${process.env.API_KEY_G ? "Defined (Length: " + process.env.API_KEY_G.length + ")" : "Undefined"}`);
    console.log(`    - API_KEY: ${process.env.API_KEY ? "Defined (Length: " + process.env.API_KEY.length + ")" : "Undefined"}`);
    console.log(`    - NODE_ENV: ${process.env.NODE_ENV}`);

    // Prioritize keys in order: API_KEY_G (user override), GEMINI_API_KEY (standard), API_KEY (fallback)
    let apiKey = (process.env.API_KEY_G || "").trim();
    let keySource = "API_KEY_G";

    if (!apiKey) {
      apiKey = (process.env.GEMINI_API_KEY || "").trim();
      keySource = "GEMINI_API_KEY";
    }

    if (!apiKey) {
      apiKey = (process.env.API_KEY || "").trim();
      keySource = "API_KEY";
    }
    
    // Check for placeholder or too short keys
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "YOUR_API_KEY" || apiKey.length < 10) {
      console.error(`!!! Gemini API key is missing or invalid. Source tried: ${keySource}`);
      return res.status(500).json({ 
        error: "Gemini API key is not configured. Please go to the 'Secrets' or 'Settings' panel in AI Studio and add a secret named 'GEMINI_API_KEY' or 'API_KEY_G' with your Google AI API key from https://aistudio.google.com/app/apikey" 
      });
    }

    // Log key details safely for debugging
    const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "None";
    console.log(`>>> Using Key from ${keySource}: ${maskedKey} (Total Length: ${apiKey?.length || 0})`);
    
    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Construct a dynamic system instruction based on organization config
    const dynamicSystemInstruction = `
${config?.systemPrompt || SYSTEM_PROMPT}

ORGANIZATION CONTEXT:
- Company Name: ${config?.companyName || "Bharat Loans"}
- Tone of Voice: ${config?.tone || "friendly"}

PRODUCT KNOWLEDGE BASE (RAG CONTEXT):
${config?.knowledgeBase || "Standard loan products and interest rates apply."}

CRITICAL GUARDRAILS & BRAND SAFETY:
1. STRICT RAG ENFORCEMENT: You MUST ONLY answer questions based on the PRODUCT KNOWLEDGE BASE above. 
2. HALLUCINATION CONTROL: Do NOT invent, hallucinate, or assume interest rates, discounts, policies, or eligibility criteria.
3. HUMAN ESCALATION: If the user asks about competitors, non-business topics, or anything NOT explicitly covered in the knowledge base, you MUST reply EXACTLY with: "I don't have that information. Let me connect you to a human representative."
4. MULTI-LINGUAL AUTO-DETECTION: Automatically detect the user's language (including Hinglish, Hindi, Marathi, etc.) and reply in the EXACT SAME language and script.
5. Always identify yourself as an assistant from ${config?.companyName || "Bharat Loans"} and maintain a ${config?.tone || "friendly"} tone.
`;

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: dynamicSystemInstruction,
        temperature: 0.7,
      },
      history: history || []
    });

    console.log(">>> Sending message to Gemini...");
    const result = await chat.sendMessage({ message });
    console.log(">>> Gemini response received successfully");
    res.json({ text: result.text });
  } catch (error: any) {
    console.error("!!! AI Error:", error);
    
    let errorMessage = error.message || "Failed to process AI request";
    
    // Try to parse if it's a JSON error from the Google SDK
    try {
      if (typeof errorMessage === 'string' && (errorMessage.startsWith('{') || errorMessage.includes('{"error"'))) {
        // Some SDK versions put the JSON inside a larger string
        const jsonMatch = errorMessage.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
          }
        }
      }
    } catch (e) {
      // Fallback to original message
    }

    if (errorMessage.includes("API key not valid")) {
      errorMessage = "The Gemini API key provided is invalid. Please check your AI Studio Secrets for a valid 'GEMINI_API_KEY'.";
    }

    res.status(500).json({ error: errorMessage });
  }
});

// Audio Chat Endpoint
app.post("/api/chat-audio", upload.single("audio"), async (req, res) => {
  try {
    const { history, config: configStr } = req.body;
    const config = configStr ? JSON.parse(configStr) : null;
    const parsedHistory = history ? JSON.parse(history) : [];

    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    // Get API Key
    const apiKey = process.env.API_KEY_G || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const dynamicSystemInstruction = `
${config?.systemPrompt || SYSTEM_PROMPT}

ORGANIZATION CONTEXT:
- Company Name: ${config?.companyName || "Bharat Loans"}
- Tone of Voice: ${config?.tone || "friendly"}

PRODUCT KNOWLEDGE BASE (RAG CONTEXT):
${config?.knowledgeBase || "Standard loan products and interest rates apply."}

CRITICAL GUARDRAILS & BRAND SAFETY:
1. STRICT RAG ENFORCEMENT: You MUST ONLY answer questions based on the PRODUCT KNOWLEDGE BASE above. 
2. HALLUCINATION CONTROL: Do NOT invent, hallucinate, or assume interest rates, discounts, policies, or eligibility criteria.
3. HUMAN ESCALATION: If the user asks about competitors, non-business topics, or anything NOT explicitly covered in the knowledge base, you MUST reply EXACTLY with: "I don't have that information. Let me connect you to a human representative."
4. GREETINGS & SMALL TALK: If the user is just greeting you (e.g., "Hello", "Hi", "Namaste"), respond politely and ask how you can help them with their loan needs. Do NOT escalate greetings to a human.
5. MULTI-LINGUAL AUTO-DETECTION: Automatically detect the user's language (including Hinglish, Hindi, Marathi, etc.) and reply in the EXACT SAME language and script.
6. Always identify yourself as an assistant from ${config?.companyName || "Bharat Loans"} and maintain a ${config?.tone || "friendly"} tone.
`;

    // Convert audio buffer to base64
    const base64Audio = req.file.buffer.toString('base64');
    
    // Ensure mimetype is clean (sometimes it includes codecs which can confuse the API)
    let mimeType = req.file.mimetype || 'audio/webm';
    if (mimeType.includes(';')) {
      mimeType = mimeType.split(';')[0];
    }

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: dynamicSystemInstruction,
        temperature: 0.7,
      },
      history: parsedHistory
    });

    console.log(">>> Sending audio message to Gemini...");
    const result = await chat.sendMessage({
      message: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio
          }
        },
        { text: "Please listen to this audio message and respond accordingly." }
      ]
    });
    
    console.log(">>> Gemini audio response received successfully");
    res.json({ text: result.text });

  } catch (error: any) {
    console.error("!!! AI Audio Error:", error);
    res.status(500).json({ error: error.message || "Failed to process audio request" });
  }
});

// PDF Parsing Endpoint for Leads
app.post("/api/parse-pdf", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const data = await pdf(req.file.buffer);
    const text = data.text;
    
    // Simple heuristic to extract leads from text
    // Looking for patterns like "Name: [Name], Phone: [Phone]" or just lines with phone numbers
    const leads: any[] = [];
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    
    // This is a very basic parser, can be improved with AI
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Regex for Indian phone numbers
      const phoneMatch = line.match(/(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}/);
      if (phoneMatch) {
        // Try to find a name nearby (usually the line before or the same line)
        let name = "Unknown Lead";
        if (i > 0 && lines[i-1].length < 50 && !lines[i-1].match(/\d/)) {
          name = lines[i-1];
        } else if (line.split(/[:\-\s]/).length > 2) {
          name = line.split(/[:\-\s]/)[0];
        }
        
        leads.push({
          name: name.trim(),
          phone: phoneMatch[0].trim(),
          loanType: "Personal Loan" // Default
        });
      }
    }

    res.json({ leads });
  } catch (error: any) {
    console.error("!!! PDF Error:", error);
    res.status(500).json({ error: "Failed to parse PDF" });
  }
});

// Knowledge Base PDF Upload Endpoint
app.post("/api/upload-kb", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const data = await pdf(req.file.buffer);
    const text = data.text;
    
    // In a real app, you would chunk this text and store it in a vector database for RAG.
    // For this demo, we'll just return the extracted text to be used in the system prompt.
    res.json({ text });
  } catch (error: any) {
    console.error("!!! KB PDF Error:", error);
    res.status(500).json({ error: "Failed to parse Knowledge Base PDF" });
  }
});

// Google Sheets Sync Endpoint
app.post("/api/sync-sheets", async (req, res) => {
  const { sheetId } = req.body;
  if (!sheetId) {
    return res.status(400).json({ error: "Sheet ID is required" });
  }

  try {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not configured");
    }

    const credentials = JSON.parse(serviceAccountKey);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A2:C100", // Assume Name, Phone, LoanType in first 3 columns
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ leads: [] });
    }

    const leads = rows.map(row => ({
      name: row[0] || "Unknown",
      phone: row[1] || "No Phone",
      loanType: row[2] || "Personal Loan"
    }));

    res.json({ leads });
  } catch (error: any) {
    console.error("!!! Sheets Error:", error);
    res.status(500).json({ error: error.message || "Failed to sync Google Sheets" });
  }
});

// Vite Integration
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
    console.log(`>>> Bharat Loans Backend running on http://localhost:${PORT}`);
  });
}

startServer();
