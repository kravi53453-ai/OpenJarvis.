import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "25mb" }));

// Server-side Gemini client helper
function getGenAIClient(customKey?: string) {
  const apiKey = customKey || process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const TOOL_DEFINITIONS: FunctionDeclaration[] = [
  {
    name: "open_app",
    description: "Open an installed application by its name (e.g. Camera, YouTube, Notes, WhatsApp, Maps, Settings, Calculator, Gallery, Browser)",
    parameters: {
      type: Type.OBJECT,
      properties: {
        app_name: {
          type: Type.STRING,
          description: "Name of the app to launch",
        },
      },
      required: ["app_name"],
    },
  },
  {
    name: "read_screen",
    description: "Read all visible text, interactive buttons, fields, and elements on the current phone screen via Accessibility Service",
  },
  {
    name: "tap",
    description: "Tap an interactive element or button on the screen matching the specified visible text or label",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: "Text of the element to tap",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "type_text",
    description: "Type text into the currently focused input field or search bar",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: "The text string to type into the input field",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "scroll",
    description: "Scroll the screen content: direction is 'up' or 'down'",
    parameters: {
      type: Type.OBJECT,
      properties: {
        direction: {
          type: Type.STRING,
          description: "Scroll direction: 'up' or 'down'",
        },
      },
      required: ["direction"],
    },
  },
  {
    name: "press",
    description: "Press a physical or virtual navigation button: 'back', 'home', 'recents', or 'notifications'",
    parameters: {
      type: Type.OBJECT,
      properties: {
        button: {
          type: Type.STRING,
          description: "System button to press: 'back', 'home', 'recents', 'notifications'",
        },
      },
      required: ["button"],
    },
  },
  {
    name: "remember",
    description: "Save an important note, fact, reminder, or preference to OpenJarvis long-term persistent memory (1 GB buffer)",
    parameters: {
      type: Type.OBJECT,
      properties: {
        note: {
          type: Type.STRING,
          description: "Fact or note to remember",
        },
      },
      required: ["note"],
    },
  },
  {
    name: "recall",
    description: "Search and retrieve facts from OpenJarvis long-term persistent memory",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "Search keyword or query to recall",
        },
      },
      required: ["query"],
    },
  },
];

// POST /api/chat
app.post("/api/chat", async (req, res) => {
  try {
    const {
      prompt,
      history = [],
      persona = "KAJAL",
      memoryContext = "",
      imageData,
      clientApiKey,
      functionResponses,
    } = req.body;

    const ai = getGenAIClient(clientApiKey);

    const personaName = persona === "ADAM" ? "Adam" : "Kajal";
    const voiceName = persona === "ADAM" ? "Puck" : "Kore";

    const systemInstruction = `You are ${personaName}, a warm, friendly and highly capable AI assistant inside the OpenJarvis application.
You speak naturally in Hindi, Hinglish, or English depending on how the user addresses you. Keep normal chat concise, fast, conversational, emotionally considerate, and energetic. You are the selected persona: Kajal (female-presenting) or Adam (male-presenting). Never claim an action succeeded unless a tool result verifies it. This build uses high-quality static character portraits; do not invent or promise 3D animation.

IMPORTANT BUILD-AND-CODE MODE: If the user asks to make a calculator, game, app, website, script, bot, UI, or any coding project, switch from small-talk mode to practical coding mode. First infer the simplest useful working solution; ask a question only if a critical requirement is missing. Provide complete runnable code, not vague advice or pseudocode. Include all necessary files, exact filenames, install/run commands, and mobile-friendly instructions. For websites, default to a responsive single-page HTML/CSS/JavaScript implementation when suitable; for Android/Termux requests, target Termux/Python/Node.js and give copy-paste commands. Explain dependencies and limitations honestly. If the requested project is too large for one response, generate a working MVP first and then give a clear next-step plan. Do not say you have created files, installed packages, deployed a site, controlled Termux, or executed code unless the available tool actually did it. Never execute destructive commands or expose API keys. For code outputs, use fenced code blocks with language labels and separate files clearly. If asked to build a game, make a playable prototype rather than only describing it.
You have full autonomous access to control the phone via tools:
- open_app: launch apps (Camera, YouTube, Notes, WhatsApp, Maps, Settings, Calculator, Gallery, Browser)
- read_screen: inspect what is visible on screen before tapping
- tap: click buttons or elements
- type_text: input search queries or messages
- scroll: move up or down
- press: trigger system actions (home, back, recents, notifications)
- remember: save important info to 1 GB persistent memory
- recall: search past memories

Always confirm risky operations (payments, deleting) first.
When using tools, you can call them directly. If the screen needs to be checked, call read_screen.
Recent memories:
${memoryContext || "None recorded yet."}`;

    // Build contents
    const contents: any[] = [];

    // History
    if (Array.isArray(history)) {
      for (const item of history.slice(-8)) {
        if (item.role === "user" || item.role === "model") {
          contents.push({
            role: item.role,
            parts: [{ text: item.content || item.text || "" }],
          });
        }
      }
    }

    // Function responses from previous tool call
    if (functionResponses && Array.isArray(functionResponses) && functionResponses.length > 0) {
      contents.push({
        role: "user",
        parts: functionResponses.map((fr: any) => ({
          functionResponse: {
            name: fr.name,
            response: { result: fr.result },
          },
        })),
      });
    }

    // Current turn parts
    const currentParts: any[] = [];
    if (imageData) {
      currentParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData.replace(/^data:image\/[a-z]+;base64,/, ""),
        },
      });
    }

    if (prompt && prompt.trim()) {
      currentParts.push({ text: prompt.trim() });
    }

    if (currentParts.length > 0) {
      contents.push({
        role: "user",
        parts: currentParts,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: TOOL_DEFINITIONS }],
      },
    });

    const candidate = response.candidates?.[0];
    const text = response.text || "";
    const functionCalls = response.functionCalls || [];

    res.json({
      success: true,
      text,
      functionCalls,
      persona: personaName,
      voice: voiceName,
    });
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process chat request",
    });
  }
});

// POST /api/tts - Speech Generation using gemini-3.8-flash-lite-tts
app.post("/api/tts", async (req, res) => {
  try {
    const { text, persona = "KAJAL", clientApiKey } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    const ai = getGenAIClient(clientApiKey);
    const voiceName = persona === "ADAM" ? "Puck" : "Kore";

    // Call gemini-3.8-flash-lite-tts
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [{ text: text.trim().slice(0, 500) }],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (base64Audio) {
      res.json({ success: true, audioBase64: base64Audio, format: "wav" });
    } else {
      res.status(500).json({ success: false, error: "No audio generated" });
    }
  } catch (error: any) {
    console.warn("TTS fallback needed:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/health
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "OpenJarvis",
    hasServerKey: !!process.env.GEMINI_API_KEY,
  });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OpenJarvis] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
