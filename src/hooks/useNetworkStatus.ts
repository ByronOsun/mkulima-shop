import { useState, useEffect, useCallback } from 'react';
import { syncPendingSales, getPendingSalesCount } from '../services/offlineService';

export function useNetworkStatus() {
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing,      setSyncing]      = useState(false);

  const refreshCount = useCallback(async () => {
    setPendingCount(await getPendingSalesCount());
  }, []);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncPendingSales();
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();

    const onOnline  = () => { setIsOnline(true);  doSync(); };
    const onOffline = () => { setIsOnline(false); };
    const onQueued  = () => { refreshCount(); };

    window.addEventListener('online',               onOnline);
    window.addEventListener('offline',              onOffline);
    window.addEventListener('offline-sale-queued',  onQueued);

    // Attempt sync on mount in case we just re-opened with pending sales.
    if (navigator.onLine) doSync();

    return () => {
      window.removeEventListener('online',              onOnline);
      window.removeEventListener('offline',             onOffline);
      window.removeEventListener('offline-sale-queued', onQueued);
    };
  }, [doSync, refreshCount]);

  return { isOnline, pendingCount, syncing };
}
