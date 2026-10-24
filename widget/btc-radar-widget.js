// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-orange; icon-glyph: satellite-dish;

/*
 * BTC 진입 레이더 — 아이폰 홈 화면 위젯 (Scriptable)
 * https://btc-entry-radar.netlify.app/api/summary 한 곳만 읽어요.
 * 작은·중간·큰 위젯 모두 돼요. 위젯을 누르면 레이더 사이트가 열려요.
 * 인터넷이 안 될 때는 마지막으로 받은 값을 보여주고 "저장된 값"이라고 표시해요.
 */

const API = "https://btc-entry-radar.netlify.app/api/summary";
const SITE = "https://btc-entry-radar.netlify.app/";
const CACHE = "btc-radar-summary.json";

// 당근 느낌 색 (밝은 화면 / 어두운 화면)
const C = {
  bg: Color.dynamic(new Color("#FFFFFF"), new Color("#1A1C20")),
  fg: Color.dynamic(new Color("#1A1C20"), new Color("#F3F4F5")),
  sub: Color.dynamic(new Color("#555D6D"), new Color("#A0A6B1")),
  faint: Color.dynamic(new Color("#868B94"), new Color("#6E737C")),
  line: Color.dynamic(new Color("#EEEFF1"), new Color("#2B2E35")),
  brand: new Color("#FF6600"),
  brandSoft: Color.dynamic(new Color("#FFF2EC"), new Color("#3A2418")),
  green: Color.dynamic(new Color("#0A8A64"), new Color("#2BC48E")),
  greenSoft: Color.dynamic(new Color("#E6F7F0"), new Color("#123528")),
  amber: Color.dynamic(new Color("#9B6100"), new Color("#F0B44C")),
  amberSoft: Color.dynamic(new Color("#FFF6DC"), new Color("#3A2E14")),
  gray: Color.dynamic(new Color("#555D6D"), new Color("#A0A6B1")),
  graySoft: Color.dynamic(new Color("#F3F4F5"), new Color("#2B2E35")),
  up: new Color("#FA342C"),
  down: new Color("#217CF9"),
  white: new Color("#FFFFFF"),
};

// 레이더 판정 칩 색 (사이트와 같게)
const VERDICT = {
  "본진입": [C.greenSoft, C.green],
  "정찰병": [C.brandSoft, C.brand],
  "추세 추종": [C.brandSoft, C.brand],
  "적립": [C.amberSoft, C.amber],
  "대기": [C.graySoft, C.gray],
};
// 돌파 신호 칩 색
const BREAK = {
  fresh: [C.brand, C.white],
  holding: [C.greenSoft, C.green],
  almost: [C.amberSoft, C.amber],
  none: [C.graySoft, C.gray],
};

async function load() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), CACHE);
  try {
    const req = new Request(API);
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    if (!data || data.error || !data.breakout) throw new Error(data && data.error ? data.error : "빈 응답");
    fm.writeString(path, JSON.stringify(data));
    return { data, cached: false };
  } catch (e) {
    if (fm.fileExists(path)) return { data: JSON.parse(fm.readString(path)), cached: true };
    return { data: null, cached: false, error: String(e) };
  }
}

