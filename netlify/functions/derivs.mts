// OKX 선물 통계 중계: 브라우저 직접 호출(CORS)이 막힌 엔드포인트만 같은 출처로 넘겨준다.
const OKX = "https://www.okx.com/api/v5";
const PATHS = {
  ls: "/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=1D",
  oi: "/rubik/stat/contracts/open-interest-volume?ccy=BTC&period=1D",
  funding: "/public/funding-rate?instId=BTC-USDT-SWAP",
};

async function get(path: string) {
  const r = await fetch(OKX + path, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`OKX ${r.status}`);
  const j = await r.json();
  if (j.code !== "0") throw new Error(`OKX code ${j.code}`);
  return j.data;
}

export default async () => {
  const out: Record<string, unknown> = {};
  const errors: string[] = [];
  await Promise.all(
    Object.entries(PATHS).map(async ([k, p]) => {
      try { out[k] = await get(p); } catch (e) { errors.push(k); }
    }),
  );
  return Response.json(
    { ...out, errors, ts: Date.now() },
    { headers: { "cache-control": "public, max-age=120" } },
  );
};

export const config = { path: "/api/derivs" };
