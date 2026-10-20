import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("./public/", import.meta.url));
const clients = new Set();
let state = { expression: "neutral", reaction: null, mouth: 0, level: 0 };
const expressions = [
  "neutral",
  "smile",
  "laugh",
  "angry",
  "surprised",
  "sigh",
  "focus",
  "exhale",
];
const reactions = ["slam", "coffee", "gamepad", "cheer", "facepalm"];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify(state)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (url.pathname === "/state" && req.method === "POST") {
    let body = "";
    try {
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 2048) throw Error("Too large");
      }
      const next = JSON.parse(body);
      if (
        next.expression !== undefined &&
        expressions.includes(next.expression)
      )
        state.expression = next.expression;
      if (
        next.reaction !== undefined &&
        (next.reaction === null || reactions.includes(next.reaction))
      ) {
        state.reaction = next.reaction;
        state.reactionAt = Date.now();
      }
      for (const key of ["mouth", "level"])
        if (Number.isFinite(next[key]))
          state[key] =
            key === "mouth"
              ? Math.round(Math.max(0, Math.min(2, next[key])))
              : Math.max(0, Math.min(1, next[key]));
      state.updatedAt = Date.now();
      for (const client of clients)
        client.write(`data: ${JSON.stringify(state)}\n\n`);
      res.writeHead(204).end();
    } catch {
      res.writeHead(400).end("Invalid state");
    }
    return;
  }
  if (req.method !== "GET") {
    res.writeHead(405).end();
    return;
  }
  const files = {
    "/": "index.html",
    "/avatar": "index.html",
    "/app.js": "app.js",
    "/avatar.js": "avatar.js",
    "/style.css": "style.css",
    "/audio.js": "audio.js",
  };
  if (/^\/assets\/[a-zA-Z0-9_.-]+\.(png|json)$/.test(url.pathname))
    files[url.pathname] = url.pathname.slice(1);
  if (!files[url.pathname]) {
    res.writeHead(404).end();
    return;
  }
  try {
    const file = files[url.pathname];
    res.setHeader(
      "Content-Type",
      file.endsWith(".png")
        ? "image/png"
        : file.endsWith(".json")
          ? "application/json"
          : file.endsWith(".js")
            ? "text/javascript"
            : file.endsWith(".css")
              ? "text/css"
              : "text/html; charset=utf-8",
    );
    res.end(await readFile(root + file));
  } catch {
    res.writeHead(500).end();
  }
});
const idle = setInterval(() => {
  if (state.mouth && Date.now() - state.updatedAt > 700) {
    state.mouth = 0;
    state.level = 0;
    for (const client of clients)
      client.write(`data: ${JSON.stringify(state)}\n\n`);
  }
}, 250);
const heartbeat = setInterval(() => {
  for (const client of clients) client.write(": heartbeat\n\n");
}, 15000);
server.on("close", () => {
  clearInterval(heartbeat);
  clearInterval(idle);
});
server.listen(Number(process.env.PORT) || 5173, "0.0.0.0", () =>
  console.log(
    "Kim Ajae studio listening on port " + (process.env.PORT || 5173),
  ),
);
