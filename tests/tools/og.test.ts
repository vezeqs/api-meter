import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("og tool", () => {
  it("renders a non-empty PNG card", async () => {
    const dir = await mkdtemp(join(tmpdir(), "meter-og-"));
    const output = join(dir, "og.png");

    try {
      await execFileAsync(process.execPath, [join(ROOT, "tools/og.mjs")], {
        cwd: ROOT,
        env: { ...process.env, OG_OUTPUT: output },
        timeout: 120_000,
      });

      const info = await stat(output);
      assert.ok(info.size > 1_000, `og.png is only ${info.size} bytes`);

      const header = await readFile(output);
      assert.deepEqual(Array.from(header.subarray(0, 8)), PNG_SIGNATURE, "og.png is not a PNG");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
