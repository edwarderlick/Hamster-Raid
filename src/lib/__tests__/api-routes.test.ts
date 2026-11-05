import { describe, expect, it } from "vitest";
import { handleApi } from "../../../api/_lib/handlers";

async function hit(method: string, path: string, body?: unknown) {
  return handleApi({
    method,
    url: `https://local${path}`,
    headers: { "content-type": "application/json" },
    body: body ?? null,
    ip: "127.0.0.1",
  });
}

describe("api routes", () => {
  it("GET /api/raid returns JSON 200", async () => {
    const res = await hit("GET", "/api/raid");
    expect(res.status).toBe(200);
    expect(res.json).toHaveProperty("boss");
    expect(res.json).toHaveProperty("persist");
  });

  it("GET /api/profile returns JSON 200", async () => {
    const res = await hit("GET", "/api/profile");
    expect(res.status).toBe(200);
    expect(res.json).toHaveProperty("profile");
  });

  it("GET /api/save without address is 400 JSON", async () => {
    const res = await hit("GET", "/api/save");
    expect(res.status).toBe(400);
    expect((res.json as { error: string }).error).toBe("missing_address");
  });

  it("GET /api/save with address is 200 JSON", async () => {
    const res = await hit("GET", "/api/save?address=0x0000000000000000000000000000000000000001");
    expect(res.status).toBe(200);
    expect(res.json).toHaveProperty("blob");
  });

  it("POST /api/surge returns 200 JSON", async () => {
    const res = await hit("POST", "/api/surge", { damage: 1 });
    expect(res.status).toBe(200);
    expect(res.json).toHaveProperty("boss");
  });

  it("POST /api/nonce without address is 4xx JSON", async () => {
    const res = await hit("POST", "/api/nonce", {});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.json).toHaveProperty("error");
  });

  it("unknown route is 404 JSON", async () => {
    const res = await hit("GET", "/api/nope");
    expect(res.status).toBe(404);
    expect((res.json as { error: string }).error).toBe("not_found");
  });
});
