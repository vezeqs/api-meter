#!/usr/bin/env node
/**
 * Serves apps/web/out the way GitHub Pages serves a project site: the app is
 * mounted under a subpath, directories resolve to index.html, and unknown
 * paths return the exported 404 page with a 404 status.
 *
 * Used by the Playwright suite so the tests exercise the real deployment shape
 * rather than a root-mounted dev server.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = normalize(fileURLToPath(new URL("../apps/web/out/", import.meta.url)));
const PREFIX = process.env.BASE_PATH ?? "/meter";
const PORT = Number(process.env.PORT ?? 4321);
const HOST = process.env.HOST ?? "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function contentType(filePath) {
  return MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

async function resolveFile(pathname) {
  let relative = pathname;

  if (relative === PREFIX) relative = "/";
  if (relative.startsWith(`${PREFIX}/`)) relative = relative.slice(PREFIX.length);

  if (relative === "/" || relative === "") relative = "/index.html";

  const candidate = normalize(join(ROOT, decodeURIComponent(relative)));

  // Refuse anything that escapes the export directory.
  if (candidate !== ROOT.replace(/\/$/, "") && !candidate.startsWith(ROOT)) {
    return null;
  }

  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      const index = join(candidate, "index.html");
      await stat(index);
      return index;
    }
    return candidate;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? HOST}`);
  const filePath = await resolveFile(url.pathname);

  if (!filePath) {
    try {
      const notFound = await readFile(join(ROOT, "404.html"));
      response.writeHead(404, { "content-type": MIME[".html"] });
      response.end(notFound);
    } catch {
      response.writeHead(404, { "content-type": MIME[".txt"] });
      response.end("Not found");
    }
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentType(filePath),
      "cache-control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(500, { "content-type": MIME[".txt"] });
    response.end("Read error");
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`serving ${ROOT} at http://${HOST}:${PORT}${PREFIX}/${sep}\n`);
});
