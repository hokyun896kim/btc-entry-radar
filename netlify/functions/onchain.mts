// GET: 저장된 최신값 반환(없으면 404 → 페이지가 정적 onchain.json으로 대체)
// POST: 예약 작업이 x-update-token 헤더와 함께 새 값을 올림
import { getStore } from "@netlify/blobs";

const KEY = "onchain";

export default async (req: Request) => {
  const store = getStore({ name: "radar", consistency: "strong" });
  if (req.method === "GET") {
    const data = await store.get(KEY, { type: "json" });
    if (data === null) return Response.json({ error: "empty" }, { status: 404 });
    return Response.json(data, { headers: { "cache-control": "no-cache" } });
  }
  if (req.method === "POST") {
    const token = Netlify.env.get("ONCHAIN_TOKEN");
    if (!token || req.headers.get("x-update-token") !== token) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    let body: any;
    try { body = await req.json(); } catch { return Response.json({ error: "invalid json" }, { status: 400 }); }
    const nums = ["mvrvZ", "sth", "tmm", "etfCost", "breakout"];
    const bad = nums.filter((k) => typeof body[k] !== "number" || !isFinite(body[k]));
    if (bad.length || !["in", "out", "flat"].includes(body.etfFlow) || typeof body.asof !== "string") {
      return Response.json({ error: "missing or invalid fields", fields: bad }, { status: 400 });
    }
    body.updatedAt = new Date().toISOString();
    await store.setJSON(KEY, body);
    return Response.json({ ok: true, updatedAt: body.updatedAt });
  }
  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/onchain", method: ["GET", "POST"] };
