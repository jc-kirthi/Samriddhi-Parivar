import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export interface VerificationResult {
  initialized: boolean;
  apiKeyPresent: boolean;
  authDomainPresent: boolean;
  projectIdPresent: boolean;
  appIdPresent: boolean;
  authInstanceValid: boolean;
  dbInstanceValid: boolean;
  firestoreConnectionOk?: boolean;
  firestoreError?: string;
  errorMessage?: string;
}

/**
 * Diagnostic utility to verify Firebase instances and configs.
 * Logs status details and configuration states to the console.
 */
export async function verifyFirebaseConfig(): Promise<VerificationResult> {
  console.log("=== Firebase Auth & Firestore Diagnostics Triggered ===");
  
  const result: VerificationResult = {
    initialized: false,
    apiKeyPresent: false,
    authDomainPresent: false,
    projectIdPresent: false,
    appIdPresent: false,
    authInstanceValid: false,
    dbInstanceValid: false,
  };

  try {
    // Check auth configuration presence
    const app = auth.app;
    if (app) {
      result.initialized = true;
      const config = app.options;
      result.apiKeyPresent = !!config.apiKey && config.apiKey !== "...";
      result.authDomainPresent = !!config.authDomain && config.authDomain !== "...";
      result.projectIdPresent = !!config.projectId && config.projectId !== "...";
      result.appIdPresent = !!config.appId && config.appId !== "...";
    }

    // Verify Auth Instance
    if (auth && typeof auth.onAuthStateChanged === "function") {
      result.authInstanceValid = true;
    }

    // Verify Firestore DB Instance & test active connection
    if (db) {
      result.dbInstanceValid = true;
      try {
        console.log("Attempting live Firestore connection test...");
        const testRef = doc(db, "_connection_test_", "ping");
        // getDoc resolves successfully even if the document doesn't exist.
        // If Firestore API is disabled or DB doesn't exist, it will throw.
        await getDoc(testRef);
        result.firestoreConnectionOk = true;
        console.log("Firestore connection test: SUCCESS (DB is reachable)");
      } catch (dbErr: any) {
        console.error("Firestore connection test: FAILED", dbErr);
        result.firestoreConnectionOk = false;
        result.firestoreError = dbErr.message || String(dbErr);
      }
    }

    console.log("Firebase App Initialized:", result.initialized);
    console.log("API Key Present:", result.apiKeyPresent);
    console.log("Auth Domain Present:", result.authDomainPresent);
    console.log("Project ID:", auth?.app?.options?.projectId || "N/A");
    console.log("Auth Instance Active:", result.authInstanceValid);
    console.log("DB Instance Active:", result.dbInstanceValid);
    console.log("Firestore Connection Ok:", result.firestoreConnectionOk);
    console.log("==========================================");

  } catch (error: any) {
    console.error("Firebase diagnostics failed to execute:", error);
    result.errorMessage = error.message || String(error);
  }

  return result;
}

