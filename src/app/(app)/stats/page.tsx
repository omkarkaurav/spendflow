"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { listCategories, getEntriesInRange, getPriceOn, listBudgets } from "@/lib/data";
import { Category, DailyEntry, Budget } from "@/lib/local-db";
import { formatMoney, todayStr, startOfWeek, startOfMonth, startOfYear, toDateStr, addDays } from "@/lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Period = "day" | "week" | "month" | "year";

export default function StatsPage() {
  const { userId } = useApp();
  const [period, setPeriod] = useState<Period>("month");
  const [cats, setCats] = useState<Category[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({}); // categoryId -> date -> price

  const range = useMemo(() => {
    const now = new Date();
    let from: Date;
    if (period === "day") from = now;
    else if (period === "week") from = startOfWeek(now);
    else if (period === "month") from = startOfMonth(now);
    else from = startOfYear(now);
    return { from: toDateStr(from), to: todayStr() };
  }, [period]);

  const load = useCallback(async () => {
    if (!userId) return;
    const [c, e, b] = await Promise.all([
      listCategories(userId, true),
      getEntriesInRange(userId, range.from, range.to),
      listBudgets(userId),
    ]);
    setCats(c);
    setEntries(e);
    setBudgets(b);
    const priceMap: Record<string, Record<string, number>> = {};
    for (const entry of e) {
      priceMap[entry.categoryId] = priceMap[entry.categoryId] || {};
      if (priceMap[entry.categoryId][entry.date] === undefined) {
        priceMap[entry.categoryId][entry.date] = await getPriceOn(entry.categoryId, entry.date);
      }
    }
    setPrices(priceMap);
  }, [userId, range]);

  useEffect(() => {
    load();
  }, [load]);

  if (!userId) return null;

  const costOf = (e: DailyEntry) => (prices[e.categoryId]?.[e.date] ?? 0) * e.quantity;
  const total = entries.reduce((sum, e) => sum + costOf(e), 0);

  const byCategory: Record<string, number> = {};
  for (const e of entries) byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + costOf(e);

  const pieData = cats
    .map((c) => ({ name: c.name, value: byCategory[c.id] || 0, color: c.color }))
    .filter((d) => d.value > 0);

  // Trend: daily totals across the range for a bar chart
  const trend = useMemo(() => {
    const days: string[] = [];
    const from = new Date(range.from + "T00:00:00");
    const to = new Date(range.to + "T00:00:00");
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) days.push(toDateStr(d));
    return days.map((d) => ({
      date: d.slice(5),
      total: entries.filter((e) => e.date === d).reduce((s, e) => s + costOf(e), 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, range, prices]);

  const overallBudget = budgets.find((b) => b.categoryId === null);
  // Rough month-progress projection based on days elapsed in current month
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthSpendSoFar =
    period === "month"
      ? total
      : entries
          .filter((e) => e.date >= toDateStr(startOfMonth(now)))
          .reduce((s, e) => s + costOf(e), 0);
  const projected = (monthSpendSoFar / dayOfMonth) * daysInMonth;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl">Stats</h1>
        <div className="flex bg-surface border border-border rounded-full p-1">
          {(["day", "week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium capitalize transition ${
                period === p ? "bg-accent text-bg" : "text-text-muted hover:text-text"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-5">
        <p className="text-sm text-text-muted">Total spend this {period}</p>
        <p className="font-display text-4xl mt-1 tabular">{formatMoney(total)}</p>
      </div>

      {overallBudget && (
        <BudgetBar label="Overall monthly budget" spent={monthSpendSoFar} limit={overallBudget.monthlyLimit} />
      )}

      {period === "month" && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-sm text-text-muted mb-1">Forecasted month-end spend</p>
          <p className="font-display text-2xl tabular">{formatMoney(projected)}</p>
          <p className="text-xs text-text-muted mt-1">
            Based on {formatMoney(monthSpendSoFar)} spent over {dayOfMonth} of {daysInMonth} days.
          </p>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-5">
        <p className="text-sm text-text-muted mb-4">Daily spend</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={40} />
              <Tooltip
                formatter={((v: number) => formatMoney(Number(v))) as never}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-5">
        <p className="text-sm text-text-muted mb-4">By category</p>
        {pieData.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">No spend logged in this period.</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={((v: number) => formatMoney(Number(v))) as never} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full space-y-2">
              {pieData
                .sort((a, b) => b.value - a.value)
                .map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className="tabular text-text-muted">{formatMoney(d.value)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {cats
          .filter((c) => !c.archived)
          .map((c) => (
            <StreakCard key={c.id} category={c} range={range} />
          ))}
      </div>
    </div>
  );
}

function BudgetBar({ label, spent, limit }: { label: string; spent: number; limit: number }) {
  const pct = Math.min(100, (spent / limit) * 100);
  const over = spent > limit;
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-text-muted">{label}</span>
        <span className={`tabular ${over ? "text-negative" : ""}`}>
          {formatMoney(spent)} / {formatMoney(limit)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: over ? "var(--negative)" : "var(--accent)" }}
        />
      </div>
    </div>
  );
}

function StreakCard({ category, range }: { category: Category; range: { from: string; to: string } }) {
  const [stats, setStats] = useState<{ taken: number; total: number }>({ taken: 0, total: 0 });

  useEffect(() => {
    getEntriesInRange(category.userId, range.from, range.to).then((all) => {
      const forCat = all.filter((e) => e.categoryId === category.id);
      const taken = forCat.filter((e) => e.taken).length;
      setStats({ taken, total: forCat.length });
    });
  }, [category, range]);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: category.color }} />
        <span className="text-sm">{category.name}</span>
      </div>
      <span className="text-sm tabular text-text-muted">
        {stats.taken}/{stats.total} days
      </span>
    </div>
  );
}
