import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BASE_PATH, SITE_URL } from "../../apps/web/lib/site-config.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TOOLS = join(ROOT, "tools");

describe("site configuration", () => {
  it("is importable by the Node tools", () => {
    assert.match(SITE_URL, /^https?:\/\//);
    assert.match(BASE_PATH, /^\//);
  });
});

describe("tools", () => {
  const sources = readdirSync(TOOLS)
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => ({ name, source: readFileSync(join(TOOLS, name), "utf8") }));

  it("are present", () => {
    assert.ok(sources.length >= 3, `found ${sources.length} tools`);
  });

  for (const { name, source } of sources) {
    it(`${name} does not hardcode the deployment host`, () => {
      assert.doesNotMatch(
        source,
        /github\.io/i,
        "the deployment host belongs in apps/web/lib/site-config.mjs, not in a tool",
      );
    });

    it(`${name} does not hardcode the preview port and subpath`, () => {
      assert.doesNotMatch(
        source,
        /127\.0\.0\.1:\d+\/api-meter/,
        "the preview port and subpath must be derived, not pasted",
      );
      assert.doesNotMatch(
        source,
        /["'`]\/api-meter["'`]/,
        "the subpath belongs to apps/web/lib/site-config.mjs, not to a literal",
      );
    });

    it(`${name} does not import TypeScript`, () => {
      assert.doesNotMatch(
        source,
        /from\s+["'][^"']+\.ts["']/,
        "Node tools must import apps/web/lib/site-config.mjs, not site.ts",
      );
    });

    it(`${name} parses as an ES module`, () => {
      execFileSync(process.execPath, ["--check", join(TOOLS, name)], { stdio: "pipe" });
    });
  }
});

describe("test harness", () => {
  it("playwright.config.ts does not hardcode the deployment subpath", () => {
    const source = readFileSync(join(ROOT, "playwright.config.ts"), "utf8");
    assert.doesNotMatch(
      source,
      /["'`]\/api-meter["'`]/,
      "the subpath belongs to apps/web/lib/site-config.mjs, not to a literal",
    );
    assert.match(source, /site-config\.mjs/, "playwright.config.ts must derive the subpath");
  });
});

describe("preview server", () => {
  // The preview suite exercises the server's mount rules, not the export's
  // contents, so it serves a two-file fixture. Without this, every test here
  // needed `pnpm build` first and failed on a clean clone.
  const EXPORT_FIXTURE = mkdtempSync(join(tmpdir(), "api-meter-export-"));
  writeFileSync(join(EXPORT_FIXTURE, "index.html"), "<!doctype html><title>fixture</title>\n");
  writeFileSync(join(EXPORT_FIXTURE, "404.html"), "<!doctype html><title>not found</title>\n");

  // The assertions below expect the defaults, so pin them rather than
  // inheriting whatever HOST or BASE_PATH the caller's shell exports.
  function spawnPreview(port: number, extraEnv: Record<string, string | undefined> = {}) {
    const env: Record<string, string | undefined> = {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      BASE_PATH: "/api-meter",
      EXPORT_ROOT: EXPORT_FIXTURE,
      ...extraEnv,
    };
    for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
    return spawn(process.execPath, [join(TOOLS, "serve-export.mjs")], {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "ignore"],
    });
  }

  async function untilListening(child: ReturnType<typeof spawnPreview>): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("the server printed nothing")), 10_000);
      child.stdout.once("data", (chunk: Buffer) => {
        clearTimeout(timer);
        resolve(chunk.toString());
      });
    });
  }

  it("prints a URL a user can open as-is", async () => {
    const port = 4399;
    const child = spawnPreview(port);

    try {
      const line = await untilListening(child);
      assert.match(
        line,
        new RegExp(`^serving .+ at http://127\\.0\\.0\\.1:${port}/api-meter/\\n?$`),
      );
      assert.doesNotMatch(line, /\/\/\n?$/, "the printed URL has a doubled slash");
    } finally {
      child.kill();
    }
  });

  it("answers a malformed percent-escape with 404 and keeps serving", async () => {
    const port = 4401;
    const child = spawnPreview(port);

    try {
      await untilListening(child);

      const malformed = await fetch(`http://127.0.0.1:${port}/api-meter/%`);
      assert.equal(malformed.status, 404);

      const alive = await fetch(`http://127.0.0.1:${port}/api-meter/`);
      assert.equal(alive.status, 200);
    } finally {
      child.kill();
    }
  });

  it("answers a malformed Host header with 400 and keeps serving", async () => {
    // Node's fetch cannot send an illegal Host, so the request is written raw.
    const port = 4403;
    const child = spawnPreview(port);

    try {
      await untilListening(child);

      const raw = await new Promise<string>((resolve, reject) => {
        const socket = connect({ port, host: "127.0.0.1" }, () => {
          socket.write("GET /api-meter/ HTTP/1.1\r\nHost: a b\r\nConnection: close\r\n\r\n");
        });
        let data = "";
        socket.setTimeout(10_000, () => {
          socket.destroy();
          reject(new Error("no response to a malformed Host"));
        });
        socket.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        socket.on("end", () => resolve(data));
        socket.on("error", reject);
      });

      assert.match(raw, /^HTTP\/1\.1 400/, "a malformed Host should get a 400");

      const alive = await fetch(`http://127.0.0.1:${port}/api-meter/`);
      assert.equal(alive.status, 200, "the server died on a malformed Host");
    } finally {
      child.kill();
    }
  });

  it("serves only under the deployment subpath", async () => {
    const port = 4405;
    const child = spawnPreview(port);

    try {
      await untilListening(child);

      for (const path of ["/", "/index.html", "/dashboard/"]) {
        const response = await fetch(`http://127.0.0.1:${port}${path}`);
        assert.equal(
          response.status,
          404,
          `${path} is outside the mount; GitHub Pages would not serve it`,
        );
      }

      const mounted = await fetch(`http://127.0.0.1:${port}/api-meter/`);
      assert.equal(mounted.status, 200);
    } finally {
      child.kill();
    }
  });

  it("mounts the site's own base path when BASE_PATH is unset", async () => {
    const port = 4407;
    const child = spawnPreview(port, {
      BASE_PATH: undefined,
      NEXT_PUBLIC_BASE_PATH: "/custom-mount",
    });

    try {
      await untilListening(child);

      const mounted = await fetch(`http://127.0.0.1:${port}/custom-mount/`);
      assert.equal(mounted.status, 200, "the preview ignored NEXT_PUBLIC_BASE_PATH");

      const stale = await fetch(`http://127.0.0.1:${port}/api-meter/`);
      assert.equal(stale.status, 404);
    } finally {
      child.kill();
    }
  });
});
