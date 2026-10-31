import { execFile } from "node:child_process";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("capture tool", () => {
  it("resolves its imports without starting a capture", async () => {
    const tool = pathToFileURL(join(ROOT, "tools/capture.mjs")).href;

    await execFileAsync(
      process.execPath,
      ["--input-type=module", "-e", `import(${JSON.stringify(tool)})`],
      { cwd: ROOT, timeout: 30_000 },
    );
  });
});
