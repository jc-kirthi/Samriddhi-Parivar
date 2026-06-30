import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInAnonymously as firebaseSignInAnonymously,
  updateProfile,
  User
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  increment, 
  arrayUnion, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  addDoc,
  runTransaction
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { CivicIssue, UserProfile, LeaderboardUser } from "../types";
import {
  cacheIssues,
  getCachedIssues,
  cacheUserProfile,
  getCachedUserProfile,
  cacheLeaderboard,
  getCachedLeaderboard,
  queueOfflineWrite,
  applyOfflineEdits
} from "./indexedDbService";

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Check if there is a local database ID override
const getDbInstance = () => {
  if (typeof window !== "undefined") {
    const override = localStorage.getItem("firebase_firestore_db_id");
    if (override !== null) {
      return override.trim() ? getFirestore(app, override.trim()) : getFirestore(app);
    }
  }
  return firebaseConfig.firestoreDatabaseId 
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
};

// Initialize Firestore
const db = getDbInstance();

export function isUsingCustomDatabase(): boolean {
  if (typeof window !== "undefined") {
    const override = localStorage.getItem("firebase_firestore_db_id");
    if (override !== null) {
      return !!override.trim();
    }
  }
  return !!firebaseConfig.firestoreDatabaseId;
}

export function resetToDefaultDatabase() {
  if (typeof window !== "undefined") {
    localStorage.setItem("firebase_firestore_db_id", " ");
  }
}

// --- DEMO FALLBACK SYSTEM START ---

export function isDemoMode(): boolean {
  if (typeof window !== "undefined") {
    return localStorage.getItem("firebase_fallback_demo_mode") === "true";
  }
  return false;
}

/**
 * Recursively removes all undefined properties from an object so Firestore doesn't reject it.
 */
export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned as T;
  }
  return obj;
}

const INITIAL_DEMO_ISSUES: CivicIssue[] = [
  {
    id: "demo_issue_1",
    title: "Water Main Leak on Indiranagar 100 Feet Rd",
    description: "Water is bubbling up from under the street near the intersection. It's creating a large puddle and wasting thousands of liters of clean water, flooding the side lanes.",
    category: "Water Leak",
    urgency: "High",
    locationName: "100 Feet Rd, Indiranagar, Bengaluru, KA",
    latitude: 12.9630,
    longitude: 77.6380,
    status: "Verified",
    reportedBy: "demo_user_alex",
    reportedByName: "Alex Rivers",
    reportedAt: Date.now() - 24 * 3600 * 1000,
    verificationsCount: 3,
    verifiedBy: ["demo_user_maria", "demo_user_john", "demo_user_sara"],
    severity: 4,
    severityRationale: "Consistent flow of water on a major arterial roadway. Hazard to motorists and heavy water loss.",
    department: "BWSSB (Bangalore Water Supply and Sewerage Board)",
    hazards: ["Slippery Road", "Resource Waste"],
    aiConfidence: 0.95,
    aiSummary: "Active high-volume water leak at major Indiranagar road."
  },
  {
    id: "demo_issue_2",
    title: "Dangerous Pothole near Cubbon Park Junction",
    description: "Very deep pothole in the right lane. Multiple two-wheelers and auto-rickshaws have had to swerve suddenly to avoid it, presenting an immediate safety hazard.",
    category: "Pothole",
    urgency: "Critical",
    locationName: "Kasturba Rd, near Cubbon Park Entrance, Bengaluru, KA",
    latitude: 12.9740,
    longitude: 77.5910,
    status: "Reported",
    reportedBy: "demo_user_maria",
    reportedByName: "Maria Flores",
    reportedAt: Date.now() - 4 * 3600 * 1000,
    verificationsCount: 1,
    verifiedBy: ["demo_user_john"],
    severity: 5,
    severityRationale: "Over 6 inches deep on a heavily trafficked central route. High risk of immediate vehicle damage and two-wheeler accidents.",
    department: "BBMP (Bruhat Bengaluru Mahanagara Palike)",
    hazards: ["Vehicle Damage", "Accident Risk"],
    aiConfidence: 0.98,
    aiSummary: "Critical roadway pothole requiring immediate asphalt patch."
  },
  {
    id: "demo_issue_3",
    title: "Flickering Streetlight on Malleshwaram 15th Cross",
    description: "The street light has been flickering non-stop for the past few nights. It makes the sidewalk very dark and is highly distracting to passing drivers.",
    category: "Broken Streetlight",
    urgency: "Medium",
    locationName: "15th Cross Rd, Malleshwaram, Bengaluru, KA",
    latitude: 13.0030,
    longitude: 77.5700,
    status: "In Progress",
    reportedBy: "demo_user_john",
    reportedByName: "John Miller",
    reportedAt: Date.now() - 3 * 24 * 3600 * 1000,
    verificationsCount: 2,
    verifiedBy: ["demo_user_alex", "demo_user_sara"],
    severity: 3,
    severityRationale: "Decreased visibility in pedestrian zone but main road illumination is partially sustained.",
    department: "BESCOM (Bangalore Electricity Supply Company)",
    hazards: ["Pedestrian Safety", "Low Visibility"],
    aiConfidence: 0.91,
    aiSummary: "Flickering overhead sodium-vapor street light fixture."
  },
  {
    id: "demo_issue_4",
    title: "Illegal Garbage Dumping near Koramangala 3rd Block",
    description: "Someone dumped construction debris, broken furniture, and several bags of plastic household waste right next to the park entrance sidewalk.",
    category: "Trash & Dumping",
    urgency: "Medium",
    locationName: "80 Feet Rd, Koramangala 3rd Block, Bengaluru, KA",
    latitude: 12.9350,
    longitude: 77.6250,
    status: "Resolved",
    reportedBy: "demo_user_sara",
    reportedByName: "Sara Chen",
    reportedAt: Date.now() - 5 * 24 * 3600 * 1000,
    verificationsCount: 3,
    verifiedBy: ["demo_user_alex", "demo_user_maria", "demo_user_john"],
    severity: 3,
    severityRationale: "Non-hazardous bulk debris near water runoff. Requires collection to avoid environmental pollution.",
    department: "BBMP Solid Waste Management Division",
    hazards: ["Environmental Pollution", "Obstruction"],
    aiConfidence: 0.94,
    aiSummary: "Bulk illegal dumping of household waste and electronics.",
    officialResponse: "Our local BBMP waste collection crew has dispatched a loader and fully cleared the dumped garbage and debris bags. The site is now clean. Thank you for reporting!",
    officialResponseAt: Date.now() - 12 * 3600 * 1000
  }
];

