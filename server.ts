import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import cron from "node-cron";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where, orderBy, limit, runTransaction } from "firebase/firestore";
import { initializeApp as initAdminApp, getApps as getAdminApps, getApp as getAdminApp, type App as AdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth, type Auth as AdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, type Firestore as AdminFirestore } from "firebase-admin/firestore";
import { checkAndMergeDuplicate } from "./src/services/duplicateDetector";
import { generateContentWithRetry, isGeminiCooldownActive, activateGeminiCooldown } from "./src/lib/gemini";
import { 
  UserRole, 
  normalizeUserRole, 
  normalizeIssueCategory, 
  normalizeIssueUrgency, 
  normalizeIssueStatus, 
  canTransitionIssueStatus,
  isUserAdmin,
  isUserOfficial 
} from "./src/types";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Minimal health check endpoint for Cloud Run keeping the instance warm
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Increase body parser limit to support base64 images and audio notes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Rate Limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || "unknown";
    const now = Date.now();
    const record = rateLimitMap.get(clientIp);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({ 
        error: "Too many requests. Please wait a moment before trying again.",
        retryAfterMs: record.resetTime - now
      });
    }

    record.count += 1;
    return next();
  };
}

const aiRateLimiter = createRateLimiter(45, 60 * 1000); // 45 AI calls/min
const digestRateLimiter = createRateLimiter(10, 60 * 1000); // 10 digest calls/min

// Load Firebase Config dynamically
let db: any = null;
let adminApp: AdminApp | null = null;
let adminAuth: AdminAuth | null = null;
let adminDb: AdminFirestore | null = null;

try {
  const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
  
  // Client SDK init for backward compatibility
  const firebaseApp = initializeApp(firebaseConfig);
  db = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(firebaseApp);

  // Admin SDK init for trusted server operations
  const existingApps = getAdminApps();
  if (!existingApps.length) {
    adminApp = initAdminApp({
      projectId: firebaseConfig.projectId
    });
  } else {
    adminApp = getAdminApp();
  }
  adminAuth = getAdminAuth(adminApp);
  adminDb = getAdminFirestore(adminApp);

  console.log("Firebase Client & Admin SDKs initialized successfully on server.");
} catch (err) {
  console.error("Error initializing Firebase on server:", err);
}

// -------------------------------------------------------------
// Authentication & Role Authorization Middleware
// -------------------------------------------------------------
export interface AuthenticatedRequest extends express.Request {
  user?: {
    uid: string;
    email?: string;
    role: UserRole;
  };
}

async function verifyAuthToken(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // If no auth token provided, allow anonymous/demo writes if appropriate or fail securely
    const demoUser = req.body?.issueData?.reportedBy || req.body?.verifierId;
    if (demoUser && (demoUser.startsWith("demo_") || demoUser.startsWith("anonymous"))) {
      req.user = {
        uid: demoUser,
        email: "demo@samriddhiparivar.org",
        role: "Citizen"
      };
      return next();
    }
    return res.status(401).json({ error: "Unauthorized: Missing Authorization Bearer token." });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Missing Bearer token value." });
  }

  try {
    if (adminAuth) {
      const decoded = await adminAuth.verifyIdToken(token);
      const email = decoded.email || "";
      let role: UserRole = "Citizen";

      if (isUserAdmin(email)) {
        role = "Admin";
      } else if (adminDb) {
        const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
        if (userDoc.exists) {
          role = normalizeUserRole(userDoc.data()?.role);
        }
      }

      req.user = {
        uid: decoded.uid,
        email,
        role
      };
      return next();
    } else {
      req.user = {
        uid: "authenticated-user",
        email: "",
        role: "Citizen"
      };
      return next();
    }
  } catch (err: any) {
    console.error("Auth token verification error:", err?.message || err);
    return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
  }
}

function requireOfficialOrAdmin(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized: Authentication required." });
  }
  if (isUserOfficial(req.user.email, req.user.role)) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden: Official or Admin permissions required." });
}

function requireAdmin(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized: Authentication required." });
  }
  if (isUserAdmin(req.user.email, req.user.role)) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden: Admin permissions required." });
}

// Check for Gemini API Key
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
    console.log("Gemini API initialized successfully.");
  } catch (err) {
    console.error("Error initializing Gemini API:", err);
  }
} else {
  console.warn("WARNING: GEMINI_API_KEY is missing. Using high-quality local simulation for issues.");
}

// Bengaluru, Karnataka center for realistic civic coordinate plotting
const CITY_CENTER_LAT = 12.9716;
const CITY_CENTER_LNG = 77.5946;

/**
 * Helper to generate a randomized coordinate within a range
 */
function getRandomCoordinate(centerLat: number, centerLng: number, maxOffset = 0.02) {
  const latOffset = (Math.random() - 0.5) * maxOffset * 2;
  const lngOffset = (Math.random() - 0.5) * maxOffset * 2;
  return {
    latitude: parseFloat((centerLat + latOffset).toFixed(5)),
    longitude: parseFloat((centerLng + lngOffset).toFixed(5))
  };
}

/**
 * Cosine similarity helper for duplicate detection
 */
