"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import {
  listCategories,
  createCategory,
  archiveCategory,
  setPrice,
  getCurrentPrice,
  getPriceHistory,
} from "@/lib/data";
import { Category } from "@/lib/local-db";
import { formatMoney, todayStr } from "@/lib/format";
import * as Icons from "lucide-react";
import { Plus, X, Archive, History } from "lucide-react";

const UNIT_SUGGESTIONS = ["L", "kg", "item", "unit", "cylinder", "month", "kWh", "km", "bottle", "visit"];

const COLOR_OPTIONS = ["#9C7538", "#59704C", "#A2503E", "#5C6B8A", "#8A6B9C", "#6B8A85"];
const ICON_OPTIONS = [
  "milk",
  "droplets",
  "flame",
  "shopping-basket",
  "zap",
  "wifi",
  "fuel",
  "home",
  "pill",
  "credit-card",
  "car",
  "package",
];

function CatIcon({ name, size = 16 }: { name: string; size?: number }) {
  const pascal = name.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[pascal] || Icons.Package;
  return <Cmp size={size} />;
}

export default function CategoriesPage() {
  const { userId } = useApp();
  const [cats, setCats] = useState<Category[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const list = await listCategories(userId);
    setCats(list);
    const p: Record<string, number> = {};
    for (const c of list) p[c.id] = await getCurrentPrice(c.id);
    setPrices(p);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!userId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Your Items</h1>
          <p className="text-sm text-text-muted mt-1">
            Anything you buy or pay for regularly — milk, LPG, rent, subscriptions, fuel, medicine, electricity…
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-accent text-bg text-sm font-medium px-3.5 py-2 rounded-lg hover:opacity-90"
        >
          <Plus size={16} /> Add item
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {cats.map((c) => (
          <div key={c.id} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: c.color + "26", color: c.color }}
                >
                  <CatIcon name={c.icon} />
                </div>
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-text-muted">per {c.unit}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setHistoryFor(historyFor === c.id ? null : c.id)}
                  className="w-7 h-7 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-muted"
                  title="Price history"
                >
                  <History size={14} />
                </button>
                <button
                  onClick={async () => {
                    await archiveCategory(c.id, true);
                    load();
                  }}
                  className="w-7 h-7 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-muted"
                  title="Archive"
                >
                  <Archive size={14} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-text-muted">Current price</span>
              <PriceEditor
                categoryId={c.id}
                userId={userId}
                current={prices[c.id] ?? 0}
                onSaved={load}
              />
            </div>

            {historyFor === c.id && <PriceHistoryList categoryId={c.id} />}
          </div>
        ))}
        {cats.length === 0 && (
          <p className="text-sm text-text-muted col-span-2 text-center py-8">
            No items yet. Add anything you track regularly — milk, LPG, rent, fuel, subscriptions…
          </p>
        )}
      </div>

      {showForm && (
        <AddCategoryModal
          userId={userId}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function PriceEditor({
  categoryId,
  userId,
  current,
  onSaved,
}: {
  categoryId: string;
  userId: string;
  current: number;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current));

  useEffect(() => setValue(String(current)), [current]);

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="font-mono text-sm tabular text-accent underline underline-offset-2">
        {formatMoney(current)}
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
          await setPrice(userId, categoryId, num, todayStr());
          onSaved();
        }
        setEditing(false);
      }}
      className="flex items-center gap-1"
    >
      <input
        autoFocus
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setEditing(false)}
        className="w-20 text-sm bg-bg border border-border rounded px-2 py-0.5 font-mono tabular"
      />
      <button type="submit" className="text-xs text-accent">
        Save
      </button>
    </form>
  );
}

function PriceHistoryList({ categoryId }: { categoryId: string }) {
  const [history, setHistory] = useState<{ price: number; effectiveFrom: string }[]>([]);
  useEffect(() => {
    getPriceHistory(categoryId).then((h) => setHistory(h.slice().reverse()));
  }, [categoryId]);

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-1">
      {history.length === 0 && <p className="text-xs text-text-muted">No price history yet.</p>}
      {history.map((h, i) => (
        <div key={i} className="flex justify-between text-xs text-text-muted">
          <span>from {h.effectiveFrom}</span>
          <span className="font-mono tabular">{formatMoney(h.price)}</span>
        </div>
      ))}
    </div>
  );
}

function AddCategoryModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [step, setStep] = useState("1");
  const [price, setPriceVal] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [icon, setIcon] = useState(ICON_OPTIONS[0]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createCategory(
      userId,
      name.trim(),
      unit.trim() || "unit",
      icon,
      color,
      parseFloat(price) || 0,
      parseFloat(step) || 1
    );
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">New item</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Grocery, Electricity, Newspaper…"
              className="w-full rounded-lg bg-bg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Unit</label>
            <input
              list="unit-suggestions"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="L, kg, cylinder, month, item…"
              className="w-full rounded-lg bg-bg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <datalist id="unit-suggestions">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <p className="text-[11px] text-text-muted mt-1">Type your own — e.g. &quot;cylinder&quot; for LPG, &quot;month&quot; for rent.</p>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">+/− step size</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={step}
              onChange={(e) => setStep(e.target.value)}
              className="w-full rounded-lg bg-bg border border-border px-3 py-2 text-sm outline-none focus:border-accent font-mono"
            />
            <p className="text-[11px] text-text-muted mt-1">How much each tap of +/− adds — e.g. 0.5 for half-liter steps, 1 for whole items.</p>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Price per unit (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPriceVal(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg bg-bg border border-border px-3 py-2 text-sm outline-none focus:border-accent font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-2">Icon & color</label>
            <div className="flex gap-2 flex-wrap">
              {ICON_OPTIONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                    icon === ic ? "border-accent" : "border-border"
                  }`}
                  style={{ background: color + "26", color }}
                >
                  <CatIcon name={ic} size={14} />
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full border-2"
                  style={{ background: c, borderColor: color === c ? c : "transparent" }}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-accent text-bg font-medium py-2.5 hover:opacity-90 transition"
          >
            Add item
          </button>
        </form>
      </div>
    </div>
  );
}
