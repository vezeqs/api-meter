import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
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

describe("preview server", () => {
  // The assertions below expect the defaults, so pin them rather than
  // inheriting whatever HOST or BASE_PATH the caller's shell exports.
  function spawnPreview(port: number) {
    return spawn(process.execPath, [join(TOOLS, "serve-export.mjs")], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", BASE_PATH: "/api-meter" },
      stdio: ["ignore", "pipe", "ignore"],
    });
  }

  it("prints a URL a user can open as-is", async () => {
    const port = 4399;
    const child = spawnPreview(port);

    try {
      const line = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("the server printed nothing")), 10_000);
        child.stdout.once("data", (chunk: Buffer) => {
          clearTimeout(timer);
          resolve(chunk.toString());
        });
      });

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
      // The server prints once it is listening; reuse that as the ready signal.
      await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("the server printed nothing")), 10_000);
        child.stdout.once("data", (chunk: Buffer) => {
          clearTimeout(timer);
          resolve(chunk.toString());
        });
      });

      const malformed = await fetch(`http://127.0.0.1:${port}/api-meter/%`);
      assert.equal(malformed.status, 404);

      const alive = await fetch(`http://127.0.0.1:${port}/api-meter/`);
      assert.equal(alive.status, 200);
    } finally {
      child.kill();
    }
  });
});
