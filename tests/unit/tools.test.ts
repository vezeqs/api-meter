import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TOOLS = join(ROOT, "tools");

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
        "the deployment host belongs in apps/web/lib/site.ts, not in a tool",
      );
    });

    it(`${name} does not hardcode the preview address`, () => {
      assert.doesNotMatch(
        source,
        /127\.0\.0\.1:\d+\/api-meter/,
        "the preview origin belongs in apps/web/lib/site.ts, not in a tool",
      );
    });
  }
});

describe("preview server", () => {
  it("prints a URL a user can open as-is", async () => {
    const port = 4399;

    const child = spawn(process.execPath, [join(TOOLS, "serve-export.mjs")], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "ignore"],
    });

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
});