const won = (n) => Math.round(n).toLocaleString("ko-KR") + "원";
const pct = (x, d = 1) => (x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%";
function hhmm(iso) {
  const t = new Date(iso);
  return `${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}

function text(stack, str, size, color, weight, lines) {
  const t = stack.addText(str);
  t.font = weight === "heavy" ? Font.heavySystemFont(size) : weight === "bold" ? Font.boldSystemFont(size) : weight === "semibold" ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  if (lines) t.lineLimit = lines;
  t.minimumScaleFactor = 0.7;
  return t;
}
function chip(stack, str, colors, size) {
  const s = stack.addStack();
  s.backgroundColor = colors[0];
  s.cornerRadius = 999;
  s.setPadding(3, 9, 3, 9);
  text(s, str, size || 12, colors[1], "bold", 1);
  return s;
}
function header(w, cached) {
  const h = w.addStack();
  h.centerAlignContent();
  const dot = h.addStack();
  dot.size = new Size(8, 8);
  dot.cornerRadius = 4;
  dot.backgroundColor = C.brand;
  h.addSpacer(5);
  text(h, "BTC 레이더", 12, C.sub, "semibold", 1);
  h.addSpacer();
  if (cached) text(h, "저장된 값", 10, C.amber, "semibold", 1);
}
function priceRow(stack, d, size) {
  const r = stack.addStack();
  r.bottomAlignContent();
  text(r, won(d.price), size, C.fg, "bold", 1);
  r.addSpacer(5);
  if (d.change != null) text(r, pct(d.change, 2), Math.round(size * 0.62), d.change > 0 ? C.up : d.change < 0 ? C.down : C.sub, "semibold", 1);
}
function verdictColors(v) { return VERDICT[v] || [C.graySoft, C.gray]; }
function breakColors(s) { return BREAK[s] || BREAK.none; }
function bigNumber(b) {
  if (b.state === "holding" || b.state === "fresh") return { lbl: "깨지면 파는 값까지", val: pct(b.toStop) };
  if (b.need != null && b.need > 0) return { lbl: "돌파까지", val: pct(b.need) };
  return { lbl: "최근 20일 최고가", val: "넘었어요" };
}

function small(w, d, cached) {
  header(w, cached);
  w.addSpacer(8);
  text(w, d.radar.verdict || "판정 전", 24, verdictColors(d.radar.verdict)[1], "heavy", 1);
  w.addSpacer(2);
  const b = d.breakout, n = bigNumber(b);
  text(w, `${b.label} · ${n.lbl} ${n.val}`, 12, C.fg, "semibold", 2);
  w.addSpacer();
  text(w, won(d.price), 15, C.fg, "bold", 1);
  w.addSpacer(2);
  text(w, `${d.nextJudge} 판정`, 10, C.faint, null, 1);
}

function medium(w, d, cached) {
  header(w, cached);
  w.addSpacer(8);
  const row = w.addStack();
  row.topAlignContent();
  // 왼쪽: 레이더 판정
  const L = row.addStack();
  L.layoutVertically();
  text(L, "레이더 판정", 11, C.sub, null, 1);
  L.addSpacer(3);
  chip(L, d.radar.verdict || "판정 전", verdictColors(d.radar.verdict), 14);
  L.addSpacer(6);
  text(L, d.radar.line || "", 12, C.sub, null, 2);
  L.addSpacer();
  priceRow(L, d, 15);
  row.addSpacer(12);
  const sep = row.addStack();
  sep.size = new Size(1, 96);
  sep.backgroundColor = C.line;
  row.addSpacer(12);
  // 오른쪽: 돌파 신호
  const R = row.addStack();
  R.layoutVertically();
  const b = d.breakout, n = bigNumber(b);
  text(R, "돌파 신호", 11, C.sub, null, 1);
  R.addSpacer(3);
  chip(R, b.label, breakColors(b.state), 13);
  R.addSpacer(5);
  const nr = R.addStack();
  nr.bottomAlignContent();
  text(nr, n.val, 22, b.state === "none" ? C.fg : breakColors(b.state)[1] === C.white ? C.brand : breakColors(b.state)[1], "heavy", 1);
  nr.addSpacer(4);
  text(nr, n.lbl, 11, C.sub, null, 1);
  R.addSpacer();
  text(R, `${d.nextJudge} 판정`, 10, C.faint, null, 1);
}

function large(w, d, cached) {
  header(w, cached);
  w.addSpacer(10);
  priceRow(w, d, 24);
  w.addSpacer(12);
  // 레이더
  const a = w.addStack();
  a.centerAlignContent();
  text(a, "레이더 판정", 13, C.sub, "semibold", 1);
  a.addSpacer();
  chip(a, d.radar.verdict || "판정 전", verdictColors(d.radar.verdict), 13);
  w.addSpacer(4);
  text(w, d.radar.line || "", 14, C.fg, null, 2);
  if (d.radar.asof) { w.addSpacer(2); text(w, `아침 갱신 ${hhmm(d.radar.asof)}`, 10, C.faint, null, 1); }
  w.addSpacer(12);
  const sep = w.addStack();
  sep.size = new Size(0, 1);
  sep.backgroundColor = C.line;
  sep.addSpacer();
  w.addSpacer(12);
  // 돌파
  const b = d.breakout, n = bigNumber(b);
  const t = w.addStack();
  t.centerAlignContent();
  text(t, "돌파 신호", 13, C.sub, "semibold", 1);
  t.addSpacer();
  chip(t, b.label, breakColors(b.state), 13);
  w.addSpacer(6);
  const nr = w.addStack();
  nr.bottomAlignContent();
  text(nr, n.val, 30, b.state === "none" ? C.fg : breakColors(b.state)[1] === C.white ? C.brand : breakColors(b.state)[1], "heavy", 1);
  nr.addSpacer(6);
  text(nr, n.lbl, 13, C.sub, null, 1);
  w.addSpacer(10);
  (b.checks || []).forEach((c) => {
    const r = w.addStack();
    r.centerAlignContent();
    const m = r.addStack();
    m.size = new Size(18, 18);
    m.cornerRadius = 9;
    m.backgroundColor = c.ok ? C.brand : C.graySoft;
    m.centerAlignContent();
    m.addSpacer();
    text(m, c.ok ? "✓" : "·", 11, c.ok ? C.white : C.gray, "bold", 1);
    m.addSpacer();
    r.addSpacer(8);
    text(r, c.name, 13, C.fg, "semibold", 1);
    r.addSpacer();
    text(r, c.value, 11, C.sub, null, 1);
    w.addSpacer(6);
  });
  w.addSpacer();
  const f = w.addStack();
  text(f, `${d.nextJudge} 판정`, 11, C.faint, null, 1);
  f.addSpacer();
  text(f, `갱신 ${hhmm(d.asof)}`, 11, C.faint, null, 1);
}

// 잠금 화면 위젯
function lock(w, d, family) {
  const b = d.breakout, n = bigNumber(b);
  if (family === "accessoryInline") { text(w, `BTC ${d.radar.verdict || "판정 전"} · ${b.label}`, 12, C.fg, "semibold", 1); return; }
  if (family === "accessoryCircular") {
    w.addSpacer();
    const s = w.addStack(); s.addSpacer(); text(s, (d.radar.verdict || "–").slice(0, 3), 13, C.fg, "bold", 1); s.addSpacer();
    const t = w.addStack(); t.addSpacer(); text(t, n.val, 10, C.fg, null, 1); t.addSpacer();
    w.addSpacer();
    return;
  }
  text(w, `BTC ${d.radar.verdict || "판정 전"} · ${b.label}`, 13, C.fg, "bold", 1);
  text(w, `${n.lbl} ${n.val}`, 12, C.fg, null, 1);
  text(w, `${won(d.price)} · ${d.nextJudge} 판정`, 11, C.fg, null, 1);
}

function failed(w, msg) {
  header(w, false);
  w.addSpacer();
  text(w, "요약을 불러오지 못했어요", 14, C.fg, "bold", 2);
  w.addSpacer(4);
  text(w, "인터넷 연결을 확인하고 잠시 후 다시 볼게요.", 11, C.sub, null, 3);
  w.addSpacer();
}

async function build(family) {
  const w = new ListWidget();
  const isLock = String(family).startsWith("accessory");
  if (!isLock) { w.backgroundColor = C.bg; w.setPadding(14, 15, 14, 15); }
  w.url = SITE;
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000); // 30분마다 다시 받아요
  const { data, cached } = await load();
  if (!data) { if (isLock) text(w, "BTC 레이더 · 불러오지 못했어요", 11, C.fg, null, 2); else failed(w); }
  else if (isLock) lock(w, data, family);
  else if (family === "large" || family === "extraLarge") large(w, data, cached);
  else if (family === "medium") medium(w, data, cached);
  else small(w, data, cached);
  return w;
}

const family = config.runsInWidget ? config.widgetFamily : (args.widgetParameter || "medium");
const widget = await build(family);
if (config.runsInWidget) Script.setWidget(widget);
else if (family === "large") await widget.presentLarge();
else if (family === "small") await widget.presentSmall();
else await widget.presentMedium();
Script.complete();
