/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { handleApi } from "./api/_lib/router";

function localApi(): Plugin {
  return {
    name: "hamster-raid-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api")) return next();
        try {
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve) => {
            req.on("data", (c) => chunks.push(c as Buffer));
            req.on("end", () => resolve());
          });
          const raw = Buffer.concat(chunks).toString("utf8");
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
              "local",
          });
          res.statusCode = result.status;
          res.setHeader("content-type", "application/json; charset=utf-8");
          for (const [k, v] of Object.entries(result.headers ?? {})) {
            res.setHeader(k, v);
          }
          res.end(JSON.stringify(result.json));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "internal", detail: String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "api/**/*.test.ts"],
  },
});
