import { GoogleGenAI } from "@google/genai";
import { doc, getDocs, collection, setDoc } from "firebase/firestore";
import { generateContentWithRetry, isGeminiCooldownActive, activateGeminiCooldown } from "../lib/gemini";

// Circuit breaker to temporarily disable Gemini API calls after encountering quota limit (429)
let geminiQuotaExceededUntil = 0;

/**
 * Calculates the geodistance between two coordinates in meters using the Haversine formula
 */
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface IssueInput {
  latitude: number;
  longitude: number;
  category: string;
  title: string;
  description: string;
  reportedBy: string;
  reportedByName?: string;
}

export interface MergeResult {
  merged: boolean;
  existingIssueId?: string;
  rationale?: string;
  message?: string;
}

/**
 * Checks for a nearby duplicate of a newly reported issue within 50 meters.
 * Uses Gemini API to perform semantic comparison of descriptions.
 * If a duplicate matches, updates the database by adding the reporter to verifiedBy
 * and returned merge information.
 */
export async function checkAndMergeDuplicate(
  db: any,
  ai: GoogleGenAI | null,
  newIssue: IssueInput,
  awardPointsFn: (userId: string, points: number, statField?: string) => Promise<void>
): Promise<MergeResult> {
  if (!db) {
    throw new Error("Database is not initialized.");
  }

  const { latitude, longitude, category, title, description, reportedBy } = newIssue;

  try {
    // 1. Fetch all open and unresolved issues
    const issuesCollection = collection(db, "issues");
    const snapshot = await getDocs(issuesCollection);

    const openIssues: any[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status !== "Resolved" && data.status !== "Fix Completed") {
        openIssues.push({ id: docSnap.id, ...data });
      }
    });

    // 2. Filter for issues strictly within 50 meters
    const nearbyOpenIssues = openIssues.filter((issue) => {
      const dist = getDistanceInMeters(latitude, longitude, issue.latitude, issue.longitude);
      return dist <= 50;
    });

    if (nearbyOpenIssues.length === 0) {
      return { merged: false };
    }

    console.log(`[DuplicateDetector] Found ${nearbyOpenIssues.length} open issues within 50 meters. Analyzing with Gemini...`);

    let matchedDuplicate: any = null;
    let matchRationale = "";

    // 3. Perform semantic duplication analysis for each nearby issue
    for (const existingIssue of nearbyOpenIssues) {
      if (ai && !isGeminiCooldownActive()) {
        try {
          const prompt = `You are an AI duplicate detector for the 'SAMRIDDHI PARIVAR' civic technology app.
A citizen reported a new issue:
Category: ${category}
Title: ${title}
Description: ${description}

An existing issue is already open nearby:
Category: ${existingIssue.category}
Title: ${existingIssue.title}
Description: ${existingIssue.description}

Do these two reports refer to the exact same physical problem or hazard at this location?
Respond strictly with a valid JSON object matching this schema (do NOT wrap in markdown code blocks like \`\`\`json):
{
  "isDuplicate": true or false,
  "rationale": "a direct, concise one-sentence explanation"
}`;

          const response = await generateContentWithRetry(ai, {
            model: "gemini-3.5-flash", // Best model for general text/reasoning tasks
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          }, 3); // Lower retry bound

          const responseText = response.text?.trim() || "{}";
          let parsed;
          try {
            parsed = JSON.parse(responseText);
          } catch (e) {
            // strip markdown formatting if any
            const cleaned = responseText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
            parsed = JSON.parse(cleaned);
          }

          if (parsed.isDuplicate) {
            matchedDuplicate = existingIssue;
            matchRationale = parsed.rationale || "Gemini semantically verified this as a duplicate report.";
            break;
          }
        } catch (geminiErr: any) {
          const errMsg = geminiErr?.message || String(geminiErr);
          const isQuotaError = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota") || errMsg.includes("limit exceeded") || errMsg.includes("Quota exceeded");
          
          if (isQuotaError) {
            console.warn("[DuplicateDetector] Gemini API rate limit / quota exceeded. Triggering global cooldown.");
            activateGeminiCooldown();
          } else {
            console.error("[DuplicateDetector] Gemini API analysis failed. Using fallback.", geminiErr);
          }
          
          // Fallback heuristic: same category within 50m
          if (existingIssue.category === category) {
            matchedDuplicate = existingIssue;
            matchRationale = `Proximity match on identical category "${category}" (fallback verification).`;
            break;
          }
        }
      } else {
        if (ai && isGeminiCooldownActive()) {
          console.log("[DuplicateDetector] Gemini API is currently in backoff/cooldown. Using fast fallback.");
        }
        // Fallback simulator if Gemini API is not configured or in backoff
        if (existingIssue.category === category) {
          matchedDuplicate = existingIssue;
          matchRationale = `Proximity and matching category "${category}" (simulated duplicate verification).`;
          break;
        }
      }
    }

    // 4. Handle merge of duplicate issue if identified
    if (matchedDuplicate) {
      console.log(`[DuplicateDetector] Match confirmed! Merging into issue: ${matchedDuplicate.id}`);

      const existingRef = doc(db, "issues", matchedDuplicate.id);
      const currentVerifiedBy = matchedDuplicate.verifiedBy || [];
      const currentRelatedIssues = matchedDuplicate.relatedIssues || [];

      // Check if this user has already verified it
      const alreadyVerified = currentVerifiedBy.includes(reportedBy);
      const updatedVerifiedBy = alreadyVerified ? currentVerifiedBy : [...currentVerifiedBy, reportedBy];
      const updatedVerificationsCount = (matchedDuplicate.verificationsCount || 0) + (alreadyVerified ? 0 : 1);
      const updatedRelatedIssues = [
        ...currentRelatedIssues,
        `reported_by_${reportedBy}_at_${Date.now()}`
      ];

      // Auto-escalate status to Verified if verifications reach 3
      let newStatus = matchedDuplicate.status;
      if (updatedVerificationsCount >= 3 && matchedDuplicate.status === "Reported") {
        newStatus = "Verified";
      }

      // Update the existing report in Firestore
      await setDoc(
        existingRef,
        {
          verifiedBy: updatedVerifiedBy,
          verificationsCount: updatedVerificationsCount,
          relatedIssues: updatedRelatedIssues,
          status: newStatus,
          serverWriteToken: "community_hero_server_write_token_2026"
        },
        { merge: true }
      );

      // Award validation/verification points (+25 XP) to the reporter
      await awardPointsFn(reportedBy, 25, "verifiedCount");

      return {
        merged: true,
        existingIssueId: matchedDuplicate.id,
        rationale: matchRationale,
        message: `We identified this as a duplicate of an existing report. We merged your details and awarded +25 XP verification credit!`
      };
    }

    return { merged: false };
  } catch (error: any) {
    console.error("[DuplicateDetector] Error during check and merge:", error);
    throw error;
  }
}
