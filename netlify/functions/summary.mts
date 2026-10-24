// 위젯용 핵심 요약: 레이더 판정(매일 아침 예약 작업이 저장한 값) + 돌파 신호(사이트 카드와 같은 엔진) + 가격 + 한 줄 멘트
// GET /api/summary → 작은 JSON 하나. 아이폰 스크립터블 위젯이 이것만 읽는다.
import { getStore } from "@netlify/blobs";
import "../../public/breakout.js"; // 실행되면서 globalThis.Breakout 을 붙인다

const B: any = (globalThis as any).Breakout;
const UP = "https://api.upbit.com/v1";

async function json(url: string) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}
const won = (n: number) => Math.round(n).toLocaleString("ko-KR") + "원";
const pct = (x: number, d = 1) => (x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%";
const md = (d: string) => { const p = d.split("-"); return `${+p[1]}월 ${+p[2]}일`; };
const plusDay = (d: string) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

export default async (req: Request) => {
  try {
    const store = getStore({ name: "radar", consistency: "strong" });
    const [days, months, tick, bt, oc] = await Promise.all([
      json(`${UP}/candles/days?market=KRW-BTC&count=200`),
      json(`${UP}/candles/months?market=KRW-BTC&count=200`),
      json(`${UP}/ticker?markets=KRW-BTC`),
      json(new URL("/backtest.json", req.url).toString()).catch(() => null),
      store.get("onchain", { type: "json" }).catch(() => null) as Promise<any>,
    ]);
    const D = B.fromUpbit(days, "days"), M = B.fromUpbit(months, "months");
    const verdict: string | null = oc && typeof oc.lastVerdict === "string" ? oc.lastVerdict : null;
    const R = B.run(D.done, M.done, bt && bt.timeline ? bt.timeline : [], B.STAGES.indexOf(verdict) >= 0 ? verdict : null);
    const price: number = tick[0].trade_price, chg: number = tick[0].signed_change_rate;
    const lastD: string = R.last.d, nextAt = `${md(plusDay(D.live.d))} 오전 9시`;
    const flowOk = R.month === "up" || B.STAGES.indexOf(verdict) >= 1;

    let breakout: any;
    if (R.pos) {
      const p = R.pos, fresh = p.ei === D.done.length - 1;
      breakout = {
        state: fresh ? "fresh" : "holding", label: fresh ? "매수 신호" : "들고 있는 중",
        entryDate: p.ed, entry: p.ep, ret: price / p.ep - 1, stop: p.stop, toStop: p.stop / price - 1, below10: p.crosses, ma10: R.ma10,
        checks: [
          { name: "돌파한 날 저가 지키는 중", ok: price > p.stop, value: won(p.stop) },
          { name: "10일 평균선 아래 마감", ok: p.crosses === 0, value: `${p.crosses}번 · 두 번째에 팔아요` },
        ],
        line: fresh
          ? `${md(plusDay(lastD))} 오전 9시 종가 ${won(p.ep)}에 매수 신호가 떴어요. ${won(p.stop)} 깨지면 팔아요.`
          : `${md(p.ed)} 일봉에 산 신호가 살아 있어요(${pct(price / p.ep - 1)}). ${won(p.stop)} 깨지면 팔아요.`,
      };
    } else {
      const P = R.preview(price), need = R.hi20 / price - 1;
      const missing: string[] = [];
      if (!P.above) missing.push(`${won(R.hi20)}을 넘어서 마감해야 해요.`);
      if (!P.rising) missing.push(`50일 평균선도 다시 올라야 해요.`);
      if (!flowOk) missing.push(`월봉이 상승으로 바뀌거나 레이더 판정이 대기를 벗어나야 해요.`);
      breakout = {
        state: P.fire ? "almost" : "none", label: P.fire ? "지금 가격이면 신호" : "신호 없음",
        hi20: R.hi20, need, ma50Rising: P.rising, flowOk, todo: missing,
        checks: [
          { name: "최근 20일 최고가를 넘어서 마감", ok: P.above, value: won(R.hi20) },
          { name: "50일 평균선이 오르는 중", ok: P.rising, value: P.rising ? "오르고 있어요" : "내려가고 있어요" },
          { name: "큰 흐름 확인", ok: flowOk, value: `${R.month === "up" ? "월봉 상승 중" : "월봉 하락 중"} · 레이더 ${verdict || "판정 전"}` },
        ],
        line: P.fire
          ? `지금 가격으로 ${nextAt}에 끝나면 매수 신호가 떠요.`
          : `${need > 0 ? `돌파까지 ${pct(need)} 남았어요.` : "최근 20일 최고가는 넘었어요."} ${missing.join(" ")}`,
      };
    }
    const vTxt: Record<string, string> = {
      "본진입": "바닥과 추세 전환을 함께 확인했어요",
      "정찰병": "바닥권이고 추세는 반쯤 돌아섰어요",
      "적립": "싼 구간이지만 추세는 아직 내려가요",
      "추세 추종": "비싸지만 추세는 강해요",
      "대기": "아직 기다릴 때예요",
    };
    const body = {
      asof: new Date().toISOString(),
      price, change: chg,
      radar: { verdict, line: verdict ? vTxt[verdict] || "" : "아침 판정을 아직 못 불러왔어요", asof: oc?.updatedAt || oc?.asof || null },
      breakout,
      month: R.month === "up" ? "월봉 상승 중" : "월봉 하락 중",
      nextJudge: nextAt,
      headline: `${verdict || "판정 전"} · ${breakout.label}`,
      url: "https://btc-entry-radar.netlify.app/",
    };
    return Response.json(body, { headers: { "cache-control": "public, max-age=120", "access-control-allow-origin": "*" } });
  } catch (e: any) {
    return Response.json({ error: String(e && e.message || e) }, { status: 502 });
  }
};

export const config = { path: "/api/summary" };
