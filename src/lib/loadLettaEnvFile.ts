import { existsSync } from "fs";
import path from "path";
import { config as loadDotenv } from "dotenv";

/** Merge `.env.letta` into `process.env` (same file Docker Compose uses). Next.js does not load this file by default. */
export function loadLettaEnvFile(): void {
  const p = path.join(process.cwd(), ".env.letta");
  if (!existsSync(p)) return;
  loadDotenv({ path: p, override: false });
}