const INITIAL_DEMO_LEADERBOARD: LeaderboardUser[] = [
  {
    uid: "demo_user_alex",
    displayName: "Alex Rivers",
    points: 450,
    reportedCount: 6,
    verifiedCount: 12,
    badges: ["First Step", "Rookie Reporter", "Civic Champion", "Eagle Eye", "Elite Validator"]
  },
  {
    uid: "demo_user_sara",
    displayName: "Sara Chen",
    points: 320,
    reportedCount: 4,
    verifiedCount: 8,
    badges: ["First Step", "Rookie Reporter", "Eagle Eye"]
  },
  {
    uid: "demo_user_maria",
    displayName: "Maria Flores",
    points: 215,
    reportedCount: 3,
    verifiedCount: 4,
    badges: ["First Step", "Rookie Reporter", "Problem Solver"]
  },
  {
    uid: "demo_user_john",
    displayName: "John Miller",
    points: 110,
    reportedCount: 1,
    verifiedCount: 2,
    badges: ["First Step"]
  }
];

export function initDemoStorage() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem("firebase_demo_issues")) {
    localStorage.setItem("firebase_demo_issues", JSON.stringify(INITIAL_DEMO_ISSUES));
  }
  if (!localStorage.getItem("firebase_demo_leaderboard")) {
    localStorage.setItem("firebase_demo_leaderboard", JSON.stringify(INITIAL_DEMO_LEADERBOARD));
  }
}

export function setDemoMode(enabled: boolean) {
  if (typeof window !== "undefined") {
    if (enabled) {
      localStorage.setItem("firebase_fallback_demo_mode", "true");
      initDemoStorage();
      if (!localStorage.getItem("firebase_demo_user_profile")) {
        const guestNames = ["Echo Guardian", "Metro Shield", "Asphalt Ranger", "Beacon Citizen", "Street Sentinel"];
        const chosenName = guestNames[Math.floor(Math.random() * guestNames.length)] + " #" + Math.floor(100 + Math.random() * 900);
        const mockProfile: UserProfile = {
          uid: "demo_guest_user_123",
          displayName: chosenName,
          email: "guest@communityhero.org",
          points: 100,
          badges: ["First Step"],
          reportedCount: 0,
          verifiedCount: 0,
          resolvedCount: 0
        };
        localStorage.setItem("firebase_demo_user_profile", JSON.stringify(mockProfile));
      }
    } else {
      localStorage.removeItem("firebase_fallback_demo_mode");
      localStorage.removeItem("firebase_demo_user_profile");
      localStorage.removeItem("firebase_demo_issues");
      localStorage.removeItem("firebase_demo_leaderboard");
    }
    // Dispatch customized event to instantly notify listeners
    window.dispatchEvent(new Event("demo_profile_updated"));
    window.dispatchEvent(new Event("demo_issues_updated"));
    window.dispatchEvent(new Event("demo_leaderboard_updated"));
  }
}

