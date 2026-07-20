"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ensureSeeded } from "@/lib/data";
import { startAutoSync, onSyncStatus, runSync, type SyncStatus } from "@/lib/sync";

const AppCtx = createContext<{
  userId: string | null;
  syncStatus: SyncStatus;
  isOnline: boolean;
  sync: () => void;
}>({ userId: null, syncStatus: "idle", isOnline: true, sync: () => {} });

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const unsub = onSyncStatus(setSyncStatus);
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) return;
    ensureSeeded(userId);
    const stop = startAutoSync();
    return stop;
  }, [userId]);

  return (
    <AppCtx.Provider value={{ userId, syncStatus, isOnline, sync: () => runSync() }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => useContext(AppCtx);
