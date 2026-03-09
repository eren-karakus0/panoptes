import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // DIRECT_URL for migrations (non-pooled connection)
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