export function onAuthStateChanged(authInstance: any, callback: (user: any) => void) {
  if (isDemoMode()) {
    const loadDemoUser = () => {
      const stored = localStorage.getItem("firebase_demo_user_profile");
      if (stored) {
        const profile = JSON.parse(stored);
        callback({
          uid: profile.uid,
          displayName: profile.displayName,
          email: profile.email,
          isAnonymous: true,
          emailVerified: true,
          providerId: "anonymous",
          reload: async () => {},
          getIdToken: async () => "demo_token"
        });
      } else {
        callback(null);
      }
    };

    loadDemoUser();

    const handleCustomChange = () => {
      loadDemoUser();
    };
    window.addEventListener("demo_profile_updated", handleCustomChange);
    return () => {
      window.removeEventListener("demo_profile_updated", handleCustomChange);
    };
  }

  return firebaseOnAuthStateChanged(authInstance, callback);
}

export async function signOut(authInstance: any) {
  if (isDemoMode()) {
    localStorage.removeItem("firebase_fallback_demo_mode");
    localStorage.removeItem("firebase_demo_user_profile");
    window.dispatchEvent(new Event("demo_profile_updated"));
    setTimeout(() => {
      window.location.reload();
    }, 150);
    return;
  }
  return firebaseSignOut(authInstance);
}

export async function signInAnonymously(authInstance: any) {
  if (isDemoMode()) {
    setDemoMode(true);
    return {
      user: {
        uid: "demo_guest_user_123",
        displayName: "Demo Hero",
        email: "guest@communityhero.org",
        isAnonymous: true
      }
    };
  }
  try {
    return await firebaseSignInAnonymously(authInstance);
  } catch (error) {
    console.warn("Real anonymous sign in failed, shifting to local demo mode fallback", error);
    setDemoMode(true);
    return {
      user: {
        uid: "demo_guest_user_123",
        displayName: "Demo Hero",
        email: "guest@communityhero.org",
        isAnonymous: true
      }
    };
  }
}

// --- DEMO FALLBACK SYSTEM END ---

export { auth, db };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Creates or retrieves a user profile in Firestore
 */
export async function getOrCreateUserProfile(user: any): Promise<UserProfile> {
  if (isDemoMode()) {
    initDemoStorage();
    const stored = localStorage.getItem("firebase_demo_user_profile");
    if (stored) {
      const p = JSON.parse(stored);
      p.uid = user.uid;
      localStorage.setItem("firebase_demo_user_profile", JSON.stringify(p));
      return p;
    }
    const newProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || user.email?.split("@")[0] || "Demo Hero",
      email: user.email || "guest@communityhero.org",
      points: 100,
      badges: ["First Step"],
      reportedCount: 0,
      verifiedCount: 0,
      resolvedCount: 0
    };
    localStorage.setItem("firebase_demo_user_profile", JSON.stringify(newProfile));
    window.dispatchEvent(new Event("demo_profile_updated"));
    return newProfile;
  }

  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.warn("Could not sign in anonymously before profile retrieval, retrying...", e);
    }
  }

  const userDocRef = doc(db, "users", user.uid);
  try {
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    } else {
      const newProfile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "Citizen Hero",
        email: user.email || "guest@communityhero.org",
        points: 100, // starting points bonus
        badges: ["First Step"],
        reportedCount: 0,
        verifiedCount: 0,
        resolvedCount: 0
      };
      await setDoc(userDocRef, cleanUndefined(newProfile));
      return newProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

/**
 * Awards points and updates user stats + badges
 */
