import { CivicIssue, UserProfile, LeaderboardUser } from "../types";

export type OfflineOperation =
  | { id?: number; type: "create_issue"; data: any; tempId: string; timestamp: number }
  | { id?: number; type: "verify_issue"; data: { issueId: string; verifierId: string }; timestamp: number }
  | { id?: number; type: "update_status"; data: { issueId: string; status: CivicIssue["status"]; officialResponse?: string }; timestamp: number };

export type OmittedOfflineOperation =
  | { type: "create_issue"; data: any; tempId: string; timestamp: number }
  | { type: "verify_issue"; data: { issueId: string; verifierId: string }; timestamp: number }
  | { type: "update_status"; data: { issueId: string; status: CivicIssue["status"]; officialResponse?: string }; timestamp: number };

const DB_NAME = "CivicVoiceOfflineDB";
const DB_VERSION = 1;

/**
 * Promise-based IndexedDB initialization helper
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      
      // Store list of all issues
      if (!db.objectStoreNames.contains("issues_cache")) {
        db.createObjectStore("issues_cache", { keyPath: "id" });
      }

      // Store user profiles
      if (!db.objectStoreNames.contains("profiles_cache")) {
        db.createObjectStore("profiles_cache", { keyPath: "uid" });
      }

      // Store general key-value configs/summaries (like leaderboard)
      if (!db.objectStoreNames.contains("general_cache")) {
        db.createObjectStore("general_cache");
      }

      // Store pending offline operations (create, verify, status updates)
      if (!db.objectStoreNames.contains("offline_operations")) {
        db.createObjectStore("offline_operations", { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

/**
 * Cache all active issues
 */
export async function cacheIssues(issues: CivicIssue[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("issues_cache", "readwrite");
    const store = tx.objectStore("issues_cache");

    // Clear old cache first
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    // Add each issue
    for (const issue of issues) {
      if (!issue || !issue.id) continue;
      store.put(issue);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to cache issues:", err);
  }
}

/**
 * Get cached issues
 */
export async function getCachedIssues(): Promise<CivicIssue[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("issues_cache", "readonly");
    const store = tx.objectStore("issues_cache");

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result || [];
        // Sort descending by reported time to mirror default firebase sorting
        results.sort((a, b) => (b.reportedAt || 0) - (a.reportedAt || 0));
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to fetch cached issues:", err);
    return [];
  }
}

/**
 * Cache single user profile
 */
export async function cacheUserProfile(profile: UserProfile): Promise<void> {
  try {
    if (!profile || !profile.uid) return;
    const db = await openDB();
    const tx = db.transaction("profiles_cache", "readwrite");
    const store = tx.objectStore("profiles_cache");
    store.put(profile);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to cache profile:", err);
  }
}

/**
 * Get cached user profile
 */
export async function getCachedUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const db = await openDB();
    const tx = db.transaction("profiles_cache", "readonly");
    const store = tx.objectStore("profiles_cache");

    return new Promise((resolve, reject) => {
      const req = store.get(uid);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to fetch cached profile:", err);
    return null;
  }
}

/**
 * Cache leaderboard
 */
export async function cacheLeaderboard(users: LeaderboardUser[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("general_cache", "readwrite");
    const store = tx.objectStore("general_cache");
    store.put(users, "leaderboard");

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to cache leaderboard:", err);
  }
}

/**
 * Get cached leaderboard
 */
export async function getCachedLeaderboard(): Promise<LeaderboardUser[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("general_cache", "readonly");
    const store = tx.objectStore("general_cache");

    return new Promise((resolve, reject) => {
      const req = store.get("leaderboard");
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to fetch cached leaderboard:", err);
    return [];
  }
}

/**
 * Queue an offline database write operation
 */
export async function queueOfflineWrite(operation: OmittedOfflineOperation): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction("offline_operations", "readwrite");
    const store = tx.objectStore("offline_operations");

    let newId: number = 0;
    const req = store.add(operation);
    
    req.onsuccess = (e: any) => {
      newId = e.target.result;
    };

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Fire custom event to notify listeners that local offline changes queued
    window.dispatchEvent(new Event("offline_queue_changed"));
    return newId;
  } catch (err) {
    console.error("[IndexedDB] Failed to queue offline operation:", err);
    return 0;
  }
}

/**
 * Get all queued offline operations
 */
export async function getOfflineWrites(): Promise<OfflineOperation[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("offline_operations", "readonly");
    const store = tx.objectStore("offline_operations");

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to retrieve offline operations:", err);
    return [];
  }
}

/**
 * Delete a processed offline write from the queue
 */
export async function deleteOfflineWrite(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("offline_operations", "readwrite");
    const store = tx.objectStore("offline_operations");
    store.delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        window.dispatchEvent(new Event("offline_queue_changed"));
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Failed to delete offline operation:", err);
  }
}

/**
 * Apply cached/offline adjustments to an array of live issues
 * This ensures that newly queued offline reports, verifications, or status updates
 * are reflected immediately in the issues list before they are synced to the backend!
 */
export async function applyOfflineEdits(liveIssues: CivicIssue[], currentUserId?: string): Promise<CivicIssue[]> {
  const operations = await getOfflineWrites();
  if (operations.length === 0) return liveIssues;

  // Clone live issues so we don't mutate parameters
  const issues = [...liveIssues];

  for (const op of operations) {
    if (op.type === "create_issue") {
      // Avoid duplicating if already integrated
      const exists = issues.some(i => i.id === op.tempId || (i.title === op.data.title && i.latitude === op.data.latitude));
      if (!exists) {
        issues.unshift({
          ...op.data,
          id: op.tempId,
          status: "Reported",
          reportedAt: op.timestamp,
          verificationsCount: 0,
          verifiedBy: [],
          isOfflinePending: true // custom flag to show sync indicator in UI
        });
      }
    } else if (op.type === "verify_issue") {
      const idx = issues.findIndex(i => i.id === op.data.issueId);
      if (idx !== -1) {
        const issue = issues[idx];
        const verifiedBy = issue.verifiedBy || [];
        if (!verifiedBy.includes(op.data.verifierId)) {
          const updatedVerifiedBy = [...verifiedBy, op.data.verifierId];
          const updatedCount = updatedVerifiedBy.length;
          let newStatus = issue.status;
          if (issue.status === "Reported" && updatedCount >= 3) {
            newStatus = "Verified";
          }
          issues[idx] = {
            ...issue,
            verifiedBy: updatedVerifiedBy,
            verificationsCount: updatedCount,
            status: newStatus,
            isOfflinePending: true
          };
        }
      }
    } else if (op.type === "update_status") {
      const idx = issues.findIndex(i => i.id === op.data.issueId);
      if (idx !== -1) {
        issues[idx] = {
          ...issues[idx],
          status: op.data.status,
          officialResponse: op.data.officialResponse || issues[idx].officialResponse,
          officialResponseAt: op.timestamp,
          isOfflinePending: true
        };
      }
    }
  }

  return issues;
}
