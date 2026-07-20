"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useApp } from "@/context/AppContext";
import { listCategories, listBudgets, setBudget, archiveCategory } from "@/lib/data";
import { db } from "@/lib/local-db";
import { Category, Budget } from "@/lib/local-db";
import { Download, Upload, RotateCcw } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { userId, sync } = useApp();
  const [cats, setCats] = useState<Category[]>([]);
  const [archived, setArchived] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [overallBudget, setOverallBudget] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    const all = await listCategories(userId, true);
    setCats(all.filter((c) => !c.archived));
    setArchived(all.filter((c) => c.archived));
    const b = await listBudgets(userId);
    setBudgets(b);
    const overall = b.find((x) => x.categoryId === null);
    setOverallBudget(overall ? String(overall.monthlyLimit) : "");
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!userId) return null;

  async function handleExport() {
    const [categories, prices, entries, budgetsAll] = await Promise.all([
      db.categories.toArray(),
      db.prices.toArray(),
      db.entries.toArray(),
      db.budgets.toArray(),
    ]);
    const payload = { exportedAt: new Date().toISOString(), categories, prices, entries, budgets: budgetsAll };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await db.transaction("rw", db.categories, db.prices, db.entries, db.budgets, async () => {
        for (const c of data.categories ?? []) await db.categories.put({ ...c, dirty: 1 });
        for (const p of data.prices ?? []) await db.prices.put({ ...p, dirty: 1 });
        for (const en of data.entries ?? []) await db.entries.put({ ...en, dirty: 1 });
        for (const b of data.budgets ?? []) await db.budgets.put({ ...b, dirty: 1 });
      });
      setMessage("Backup restored. Syncing…");
      sync();
      load();
    } catch {
      setMessage("Could not read that file — is it a valid Ledger backup?");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Settings</h1>

      <section className="bg-surface border border-border rounded-2xl p-5">
        <p className="text-sm text-text-muted mb-1">Signed in as</p>
        <p className="font-medium">{session?.user?.name}</p>
        <p className="text-sm text-text-muted">{session?.user?.email}</p>
      </section>

      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-medium">Monthly budget</h2>
        <div>
          <label className="text-xs text-text-muted block mb-1">Overall (all items combined)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={overallBudget}
              onChange={(e) => setOverallBudget(e.target.value)}
              placeholder="e.g. 5000"
              className="flex-1 rounded-lg bg-bg border border-border px-3 py-2 text-sm font-mono outline-none focus:border-accent"
            />
            <button
              onClick={async () => {
                await setBudget(userId, null, parseFloat(overallBudget) || 0);
                load();
              }}
              className="px-4 rounded-lg bg-accent text-bg text-sm font-medium hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {cats.map((c) => (
            <CategoryBudgetRow key={c.id} category={c} budget={budgets.find((b) => b.categoryId === c.id)} onSaved={load} />
          ))}
        </div>
      </section>

      <section className="bg-surface border border-border rounded-2xl p-5 space-y-3">
        <h2 className="font-medium">Backup & restore</h2>
        <p className="text-xs text-text-muted">
          Your data lives on this device and syncs to the cloud automatically. You can also export a manual backup file anytime.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm hover:bg-surface-alt"
          >
            <Download size={14} /> Export
          </button>
          <label className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm hover:bg-surface-alt cursor-pointer">
            <Upload size={14} /> Import
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
        </div>
        {message && <p className="text-xs text-accent">{message}</p>}
      </section>

      {archived.length > 0 && (
        <section className="bg-surface border border-border rounded-2xl p-5 space-y-2">
          <h2 className="font-medium mb-1">Archived items</h2>
          {archived.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="text-text-muted">{c.name}</span>
              <button
                onClick={async () => {
                  await archiveCategory(c.id, false);
                  load();
                }}
                className="flex items-center gap-1 text-accent text-xs"
              >
                <RotateCcw size={12} /> Restore
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="text-center text-xs text-text-muted pt-2">
        Ledger — installable, offline-first spend tracker.
      </section>
    </div>
  );
}

function CategoryBudgetRow({
  category,
  budget,
  onSaved,
}: {
  category: Category;
  budget: Budget | undefined;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(budget ? String(budget.monthlyLimit) : "");
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-text-muted flex-1">{category.name}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="No limit"
        className="w-28 rounded-lg bg-bg border border-border px-2 py-1 text-xs font-mono tabular outline-none focus:border-accent"
      />
      <button
        onClick={async () => {
          await setBudget(category.userId, category.id, parseFloat(value) || 0);
          onSaved();
        }}
        className="text-xs text-accent"
      >
        Set
      </button>
    </div>
  );
}