export async function awardPointsAndStats(
  userId: string, 
  pointsToAdd: number, 
  statToIncrement: "reportedCount" | "verifiedCount" | "resolvedCount" | null
) {
  if (!isDemoMode()) {
    console.log("awardPointsAndStats is a no-op on the client-side in Live mode; backend APIs handle point awarding securely.");
    return;
  }

  if (isDemoMode()) {
    initDemoStorage();
    const stored = localStorage.getItem("firebase_demo_user_profile");
    if (!stored) return;
    const data = JSON.parse(stored) as UserProfile;
    const currentPoints = data.points + pointsToAdd;
    const reportedCount = data.reportedCount + (statToIncrement === "reportedCount" ? 1 : 0);
    const verifiedCount = data.verifiedCount + (statToIncrement === "verifiedCount" ? 1 : 0);
    const resolvedCount = data.resolvedCount + (statToIncrement === "resolvedCount" ? 1 : 0);

    const badgesSet = new Set<string>(data.badges || []);
    if (reportedCount >= 1) badgesSet.add("Rookie Reporter");
    if (reportedCount >= 5) badgesSet.add("Civic Champion");
    if (verifiedCount >= 1) badgesSet.add("Eagle Eye");
    if (verifiedCount >= 5) badgesSet.add("Elite Validator");
    if (resolvedCount >= 1) badgesSet.add("Problem Solver");
    if (currentPoints >= 200) badgesSet.add("Neighborhood Guardian");
    if (currentPoints >= 500) badgesSet.add("Super Citizen");

    const updated: UserProfile = {
      ...data,
      points: currentPoints,
      badges: Array.from(badgesSet),
      reportedCount,
      verifiedCount,
      resolvedCount
    };
    localStorage.setItem("firebase_demo_user_profile", JSON.stringify(updated));
    window.dispatchEvent(new Event("demo_profile_updated"));
    return;
  }

  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.warn("Could not sign in anonymously before awarding points", e);
    }
  }

  const userDocRef = doc(db, "users", userId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists()) return;

      const data = userDoc.data() as UserProfile;
      const currentPoints = data.points + pointsToAdd;
      const reportedCount = data.reportedCount + (statToIncrement === "reportedCount" ? 1 : 0);
      const verifiedCount = data.verifiedCount + (statToIncrement === "verifiedCount" ? 1 : 0);
      const resolvedCount = data.resolvedCount + (statToIncrement === "resolvedCount" ? 1 : 0);

      // Calculate badges
      const badgesSet = new Set<string>(data.badges || []);
      
      if (reportedCount >= 1) badgesSet.add("Rookie Reporter");
      if (reportedCount >= 5) badgesSet.add("Civic Champion");
      if (verifiedCount >= 1) badgesSet.add("Eagle Eye");
      if (verifiedCount >= 5) badgesSet.add("Elite Validator");
      if (resolvedCount >= 1) badgesSet.add("Problem Solver");
      if (currentPoints >= 200) badgesSet.add("Neighborhood Guardian");
      if (currentPoints >= 500) badgesSet.add("Super Citizen");

      const updateData: Partial<UserProfile> = {
        points: currentPoints,
        badges: Array.from(badgesSet)
      };

      if (statToIncrement) {
        updateData[statToIncrement] = increment(1) as any;
      } else {
        updateData.points = currentPoints;
      }

      transaction.update(userDocRef, updateData);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

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

/**
 * Report a new issue
 */
export async function reportIssue(issueData: Omit<CivicIssue, "id" | "reportedAt" | "verificationsCount" | "verifiedBy" | "status">): Promise<string> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (isOffline) {
    const tempId = "offline_" + Math.random().toString(36).substring(2, 11);
    await queueOfflineWrite({
      type: "create_issue",
      data: issueData,
      tempId,
      timestamp: Date.now()
    });
    await awardPointsAndStats(issueData.reportedBy, 50, "reportedCount");
    return tempId;
  }

  try {
    if (isDemoMode()) {
      initDemoStorage();
      const stored = localStorage.getItem("firebase_demo_issues");
      const issues: CivicIssue[] = stored ? JSON.parse(stored) : [];
      
      // Proximity duplicate check (50m) in demo mode too!
      const nearbyOpenIssues = issues.filter(issue => {
        if (issue.status === "Resolved" || issue.status === "Fix Completed") return false;
        const dist = getDistanceInMeters(issueData.latitude, issueData.longitude, issue.latitude, issue.longitude);
        return dist <= 50;
      });

      const duplicate = nearbyOpenIssues.find(i => i.category === issueData.category);

      if (duplicate) {
        const currentVerifiedBy = duplicate.verifiedBy || [];
        const alreadyVerified = currentVerifiedBy.includes(issueData.reportedBy);
        const updatedVerifiedBy = alreadyVerified ? currentVerifiedBy : [...currentVerifiedBy, issueData.reportedBy];
        const updatedCount = (duplicate.verificationsCount || 0) + (alreadyVerified ? 0 : 1);
        let newStatus = duplicate.status;
        if (updatedCount >= 3 && duplicate.status === "Reported") {
          newStatus = "Verified";
        }

        const updatedDuplicate = {
          ...duplicate,
          verifiedBy: updatedVerifiedBy,
          verificationsCount: updatedCount,
          status: newStatus,
          relatedIssues: [...(duplicate.relatedIssues || []), `reported_by_${issueData.reportedBy}_at_${Date.now()}`]
        };

        const idx = issues.findIndex(i => i.id === duplicate.id);
        issues[idx] = updatedDuplicate;
        localStorage.setItem("firebase_demo_issues", JSON.stringify(issues));
        window.dispatchEvent(new Event("demo_issues_updated"));
        
        await awardPointsAndStats(issueData.reportedBy, 25, "verifiedCount");
        
        // Dispatch duplicate merge notification
        const event = new CustomEvent("duplicate_merged_toast", {
          detail: { 
            title: duplicate.title, 
            rationale: "Proximity match on identical categories (Demo Mode)." 
          }
        });
        window.dispatchEvent(event);

        return duplicate.id;
      }

      const newId = "demo_issue_" + Math.random().toString(36).substring(2, 11);
      const newIssue: CivicIssue = {
        ...issueData,
        id: newId,
        status: "Reported",
        reportedAt: Date.now(),
        verificationsCount: 0,
        verifiedBy: []
      };
      
      issues.push(newIssue);
      localStorage.setItem("firebase_demo_issues", JSON.stringify(issues));
      window.dispatchEvent(new Event("demo_issues_updated"));
      
      await awardPointsAndStats(issueData.reportedBy, 50, "reportedCount");
      return newId;
    }

    // Non-demo mode: Secure backend write via Express API
    const response = await fetch("/api/issues/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueData })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to submit report via server API.");
    }

    const resJson = await response.json();
    if (resJson.merged) {
      const event = new CustomEvent("duplicate_merged_toast", {
        detail: { 
          title: issueData.title, 
          rationale: resJson.rationale, 
          existingIssueId: resJson.existingIssueId 
        }
      });
      window.dispatchEvent(event);
      return resJson.existingIssueId;
    }

    return resJson.newIssueId;
  } catch (err) {
    const isOnline = typeof navigator !== "undefined" && navigator.onLine;
    if (isOnline) {
      console.error("Server API returned an error:", err);
      throw err;
    }
    console.warn("Write operation failed or timed out. Queueing offline fallback.", err);
    const tempId = "offline_" + Math.random().toString(36).substring(2, 11);
    await queueOfflineWrite({
      type: "create_issue",
      data: issueData,
      tempId,
      timestamp: Date.now()
    });
    await awardPointsAndStats(issueData.reportedBy, 50, "reportedCount");
    return tempId;
  }
}

