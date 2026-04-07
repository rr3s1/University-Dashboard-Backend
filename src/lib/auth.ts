import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db"; // your drizzle instance
import * as schema from "../db/schema/auth";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in your environment or .env file.`,
    );
  }
  return value;
}

const betterAuthSecret = requireEnv("BETTER_AUTH_SECRET");
const betterAuthUrl = requireEnv("BETTER_AUTH_URL");
const frontendUrl = requireEnv("FRONTEND_URL");

export const auth = betterAuth({
  secret: betterAuthSecret,
  baseURL: betterAuthUrl,
  trustedOrigins: [frontendUrl],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema, // or "mysql", "sqlite"
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "student",
        input: false,
      },
      imageCldPubId: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
});
