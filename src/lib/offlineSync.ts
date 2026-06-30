import { CivicIssue } from "../types";
import { reportIssue, verifyIssue, updateIssueStatus } from "./firebase";
import { getOfflineWrites, deleteOfflineWrite } from "./indexedDbService";

export interface OfflineReport {
  id: string; // Temporary offline ID
  title: string;
  description: string;
  category: CivicIssue["category"];
  urgency: CivicIssue["urgency"];
  locationName: string;
  latitude: number;
  longitude: number;
  reportedBy: string;
  reportedByName: string;
  imageUrl?: string;
  voiceUrl?: string;
  timestamp: number;
}

const QUEUE_KEY = "samriddhi_offline_queue";

/**
 * Gets all pending offline reports
 */
export function getOfflineQueue(): OfflineReport[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to read offline queue from localStorage:", e);
    return [];
  }
}

/**
 * Saves the offline queue to localStorage
 */
function saveOfflineQueue(queue: OfflineReport[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event("offline_queue_changed"));
  } catch (e) {
    console.error("Failed to write offline queue to localStorage:", e);
  }
}

/**
 * Adds an issue report to the offline queue
 */
export function queueOfflineReport(
  reportData: Omit<OfflineReport, "id" | "timestamp">
): OfflineReport {
  const queue = getOfflineQueue();
  const newReport: OfflineReport = {
    ...reportData,
    id: "offline_" + Math.random().toString(36).substring(2, 11),
    timestamp: Date.now()
  };
  
  queue.push(newReport);
  saveOfflineQueue(queue);
  return newReport;
}

/**
 * Removes a specific report from the offline queue
 */
export function removeFromOfflineQueue(id: string) {
  const queue = getOfflineQueue();
  const filtered = queue.filter(r => r.id !== id);
  saveOfflineQueue(filtered);
}

/**
 * Attempts to synchronize all pending offline reports with the backend
 * @param onSynced Callback triggered for each successfully synchronized report
 */
export async function syncOfflineQueue(
  onSynced?: (report: OfflineReport, serverId: string) => void
): Promise<number> {
  let successCount = 0;

  // --- 1. Sync standard localStorage Queue (OfflineReport) ---
  const queue = getOfflineQueue();
  if (queue.length > 0) {
    console.log(`[OfflineSync] Found ${queue.length} pending reports to sync from LocalStorage...`);
    const pending = [...queue];
    
    for (const report of pending) {
      try {
        const serverId = await reportIssue({
          title: report.title,
          description: report.description,
          category: report.category,
          urgency: report.urgency,
          locationName: report.locationName,
          latitude: report.latitude,
          longitude: report.longitude,
          reportedBy: report.reportedBy,
          reportedByName: report.reportedByName,
          imageUrl: report.imageUrl,
          voiceUrl: report.voiceUrl
        });
        
        removeFromOfflineQueue(report.id);
        successCount++;
        if (onSynced) {
          onSynced(report, serverId);
        }
      } catch (err) {
        console.error(`[OfflineSync] Failed to sync report ${report.id}:`, err);
      }
    }
  }

  // --- 2. Sync IndexedDB Operations Queue ---
  try {
    const idxDbOps = await getOfflineWrites();
    if (idxDbOps.length > 0) {
      console.log(`[OfflineSync] Found ${idxDbOps.length} pending operations to sync from IndexedDB...`);
      for (const op of idxDbOps) {
        if (!op.id) continue;
        try {
          if (op.type === "create_issue") {
            await reportIssue(op.data);
            await deleteOfflineWrite(op.id);
            successCount++;
          } else if (op.type === "verify_issue") {
            await verifyIssue(op.data.issueId, op.data.verifierId);
            await deleteOfflineWrite(op.id);
            successCount++;
          } else if (op.type === "update_status") {
            await updateIssueStatus(op.data.issueId, op.data.status, op.data.officialResponse);
            await deleteOfflineWrite(op.id);
            successCount++;
          }
        } catch (opErr) {
          console.error(`[OfflineSync] Failed to sync IndexedDB operation ${op.id} (${op.type}):`, opErr);
        }
      }
    }
  } catch (err) {
    console.error("[OfflineSync] Error reading or syncing IndexedDB queue:", err);
  }

  if (successCount > 0) {
    const event = new CustomEvent("offline_sync_completed", {
      detail: { count: successCount }
    });
    window.dispatchEvent(event);
    window.dispatchEvent(new Event("offline_queue_changed"));
  }
  
  return successCount;
}
