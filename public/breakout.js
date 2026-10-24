/* 돌파 신호 엔진 — 신고가 돌파(CIS) + 큰 흐름 필터(월봉 상승 중 또는 레이더가 대기가 아님)
 * 백테스트(2017-11 ~ 2026-10, 업비트 KRW-BTC 일봉, 수수료 0.05%/편도)와 같은 규칙.
 * 브라우저(window.Breakout)와 node(module.exports) 둘 다 지원.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Breakout = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var STAGES = ["대기", "추세 추종", "적립", "정찰병", "본진입"];

  // 월봉 캔들 상태: 양봉이 앞 음봉 고가를 넘어 마감하면 상승, 상승 중 음봉이 앞 양봉 저가를 깨고 마감하면 하락
  function monthStates(months) {
    var blocks = [], cur = null, state = "none", out = [];
    function last(dir) { for (var k = blocks.length - 1; k >= 0; k--) if (blocks[k].dir === dir) return blocks[k]; return null; }
    for (var i = 0; i < months.length; i++) {
      var b = months[i], dir = b.c >= b.o ? "bull" : "bear";
      if (!cur || cur.dir !== dir) { if (cur) blocks.push(cur); cur = { dir: dir, hi: b.h, lo: b.l, m: b.m }; }
      else { cur.hi = Math.max(cur.hi, b.h); cur.lo = Math.min(cur.lo, b.l); }
      var pb = last("bear"), pu = last("bull"), ch = null;
      if (dir === "bull" && state !== "up" && pb && b.c > pb.hi) { state = "up"; ch = { level: pb.hi }; }
      else if (dir === "bear" && state === "up" && pu && b.c < pu.lo) { state = "down"; ch = { level: pu.lo }; }
      out.push({ m: b.m, state: state, changed: !!ch, level: ch ? ch.level : null });
    }
    // 하락 중일 때 다시 상승으로 바뀌려면 양봉이 넘어야 하는 값 = 앞 음봉(진행 중이면 그 음봉) 고가
    if (cur) {
      var pbear = cur.dir === "bear" ? cur : last("bear"), pbull = cur.dir === "bull" ? cur : last("bull");
      out.upAbove = pbear ? pbear.hi : null;
      out.downBelow = cur.dir === "bear" ? (last("bull") ? last("bull").lo : null) : (last("bull") ? last("bull").lo : null);
    }
    return out;
  }

  function sma(arr, end, n) { if (end - n + 1 < 0) return null; var s = 0; for (var k = end - n + 1; k <= end; k++) s += arr[k]; return s / n; }

  /**
   * days: 끝난 일봉 [{d:'2026-10-23', o,h,l,c}] 오래된 순
   * months: 끝난 월봉 [{m:'2026-09', o,h,l,c}] 오래된 순
   * timeline: 레이더 과거 판정 [[date, price, stageIdx]] (주 단위)
   * curStage: 지금 레이더 판정 이름(대기/추세 추종/…), 모르면 null
   */
  function run(days, months, timeline, curStage) {
    var N = days.length, C = [], H = [], L = [], O = [];
    days.forEach(function (x) { O.push(x.o); H.push(x.h); L.push(x.l); C.push(x.c); });
    var ms = monthStates(months), mIdx = {};
    ms.forEach(function (x) { mIdx[x.m] = x; });
    // 그날까지 끝난 월봉 기준 상태: 그 달 마지막 일봉 마감 = 월봉 마감
    var monthOf = function (i) {
      var d = days[i].d, m = d.slice(0, 7), nextM = i + 1 < N ? days[i + 1].d.slice(0, 7) : null;
      // 그 달 마지막 날이거나 가장 최근 봉이면 그 달 월봉까지(끝났다면) 반영
      var key = (nextM === null || nextM !== m) ? m : prevMonth(m);
      var best = null;
      for (var k = ms.length - 1; k >= 0; k--) if (ms[k].m <= key) { best = ms[k]; break; }
      return best ? best.state : "none";
    };
    var tl = (timeline || []).slice().sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    var tlLast = tl.length ? tl[tl.length - 1][0] : null;
    var curIdx = curStage ? STAGES.indexOf(curStage) : -1;
    var stageOf = function (i) {
      var d = days[i].d;
      if (tlLast && d <= addDays(tlLast, 6)) {
        var s = null;
        for (var k = tl.length - 1; k >= 0; k--) if (tl[k][0] <= d) { s = tl[k][2]; break; }
        return s;
      }
      return curIdx >= 0 ? curIdx : null;
    };
    var allow = function (i) { var s = stageOf(i); return monthOf(i) === "up" || (s != null && s >= 1); };

    var trades = [], i = 51, pos = null;
    while (i < N) {
      var m50 = sma(C, i, 50), m50p = sma(C, i - 1, 50), hi20 = Math.max.apply(null, H.slice(i - 20, i));
      if (!(C[i] > hi20 && m50 > m50p && allow(i))) { i++; continue; }
      var t = { ei: i, ed: days[i].d, ep: C[i], stop: L[i], crosses: 0, open: true };
      var j = i + 1;
      for (; j < N; j++) {
        if (L[j] <= t.stop) { t.xp = Math.min(O[j], t.stop); t.reason = "stop"; break; }
        var m10 = sma(C, j, 10), m10p = sma(C, j - 1, 10);
        if (C[j] < m10 && !(C[j - 1] < m10p)) { t.crosses++; if (t.crosses === 2) { t.xp = C[j]; t.reason = "ma10"; break; } }
      }
      if (j < N) { t.open = false; t.xi = j; t.xd = days[j].d; t.ret = t.xp / t.ep - 1 - 0.001; }
      trades.push(t);
      if (t.open) { pos = t; break; }
      i = j + 1;
    }

    var e = N - 1;
    var hiNext = Math.max.apply(null, H.slice(N - 20, N));
    var res = {
      last: days[e], trades: trades, pos: pos,
      ma50: sma(C, e, 50), ma50prev: sma(C, e - 1, 50), ma10: sma(C, e, 10),
      hi20: hiNext,
      month: monthOf(e), monthInfo: ms.length ? ms[ms.length - 1] : null, monthChange: null,
      monthUpAbove: ms.upAbove || null, monthDownBelow: ms.downBelow || null,
      stage: stageOf(e), stageName: stageOf(e) != null ? STAGES[stageOf(e)] : null,
      sumClose49: 0,
    };
    for (var k = ms.length - 1; k >= 0; k--) if (ms[k].changed) { res.monthChange = ms[k]; break; }
    for (var q = N - 49; q < N; q++) res.sumClose49 += C[q];
    res.firedToday = !!(pos && pos.ei === e) || !!(trades.length && trades[trades.length - 1].ei === e);
    // 다음 일봉이 지금 가격으로 끝난다고 치면?
    res.preview = function (price) {
      var m50n = (res.sumClose49 + price) / 50;
      var nextAllow = res.month === "up" || (curIdx >= 1);
      return { m50: m50n, rising: m50n > res.ma50, above: price > res.hi20, allow: nextAllow, fire: m50n > res.ma50 && price > res.hi20 && nextAllow };
    };
    return res;
  }

  function prevMonth(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1; if (mo === 0) { y--; mo = 12; } return y + "-" + (mo < 10 ? "0" : "") + mo; }
  function addDays(d, n) { var t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }

  // 업비트 캔들 응답 → 끝난 봉만(가장 최근 진행 중인 봉 제외), 오래된 순
  function fromUpbit(rows, kind) {
    var a = rows.map(function (r) {
      var k = r.candle_date_time_kst;
      return { d: k.slice(0, 10), m: k.slice(0, 7), o: r.opening_price, h: r.high_price, l: r.low_price, c: r.trade_price };
    }).sort(function (x, y) { return x.d < y.d ? -1 : 1; });
    return { done: a.slice(0, -1), live: a[a.length - 1] };
  }

  return { run: run, monthStates: monthStates, fromUpbit: fromUpbit, STAGES: STAGES };
});
