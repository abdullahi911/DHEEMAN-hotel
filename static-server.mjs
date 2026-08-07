import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { existsSync } from "node:fs";

let port = Number(process.env.PORT || 3000);
const root = existsSync(join(process.cwd(), "out"))
  ? join(process.cwd(), "out")
  : join(process.cwd(), "static");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);
    let requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    let filePath = normalize(join(root, requestedPath));

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const stats = await stat(filePath);
      if (stats.isDirectory()) {
        filePath = join(filePath, "index.html");
      }
    } catch {
      if (!extname(filePath)) {
        filePath = filePath + ".html";
      }
    }

    const content = await readFile(filePath);
    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

function startServer(p) {
  server.removeAllListeners("error");
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${p} in use, trying ${p + 1}...`);
      startServer(p + 1);
    } else {
      console.error(err);
    }
  });
  server.listen(p, () => {
    port = p;
    console.log(`Dheeman Restaurant Management running at http://localhost:${port}`);
  });
}

startServer(port);
