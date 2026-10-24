// 매크로 시계열: FRED(세인트루이스 연준) 공개 CSV — 달러 광의지수, 미 10년물, 나스닥 종합
const SERIES: Record<string, string> = { usd: "DTWEXBGS", y10: "DGS10", ndx: "NASDAQCOM" };

async function fred(id: string, start: string) {
  const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`);
  if (!r.ok) throw new Error(`FRED ${id} ${r.status}`);
  return (await r.text()).trim().split("\n").slice(1)
    .map((l) => l.split(","))
    .filter((p) => p[1] && p[1] !== "." && isFinite(Number(p[1])))
    .map((p) => [p[0], Number(p[1])] as [string, number]);
}

export default async () => {
  const start = new Date(Date.now() - 460 * 864e5).toISOString().slice(0, 10);
  const out: Record<string, unknown> = {}; const errors: string[] = [];
  await Promise.all(Object.entries(SERIES).map(async ([k, id]) => {
    try { out[k] = await fred(id, start); } catch { errors.push(k); }
  }));
  return Response.json({ ...out, errors }, { headers: { "cache-control": "public, max-age=3600" } });
};

export const config = { path: "/api/macro" };
