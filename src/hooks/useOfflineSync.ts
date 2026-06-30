import { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "../lib/AppContext";
import { syncOfflineQueue } from "../lib/offlineSync";
import { getOfflineWrites } from "../lib/indexedDbService";

export interface SyncNotification {
  id: string;
  title: string;
  body: string;
  type: string;
}

/**
 * Custom hook to monitor connection status and coordinate offline synchronization
 * from both the localStorage offline queue and IndexedDB queue to Firestore.
 */
export function useOfflineSync(
  addNotification: (notification: SyncNotification) => void,
  user: any,
  authLoading: boolean
) {
  const { t } = useApp();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const addNotificationRef = useRef(addNotification);
  const tRef = useRef(t);

  // Keep references fresh to avoid stale closures
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const triggerSync = useCallback(async () => {
    if (isSyncing) return 0;
    setIsSyncing(true);

    try {
      // Find count of operations in IndexedDB before syncing
      const pendingOps = await getOfflineWrites();
      const hasIndexedDbOps = pendingOps.length > 0;

      const syncedCount = await syncOfflineQueue((report) => {
        const syncId = Math.random().toString(36).substring(2, 9);
        addNotificationRef.current({
          id: syncId,
          title: tRef.current("Issue Synced Successfully"),
          body: `"${report.title}" has been uploaded and welcomed into the SAMRIDDHI PARIVAR!`,
          type: "success"
        });
      });

      if (syncedCount > 0 || hasIndexedDbOps) {
        const completeId = Math.random().toString(36).substring(2, 9);
        addNotificationRef.current({
          id: completeId,
          title: tRef.current("Synchronization Complete"),
          body: tRef.current("Successfully synced offline activities with the main database!"),
          type: "success"
        });
      }
      return syncedCount;
    } catch (err) {
      console.error("[useOfflineSync] Offline sync process failed:", err);
      return 0;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    // Monitor connection events
    const handleOnline = async () => {
      setIsOnline(true);
      const id = Math.random().toString(36).substring(2, 9);
      addNotificationRef.current({
        id,
        title: tRef.current("Network Connected"),
        body: tRef.current("Connection restored. Initiating automatic synchronization of offline reports..."),
        type: "info"
      });

      if (user && !authLoading) {
        await triggerSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      const id = Math.random().toString(36).substring(2, 9);
      addNotificationRef.current({
        id,
        title: tRef.current("Offline-First Mode Active"),
        body: tRef.current("You are currently offline. New reports will be saved locally and synced automatically when you reconnect!"),
        type: "warning"
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check on load
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
      if (navigator.onLine && user && !authLoading) {
        triggerSync().catch((err) =>
          console.error("[useOfflineSync] Initial mount sync failed:", err)
        );
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user, authLoading, triggerSync]);

  return {
    isOnline,
    isSyncing,
    triggerSync
  };
}