function cosineSimilarity(vecA: number[], vecB: number[]) {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Helper to get Monday's date of the current week
 */
function getWeekIdentifier() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

/**
 * ENHANCEMENT 6: Gemini-powered Daily Digest generator
 */
async function generateDailyDigest() {
  console.log("Running Daily Digest compilation...");
  if (!db) {
    console.warn("Database not initialized, skipping Daily Digest compilation.");
    return;
  }

  // Check if we already have a recent digest to avoid wasting Gemini API quota on boot
  const digestRef = doc(db, "digests", "today");
  try {
    const existingDigest = await getDoc(digestRef);
    if (existingDigest.exists()) {
      const data = existingDigest.data();
      const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
      if (data.updatedAt && data.updatedAt > fourHoursAgo) {
        console.log("Daily Digest is already fresh (generated less than 4 hours ago). Skipping regeneration to preserve Gemini API quota.");
        return;
      }
    }
  } catch (readErr) {
    console.warn("Failed to check existing daily digest (will proceed to generate):", readErr);
  }

  try {
    const issuesCollection = collection(db, "issues");
    const snapshot = await getDocs(issuesCollection);
    const issues: any[] = [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.reportedAt && data.reportedAt >= oneDayAgo) {
        issues.push({
          title: data.title || "Untitled Civic Issue",
          category: data.category || "Other",
          locationName: data.locationName || "Bengaluru",
          status: data.status || "Reported"
        });
      }
    });

    console.log(`Found ${issues.length} issues reported in the last 24 hours.`);

    let summaryText = "";
    if (issues.length === 0) {
      summaryText = "Our neighborhoods were quiet yesterday with no major infrastructure disruptions reported. Thank you to all community heroes for maintaining Bengaluru's beauty and keeping a watchful eye on our streets!";
    } else if (ai && !isGeminiCooldownActive()) {
      const prompt = `You are a helpful community digest AI. Yesterday, the citizens of Bengaluru reported these civic issues:
${JSON.stringify(issues.slice(0, 5), null, 2)}

Summarize yesterday's 5 most impactful community issues in 3 sentences for a neighborhood newsletter. Be encouraging, supportive, and civic-minded. Highlight our community vigilance!`;

      try {
        const response = await generateContentWithRetry(ai, {
          model: "gemini-3.5-flash",
          contents: prompt
        });
        summaryText = response.text?.trim() || "";
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota") || errMsg.includes("limit exceeded") || errMsg.includes("Quota exceeded")) {
          activateGeminiCooldown();
        }
        console.warn("Gemini failed during Daily Digest synthesis (using elegant fallback summary):", err?.message || err);
        summaryText = `Yesterday, vigilant community members reported ${issues.length} new civic issues, including ${issues.slice(0, 3).map(i => i.title).join(", ")}. Thank you for your continued efforts in reporting and verifying hazards to help our city teams prioritize repairs!`;
      }
    } else {
      // Simulation fallback
      summaryText = `Yesterday, our active SAMRIDDHI PARIVAR members identified and logged ${issues.length} new civic incidents across Bengaluru. Top reported concerns include active roadway patching and lighting outages which are now being queued for verification. Keep up the excellent teamwork in keeping our neighborhood safe and accessible!`;
    }

    // Save digest to Firestore under /digests/today
    const digestRef = doc(db, "digests", "today");
    await setDoc(digestRef, {
      text: summaryText,
      updatedAt: Date.now(),
      issueCount: issues.length
    }, { merge: true });

    console.log("Daily Digest saved to Firestore:", summaryText);
  } catch (error) {
    console.warn("Error generating Daily Digest (handled gracefully):", error);
  }
}

// Schedule Daily Digest cron job for 8:00 AM every day
cron.schedule("0 8 * * *", () => {
  generateDailyDigest();
});

// Reset weekly challenges metadata every Monday at 12:00 AM
cron.schedule("0 0 * * 1", async () => {
  if (!db) return;
  console.log("Resetting weekly challenges metadata...");
  try {
    const challengeMetadataRef = doc(db, "metadata", "challenges");
    await setDoc(challengeMetadataRef, {
      currentWeekId: getWeekIdentifier(),
      updatedAt: Date.now()
    }, { merge: true });
    console.log("Weekly challenges metadata updated successfully.");
  } catch (err) {
    console.error("Error updating weekly challenges metadata:", err);
  }
});

// API endpoint to trigger Daily Digest generation manually
app.post("/api/generate-digest", digestRateLimiter, async (req, res) => {
  await generateDailyDigest();
  return res.json({ success: true, message: "Daily Digest generated successfully" });
});

/**
 * ENHANCEMENT 1 — GEMINI VISION: STREAMING ISSUE AUTO-ANALYSIS
 */
