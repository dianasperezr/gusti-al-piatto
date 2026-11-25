import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { parseDatabaseUrl } from "@/lib/database-url";

const database = globalThis as typeof globalThis & { gustiDb?: PrismaClient };

export function db() {
  if (!database.gustiDb) {
    const connectionString = parseDatabaseUrl(process.env.DATABASE_URL ?? "");
    database.gustiDb = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 3000 }) });
  }

  return database.gustiDb;
}
