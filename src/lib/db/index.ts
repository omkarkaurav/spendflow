import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// DATABASE_URL comes from your Neon project (Neon dashboard -> Connection string).
// Falls back gracefully at build time; actual requests will fail with a clear
// error if the env var is missing, rather than crashing the build.
const connectionString = process.env.DATABASE_URL ?? "";

const sql = neon(connectionString);
export const dbServer = drizzle(sql, { schema });