/**
 * Verify an issue reported by another user
 */
export async function verifyIssue(issueId: string, verifierId: string): Promise<boolean> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (isOffline) {
    await queueOfflineWrite({
      type: "verify_issue",
      data: { issueId, verifierId },
      timestamp: Date.now()
    });
    await awardPointsAndStats(verifierId, 25, "verifiedCount");
    return true;
  }

  try {
    if (isDemoMode()) {
      initDemoStorage();
      const stored = localStorage.getItem("firebase_demo_issues");
      const issues: CivicIssue[] = stored ? JSON.parse(stored) : [];
      const index = issues.findIndex(i => i.id === issueId);
      if (index === -1) {
        throw new Error("Issue not found");
      }
      const issue = issues[index];
      if (issue.reportedBy === verifierId) {
        throw new Error("You cannot verify your own reported issues!");
      }
      if (issue.verifiedBy.includes(verifierId)) {
        throw new Error("You have already verified this issue!");
      }

      const updatedVerifiedBy = [...issue.verifiedBy, verifierId];
      const newCount = updatedVerifiedBy.length;
      let newStatus = issue.status;

      if (issue.status === "Reported" && newCount >= 3) {
        newStatus = "Verified";
      }

      issues[index] = {
        ...issue,
        verifiedBy: updatedVerifiedBy,
        verificationsCount: newCount,
        status: newStatus
      };

      localStorage.setItem("firebase_demo_issues", JSON.stringify(issues));
      window.dispatchEvent(new Event("demo_issues_updated"));

      await awardPointsAndStats(verifierId, 25, "verifiedCount");
      return true;
    }

    // Non-demo mode: Secure backend write via Express API
    const response = await fetch("/api/issues/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId, verifierId })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to verify issue via server.");
    }

    return true;
  } catch (err) {
    const isOnline = typeof navigator !== "undefined" && navigator.onLine;
    if (isOnline) {
      console.error("Server API returned an error:", err);
      throw err;
    }
    console.warn("Verify request failed, queueing offline fallback.", err);
    await queueOfflineWrite({
      type: "verify_issue",
      data: { issueId, verifierId },
      timestamp: Date.now()
    });
    await awardPointsAndStats(verifierId, 25, "verifiedCount");
    return true;
  }
}

/**
 * Update issue status (e.g. In Progress, Resolved)
 */
