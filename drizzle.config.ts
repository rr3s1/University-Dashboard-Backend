import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * `drizzle-kit migrate` picks the first available Postgres driver. With `pg`
 * installed (devDependency), it uses TCP (`pg`) instead of `@neondatabase/serverless`
 * WebSockets, which often hang on Windows or strict networks.
 *
 * Use Neon’s **direct** (non-pooler) connection string in `DATABASE_URL` if
 * migrations still time out.
 */
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env file");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

