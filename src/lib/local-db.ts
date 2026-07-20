import Dexie, { type Table } from "dexie";

// ---- Types (mirror the Neon/Postgres schema) ----

export interface Category {
  id: string;          // uuid
  userId: string;
  name: string;         // "Milk", "LPG", "Rent", "Netflix", "Fuel"...
  unit: string;          // free text, chosen by the user: "L", "kg", "cylinder", "month", "item", "kWh"...
  step: number;            // how much the +/- buttons increment by (e.g. 1, 0.5, 10)
  icon: string;           // lucide icon name
  color: string;            // hex accent for this category's dots/charts
  archived: boolean;
  createdAt: string;        // ISO
  updatedAt: string;
  dirty?: number;             // 1 = needs sync to server
  deleted?: number;             // 1 = tombstoned, needs delete-sync
}

export interface PriceEntry {
  id: string;
  userId: string;
  categoryId: string;
  price: number;             // price per unit, in the base currency
  effectiveFrom: string;      // ISO date - price applies from this date forward
  createdAt: string;
  dirty?: number;
  deleted?: number;
}

export interface DailyEntry {
  id: string;
  userId: string;
  categoryId: string;
  date: string;              // "YYYY-MM-DD"
  quantity: number;           // amount taken (0 if skipped)
  taken: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
  dirty?: number;
  deleted?: number;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string | null; // null = overall budget across all categories
  monthlyLimit: number;
  createdAt: string;
  updatedAt: string;
  dirty?: number;
  deleted?: number;
}

export interface Meta {
  key: string;
  value: string;
}

class SpendDB extends Dexie {
  categories!: Table<Category, string>;
  prices!: Table<PriceEntry, string>;
  entries!: Table<DailyEntry, string>;
  budgets!: Table<Budget, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super("spend-tracker-db");
    this.version(1).stores({
      categories: "id, userId, archived, dirty",
      prices: "id, userId, categoryId, effectiveFrom, dirty",
      entries: "id, userId, categoryId, date, dirty, [categoryId+date]",
      budgets: "id, userId, categoryId, dirty",
      meta: "key",
    });
  }
}

export const db = new SpendDB();

// ---- Starter categories, seeded once per new user. Just ordinary categories —
// fully editable, renamable, or deletable like anything the user adds themselves.
export const DEFAULT_CATEGORIES: Array<Pick<Category, "name" | "unit" | "step" | "icon" | "color">> = [
  { name: "Milk", unit: "L", step: 0.5, icon: "milk", color: "#9C7538" },
  { name: "RO Water", unit: "10L bottle", step: 1, icon: "droplets", color: "#59704C" },
];
