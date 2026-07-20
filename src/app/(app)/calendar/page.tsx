"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { listCategories, getEntriesInRange, upsertEntry, markSkipped, getPriceOn } from "@/lib/data";
import { Category, DailyEntry } from "@/lib/local-db";
import { formatMoney } from "@/lib/format";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dstr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export default function CalendarPage() {
  const { userId } = useApp();
  const [cursor, setCursor] = useState(() => new Date());
  const [cats, setCats] = useState<Category[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const load = useCallback(async () => {
    if (!userId) return;
    const list = await listCategories(userId, true);
    setCats(list);
    const from = dstr(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = dstr(year, month, lastDay);
    const e = await getEntriesInRange(userId, from, to);
    setEntries(e);
  }, [userId, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  if (!userId) return null;

  const entriesByDate: Record<string, DailyEntry[]> = {};
  for (const e of entries) {
    entriesByDate[e.date] = entriesByDate[e.date] || [];
    entriesByDate[e.date].push(e);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-surface-alt"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium w-32 text-center">
            {cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-surface-alt"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4">
        <div className="grid grid-cols-7 text-center text-xs text-text-muted mb-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((d, i) => {
            if (d === null) return <div key={i} />;
            const dateStr = dstr(year, month, d);
            const dayEntries = entriesByDate[dateStr] ?? [];
            const isToday = dateStr === new Date().toISOString().slice(0, 10);
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(dateStr)}
                className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 text-xs transition hover:bg-surface-alt ${
                  isToday ? "border-accent" : "border-border"
                }`}
              >
                <span className={isToday ? "text-accent font-semibold" : ""}>{d}</span>
                <div className="flex gap-0.5">
                  {cats.slice(0, 4).map((c) => {
                    const e = dayEntries.find((en) => en.categoryId === c.id);
                    if (!e) return null;
                    return (
                      <span
                        key={c.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: e.taken ? c.color : "var(--negative)" }}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-text-muted flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent inline-block" /> taken
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-negative inline-block" /> skipped
        </span>
      </p>

      {selectedDate && (
        <DayDetailModal
          userId={userId}
          date={selectedDate}
          categories={cats}
          entries={entriesByDate[selectedDate] ?? []}
          onClose={() => setSelectedDate(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function DayDetailModal({
  userId,
  date,
  categories,
  entries,
  onClose,
  onChanged,
}: {
  userId: string;
  date: string;
  categories: Category[];
  entries: DailyEntry[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const p: Record<string, number> = {};
      for (const c of categories) p[c.id] = await getPriceOn(c.id, date);
      setPrices(p);
    })();
  }, [categories, date]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-5 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">
            {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          {categories.map((c) => {
            const e = entries.find((en) => en.categoryId === c.id);
            const qty = e?.quantity ?? 0;
            const step = c.step || 1;
            return (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">{c.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const next = Math.max(0, Math.round((qty - step) * 100) / 100);
                      await upsertEntry(userId, c.id, date, next, next > 0);
                      onChanged();
                    }}
                    className="w-6 h-6 rounded-full border border-border text-xs hover:bg-surface-alt"
                  >
                    −
                  </button>
                  <span className="text-sm tabular w-16 text-center">
                    {qty} {c.unit}
                  </span>
                  <button
                    onClick={async () => {
                      const next = Math.round((qty + step) * 100) / 100;
                      await upsertEntry(userId, c.id, date, next, true);
                      onChanged();
                    }}
                    className="w-6 h-6 rounded-full border border-border text-xs hover:bg-surface-alt"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs tabular text-text-muted w-14 text-right">
                  {formatMoney(qty * (prices[c.id] ?? 0))}
                </span>
              </div>
            );
          })}
        </div>
        <button
          onClick={async () => {
            for (const c of categories) await markSkipped(userId, c.id, date);
            onChanged();
          }}
          className="w-full mt-4 text-xs text-negative border border-negative/30 rounded-lg py-2 hover:bg-negative-soft"
        >
          Mark entire day as skipped
        </button>
      </div>
    </div>
  );
}