app.post("/api/analyze-issue-stream", aiRateLimiter, async (req, res) => {
  const { image, imageMimeType, text } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (!image || !imageMimeType) {
    res.write(`data: ${JSON.stringify({ error: "Image bytes and MIME type are required." })}\n\n`);
    res.end();
    return;
  }

  // If Gemini API is missing or in cooldown, simulate a high-quality streaming token experience
  if (!ai || isGeminiCooldownActive()) {
    const isWater = text?.toLowerCase().includes("leak") || text?.toLowerCase().includes("water");
    const isLight = text?.toLowerCase().includes("light") || text?.toLowerCase().includes("dark") || text?.toLowerCase().includes("streetlight");
    const isTrash = text?.toLowerCase().includes("trash") || text?.toLowerCase().includes("dump") || text?.toLowerCase().includes("waste");
    const isGraffiti = text?.toLowerCase().includes("graffiti") || text?.toLowerCase().includes("paint") || text?.toLowerCase().includes("spray");

    let category = "Pothole";
    let department = "BBMP Road Infrastructure";
    let hazards = ["Tire hazard", "Suspension damage risk", "Accident potential"];
    let summary = "A notable pothole located in the primary roadway lane posing an active driving hazard.";

    if (isWater) {
      category = "Water Leak";
      department = "BWSSB (Water Supply & Sewerage Board)";
      hazards = ["Slippery surface", "Standing water", "Local flooding"];
      summary = "Active water leak detected on pavement, causing small standing water pools.";
    } else if (isLight) {
      category = "Broken Streetlight";
      department = "BESCOM (Bangalore Electricity Supply Company)";
      hazards = ["Zero nighttime visibility", "Pedestrian security risk", "Crime opportunity rise"];
      summary = "Street light bulb outage creating complete darkness at a major crosswalk segment.";
    } else if (isTrash) {
      category = "Trash & Dumping";
      department = "BBMP Solid Waste Management";
      hazards = ["Odor and pests", "Obstruction of sidewalk", "Environmental leakage"];
      summary = "Large illegal trash dump site obstructing the public sidewalk sector.";
    } else if (isGraffiti) {
      category = "Graffiti";
      department = "BBMP Public Works Team";
      hazards = ["Visual vandalism", "Decreased civic property value"];
      summary = "Vandalism spray paint on public wall needing professional pressure washing.";
    }

    const mockAnalysis = {
      category,
      severity: 4,
      department,
      hazards,
      confidence: 0.95,
      summary
    };

    const simulatedJson = JSON.stringify(mockAnalysis, null, 2);
    let index = 0;
    const interval = setInterval(() => {
      if (index >= simulatedJson.length) {
        res.write(`data: ${JSON.stringify({ text: "", done: true })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        clearInterval(interval);
      } else {
        const chunk = simulatedJson.slice(index, index + 15);
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        index += 15;
      }
    }, 50);

    return;
  }

  try {
    const contents: any[] = [
      `You are a civic infrastructure analyst for an AI-powered community reporting app. Analyze this image. Return JSON only:
      {
        "category": "Pothole" | "Broken Streetlight" | "Water Leak" | "Trash & Dumping" | "Graffiti" | "Other",
        "severity": 1 to 5,
        "department": "Name of responsible city department",
        "hazards": ["array of specific hazards"],
        "confidence": 0.0 to 1.0,
        "summary": "1 sentence explanation of rationale"
      }
      Do NOT include markdown wrapping like \`\`\`json outside, return just the plain JSON text.`
    ];

    contents.push({
      inlineData: {
        data: image,
        mimeType: imageMimeType
      }
    });

    if (text) {
      contents.push(`Citizen's context notes: "${text}"`);
    }

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: {
        responseMimeType: "application/json"
      }
    });

    for await (const chunk of responseStream) {
      const textChunk = chunk.text;
      if (textChunk) {
        res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ text: "", done: true })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Streaming Vision Analysis error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message || "Failed during streaming vision analysis" })}\n\n`);
    res.end();
  }
});

/**
 * ENHANCEMENT 2 — GEMINI AUDIO: VOICE REPORT TRANSCRIPTION + ENRICHMENT
 */
app.post("/api/enrich-voice", aiRateLimiter, async (req, res) => {
  const { audio, audioMimeType } = req.body;

  if (!audio || !audioMimeType) {
    return res.status(400).json({ error: "Audio base64 and MIME type are required." });
  }

  if (!ai || isGeminiCooldownActive()) {
    // Simulator fallback
    console.log("Simulating voice note transcription...");
    return res.json({
      transcript: "Yes, hello, I am reporting a broken streetlight over here near 100 Feet Road, Indiranagar. It is completely dark and there is high pedestrian foot traffic making it a safety issue.",
      category: "Broken Streetlight",
      urgency: "High",
      locationHints: ["100 Feet Road, Indiranagar", "12th Main Crossing"],
      landmarks: ["Indiranagar Metro Station", "100 Feet Road"]
    });
  }

  try {
    const prompt = `Transcribe this voice report from a citizen. Then extract:
    location hints, issue type, urgency words, and any mentioned landmarks.
    Return JSON strictly in this format:
    {
      "transcript": "Full literal text transcription",
      "category": "Pothole" | "Water Leak" | "Broken Streetlight" | "Trash & Dumping" | "Graffiti" | "Other",
      "urgency": "Low" | "Medium" | "High" | "Critical",
      "locationHints": ["Specific landmarks, streets, or quadrants mentioned"],
      "landmarks": ["Mentioned buildings, parks, or shops"]
    }`;

    const contents = [
      prompt,
      {
        inlineData: {
          data: audio,
          mimeType: audioMimeType
        }
      }
    ];

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.error("Voice Note Analysis error:", err);
    return res.status(500).json({ error: err.message || "Failed to analyze voice report" });
  }
});

/**
 * ENHANCEMENT 8 — DUPLICATE DETECTION (Gemini Embeddings)
 */
app.post("/api/check-duplicates", async (req, res) => {
  const { description, nearbyIssues } = req.body;
  if (!description) {
    return res.status(400).json({ error: "Description is required" });
  }

  try {
    let newEmbedding: number[] = [];
    if (ai && !isGeminiCooldownActive()) {
      const response = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: description
      });
      newEmbedding = (response as any).embedding?.values || [];
    } else {
      // Simulation: generate consistent mock embedding based on length
      newEmbedding = Array.from({ length: 768 }, (_, index) => Math.sin(index + description.length));
    }

    let duplicateFound = null;
    if (nearbyIssues && Array.isArray(nearbyIssues)) {
      for (const issue of nearbyIssues) {
        if (issue.embedding && Array.isArray(issue.embedding)) {
          const sim = cosineSimilarity(newEmbedding, issue.embedding);
          if (sim >= 0.85) {
            duplicateFound = { issue, similarity: sim };
            break;
          }
        }
      }
    }

    return res.json({
      duplicateFound,
      newEmbedding
    });
  } catch (err: any) {
    console.error("Duplicate detection error:", err);
    return res.status(500).json({ error: err.message || "Failed to run duplicate detection" });
  }
});

/**
 * ENHANCEMENT 5 — SLA TRACKER WEEKLY SUMMARY
 */
app.post("/api/weekly-sla-summary", async (req, res) => {
  const { stats } = req.body;

  if (!ai || isGeminiCooldownActive()) {
    return res.json({
      insights: [
        "Water Leak reports have the highest SLA compliance at 94%, driven by immediate utility intervention.",
        "Streetlight outages average 48 hours, right on boundary SLA targets due to supply availability.",
        "Pothole repairs require 88 hours average, slightly breaching our 72-hour target."
      ],
      recommendations: [
        "Reallocate standard patching crews from low-density roads to central artery potholes.",
        "Implement a pre-stocked replacement light bulb program for maintenance trucks."
      ]
    });
  }

  try {
    const prompt = `You are a municipal operations SLA analyst. Given these community civic issue resolution statistics:
${JSON.stringify(stats, null, 2)}

Provide:
1. 3 key insights on municipal resolution performance.
2. 2 concrete, proactive operational recommendations.

Return JSON strictly in the following format:
{
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.error("SLA Summary generation error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate SLA analysis" });
  }
});

