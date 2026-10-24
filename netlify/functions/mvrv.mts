// MVRV Z-Score: CoinMetrics 무료 데이터로 직접 계산 (Z = (시가총액 - 실현시가총액) / 시가총액 전체 표준편차)
export default async () => {
  const url = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=CapMVRVCur,CapMrktCurUSD&frequency=1d&page_size=10000&start_time=2010-07-18";
  const r = await fetch(url);
  if (!r.ok) return Response.json({ error: `coinmetrics ${r.status}` }, { status: 502 });
  const rows = ((await r.json()).data || [])
    .map((x: any) => ({ t: String(x.time).slice(0, 10), mv: Number(x.CapMVRVCur), mc: Number(x.CapMrktCurUSD) }))
    .filter((x: any) => isFinite(x.mv) && isFinite(x.mc) && x.mv > 0 && x.mc > 0);
  // 날짜별 전체 기간 표준편차(그날까지)로 Z 계산 — 백테스트와 같은 방식
  let n = 0, mean = 0, m2 = 0;
  const z: [string, number][] = [];
  for (const x of rows) {
    n++; const d = x.mc - mean; mean += d / n; m2 += d * (x.mc - mean);
    if (n >= 365) z.push([x.t, (x.mc - x.mc / x.mv) / Math.sqrt(m2 / n)]);
  }
  const last = rows[rows.length - 1];
  return Response.json(
    { date: last.t, mvrv: last.mv, z: z[z.length - 1][1], series: z.slice(-730).map(([t, v]) => [t, Math.round(v * 1000) / 1000]) },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
};

export const config = { path: "/api/mvrv" };
