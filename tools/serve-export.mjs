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
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_PATH as SITE_BASE_PATH } from "../apps/web/lib/site-config.mjs";

// The build writes apps/web/out. EXPORT_ROOT lets the unit suite point at a
// fixture so `pnpm test:unit` needs no build — CI runs it before `pnpm build`.
// The trailing separator is load-bearing: it keeps the containment check below
// from accepting a sibling whose name shares the prefix (out-leaked.txt).
const ROOT = normalize(
  process.env.EXPORT_ROOT
    ? `${resolve(process.env.EXPORT_ROOT)}${sep}`
    : fileURLToPath(new URL("../apps/web/out/", import.meta.url)),
);

// The mount defaults to the site's own base path so the documented
// NEXT_PUBLIC_BASE_PATH drives the build and the preview identically.
// BASE_PATH remains as an explicit override.
const PREFIX = process.env.BASE_PATH ?? SITE_BASE_PATH;
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

  if (relative === PREFIX) {
    relative = "/";
  } else if (relative.startsWith(`${PREFIX}/`)) {
    relative = relative.slice(PREFIX.length);
  } else {
    // Outside the mount GitHub Pages answers 404. Serving the export at the
    // root would let an unprefixed link pass locally and die in production.
    return null;
  }

  if (relative === "/" || relative === "") relative = "/index.html";

  let decoded;
  try {
    decoded = decodeURIComponent(relative);
  } catch {
    // A bare % is a client error, not a reason to take the server down.
    return null;
  }

  const candidate = normalize(join(ROOT, decoded));

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
  let url;
  try {
    // The Host header is client input: a malformed one makes new URL throw,
    // and an exception in this async handler takes the whole server down.
    url = new URL(request.url ?? "/", `http://${request.headers.host ?? HOST}`);
  } catch {
    response.writeHead(400, { "content-type": MIME[".txt"] });
    response.end("Bad request");
    return;
  }

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
  process.stdout.write(`serving ${ROOT} at http://${HOST}:${PORT}${PREFIX}/\n`);
});
