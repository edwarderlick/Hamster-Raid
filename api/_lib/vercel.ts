import type { IncomingMessage, ServerResponse } from "node:http";
import { handleApi } from "./handlers";

export default async function vercel(req: IncomingMessage, res: ServerResponse) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  const host = req.headers.host ?? "localhost";
  const url = req.url?.startsWith("http") ? req.url! : `https://${host}${req.url}`;
  const result = await handleApi({
    method: req.method ?? "GET",
    url,
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [
        k.toLowerCase(),
        Array.isArray(v) ? v.join(",") : (v ?? ""),
      ]),
    ),
    body: raw ? JSON.parse(raw) : null,
    ip:
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "0.0.0.0",
  });
  res.statusCode = result.status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v);
  res.end(JSON.stringify(result.json));
}
