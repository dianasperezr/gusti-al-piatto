import { z } from "zod";

const databaseUrl = z.url({ protocol: /^(postgresql|postgres)$/ });

export function parseDatabaseUrl(value: string) {
  const result = databaseUrl.safeParse(value);

  if (!result.success) {
    throw new Error("DATABASE_URL debe contener una URL de PostgreSQL válida.");
  }

  return result.data;
}
