import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbServer } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password || password.length < 6) {
      return NextResponse.json(
        { error: "Name, email and a password of at least 6 characters are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const [existing] = await dbServer.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await dbServer
      .insert(users)
      .values({ name, email: normalizedEmail, passwordHash })
      .returning();

    return NextResponse.json({ id: created.id, name: created.name, email: created.email });
  } catch (err) {
    console.error("register error", err);
    return NextResponse.json(
      { error: "Could not create account. Is DATABASE_URL configured?" },
      { status: 500 }
    );
  }
}
