import { execSync } from "child_process";

const env = process.env["VERCEL_ENV"] ?? "development";

function run(cmd: string) {
  console.warn(`[vercel-build] Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

// Only run migrations on production deploys.
// Preview branches share the same DB — migrations are applied on production merge.
// This avoids P1013 errors when DIRECT_URL is not configured for preview environments.
if (env === "production") {
  run("prisma migrate deploy");
}

run("prisma generate");
run("next build");
