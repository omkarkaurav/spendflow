"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { listCategories, getEntriesForDate, upsertEntry, markSkipped, getPriceOn, getCurrentPrice } from "@/lib/data";
import { Category, DailyEntry } from "@/lib/local-db";
import { formatMoney, todayStr, formatDateLabel } from "@/lib/format";
import * as Icons from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Row = {
  category: Category;
  entry: DailyEntry | null;
  price: number;
};

function Icon({ name, ...props }: { name: string; size?: number; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[
    toPascal(name)
  ] || Icons.Package;
  return <Cmp {...props} />;
}
function toPascal(s: string) {
  return s.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());
}

export default function TodayPage() {
  const { userId } = useApp();
  const [date] = useState(todayStr());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const cats = await listCategories(userId);
    const entries = await getEntriesForDate(userId, date);
    const built: Row[] = await Promise.all(
      cats.map(async (c) => ({
        category: c,
        entry: entries.find((e) => e.categoryId === c.id) ?? null,
        price: (await getPriceOn(c.id, date)) || (await getCurrentPrice(c.id)),
      }))
    );
    setRows(built);
    setLoading(false);
  }, [userId, date]);

  useEffect(() => {
    load();
  }, [load]);

  if (!userId) return null;

  const total = rows.reduce((sum, r) => sum + (r.entry?.quantity ?? 0) * r.price, 0);
  const loggedCount = rows.filter((r) => r.entry).length;

  async function handleQuantity(row: Row, delta: number, step: number) {
    if (!userId) return;
    const current = row.entry?.quantity ?? 0;
    const next = Math.max(0, Math.round((current + delta * step) * 100) / 100);
    await upsertEntry(userId, row.category.id, date, next, next > 0);
    load();
  }

  async function handleSkip(row: Row) {
    if (!userId) return;
    await markSkipped(userId, row.category.id, date);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-text-muted">{formatDateLabel(date)}</p>
        <h1 className="font-display text-3xl mt-0.5">Today&apos;s Ledger</h1>
      </div>

      {/* Signature ledger card */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-baseline justify-between border-b border-border">
          <span className="text-sm text-text-muted">
            {loggedCount}/{rows.length} logged
          </span>
          <span className="font-display text-2xl tabular">{formatMoney(total)}</span>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-text-muted text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-text-muted">
            No items yet.{" "}
            <Link href="/categories" className="text-accent underline underline-offset-2">
              Add your first one
            </Link>
            .
          </div>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {rows.map((row) => {
                const step = row.category.step || 1;
                const taken = !!row.entry?.taken;
                const qty = row.entry?.quantity ?? 0;
                return (
                  <motion.li
                    key={row.category.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 px-5 py-3.5 border-b border-border last:border-0"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: row.category.color + "26", color: row.category.color }}
                    >
                      <Icon name={row.category.icon} size={15} />
                    </div>
                    <span className="text-sm font-medium">{row.category.name}</span>
                    <span className="ledger-leader" />

                    {qty > 0 ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantity(row, -1, step)}
                          className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-surface-alt text-xs"
                        >
                          −
                        </button>
                        <span className="text-sm tabular w-14 text-center">
                          {qty} {row.category.unit}
                        </span>
                        <button
                          onClick={() => handleQuantity(row, 1, step)}
                          className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-surface-alt text-xs"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSkip(row)}
                          className="text-xs px-2.5 py-1 rounded-full bg-negative-soft text-negative"
                        >
                          Skipped
                        </button>
                        <button
                          onClick={() => handleQuantity(row, 1, step)}
                          className="text-xs px-2.5 py-1 rounded-full bg-positive-soft text-positive"
                        >
                          Log it
                        </button>
                      </div>
                    )}

                    <span className="text-sm tabular w-16 text-right text-text-muted">
                      {taken ? formatMoney(qty * row.price) : "—"}
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <p className="text-xs text-text-muted text-center">
        Entries save instantly to this device and sync automatically when you&apos;re online.
      </p>
    </div>
  );
}
