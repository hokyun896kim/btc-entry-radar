// 업비트 중계: 브라우저 직접 호출이 호출 제한(429)에 걸릴 때 쓰는 대체 경로.
// /api/upbit-days → KRW-BTC 일봉 61개, /api/upbit-ticker → KRW-BTC·KRW-USDT 현재가
// /api/upbit-days200 → 일봉 200개, /api/upbit-months → 월봉 200개 (돌파 신호 카드용)
const URLS: Record<string, [string, number]> = {
  "/api/upbit-days": ["https://api.upbit.com/v1/candles/days?market=KRW-BTC&count=61", 300],
  "/api/upbit-ticker": ["https://api.upbit.com/v1/ticker?markets=KRW-BTC,KRW-USDT", 15],
  "/api/upbit-days200": ["https://api.upbit.com/v1/candles/days?market=KRW-BTC&count=200", 300],
  "/api/upbit-months": ["https://api.upbit.com/v1/candles/months?market=KRW-BTC&count=200", 3600],
};

export default async (req: Request) => {
  const [url, maxAge] = URLS[new URL(req.url).pathname] || [];
  if (!url) return new Response("Not found", { status: 404 });
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) return Response.json({ error: r.status }, { status: 502 });
  return Response.json(await r.json(), { headers: { "cache-control": `public, max-age=${maxAge}` } });
};

export const config = { path: ["/api/upbit-days", "/api/upbit-ticker", "/api/upbit-days200", "/api/upbit-months"] };