export async function updateIssueStatus(issueId: string, newStatus: CivicIssue["status"], officialResponse?: string): Promise<void> {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (isOffline) {
    await queueOfflineWrite({
      type: "update_status",
      data: { issueId, status: newStatus, officialResponse },
      timestamp: Date.now()
    });
    return;
  }

  try {
    if (isDemoMode()) {
      initDemoStorage();
      const stored = localStorage.getItem("firebase_demo_issues");
      const issues: CivicIssue[] = stored ? JSON.parse(stored) : [];
      const index = issues.findIndex(i => i.id === issueId);
      if (index === -1) return;
      const issue = issues[index];

      issues[index] = {
        ...issue,
        status: newStatus,
        officialResponse: officialResponse || issue.officialResponse,
        officialResponseAt: Date.now()
      };

      localStorage.setItem("firebase_demo_issues", JSON.stringify(issues));
      window.dispatchEvent(new Event("demo_issues_updated"));

      if ((newStatus === "Resolved" || newStatus === "Fix Completed") && issue.status !== "Resolved" && issue.status !== "Fix Completed") {
        await awardPointsAndStats(issue.reportedBy, 100, "resolvedCount");
      }
      return;
    }

    // Non-demo mode: Secure backend write via Express API
    const response = await fetch("/api/issues/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId, status: newStatus, officialResponse })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to update status via server.");
    }
  } catch (err) {
    const isOnline = typeof navigator !== "undefined" && navigator.onLine;
    if (isOnline) {
      console.error("Server API returned an error:", err);
      throw err;
    }
    console.warn("Update status request failed, queueing offline fallback.", err);
    await queueOfflineWrite({
      type: "update_status",
      data: { issueId, status: newStatus, officialResponse },
      timestamp: Date.now()
    });
  }
}

export async function seedFirestoreDatabase() {
  await seedFirestoreIfEmpty();
}

/**
 * Helper to seed Firestore database with demo issues and leaderboard users if it is empty.
 * This guarantees that when a user logs in (even in real Firestore mode), they immediately see pre-loaded data to analyze.
 */
async function seedFirestoreIfEmpty() {
  try {
    const issuesCol = collection(db, "issues");
    const issuesSnap = await getDocs(query(issuesCol, limit(1)));
    if (issuesSnap.empty) {
      console.log("Firestore 'issues' collection is empty. Seeding initial demo issues...");
      for (const issue of INITIAL_DEMO_ISSUES) {
        await setDoc(doc(db, "issues", issue.id), cleanUndefined(issue));
      }
      console.log("Firestore 'issues' collection successfully seeded.");
    }

    const usersCol = collection(db, "users");
    const usersSnap = await getDocs(query(usersCol, limit(1)));
    if (usersSnap.empty) {
      console.log("Firestore 'users' collection is empty. Seeding initial demo leaderboard users...");
      for (const lUser of INITIAL_DEMO_LEADERBOARD) {
        await setDoc(doc(db, "users", lUser.uid), cleanUndefined({
          uid: lUser.uid,
          displayName: lUser.displayName,
          points: lUser.points,
          reportedCount: lUser.reportedCount,
          verifiedCount: lUser.verifiedCount,
          badges: lUser.badges,
          email: `${lUser.uid}@communityhero.org`,
          resolvedCount: lUser.reportedCount > 2 ? 1 : 0
        }));
      }
      console.log("Firestore 'users' collection successfully seeded.");
    }
  } catch (err) {
    console.warn("Could not seed Firestore (this is normal if rules are restrictive or connection is offline):", err);
  }
}

/**
 * Listen to all issues in real-time
 */