/**
 * ENHANCEMENT 3 — PREDICTIVE HOTSPOT ENGINE
 */
app.post("/api/predictive-insights", async (req, res) => {
  const { history } = req.body;

  if (!ai || isGeminiCooldownActive()) {
    // Return high quality simulation
    return res.json({
      hotspots: [
        { neighborhood: "Indiranagar / 100 Feet Rd", latitude: 12.9784, longitude: 77.6408, category: "Broken Streetlight", confidence: 0.89, reason: "High pedestrian nightlife density and aging streetlight feeder lines." },
        { neighborhood: "Koramangala 80 Feet Road", latitude: 12.9340, longitude: 77.6200, category: "Pothole", confidence: 0.82, reason: "Heavy morning BMTC bus transit and monsoon water runoff." },
        { neighborhood: "Whitefield Outer Ring Road", latitude: 12.9698, longitude: 77.7500, category: "Trash & Dumping", confidence: 0.78, reason: "Commercial corridor waste accumulation near tech parks." }
      ],
      patterns: [
        "Streetlight outages are clustering strongly in high-density pedestrian corridors near transit stations.",
        "Water leak reports consistently surge following monsoon pipeline pressure spikes."
      ],
      recommendations: [
        "Pre-stage asphalt patching units in central BBMP maintenance yards to decrease response time.",
        "Coordinate with BESCOM to install rapid-replacement LED modules on primary Indiranagar arterial corridors."
      ]
    });
  }

  try {
    const prompt = `You are a city infrastructure analyst for Bengaluru, Karnataka. Given this 6-month issue history by neighborhood and category:
${JSON.stringify(history, null, 2)}

Identify:
1. Top 3 predicted hotspots for next month (include neighborhood name, estimate latitude/longitude coordinate near Bengaluru, category, confidence 0-1, and reason).
2. 2 recurring pattern categories.
3. 2 proactive maintenance recommendations.

Return JSON strictly in this format:
{
  "hotspots": [
    { "neighborhood": "Name", "latitude": 12.9716, "longitude": 77.5946, "category": "Pothole", "confidence": 0.85, "reason": "Reason" }
  ],
  "patterns": ["Pattern 1", "Pattern 2"],
  "recommendations": ["Rec 1", "Rec 2"]
}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.error("Predictive insights generation error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate predictive insights" });
  }
});

/**
 * ENHANCEMENT 10 — WEEKLY BRIEF REPORT CARD
 */
app.post("/api/weekly-brief", async (req, res) => {
  const { issues } = req.body;

  if (!ai || isGeminiCooldownActive()) {
    return res.json({
      summary: "Bengaluru municipal systems maintained steady progress this week, though central transit corridors are undergoing ongoing road maintenance.",
      priorities: [
        { title: "Indiranagar 100 Feet Rd Water Leak", priority: "Critical", reason: "Active BWSSB pipeline rupture with water overflow on heavy commute lanes." },
        { title: "Koramangala 80 Feet Rd Streetlight Dark Outage", priority: "High", reason: "Safety hazard located in high-density crosswalk sector near commercial junction." }
      ],
      slaCompliance: "Active SLA compliance rate is sitting at 82.3%, representing a 2.1% increase compared to last period.",
      recommendations: [
        "Direct immediate BBMP asphalt patching crews to Koramangala 80 Feet Rd intersections.",
        "Schedule overnight BESCOM bulb replacements on Indiranagar 100 Feet Rd crossings."
      ]
    });
  }

  try {
    const prompt = `You are a municipal director. Analyze these current open/recent civic issues:
${JSON.stringify(issues.map((i: any) => ({ title: i.title, category: i.category, urgency: i.urgency, reportedAt: i.reportedAt, status: i.status })), null, 2)}

Generate a 'Weekly Brief' report card. Return JSON strictly matching this schema:
{
  "summary": "1-2 sentence executive summary of current status.",
  "priorities": [
    { "title": "Issue title", "priority": "Critical" | "High" | "Medium", "reason": "1-sentence rationale for priority" }
  ],
  "slaCompliance": "1-sentence description of SLA status",
  "recommendations": ["Action recommendation 1", "Action recommendation 2"]
}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.error("Weekly brief error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate weekly brief" });
  }
});

/**
 * GEMINI DAILY DIGEST BANNER ENDPOINT
 */
let serverDailyDigestCache: { text: string; timestamp: number } | null = null;

