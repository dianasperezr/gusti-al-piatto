import "dotenv/config";
import { defineConfig } from "prisma/config";
import { parseDatabaseUrl } from "./src/lib/database-url";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "node scripts/seed.mjs" },
  datasource: {
    url: databaseUrl === undefined ? undefined : parseDatabaseUrl(databaseUrl),
  },
});
