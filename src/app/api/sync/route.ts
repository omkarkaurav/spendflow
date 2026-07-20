import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbServer } from "@/lib/db";
import { categories, prices, entries, budgets } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";

type Change = Record<string, unknown> & {
  id: string;
  updatedAt?: string;
  createdAt?: string;
  deleted?: boolean;
};

// Push local changes (upsert by id, last-write-wins), then pull everything
// updated since `since` for this user, so other devices reconcile too.
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const since: string = body.since ?? "1970-01-01T00:00:00.000Z";
  const changes: {
    categories?: Change[];
    prices?: Change[];
    entries?: Change[];
    budgets?: Change[];
  } = body.changes ?? {};

  try {
    // ---- Push: categories ----
    for (const c of changes.categories ?? []) {
      await dbServer
        .insert(categories)
        .values({
          id: c.id,
          userId,
          name: c.name as string,
          unit: c.unit as string,
          step: String((c.step as number) ?? 1),
          icon: (c.icon as string) ?? "package",
          color: (c.color as string) ?? "#9C7538",
          archived: !!c.archived,
          deleted: !!c.deleted,
          createdAt: new Date(c.createdAt as string),
          updatedAt: new Date(c.updatedAt as string),
        })
        .onConflictDoUpdate({
          target: categories.id,
          set: {
            name: c.name as string,
            unit: c.unit as string,
            step: String((c.step as number) ?? 1),
            icon: (c.icon as string) ?? "package",
            color: (c.color as string) ?? "#9C7538",
            archived: !!c.archived,
            deleted: !!c.deleted,
            updatedAt: new Date(c.updatedAt as string),
          },
        });
    }

    // ---- Push: prices ----
    for (const p of changes.prices ?? []) {
      await dbServer
        .insert(prices)
        .values({
          id: p.id,
          userId,
          categoryId: p.categoryId as string,
          price: String(p.price),
          effectiveFrom: p.effectiveFrom as string,
          deleted: !!p.deleted,
          createdAt: new Date(p.createdAt as string),
        })
        .onConflictDoUpdate({
          target: prices.id,
          set: { price: String(p.price), deleted: !!p.deleted },
        });
    }

    // ---- Push: entries ----
    for (const e of changes.entries ?? []) {
      await dbServer
        .insert(entries)
        .values({
          id: e.id,
          userId,
          categoryId: e.categoryId as string,
          date: e.date as string,
          quantity: String(e.quantity),
          taken: !!e.taken,
          note: (e.note as string) ?? "",
          deleted: !!e.deleted,
          createdAt: new Date(e.createdAt as string),
          updatedAt: new Date(e.updatedAt as string),
        })
        .onConflictDoUpdate({
          target: entries.id,
          set: {
            quantity: String(e.quantity),
            taken: !!e.taken,
            note: (e.note as string) ?? "",
            deleted: !!e.deleted,
            updatedAt: new Date(e.updatedAt as string),
          },
        });
    }

    // ---- Push: budgets ----
    for (const b of changes.budgets ?? []) {
      await dbServer
        .insert(budgets)
        .values({
          id: b.id,
          userId,
          categoryId: (b.categoryId as string) ?? null,
          monthlyLimit: String(b.monthlyLimit),
          deleted: !!b.deleted,
          createdAt: new Date(b.createdAt as string),
          updatedAt: new Date(b.updatedAt as string),
        })
        .onConflictDoUpdate({
          target: budgets.id,
          set: { monthlyLimit: String(b.monthlyLimit), deleted: !!b.deleted, updatedAt: new Date(b.updatedAt as string) },
        });
    }

    // ---- Pull: everything changed since `since` for this user ----
    const sinceDate = new Date(since);
    const [pulledCategories, pulledPrices, pulledEntries, pulledBudgets] = await Promise.all([
      dbServer.select().from(categories).where(and(eq(categories.userId, userId), gt(categories.updatedAt, sinceDate))),
      dbServer.select().from(prices).where(and(eq(prices.userId, userId), gt(prices.createdAt, sinceDate))),
      dbServer.select().from(entries).where(and(eq(entries.userId, userId), gt(entries.updatedAt, sinceDate))),
      dbServer.select().from(budgets).where(and(eq(budgets.userId, userId), gt(budgets.updatedAt, sinceDate))),
    ]);

    return NextResponse.json({
      serverTime: new Date().toISOString(),
      changes: {
        categories: pulledCategories,
        prices: pulledPrices,
        entries: pulledEntries,
        budgets: pulledBudgets,
      },
    });
  } catch (err) {
    console.error("sync error", err);
    return NextResponse.json({ error: "Sync failed. Is DATABASE_URL configured?" }, { status: 500 });
  }
}
