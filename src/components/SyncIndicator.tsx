"use client";

import { useApp } from "@/context/AppContext";
import { CloudOff, RefreshCw, CloudCheck, CloudAlert } from "lucide-react";

export default function SyncIndicator() {
  const { syncStatus, isOnline, sync } = useApp();

  if (!isOnline) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-text-muted">
        <CloudOff size={14} /> Offline
      </span>
    );
  }

  const map: Record<string, { icon: React.ReactNode; label: string }> = {
    idle: { icon: <CloudCheck size={14} />, label: "Up to date" },
    syncing: { icon: <RefreshCw size={14} className="animate-spin" />, label: "Syncing…" },
    synced: { icon: <CloudCheck size={14} />, label: "Synced" },
    offline: { icon: <CloudOff size={14} />, label: "Offline" },
    error: { icon: <CloudAlert size={14} />, label: "Sync issue" },
  };
  const state = map[syncStatus] ?? map.idle;

  return (
    <button
      onClick={() => sync()}
      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition"
      title="Tap to sync now"
    >
      {state.icon} {state.label}
    </button>
  );
}