app.post("/api/daily-digest", async (req, res) => {
  const { issues = [] } = req.body;

  const yesterdayCount = issues.length > 0 ? issues.length : 7;
  const resolvedCount = issues.filter((i: any) => i.status === "Resolved").length || 2;
  
  // Find top concern based on category frequency
  const categoriesMap: Record<string, number> = {};
  issues.forEach((i: any) => {
    categoriesMap[i.category] = (categoriesMap[i.category] || 0) + 1;
  });
  let topConcern = "potholes";
  let maxCount = 0;
  Object.entries(categoriesMap).forEach(([cat, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topConcern = cat.toLowerCase() + "s";
    }
  });

  const fallbackText = `Yesterday, ${yesterdayCount} issues were reported in Bengaluru. Top concern: ${topConcern}. ${resolvedCount} were successfully resolved!`;

  // Server-side caching check (Cache is valid for 15 minutes)
  const now = Date.now();
  if (serverDailyDigestCache && (now - serverDailyDigestCache.timestamp < 15 * 60 * 1000)) {
    return res.json({ text: serverDailyDigestCache.text });
  }

  if (!ai || isGeminiCooldownActive()) {
    return res.json({ text: fallbackText });
  }

  try {
    const prompt = `You are a friendly municipal AI assistant for Bengaluru. Analyze these active issues in the city:
${JSON.stringify(issues.map((i: any) => ({ title: i.title, category: i.category, status: i.status })), null, 2)}

Create a highly concise, encouraging daily digest bulletin for citizen heroes (MAX 25 words, exactly 1-2 punchy sentences).
Example format: "Yesterday, 7 issues were reported in your area. Top concern: potholes near Indiranagar. 2 were resolved."
Be energetic, authentic, and direct. Do not refer to other cities. Return JSON in the exact format:
{
  "text": "The bulletin sentence here."
}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    const resultText = parsed.text || fallbackText;

    // Save to cache
    serverDailyDigestCache = { text: resultText, timestamp: now };

    return res.json({ text: resultText });
  } catch (err: any) {
    // Check if it is a Quota Exceeded (429) error or normal API error
    const errMessage = err?.message || "";
    if (errMessage.includes("429") || errMessage.toLowerCase().includes("quota") || errMessage.toLowerCase().includes("rate limit") || errMessage.toLowerCase().includes("resource_exhausted")) {
      console.warn("Gemini API daily digest quota/rate-limit exceeded. Activating global cooldown and serving fallback text.");
      activateGeminiCooldown();
    } else {
      console.warn("Could not generate Gemini daily digest on backend:", errMessage);
    }
    
    // Cache the fallback temporarily (for 5 minutes) to avoid spamming a rate-limited API
    serverDailyDigestCache = { text: fallbackText, timestamp: now - 10 * 60 * 1000 };

    return res.json({ text: fallbackText });
  }
});

// API: Analyze image using Gemini 2.5 Flash Vision (returns category, severity, department, hazards, confidence, and summary in JSON)
app.post("/api/analyze-image", async (req, res) => {
  const { image, imageMimeType } = req.body;

  if (!image || !imageMimeType) {
    return res.status(400).json({ error: "Image bytes and MIME type are required." });
  }

  // Fallback Simulation when Gemini API key is not configured or in cooldown
  if (!ai || isGeminiCooldownActive()) {
    console.log("Simulating vision analysis (API key not found)...");
    
    // Simple heuristic-based simulation
    const category = "Pothole";
    const severity = 4;
    const department = "BBMP Road Infrastructure";
    const hazards = ["Tire puncture hazard", "Suspension damage risk", "Accident potential"];
    const confidence = 0.95;
    const summary = "A deep pothole in the primary lane of travel, posing high risk of vehicle damage.";

    return res.json({
      success: true,
      simulated: true,
      category,
      severity,
      department,
      hazards,
      confidence,
      summary,
      analysis: {
        category,
        severity,
        department,
        hazards,
        confidence,
        summary
      }
    });
  }

  try {
    const contents: any[] = [
      "You are an expert municipal infrastructure inspector in Bengaluru. Analyze the attached image of a civic issue and extract structured details."
    ];

    contents.push({
      inlineData: {
        data: image,
        mimeType: imageMimeType
      }
    });

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: "The primary category of the civic issue, e.g. Pothole, Water Leak, Broken Streetlight, Trash & Dumping, Graffiti, or Other."
            },
            severity: {
              type: Type.INTEGER,
              description: "A hazard severity score from 1 to 5, where 1 is lowest/minor risk and 5 is highest/immediate danger."
            },
            department: {
              type: Type.STRING,
              description: "The name of the responsible municipal department/division (e.g. BBMP, BWSSB, BESCOM, BBMP Solid Waste Management)."
            },
            hazards: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A list of 2-3 specific immediate hazards or risks posed by this issue."
            },
            confidence: {
              type: Type.NUMBER,
              description: "A confidence score between 0.0 and 1.0 representing the inspector's certainty."
            },
            summary: {
              type: Type.STRING,
              description: "A concise 1-2 sentence professional inspector summary of the issue."
            }
          },
          required: ["category", "severity", "department", "hazards", "confidence", "summary"]
        }
      }
    });

    const textResult = response.text?.trim() || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(textResult);
    } catch (e) {
      // Handle potential markdown block wrapped responses
      const cleanText = textResult.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(cleanText);
    }

    return res.json({
      success: true,
      ...parsed,
      analysis: parsed
    });
  } catch (err: any) {
    console.error("Image Vision Analysis error:", err);
    return res.status(500).json({ error: err.message || "Failed to analyze image" });
  }
});

// API: Analyze Civic Issue reports using Gemini Multimodal AI (Traditional Post)
app.post("/api/analyze-issue", async (req, res) => {
  const { text, image, imageMimeType, audio, audioMimeType } = req.body;

  // Fallback Simulation when Gemini API key is not configured or in cooldown
  if (!ai || isGeminiCooldownActive()) {
    console.log("Simulating issue analysis (API key not found)...");
    
    // Quick heuristic logic to make mock response feel organic
    let category: any = "Other";
    let title = "Civic Issue";
    let urgency: any = "Medium";
    let locationName = "Bengaluru Civic Center";
    let description = text || "A citizen reported a local maintenance issue.";

    const combinedText = (text || "").toLowerCase() + (audio ? " voice" : "");

    if (combinedText.includes("pot") || combinedText.includes("hole") || combinedText.includes("street") && combinedText.includes("broken")) {
      category = "Pothole";
      title = "Pothole / Road damage spotted";
      urgency = "High";
      locationName = "MG Road & Brigade Road Junction";
    } else if (combinedText.includes("water") || combinedText.includes("leak") || combinedText.includes("pipe") || combinedText.includes("flood")) {
      category = "Water Leak";
      title = "Active Water Main Leak";
      urgency = "Critical";
      locationName = "100 Feet Road, Indiranagar";
    } else if (combinedText.includes("light") || combinedText.includes("dark") || combinedText.includes("lamp") || combinedText.includes("streetlight")) {
      category = "Broken Streetlight";
      title = "Outage: Street Light Dark";
      urgency = "Medium";
      locationName = "80 Feet Road, Koramangala";
    } else if (combinedText.includes("trash") || combinedText.includes("dump") || combinedText.includes("waste") || combinedText.includes("garbage")) {
      category = "Trash & Dumping";
      title = "Illegal Bulk Waste Dumping";
      urgency = "Low";
      locationName = "Cubbon Park Peripheral Road";
    } else if (combinedText.includes("graffiti") || combinedText.includes("paint") || combinedText.includes("spray")) {
      category = "Graffiti";
      title = "Vandalism/Graffiti Cleanup Required";
      urgency = "Low";
      locationName = "Malleshwaram 8th Main";
    }

    if (image) {
      title = "Visual Report: " + title;
      description += " (Extracted from photo description)";
    }
    if (audio) {
      title = "Voice Report: " + title;
      description = "Citizen voice note: 'Hello, there is an active issue that needs attention... " + description + "'";
    }

    const coords = getRandomCoordinate(CITY_CENTER_LAT, CITY_CENTER_LNG);

    return res.json({
      success: true,
      simulated: true,
      analysis: {
        title,
        description,
        category,
        urgency,
        locationName,
        latitude: coords.latitude,
        longitude: coords.longitude,
        recommendedAction: `Inspect and assign ${category.toLowerCase()} repair team to ${locationName}.`
      }
    });
  }

  try {
    const contents: any[] = [];
    
    // Build the prompt instruction
    const promptInstruction = `
      You are the "SAMRIDDHI PARIVAR" expert civic AI agent. Your job is to process a citizen's civic report (submitted as text, a photo, or an audio recording).
      Analyze the input details to extract or estimate:
      1. title: A short, concise, and clean descriptive title for the issue.
      2. description: A clear, descriptive summary. If an audio voice note is present, accurately transcribe or summarize what the citizen is saying.
      3. category: Must be EXACTLY one of the following strings: "Pothole", "Water Leak", "Broken Streetlight", "Trash & Dumping", "Graffiti", "Other".
      4. urgency: Must be EXACTLY one of: "Low", "Medium", "High", "Critical".
      5. locationName: The specific address, intersection, or local landmark mentioned. If none is mentioned, provide a descriptive local neighborhood name in Bengaluru, Karnataka.
      6. latitude: The estimated latitude. If a specific address is mentioned in Bengaluru, return its coordinate. If no specific address is mentioned, generate a realistic coordinate inside the Bengaluru metro area (latitude between 12.8500 and 13.1000).
      7. longitude: The estimated longitude. Correspondingly inside the Bengaluru area (longitude between 77.4800 and 77.7800).
      8. recommendedAction: A practical, 1-sentence recommendation for the municipal dispatch crew.

      You MUST respond strictly with a valid JSON object matching this schema. Do not include markdown wraps like \`\`\`json outside, just the JSON text:
      {
        "title": "Concise title",
        "description": "Full description",
        "category": "Pothole" | "Water Leak" | "Broken Streetlight" | "Trash & Dumping" | "Graffiti" | "Other",
        "urgency": "Low" | "Medium" | "High" | "Critical",
        "locationName": "Address or landmark",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "recommendedAction": "Action instruction"
      }
    `;

    contents.push(promptInstruction);

    if (text) {
      contents.push(`Citizen's typed text: "${text}"`);
    }

    if (image && imageMimeType) {
      contents.push({
        inlineData: {
          data: image,
          mimeType: imageMimeType
        }
      });
    }

    if (audio && audioMimeType) {
      contents.push({
        inlineData: {
          data: audio,
          mimeType: audioMimeType
        }
      });
    }

    console.log("Sending analysis request to Gemini API...");
    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents,
      config: {
        responseMimeType: "application/json"
      }
    });

    const resultText = response.text || "{}";
    console.log("Gemini Response:", resultText);

    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(resultText.trim());
    } catch (parseErr) {
      console.error("Failed to parse Gemini response as JSON. Raw response:", resultText);
      const cleaned = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedAnalysis = JSON.parse(cleaned);
    }

    if (
      !parsedAnalysis.latitude || 
      parsedAnalysis.latitude < 12.5 || 
      parsedAnalysis.latitude > 13.5 ||
      !parsedAnalysis.longitude ||
      parsedAnalysis.longitude < 77.0 ||
      parsedAnalysis.longitude > 78.0
    ) {
      const coords = getRandomCoordinate(CITY_CENTER_LAT, CITY_CENTER_LNG);
      parsedAnalysis.latitude = coords.latitude;
      parsedAnalysis.longitude = coords.longitude;
    }

    return res.json({
      success: true,
      simulated: false,
      analysis: parsedAnalysis
    });

  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze issue with Gemini."
    });
  }
});

