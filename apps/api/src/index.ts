import Fastify from "fastify";
import { HEALTH_PATH, type HealthResponse } from "@production/shared";

const app = Fastify({ logger: true });

app.get(HEALTH_PATH, async (): Promise<HealthResponse> => ({
  status: "ok",
  service: "api",
  version: "1.0.3",
}));

const port = Number(process.env.API_PORT ?? 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
