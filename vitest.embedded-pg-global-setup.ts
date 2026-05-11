import { execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      s.close(() => resolve(port));
    });
  });
}

export default async function embeddedPostgresGlobalSetup() {
  const port = await getFreePort();
  const databaseDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "single-thread-epg-")), "pgdata");
  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: "postgres",
    password: "test",
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await pg.initialise();
  await pg.start();

  const dbName = "single_thread_test";
  await pg.createDatabase(dbName);

  const databaseUrl = `postgresql://postgres:test@127.0.0.1:${port}/${dbName}`;
  process.env.DATABASE_URL = databaseUrl;

  try {
    execSync("npx prisma migrate deploy", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });
  } catch (e) {
    await pg.stop().catch(() => {});
    throw e;
  }

  return async () => {
    await pg.stop();
  };
}
