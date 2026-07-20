import { v4 as uuid } from "uuid";
import { db, Category, DailyEntry, PriceEntry, Budget, DEFAULT_CATEGORIES } from "./local-db";

const now = () => new Date().toISOString();

export async function ensureSeeded(userId: string) {
  const existing = await db.categories.where("userId").equals(userId).count();
  if (existing > 0) return;
  for (const c of DEFAULT_CATEGORIES) {
    await createCategory(userId, c.name, c.unit, c.icon, c.color, 0, c.step);
  }
}

// ---------- Categories ----------
export async function createCategory(
  userId: string,
  name: string,
  unit: string,
  icon: string,
  color: string,
  initialPrice: number,
  step: number = 1
): Promise<Category> {
  const cat: Category = {
    id: uuid(),
    userId,
    name,
    unit,
    step: step > 0 ? step : 1,
    icon,
    color,
    archived: false,
    createdAt: now(),
    updatedAt: now(),
    dirty: 1,
  };
  await db.categories.put(cat);
  if (initialPrice > 0) {
    await setPrice(userId, cat.id, initialPrice, new Date().toISOString().slice(0, 10));
  }
  return cat;
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  await db.categories.update(id, { ...patch, updatedAt: now(), dirty: 1 });
}

export async function archiveCategory(id: string, archived = true) {
  await db.categories.update(id, { archived, updatedAt: now(), dirty: 1 });
}

export async function deleteCategory(id: string) {
  await db.categories.update(id, { deleted: 1, dirty: 1, updatedAt: now() });
}

export async function listCategories(userId: string, includeArchived = false) {
  const all = await db.categories.where("userId").equals(userId).toArray();
  return all
    .filter((c) => !c.deleted && (includeArchived || !c.archived))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------- Prices ----------
export async function setPrice(userId: string, categoryId: string, price: number, effectiveFrom: string) {
  const entry: PriceEntry = {
    id: uuid(),
    userId,
    categoryId,
    price,
    effectiveFrom,
    createdAt: now(),
    dirty: 1,
  };
  await db.prices.put(entry);
  return entry;
}

export async function getPriceHistory(categoryId: string) {
  const all = await db.prices.where("categoryId").equals(categoryId).toArray();
  return all.filter((p) => !p.deleted).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

/** Price that was effective on a given YYYY-MM-DD date */
export async function getPriceOn(categoryId: string, date: string): Promise<number> {
  const history = await getPriceHistory(categoryId);
  let applicable = 0;
  for (const p of history) {
    if (p.effectiveFrom <= date) applicable = p.price;
    else break;
  }
  return applicable;
}

export async function getCurrentPrice(categoryId: string): Promise<number> {
  const history = await getPriceHistory(categoryId);
  return history.length ? history[history.length - 1].price : 0;
}

// ---------- Daily Entries ----------
export async function upsertEntry(
  userId: string,
  categoryId: string,
  date: string,
  quantity: number,
  taken: boolean,
  note = ""
) {
  const existing = await db.entries.where("[categoryId+date]").equals([categoryId, date]).first();
  if (existing) {
    await db.entries.update(existing.id, { quantity, taken, note, updatedAt: now(), dirty: 1 });
    return existing.id;
  }
  const entry: DailyEntry = {
    id: uuid(),
    userId,
    categoryId,
    date,
    quantity,
    taken,
    note,
    createdAt: now(),
    updatedAt: now(),
    dirty: 1,
  };
  await db.entries.put(entry);
  return entry.id;
}

export async function markSkipped(userId: string, categoryId: string, date: string) {
  return upsertEntry(userId, categoryId, date, 0, false);
}

export async function deleteEntry(id: string) {
  await db.entries.update(id, { deleted: 1, dirty: 1, updatedAt: now() });
}

export async function getEntriesForDate(userId: string, date: string) {
  const all = await db.entries.where("date").equals(date).toArray();
  return all.filter((e) => e.userId === userId && !e.deleted);
}

export async function getEntriesInRange(userId: string, from: string, to: string) {
  const all = await db.entries.where("date").between(from, to, true, true).toArray();
  return all.filter((e) => e.userId === userId && !e.deleted);
}

export async function getEntriesForCategory(categoryId: string, from?: string, to?: string) {
  let all = await db.entries.where("categoryId").equals(categoryId).toArray();
  all = all.filter((e) => !e.deleted);
  if (from) all = all.filter((e) => e.date >= from);
  if (to) all = all.filter((e) => e.date <= to);
  return all;
}

// ---------- Budgets ----------
export async function setBudget(userId: string, categoryId: string | null, monthlyLimit: number) {
  const existing = await db.budgets
    .where("userId")
    .equals(userId)
    .filter((b) => b.categoryId === categoryId && !b.deleted)
    .first();
  if (existing) {
    await db.budgets.update(existing.id, { monthlyLimit, updatedAt: now(), dirty: 1 });
    return existing.id;
  }
  const b: Budget = {
    id: uuid(),
    userId,
    categoryId,
    monthlyLimit,
    createdAt: now(),
    updatedAt: now(),
    dirty: 1,
  };
  await db.budgets.put(b);
  return b.id;
}

export async function listBudgets(userId: string) {
  const all = await db.budgets.where("userId").equals(userId).toArray();
  return all.filter((b) => !b.deleted);
}

// ---------- Cost calculation ----------
export async function costForEntry(entry: DailyEntry): Promise<number> {
  const price = await getPriceOn(entry.categoryId, entry.date);
  return price * entry.quantity;
}

export async function totalSpend(userId: string, from: string, to: string) {
  const entries = await getEntriesInRange(userId, from, to);
  let total = 0;
  const byCategory: Record<string, number> = {};
  for (const e of entries) {
    const cost = await costForEntry(e);
    total += cost;
    byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + cost;
  }
  return { total, byCategory, entries };
}
