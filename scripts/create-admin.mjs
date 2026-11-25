import "dotenv/config";
import { Client } from "pg";
import { z } from "zod";
import { hashPassword } from "../src/modules/auth/password.ts";
import { randomUUID } from "node:crypto";

const result = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(256),
  database: z.url({ protocol: /^postgres(ql)?$/ }),
}).safeParse({
  email: process.argv[2]?.toLowerCase(),
  name: process.argv[3],
  password: (await Array.fromAsync(process.stdin)).map(chunk => chunk.toString()).join("").replace(/\r?\n$/, ""),
  database: process.env.DATABASE_URL,
});

if (!result.success) {
  console.error("Indica correo, nombre y contraseña de 12 a 256 caracteres por stdin. Configura DATABASE_URL.");
  process.exitCode = 1;
} else {
  const { email, name, password, database } = result.data;
  const client = new Client({ connectionString: database });
  try {
    await client.connect();
    await client.query(
      'INSERT INTO "users" ("id", "email", "name", "password_hash", "role") VALUES ($1, $2, $3, $4, $5)',
      [randomUUID(), email, name, await hashPassword(password), "ADMIN"],
    );
    console.log("Administrador creado.");
  } catch (error) {
    console.error(error.code === "23505" ? "Ese correo ya está registrado." : "No se pudo crear el administrador.");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