export function subscribeToIssues(callback: (issues: CivicIssue[]) => void, onError?: (error: any) => void) {
  let isSubscribed = true;

  // 1. Immediately emit cached issues with offline edits applied for instant load
  getCachedIssues().then(async (cached) => {
    if (isSubscribed) {
      const adjusted = await applyOfflineEdits(cached);
      callback(adjusted);
    }
  }).catch(err => {
    console.warn("Failed to retrieve cached issues from IndexedDB:", err);
  });

  // 2. Set up listener for offline changes so the UI stays reactive offline!
  const handleOfflineChange = async () => {
    if (!isSubscribed) return;
    try {
      const cached = await getCachedIssues();
      const adjusted = await applyOfflineEdits(cached);
      callback(adjusted);
    } catch (e) {
      console.warn("Failed to refresh offline edits:", e);
    }
  };
  window.addEventListener("offline_queue_changed", handleOfflineChange);

  // 3. Define how we process live database updates
  const handleLiveIssues = async (liveList: CivicIssue[]) => {
    if (!isSubscribed) return;
    // Update our IndexedDB cache first
    await cacheIssues(liveList);
    // Apply any local offline writes that haven't synced yet
    const adjusted = await applyOfflineEdits(liveList);
    callback(adjusted);
  };

  // 4. Delegate to the underlying real Firebase stream or Demo stream
  let realUnsubscribe: (() => void) | null = null;

  if (isDemoMode()) {
    initDemoStorage();
    const loadIssues = () => {
      const stored = localStorage.getItem("firebase_demo_issues");
      const list = stored ? JSON.parse(stored) : INITIAL_DEMO_ISSUES;
      list.sort((a: CivicIssue, b: CivicIssue) => b.reportedAt - a.reportedAt);
      handleLiveIssues(list);
    };
    loadIssues();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "firebase_demo_issues") {
        loadIssues();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    
    const handleCustomChange = () => {
      loadIssues();
    };
    window.addEventListener("demo_issues_updated", handleCustomChange);

    realUnsubscribe = () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("demo_issues_updated", handleCustomChange);
    };
  } else {
    // Real Firestore subscription
    let activeUnsubscribe: (() => void) | null = null;
    
    const startListening = () => {
      if (!isSubscribed) return;
      const q = query(collection(db, "issues"), orderBy("reportedAt", "desc"));
      activeUnsubscribe = onSnapshot(q, (snapshot) => {
        const issues: CivicIssue[] = [];
        snapshot.forEach((doc) => {
          issues.push(doc.data() as CivicIssue);
        });
        handleLiveIssues(issues);
      }, (error) => {
        console.error("Error subscribing to issues collection:", error);
        if (onError) onError(error);
      });
    };

    if (!auth.currentUser) {
      signInAnonymously(auth)
        .then(() => {
          startListening();
        })
        .catch((error) => {
          console.error("Auto-anonymous authentication failed for issues stream:", error);
          if (onError) onError(error);
        });
    } else {
      startListening();
    }

    realUnsubscribe = () => {
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }

  return () => {
    isSubscribed = false;
    window.removeEventListener("offline_queue_changed", handleOfflineChange);
    if (realUnsubscribe) {
      realUnsubscribe();
    }
  };
}

/**
 * Subscribe to a single user profile
 */
export function subscribeToUserProfile(userId: string, callback: (profile: UserProfile | null) => void, onError?: (error: any) => void) {
  let isSubscribed = true;

  // 1. Immediately emit cached profile
  getCachedUserProfile(userId).then(cached => {
    if (isSubscribed && cached) {
      callback(cached);
    }
  }).catch(err => {
    console.warn("Failed to get cached user profile:", err);
  });

  const handleLiveProfile = async (profile: UserProfile | null) => {
    if (!isSubscribed) return;
    if (profile) {
      await cacheUserProfile(profile);
    }
    callback(profile);
  };

  let realUnsubscribe: (() => void) | null = null;

  if (isDemoMode()) {
    const loadProfile = () => {
      const stored = localStorage.getItem("firebase_demo_user_profile");
      if (stored) {
        handleLiveProfile(JSON.parse(stored));
      } else {
        handleLiveProfile({
          uid: userId,
          displayName: "Demo Hero",
          email: "guest@communityhero.org",
          points: 100,
          badges: ["First Step"],
          reportedCount: 0,
          verifiedCount: 0,
          resolvedCount: 0
        });
      }
    };
    loadProfile();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "firebase_demo_user_profile") {
        loadProfile();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    const handleCustomChange = () => {
      loadProfile();
    };
    window.addEventListener("demo_profile_updated", handleCustomChange);
    
    realUnsubscribe = () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("demo_profile_updated", handleCustomChange);
    };
  } else {
    let activeUnsubscribe: (() => void) | null = null;

    const startListening = () => {
      if (!isSubscribed) return;
      activeUnsubscribe = onSnapshot(doc(db, "users", userId), (docSnap) => {
        if (docSnap.exists()) {
          handleLiveProfile(docSnap.data() as UserProfile);
        } else {
          handleLiveProfile(null);
        }
      }, (error) => {
        console.error(`Error subscribing to user profile ${userId}:`, error);
        if (onError) onError(error);
      });
    };

    if (!auth.currentUser) {
      signInAnonymously(auth)
        .then(() => {
          startListening();
        })
        .catch((error) => {
          console.error(`Auto-anonymous authentication failed for user profile ${userId}:`, error);
          if (onError) onError(error);
        });
    } else {
      startListening();
    }

    realUnsubscribe = () => {
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }

  return () => {
    isSubscribed = false;
    if (realUnsubscribe) realUnsubscribe();
  };
}

/**
 * Fetch leaderboard users
 */
