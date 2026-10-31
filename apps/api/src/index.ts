import { createRequire } from "node:module";
import Fastify from "fastify";
import { HEALTH_PATH, type HealthResponse } from "@production/shared";

// The version comes from package.json so a release bump cannot leave the
// endpoint reporting a stale one. createRequire resolves identically from
// src/ and dist/.
const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const app = Fastify({ logger: true });

app.get(HEALTH_PATH, async (): Promise<HealthResponse> => ({
  status: "ok",
  service: "api",
  version,
}));

const port = Number(process.env.API_PORT ?? 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