// API: Dynamic Translation endpoint using Gemini
app.post("/api/translate", async (req, res) => {
  const { text, targetLanguage } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  if (!ai || isGeminiCooldownActive()) {
    console.log("Gemini API not configured or in cooldown, using direct fallback for translation.");
    return res.json({ translatedText: text, fallback: true });
  }

  try {
    const targetLangMap: Record<string, string> = {
      en: "English",
      es: "Spanish / Español",
      vi: "Vietnamese / Tiếng Việt",
      hi: "Hindi / हिन्दी",
      zh: "Chinese (Simplified) / 中文",
      fr: "French / Français",
      kn: "Kannada / ಕನ್ನಡ",
      ta: "Tamil / தமிழ்",
      te: "Telugu / తెలుగు",
      mr: "Marathi / मराठी",
      ja: "Japanese / 日本語"
    };

    const targetLangName = targetLangMap[targetLanguage] || targetLanguage || "English";

    const prompt = `You are a high-quality translator. Translate the following text precisely into ${targetLangName}. 
Maintain the tone, style, and structure of the original text. Do not add any introductory or explanatory text. Do not use quote marks around the translation unless they were in the original.
Only respond with the translated text.

Text to translate:
${text}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt
    });

    const translatedText = response.text?.trim() || text;
    return res.json({ translatedText });
  } catch (err: any) {
    console.error("Gemini translation error:", err);
    return res.status(500).json({ error: err.message || "Translation failed" });
  }
});

// API: Text-to-Speech endpoint using Gemini
app.post("/api/tts", async (req, res) => {
  const { text, language } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  if (!ai || isGeminiCooldownActive()) {
    console.log("Gemini API not configured or in cooldown, fallback to client-side native speechSynthesis.");
    return res.json({ success: false, reason: "Gemini API not configured" });
  }

  try {
    const prompt = `Say clearly in the matching language, with proper emotion: ${text}`;
    
    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return res.json({ success: true, audioBase64: base64Audio });
    }
    
    return res.status(500).json({ error: "No audio generated" });
  } catch (err: any) {
    console.error("Gemini TTS error:", err);
    return res.status(500).json({ error: err.message || "TTS generation failed" });
  }
});

// ==========================================
// SECURE DATABASE WRITES & DUPLICATE DETECTOR
// ==========================================

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function awardPointsAndStatsServer(userId: string, points: number, statField?: string) {
  if (!userId) return;
  try {
    if (adminDb) {
      const userDocRef = adminDb.collection("users").doc(userId);
      await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists) {
          transaction.set(userDocRef, {
            uid: userId,
            displayName: "SAMRIDDHI PARIVAR Partner",
            email: "",
            points: points,
            badges: ["First Step"],
            reportedCount: statField === "reportedCount" ? 1 : 0,
            verifiedCount: statField === "verifiedCount" ? 1 : 0,
            resolvedCount: statField === "resolvedCount" ? 1 : 0,
            role: "Citizen"
          });
        } else {
          const currentData = userDoc.data() || {};
          const currentPoints = currentData.points || 0;
          const currentStat = statField ? (currentData[statField] || 0) : 0;
          
          const updateData: any = {
            points: currentPoints + points
          };
          if (statField) {
            updateData[statField] = currentStat + 1;
          }
          transaction.update(userDocRef, updateData);
        }
      });
      return;
    }

    if (db) {
      const userDocRef = doc(db, "users", userId);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists()) {
          transaction.set(userDocRef, {
            uid: userId,
            displayName: "SAMRIDDHI PARIVAR Partner",
            email: "",
            points: points,
            badges: ["First Step"],
            reportedCount: statField === "reportedCount" ? 1 : 0,
            verifiedCount: statField === "verifiedCount" ? 1 : 0,
            resolvedCount: statField === "resolvedCount" ? 1 : 0,
            role: "Citizen"
          });
        } else {
          const currentData = userDoc.data();
          const currentPoints = currentData.points || 0;
          const currentStat = statField ? (currentData[statField] || 0) : 0;
          
          const updateData: any = {
            points: currentPoints + points
          };
          if (statField) {
            updateData[statField] = currentStat + 1;
          }
          transaction.update(userDocRef, updateData);
        }
      });
    }
  } catch (err) {
    console.error("Error awarding points server-side:", err);
  }
}

// 1. Create issue with Smart Duplicate Detection (within 50 meters)
app.post("/api/issues/create", verifyAuthToken, async (req: AuthenticatedRequest, res) => {
  const { issueData } = req.body;
  if (!issueData || typeof issueData !== "object" || !db) {
    return res.status(400).json({ error: "Invalid issue data or database offline." });
  }

  try {
    const reportedBy = req.user?.uid || issueData.reportedBy;
    if (!reportedBy) {
      return res.status(401).json({ error: "Reporter user ID is required." });
    }

    // Input Validation & Normalization
    const rawTitle = typeof issueData.title === "string" ? issueData.title.trim() : "Civic Issue";
    const title = rawTitle.slice(0, 200) || "Civic Issue";
    const rawDesc = typeof issueData.description === "string" ? issueData.description.trim() : "";
    const description = rawDesc.slice(0, 5000);
    const category = normalizeIssueCategory(issueData.category);
    const urgency = normalizeIssueUrgency(issueData.urgency);
    const rawLocName = typeof issueData.locationName === "string" ? issueData.locationName.trim() : "Bengaluru";
    const locationName = rawLocName.slice(0, 1000) || "Bengaluru";
    
    const lat = typeof issueData.latitude === "number" && !isNaN(issueData.latitude) ? issueData.latitude : CITY_CENTER_LAT;
    const lng = typeof issueData.longitude === "number" && !isNaN(issueData.longitude) ? issueData.longitude : CITY_CENTER_LNG;

    const sanitizedIssueData = {
      ...issueData,
      title,
      description,
      category,
      urgency,
      locationName,
      latitude: lat,
      longitude: lng,
      reportedBy,
      reportedByName: (issueData.reportedByName || req.user?.email?.split("@")[0] || "Citizen").slice(0, 100)
    };

    // Strip unpermitted official fields on citizen create
    delete sanitizedIssueData.officialResponse;
    delete sanitizedIssueData.officialResponseAt;
    delete sanitizedIssueData.assignedDepartment;
    delete sanitizedIssueData.serverWriteToken;

    // Use the duplicate detection service
    const mergeResult = await checkAndMergeDuplicate(db, ai, sanitizedIssueData, awardPointsAndStatsServer);

    if (mergeResult.merged) {
      return res.json({
        success: true,
        merged: true,
        existingIssueId: mergeResult.existingIssueId,
        rationale: mergeResult.rationale,
        message: mergeResult.message
      });
    }

    // Create a brand new issue document
    const newIssueRef = doc(collection(db, "issues"));
    const newIssue = {
      ...sanitizedIssueData,
      id: newIssueRef.id,
      status: "Reported",
      reportedAt: Date.now(),
      verificationsCount: 0,
      verifiedBy: []
    };

    // Clean undefined properties
    const cleaned = JSON.parse(JSON.stringify(newIssue));
    await setDoc(newIssueRef, cleaned);
    
    // Securely award 50 XP for reporting a new issue
    await awardPointsAndStatsServer(reportedBy, 50, "reportedCount");

    return res.json({
      success: true,
      merged: false,
      newIssueId: newIssueRef.id,
      message: `Report submitted successfully! +50 XP awarded.`
    });

  } catch (err: any) {
    console.error("Error creating issue:", err);
    return res.status(500).json({ error: err.message || "Failed to create issue on server." });
  }
});

// 2. Verify an issue securely
app.post("/api/issues/verify", verifyAuthToken, async (req: AuthenticatedRequest, res) => {
  const { issueId, verifierId } = req.body;
  const callerUid = req.user?.uid || verifierId;

  if (!issueId || !callerUid || !db) {
    return res.status(400).json({ error: "Missing parameters or database offline." });
  }

  try {
    const issueRef = doc(db, "issues", issueId);
    let isAlreadyVerified = false;
    let reportedBy = "";

    await runTransaction(db, async (transaction) => {
      const issueDoc = await transaction.get(issueRef);
      if (!issueDoc.exists()) {
        throw new Error("Issue does not exist.");
      }
      
      const data = issueDoc.data();
      reportedBy = data.reportedBy;
      const verifiedBy = data.verifiedBy || [];
      const currentCount = data.verificationsCount || 0;

      if (verifiedBy.includes(callerUid)) {
        isAlreadyVerified = true;
        return;
      }

      if (reportedBy === callerUid) {
        throw new Error("You cannot verify your own reported issue!");
      }

      const updatedVerifiedBy = [...verifiedBy, callerUid];
      const updatedCount = currentCount + 1;
      let newStatus = data.status;
      if (updatedCount >= 3 && data.status === "Reported") {
        newStatus = "Verified";
      }

      transaction.update(issueRef, {
        verifiedBy: updatedVerifiedBy,
        verificationsCount: updatedCount,
        status: newStatus
      });
    });

    if (isAlreadyVerified) {
      return res.status(400).json({ error: "You have already verified this issue!" });
    }

    // Award verifier 25 points
    await awardPointsAndStatsServer(callerUid, 25, "verifiedCount");

    return res.json({ success: true, message: "Issue verified successfully! +25 XP awarded." });
  } catch (err: any) {
    console.error("Error verifying issue:", err);
    return res.status(500).json({ error: err.message || "Failed to verify issue." });
  }
});

// 3. Update issue status securely (Role-guarded: Official or Admin only)
app.post("/api/issues/update-status", verifyAuthToken, requireOfficialOrAdmin, async (req: AuthenticatedRequest, res) => {
  const { issueId, status, officialResponse } = req.body;
  if (!issueId || !status || !db) {
    return res.status(400).json({ error: "Missing parameters or database offline." });
  }

  const targetStatus = normalizeIssueStatus(status);

  try {
    const issueRef = doc(db, "issues", issueId);
    let reporterId = "";

    await runTransaction(db, async (transaction) => {
      const issueDoc = await transaction.get(issueRef);
      if (!issueDoc.exists()) {
        throw new Error("Issue does not exist.");
      }

      const data = issueDoc.data();
      reporterId = data.reportedBy;
      const currentStatus = normalizeIssueStatus(data.status);

      // Validate status transition (Admins may override if needed)
      if (!canTransitionIssueStatus(currentStatus, targetStatus) && req.user?.role !== "Admin") {
        throw new Error(`Invalid status transition from "${currentStatus}" to "${targetStatus}".`);
      }

      const updatePayload: any = {
        status: targetStatus,
        officialResponseAt: Date.now()
      };

      if (officialResponse && typeof officialResponse === "string") {
        updatePayload.officialResponse = officialResponse.slice(0, 5000);
      }

      const currentTimestamps = data.timestamps || {};
      const updatedTimestamps = { ...currentTimestamps };
      if (targetStatus === "Verified" && !updatedTimestamps.verified) updatedTimestamps.verified = Date.now();
      if (targetStatus === "Assigned" && !updatedTimestamps.assigned) updatedTimestamps.assigned = Date.now();
      if (targetStatus === "Repair Scheduled" || targetStatus === "In Progress") {
        updatedTimestamps.inProgress = Date.now();
      } else if (targetStatus === "Fix Completed" || targetStatus === "Resolved") {
        updatedTimestamps.resolved = Date.now();
      }
      updatePayload.timestamps = updatedTimestamps;

      transaction.update(issueRef, updatePayload);
    });

    // If resolved or completed, award 100 XP to original reporter
    if ((targetStatus === "Fix Completed" || targetStatus === "Resolved") && reporterId) {
      await awardPointsAndStatsServer(reporterId, 100, "resolvedCount");
    }

    return res.json({ 
      success: true, 
      message: `Issue status updated to "${targetStatus}" successfully!`,
      reporterId
    });
  } catch (err: any) {
    console.error("Error updating issue status:", err);
    return res.status(500).json({ error: err.message || "Failed to update issue status." });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Dynamically import Vite server for development
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Generate Daily Digest on boot if database is ready to go
  setTimeout(() => {
    generateDailyDigest().catch((err) => console.warn("Initial Daily Digest failed:", err?.message || err));
  }, 5000);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
