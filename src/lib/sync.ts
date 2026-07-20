import { db } from "./local-db";

const LAST_SYNC_KEY = "lastSyncedAt";

export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "synced";

let listeners: ((status: SyncStatus) => void)[] = [];
export function onSyncStatus(cb: (status: SyncStatus) => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
function emit(status: SyncStatus) {
  listeners.forEach((l) => l(status));
}

async function getLastSyncedAt(): Promise<string> {
  const row = await db.meta.get(LAST_SYNC_KEY);
  return row?.value ?? "1970-01-01T00:00:00.000Z";
}
async function setLastSyncedAt(iso: string) {
  await db.meta.put({ key: LAST_SYNC_KEY, value: iso });
}

export async function hasPendingChanges(): Promise<boolean> {
  const [c, p, e, b] = await Promise.all([
    db.categories.where("dirty").equals(1).count(),
    db.prices.where("dirty").equals(1).count(),
    db.entries.where("dirty").equals(1).count(),
    db.budgets.where("dirty").equals(1).count(),
  ]);
  return c + p + e + b > 0;
}

export async function runSync(): Promise<{ ok: boolean; error?: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    emit("offline");
    return { ok: false, error: "offline" };
  }

  emit("syncing");
  try {
    const since = await getLastSyncedAt();
    const [dirtyCategories, dirtyPrices, dirtyEntries, dirtyBudgets] = await Promise.all([
      db.categories.where("dirty").equals(1).toArray(),
      db.prices.where("dirty").equals(1).toArray(),
      db.entries.where("dirty").equals(1).toArray(),
      db.budgets.where("dirty").equals(1).toArray(),
    ]);

    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        since,
        changes: {
          categories: dirtyCategories,
          prices: dirtyPrices,
          entries: dirtyEntries,
          budgets: dirtyBudgets,
        },
      }),
    });

    if (!res.ok) throw new Error(`sync failed: ${res.status}`);
    const data = await res.json();

    // Clear dirty flags on what we successfully pushed
    await db.transaction("rw", db.categories, db.prices, db.entries, db.budgets, async () => {
      for (const c of dirtyCategories) await db.categories.update(c.id, { dirty: 0 });
      for (const p of dirtyPrices) await db.prices.update(p.id, { dirty: 0 });
      for (const e of dirtyEntries) await db.entries.update(e.id, { dirty: 0 });
      for (const b of dirtyBudgets) await db.budgets.update(b.id, { dirty: 0 });
    });

    // Apply pulled remote changes (skip ones we just pushed to avoid echo-overwrite races is
    // fine here since server is source of truth post-push)
    const pulled = data.changes ?? {};
    await db.transaction("rw", db.categories, db.prices, db.entries, db.budgets, async () => {
      for (const c of pulled.categories ?? []) {
        await db.categories.put({ ...c, step: Number(c.step) || 1, dirty: 0 });
      }
      for (const p of pulled.prices ?? []) {
        await db.prices.put({ ...p, price: Number(p.price), dirty: 0 });
      }
      for (const e of pulled.entries ?? []) {
        await db.entries.put({ ...e, quantity: Number(e.quantity), dirty: 0 });
      }
      for (const b of pulled.budgets ?? []) {
        await db.budgets.put({ ...b, monthlyLimit: Number(b.monthlyLimit), dirty: 0 });
      }
    });

    await setLastSyncedAt(data.serverTime);
    emit("synced");
    return { ok: true };
  } catch (err) {
    console.error("sync error", err);
    emit("error");
    return { ok: false, error: String(err) };
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/** Call once on app mount: syncs on load, on reconnect, and periodically. */
export function startAutoSync(intervalMs = 30000) {
  if (typeof window === "undefined") return () => {};

  runSync();
  const onOnline = () => runSync();
  window.addEventListener("online", onOnline);
  intervalHandle = setInterval(() => {
    if (navigator.onLine) runSync();
  }, intervalMs);

  return () => {
    window.removeEventListener("online", onOnline);
    if (intervalHandle) clearInterval(intervalHandle);
  };
}