export function subscribeToLeaderboard(callback: (users: LeaderboardUser[]) => void, onError?: (error: any) => void) {
  let isSubscribed = true;

  // 1. Immediately emit cached leaderboard
  getCachedLeaderboard().then(cached => {
    if (isSubscribed && cached && cached.length > 0) {
      callback(cached);
    }
  }).catch(err => {
    console.warn("Failed to get cached leaderboard:", err);
  });

  const handleLiveLeaderboard = async (users: LeaderboardUser[]) => {
    if (!isSubscribed) return;
    await cacheLeaderboard(users);
    callback(users);
  };

  let realUnsubscribe: (() => void) | null = null;

  if (isDemoMode()) {
    initDemoStorage();
    const loadLeaderboard = () => {
      const stored = localStorage.getItem("firebase_demo_leaderboard");
      const list: LeaderboardUser[] = stored ? JSON.parse(stored) : INITIAL_DEMO_LEADERBOARD;
      const userStored = localStorage.getItem("firebase_demo_user_profile");
      if (userStored) {
        const uProf: UserProfile = JSON.parse(userStored);
        const exists = list.some(u => u.uid === uProf.uid);
        if (!exists) {
          list.push({
            uid: uProf.uid,
            displayName: uProf.displayName,
            points: uProf.points,
            reportedCount: uProf.reportedCount,
            verifiedCount: uProf.verifiedCount,
            badges: uProf.badges
          });
        } else {
          const index = list.findIndex(u => u.uid === uProf.uid);
          list[index] = {
            uid: uProf.uid,
            displayName: uProf.displayName,
            points: uProf.points,
            reportedCount: uProf.reportedCount,
            verifiedCount: uProf.verifiedCount,
            badges: uProf.badges
          };
        }
      }
      list.sort((a, b) => b.points - a.points);
      handleLiveLeaderboard(list.slice(0, 10));
    };
    loadLeaderboard();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "firebase_demo_leaderboard" || e.key === "firebase_demo_user_profile") {
        loadLeaderboard();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    const handleCustomChange = () => {
      loadLeaderboard();
    };
    window.addEventListener("demo_leaderboard_updated", handleCustomChange);
    window.addEventListener("demo_profile_updated", handleCustomChange);

    realUnsubscribe = () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("demo_leaderboard_updated", handleCustomChange);
      window.removeEventListener("demo_profile_updated", handleCustomChange);
    };
  } else {
    let activeUnsubscribe: (() => void) | null = null;

    const startListening = () => {
      if (!isSubscribed) return;
      const q = query(collection(db, "users"), orderBy("points", "desc"), limit(10));
      activeUnsubscribe = onSnapshot(q, (snapshot) => {
        const users: LeaderboardUser[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          users.push({
            uid: doc.id,
            displayName: data.displayName || "Anonymous Hero",
            points: data.points || 0,
            reportedCount: data.reportedCount || 0,
            verifiedCount: data.verifiedCount || 0,
            badges: data.badges || []
          });
        });
        handleLiveLeaderboard(users);
      }, (error) => {
        console.error("Error subscribing to leaderboard:", error);
        if (onError) onError(error);
      });
    };

    if (!auth.currentUser) {
      signInAnonymously(auth)
        .then(() => {
          startListening();
        })
        .catch((error) => {
          console.error("Auto-anonymous authentication failed for leaderboard stream:", error);
          if (onError) onError(error);
        });
    } else {
      startListening();
    }

    realUnsubscribe = () => {
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }

  return () => {
    isSubscribed = false;
    if (realUnsubscribe) realUnsubscribe();
  };
}

export interface FirebaseDiagResult {
  configValid: boolean;
  missingKeys: string[];
  usingPlaceholders: boolean;
  authDomainMatched: boolean;
  projectId: string;
  isDevDomain: boolean;
}

/**
 * Diagnostic utility to verify Firebase configuration and detect initialization errors
 */
export function diagnoseFirebaseConfig(): FirebaseDiagResult {
  const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];
  const missingKeys: string[] = [];
  let usingPlaceholders = false;

  requiredKeys.forEach(key => {
    const val = (firebaseConfig as any)[key];
    if (!val) {
      missingKeys.push(key);
    } else if (val === "..." || val.includes("YOUR_") || val.includes("<") || val === "") {
      usingPlaceholders = true;
    }
  });

  const authDomain = firebaseConfig.authDomain || "";
  const projectId = firebaseConfig.projectId || "";
  const currentHost = typeof window !== "undefined" ? window.location.hostname : "";

  return {
    configValid: missingKeys.length === 0 && !usingPlaceholders,
    missingKeys,
    usingPlaceholders,
    authDomainMatched: authDomain.includes(projectId),
    projectId,
    isDevDomain: currentHost.includes("run.app") || currentHost.includes("localhost") || currentHost.includes("127.0.0.1")
  };
}

