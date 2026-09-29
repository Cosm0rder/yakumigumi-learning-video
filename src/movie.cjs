'use strict';
/* 来年から来るギュ後の世界はどうなるのか？ — movie body.
   createMovie(timeline) -> {canvas, ctx, frame(t)}; t is global seconds.
   Characters come from the bundled Yakumigumi atlases (chroma-keyed at load). Everything else is Canvas. */
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

const W = 1920, H = 1080, TAU = Math.PI * 2;
const ASSET = path.join(__dirname, '..', 'assets');
const SUB_TOP = 870, SUB_BOTTOM = 1030, FLOOR = 845; // stage content stays above FLOOR

// ---------------------------------------------------------------- utils
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eOut = t => 1 - Math.pow(1 - clamp(t), 3);
const eIn = t => Math.pow(clamp(t), 3);
const eIO = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const fract = v => v - Math.floor(v);
const rnd = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const wrap = (v, span) => ((v % span) + span) % span;

function registerFonts() {
  try { GlobalFonts.registerFromPath(path.join(ASSET, 'fonts', 'NotoSansJP.ttf'), 'GyuSans'); } catch (e) {}
  try { GlobalFonts.registerFromPath(path.join(ASSET, 'v2', 'DelaGothicOne-Regular.ttf'), 'GyuDela'); } catch (e) {}
}
const SANS = '"GyuSans","Meiryo","Yu Gothic",sans-serif';
const DELA = '"GyuDela","GyuSans","Meiryo",sans-serif';

const SPEAKERS = {
  shoga: { name: 'しょうが', color: '#ffc94d' },
  daikon: { name: 'だいこん', color: '#9fe3b0' },
  chili: { name: 'とうがらし', color: '#ff7a66' },
  garlic: { name: 'にんにく', color: '#f1e3cf' },
  negi: { name: 'ねぎ', color: '#8fe36a' },
};
const CH = { shoga: 0, shogaRunA: 1, shogaRunB: 2, shogaJoy: 3, whale: 4, okra: 5, chili: 6, myoga: 7, tube: 8, wasabi: 9, sudachi: 10, yuzu: 11, garlic: 12, negi: 13, daikon: 14, shogaBag: 15 };
const MO = { wave: 8, crouch: 9, think: 10, jump: 11, crouch2: 12, arms: 13, point: 14, cheer: 15 };
const BASEH = { shoga: 1, daikon: 1.08, chili: 1.06, garlic: .82, negi: 1.12, whale: .62, okra: .6, myoga: .95, tube: 1.0, wasabi: .98, sudachi: .7, yuzu: .58, shogaBag: 1 };

// HUD status per scene: [timeline node 0..4, label]
const STATUS = {
  s01: [0, '2026 いま'], s02: [0, '2026 いま'], s03: [1, '2027 加速？'], s04: [1, '2027 加速？'],
  s05: [2, '2027〜 ギュ中'], s06: [2, '2027〜 ギュ中'], s07: [2, '2027〜 ギュ中'], s08: [2, '2027〜 ギュ中'],
  s09: [2, '2027〜 ギュ中'], s10: [2, '2027〜 ギュ中'], s11: [4, 'SF 地球計算網'], s12: [4, '宇宙文明 月・小惑星'],
  s13: [4, '宇宙文明 太陽'], s14: [4, '宇宙文明 光速の壁'], s15: [4, '宇宙文明 銀河'], s16: [4, '長期シナリオ'],
  s02b: [0, 'この動画の立場'], s03c: [0, '全体の地図'], s03b: [1, '大問一 ギュは起きるか'], s04b: [2, 'ギュ中 仕事'], s06b: [2, 'ギュ中 会社'],
  s07b: [2, 'ギュ中 研究'], s07c: [2, 'ギュ中 資本'], s07d: [2, 'ギュ中 科学と寿命'], s08b: [2, 'ギュ中 経済'], s08c: [2, 'ギュ中 市場'], s08d: [3, '仮説 貨幣のあと'],
  s09b: [3, '仮説 評価経済'], s09c: [3, '仮説 主観的幸福'], s10b: [0, 'いまの備え'], s10c: [3, '大問四 支配構造'], s10d: [3, '大問四 国家'], s10e: [3, '大問四 アライメント'],
  s10f: [2, '大問二 責任'], s10g: [3, '文明の知性'], s10h: [3, '大問三 風刺'], s10i: [3, '風刺 魂路振り分け'], s10j: [3, '風刺 思考実験'], s10k: [3, '大問五 人類の意味'],
  s11b: [4, '宇宙文明 ロボット'], s13b: [4, '宇宙文明 カルダシェフ'], s14b: [4, '仮定 別のASI'], s15b: [4, '宇宙文明 宇宙全体'], s15c: [4, '理論予測 三つの終わり'],
  s16f: [4, '未検証の仮説 AED'], s16g: [4, '思考実験 並行宇宙'], s16h: [4, '思考実験 上位存在'], s18b: [0, '帰還 残り3650日'],
  s03d: [1, '現在の証拠 2026年9月'], s06c: [2, '現在の証拠 エージェント'], s07e: [2, '現在の証拠 研究'], s07g: [2, '現在の証拠 資本と電力'], s07f: [2, '現在の証拠 実験室'], s10ea: [3, '現在の証拠 安全'], s16x: [4, '理論と構想 生存戦略'],
  s16b: [4, '理論予測 熱的死'], s16c: [4, '理論予測 長い夜'], s16d: [4, '文明の構想 冷たい計算'], s16e: [4, '未検証の仮説へ'],
  s17: [4, '宇宙文明 人間の意味'], s18: [0, '帰還 2026 いま'], s19: [3, '2034？ シン平時'], s20: [0, '2026 → 未来'],
};
const TL_NODES = ['いま', '2027', 'ギュ中', 'シン平時', '宇宙'];

// ---------------------------------------------------------------- global resources
const M = { key: [], motion: [] };
let CUR = null; // scene env of the scene being drawn (for speaking detection)

function chromaSprites(img, isKey) {
  const cv = createCanvas(img.width, img.height), x = cv.getContext('2d');
  x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, cv.width, cv.height), a = id.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i], g = a[i + 1], b = a[i + 2];
    if (r > 65 && b > 65 && g < 130 && r > g * 1.65 && b > g * 1.5) a[i + 3] = 0;
  }
  x.putImageData(id, 0, 0);
  const out = [], bounds = [0, .25, .5, .75, 1];
  for (let k = 0; k < 16; k++) {
    const col = k % 4, row = k >> 2;
    let x0 = Math.round(bounds[col] * cv.width), x1 = Math.round(bounds[col + 1] * cv.width);
    let y0 = Math.round(bounds[row] * cv.height), y1 = Math.round(bounds[row + 1] * cv.height);
    if (isKey && k === 14) y0 -= 13; // daikon crown crosses the row boundary
    if (isKey && k === 10) y1 -= 13;
    let L = x1, T = y1, R = x0, B = y0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      if (a[(yy * cv.width + xx) * 4 + 3] > 100) { if (xx < L) L = xx; if (xx > R) R = xx; if (yy < T) T = yy; if (yy > B) B = yy; }
    }
    const w = Math.max(1, R - L + 1), h = Math.max(1, B - T + 1);
    const sc = createCanvas(w, h), s = sc.getContext('2d');
    s.drawImage(cv, L, T, w, h, 0, 0, w, h);
    // Remove tiny isolated flecks left by the chroma-key atlas cell boundaries.
    const clean=s.getImageData(0,0,w,h),px=clean.data,seen=new Uint8Array(w*h),groups=[];
    for(let p=0;p<w*h;p++) {
      if(seen[p]||px[p*4+3]<20)continue;
      const group=[p];seen[p]=1;
      for(let q=0;q<group.length;q++) {
        const k=group[q],xx=k%w,yy=Math.floor(k/w);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
          const nx=xx+dx,ny=yy+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;
          const n=ny*w+nx;if(!seen[n]&&px[n*4+3]>=20){seen[n]=1;group.push(n);}
        }
      }
      groups.push(group);
    }
    const largest=Math.max(0,...groups.map(g=>g.length)),minimum=Math.max(20,largest/500);
    for(const group of groups)if(group.length<minimum)for(const p of group)px[p*4+3]=0;
    s.putImageData(clean,0,0);
    out.push(sc);
  }
  return out;
}

function buildCity(seed, { w = 2400, h = 640, minH = 120, maxH = 520, night = true, far = false } = {}) {
  const cv = createCanvas(w, h), c = cv.getContext('2d');
  const dayPal = far ? ['#b8c7df', '#aebfda', '#c4d0e4'] : ['#f0d9b5', '#e7c6a0', '#d9e3ea', '#f5e6c8', '#cfe0d6'];
  const nightPal = far ? ['#1c2444', '#20294c', '#18203d'] : ['#141a30', '#171e38', '#11172b'];
  let x = 0, i = 0;
  while (x < w) {
    const bw = Math.round(60 + rnd(seed + i * 1.3) * 120);
    const bh = Math.round(minH + rnd(seed + i * 2.7) * (maxH - minH));
    const pal = night ? nightPal : dayPal;
    c.fillStyle = pal[Math.floor(rnd(seed + i * 4.1) * pal.length)];
    c.fillRect(x, h - bh, bw, bh);
    if (!night) { c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(x + bw - 8, h - bh, 8, bh); }
    if (rnd(seed + i * 5.5) > .7) { c.fillStyle = night ? '#0d1122' : '#8a7f78'; c.fillRect(x + bw / 2 - 2, h - bh - 26, 4, 26); if (night) { c.fillStyle = '#ff6b5a'; c.fillRect(x + bw / 2 - 3, h - bh - 30, 6, 6); } }
    for (let wy = h - bh + 16; wy < h - 20; wy += far ? 20 : 26) for (let wx = x + 10; wx < x + bw - 14; wx += far ? 15 : 20) {
      const lit = rnd(seed + i * 7 + wx * .13 + wy * .07);
      if (night) { if (lit > (far ? .66 : .56)) { c.fillStyle = lit > .94 ? '#9fe8ff' : '#ffd98a'; c.fillRect(wx, wy, far ? 6 : 9, far ? 8 : 12); } }
      else { c.fillStyle = lit > .7 ? '#e3f3fb' : '#a9c7d8'; c.fillRect(wx, wy, far ? 6 : 9, far ? 8 : 12); }
    }
    x += bw + Math.round(rnd(seed + i * 3.1) * 14); i++;
  }
  return cv;
}

// stars / galaxy / swarm / globe point sets
const STARS = Array.from({ length: 1500 }, (_, i) => ({ x: rnd(i * 3.1) * 2 - 1, y: rnd(i * 7.7 + 1) * 2 - 1, d: .15 + rnd(i * 1.9 + 4) * .85, s: rnd(i * 5.3 + 2), ph: rnd(i * 2.2 + 9) * TAU, c: rnd(i * 8.8 + 3) }));
const GAL = Array.from({ length: 4600 }, (_, i) => {
  const arm = i % 2, bulge = rnd(i * 3.7) < .2;
  let r, th;
  if (bulge) { r = Math.pow(rnd(i * 5.1), 1.8) * .26; th = rnd(i * 6.3) * TAU; }
  else { r = .12 + Math.pow(rnd(i * 1.13 + .5), .8) * .9; th = arm * Math.PI + Math.log(r / .12) * 2.4 + (rnd(i * 9.1) - .5) * .7 * (1 - r * .25); }
  return { r, th, c: rnd(i * 4.4), s: rnd(i * 2.9), z: (rnd(i * 7.3) - .5) * .07 * (1 - r * .6), bulge };
});
const SUN_G = { r: .62, th: Math.log(.62 / .12) * 2.4 + .05 };
(function galDist() {
  const sx = SUN_G.r * Math.cos(SUN_G.th), sy = SUN_G.r * Math.sin(SUN_G.th);
  for (const g of GAL) { g.x0 = g.r * Math.cos(g.th); g.y0 = g.r * Math.sin(g.th); g.dist = Math.hypot(g.x0 - sx, g.y0 - sy); }
})();
const HUBS = (() => {
  const idx = GAL.map((g, i) => i).filter(i => !GAL[i].bulge && rnd(i * 11.3) > .93).sort((a, b) => GAL[a].dist - GAL[b].dist).slice(0, 110);
  return idx.map((gi, k) => {
    let best = -1, bd = 1e9;
    for (let j = 0; j < k; j++) { const a = GAL[gi], b = GAL[idx[j]], d = Math.hypot(a.x0 - b.x0, a.y0 - b.y0); if (d < bd) { bd = d; best = idx[j]; } }
    return { gi, parent: best };
  });
})();
const SW = Array.from({ length: 2000 }, (_, i) => ({ a: .78 + Math.pow(rnd(i * 1.7), .8) * 1.3, inc: (rnd(i * 2.3) - .5) * 1.4, node: rnd(i * 3.9) * TAU, ph: rnd(i * 5.2) * TAU, sz: rnd(i * 6.6) }));
const GLOBE = (() => {
  const N = 2300, g = Math.PI * (3 - Math.sqrt(5)), pts = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), phi = i * g;
    const lat = Math.asin(y), lon = Math.atan2(Math.sin(phi) * r, Math.cos(phi) * r);
    const f = Math.sin(lon * 2 + 1.3) * Math.cos(lat * 2.6) + .6 * Math.sin(lon * 5 + lat * 4 + 2) + .35 * Math.sin(lon * 9 - lat * 7);
    const land = f > .38 && Math.abs(lat) < 1.3;
    pts.push({ lat, lon, land, city: land && rnd(i * 1.37) > .72, ice: Math.abs(lat) > 1.25 });
  }
  const cities = pts.filter(p => p.city);
  const arcs = [];
  for (let k = 0; k < 46; k++) { const a = cities[Math.floor(rnd(k * 3.3) * cities.length)], b = cities[Math.floor(rnd(k * 5.9 + 1) * cities.length)]; if (a !== b) arcs.push([a, b, rnd(k * 2.1)]); }
  return { pts, arcs };
})();

// ---------------------------------------------------------------- drawing helpers
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function card(ctx, x, y, w, h, o = {}) {
  const { fill = '#fff6df', stroke = '#2a2233', r = 16, lw = 4, shadow = true, alpha = 1 } = o;
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(ctx, x + 6, y + 8, w, h, r); ctx.fill(); }
  ctx.fillStyle = fill; rr(ctx, x, y, w, h, r); ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
}
function txt(ctx, s, x, y, o = {}) {
  const { size = 40, color = '#fff6df', align = 'center', font = SANS, stroke = 0, strokeColor = 'rgba(20,14,30,.9)', base = 'middle', alpha = 1, weight = 'bold', maxW } = o;
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.font = `${font === DELA ? 'normal' : weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = base;
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = stroke; ctx.strokeStyle = strokeColor; ctx.strokeText(s, x, y, maxW); }
  ctx.fillStyle = color; ctx.fillText(s, x, y, maxW); ctx.restore();
}
function label(ctx, s, x, y, o = {}) { // pill label
  const size = o.size || 26; ctx.save(); ctx.font = `bold ${size}px ${SANS}`;
  const w = ctx.measureText(s).width + size * 1.1, h = size * 1.6; ctx.restore();
  const ax = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2;
  card(ctx, ax, y - h / 2, w, h, { fill: o.fill || 'rgba(20,16,36,.82)', stroke: o.stroke || '#ffc94d', lw: o.lw ?? 3, r: h / 2, shadow: false, alpha: o.alpha ?? 1 });
  txt(ctx, s, ax + w / 2, y + 1, { size, color: o.color || '#fff6df', alpha: o.alpha ?? 1 });
  return w;
}
function vgrad(ctx, stops, y0 = 0, y1 = H) {
  const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
}
function glow(ctx, x, y, r, color, a = 1) {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalAlpha *= a; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
}
function ripple(ctx, x, y, since, o = {}) {
  const { color = '255,214,140', n = 3, max = 520, squash = .34, life = 2.4, lw = 6 } = o;
  if (since < 0) return;
  for (let k = 0; k < n; k++) {
    const s = since - k * .42; if (s < 0 || s > life) continue;
    const p = s / life, r = max * eOut(p);
    ctx.save(); ctx.globalAlpha = (1 - p) * .85; ctx.strokeStyle = `rgb(${color})`; ctx.lineWidth = lw * (1 - p) + 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * squash, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
}
function shake(since, amp = 9, life = 1.1) {
  if (since < 0 || since > life) return [0, 0];
  const d = 1 - since / life; return [Math.sin(since * 34) * amp * d * d, Math.cos(since * 27) * amp * .45 * d * d];
}
function arrow(ctx, x0, y0, x1, y1, o = {}) {
  const { color = '#fff6df', lw = 6, head = 20, dash = null, alpha = 1 } = o;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * 4, y1 + Math.sin(a) * 4); ctx.lineTo(x1 - Math.cos(a - .5) * head, y1 - Math.sin(a - .5) * head); ctx.lineTo(x1 - Math.cos(a + .5) * head, y1 - Math.sin(a + .5) * head); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawSprite(ctx, spr, x, y, h, o = {}) {
  const w = h * spr.width / spr.height;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot);
  ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1); ctx.globalAlpha *= (o.alpha ?? 1);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(spr, -w / 2, -h, w, h); ctx.restore();
}
function speechMark(ctx, x, y, t, h, flip) {
  ctx.save(); ctx.strokeStyle = '#fff6df'; ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const p = fract(t * 1.6 - k * .33); ctx.globalAlpha = (1 - p) * .9; ctx.lineWidth = Math.max(2, h * .016);
    const r = h * (.05 + p * .12); ctx.beginPath();
    if (flip) ctx.arc(x, y, r, Math.PI * .75, Math.PI * 1.25); else ctx.arc(x, y, r, -Math.PI * .25, Math.PI * .25);
    ctx.stroke();
  }
  ctx.restore();
}
function poseSprite(pose) {
  if (pose === 'joy') return M.key[CH.shogaJoy];
  if (pose === 'bag') return M.key[CH.shogaBag];
  if (MO[pose] != null) return M.motion[MO[pose]];
  return M.key[CH.shoga];
}
/** Draw a cast member standing with feet at (x,y). o: {flip, pose, walk, hop, rot, alpha, mute, shadow} */
function actor(ctx, who, x, y, h, o = {}) {
  const E = CUR, t = E ? E.t : 0, speaking = E && E.spk === who && !o.mute;
  const ph = (who.charCodeAt(0) * 1.37 + who.length) % TAU;
  const hh = h * (BASEH[who] || 1);
  let spr;
  if (who === 'shoga') {
    if (o.walk) spr = M.motion[Math.floor(t * 10 + ph) % 8];
    else if ((o.pose || 'idle') === 'idle' && speaking) spr = [M.key[0], M.motion[MO.arms], M.key[0], M.motion[MO.point]][Math.floor(t / .8) % 4];
    else spr = poseSprite(o.pose);
  } else spr = M.key[CH[who] ?? 0];
  let sx = 1, sy = 1, dy = 0, rot = o.rot || 0;
  if (o.walk && who !== 'shoga') { dy = -Math.abs(Math.sin(t * 9 + ph)) * hh * .06; rot += Math.sin(t * 9 + ph) * .06; }
  if (speaking) { const k = Math.abs(Math.sin(t * 11 + ph)); sy = 1 + k * .045; sx = 1 - k * .025; dy -= k * hh * .02; }
  else if (!o.walk) sy = 1 + Math.sin(t * 2.2 + ph) * .013;
  if (o.hop) dy -= o.hop;
  if (o.shadow !== false) { ctx.save(); ctx.globalAlpha *= .26 * (o.alpha ?? 1); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y + 2, hh * .27, hh * .05, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  drawSprite(ctx, spr, x, y + dy, hh, { flip: o.flip, alpha: o.alpha ?? 1, sx, sy, rot });
  if (speaking && o.bubble !== false) speechMark(ctx, x + (o.flip ? -1 : 1) * hh * .45, y - hh * .9 + dy, t, hh, o.flip);
}
function tiny(ctx, x, y, s, col, t, ph, walk = true, flip = false, alpha = 1) {
  if (alpha <= 0) return;
  const st = walk ? Math.sin(t * 10 + ph) : 0;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(Math.round(x), Math.round(y - Math.abs(st) * 2 * s)); if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = '#2a2233'; ctx.fillRect(-5 * s + st * 2 * s, -10 * s, 4 * s, 10 * s); ctx.fillRect(1 * s - st * 2 * s, -10 * s, 4 * s, 10 * s);
  ctx.fillStyle = col; ctx.fillRect(-6 * s, -26 * s, 12 * s, 17 * s);
  ctx.fillStyle = '#f5d6a8'; ctx.fillRect(-5 * s, -37 * s, 10 * s, 10 * s);
  ctx.fillStyle = '#2a2233'; ctx.fillRect(1 * s, -34 * s, 2 * s, 2 * s);
  ctx.restore();
}
function bot(ctx, x, y, s, t, o = {}) {
  const bob = Math.sin(t * 2.4) * 4 * s;
  glow(ctx, x, y - 50 * s, 130 * s, 'rgba(70,217,196,.55)', o.glow ?? 1);
  ctx.save(); ctx.fillStyle = '#9fe8e0'; ctx.fillRect(x - 2 * s, y - 112 * s + bob, 4 * s, 18 * s); ctx.beginPath(); ctx.arc(x, y - 114 * s + bob, 6 * s, 0, TAU); ctx.fill(); ctx.restore();
  card(ctx, x - 48 * s, y - 96 * s + bob, 96 * s, 86 * s, { fill: '#1f6f78', stroke: '#0c2c33', r: 16 * s, lw: 5 * s, shadow: false });
  card(ctx, x - 36 * s, y - 84 * s + bob, 72 * s, 50 * s, { fill: '#0f3d45', stroke: '#46d9c4', r: 10 * s, lw: 2 * s, shadow: false });
  const blink = fract(t / 3.1) > .95 ? .15 : 1;
  ctx.save(); ctx.fillStyle = '#aaffee'; ctx.fillRect(x - 20 * s, y - 68 * s + bob, 10 * s, 16 * s * blink); ctx.fillRect(x + 10 * s, y - 68 * s + bob, 10 * s, 16 * s * blink); ctx.restore();
  txt(ctx, o.label || 'AI', x, y - 22 * s + bob, { size: 20 * s, color: '#aaffee' });
}
function stars(ctx, t, o = {}) {
  const { ox = 0, oy = 0, zoom = 1, alpha = 1, cx = W / 2, cy = H / 2, dim = 1 } = o;
  if (alpha <= 0) return;
  ctx.save();
  for (const s of STARS) {
    const z = Math.min(Math.pow(zoom, s.d), 60);
    const xx = wrap(s.x * 1300 - ox * s.d + 1300, 2600) - 1300, yy = wrap(s.y * 800 - oy * s.d + 800, 1600) - 800;
    const x = cx + xx * z, y = cy + yy * z;
    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
    const sz = Math.min(7, (1 + s.s * 2.4) * (.4 + s.d * .8) * Math.sqrt(z));
    const b = (.45 + .55 * (.5 + .5 * Math.sin(t * 1.3 + s.ph))) * alpha * dim;
    ctx.globalAlpha = b; ctx.fillStyle = s.c > .85 ? '#9fd4ff' : s.c > .7 ? '#ffe2a8' : '#ffffff';
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(sz)), Math.max(1, Math.round(sz)));
  }
  ctx.restore();
}
function nebula(ctx, t, a = 1) {
  glow(ctx, 380 + Math.sin(t * .05) * 40, 260, 620, 'rgba(120,60,170,.30)', a);
  glow(ctx, 1560, 700 + Math.cos(t * .04) * 30, 700, 'rgba(40,120,160,.26)', a);
  glow(ctx, 1100, 160, 420, 'rgba(200,90,120,.16)', a);
}
function drawCity(ctx, cv, off, groundY, scale = 1, alpha = 1) {
  if (alpha <= 0) return;
  const w = cv.width * scale, h = cv.height * scale, x0 = -wrap(off, w);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = false;
  for (let x = x0; x < W; x += w) ctx.drawImage(cv, x, groundY - h, w, h);
  ctx.restore();
}
function nightSky(ctx, t, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; vgrad(ctx, ['#070a1c', '#141a3c', '#2a2350']); ctx.restore();
  stars(ctx, t, { alpha: .8 * a, ox: t * 6 });
}
function globe(ctx, cx, cy, R, rot, tilt, t, o = {}) {
  const { night = true, net = 0, alpha = 1, lights = 1 } = o;
  if (alpha <= 0 || R < 2) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  glow(ctx, cx, cy, R * 1.35, night ? 'rgba(70,140,255,.35)' : 'rgba(120,190,255,.5)');
  const g = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R);
  if (night) { g.addColorStop(0, '#173a6e'); g.addColorStop(1, '#060f26'); } else { g.addColorStop(0, '#5fb0ff'); g.addColorStop(1, '#1b4f9c'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  const ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(rot), sr = Math.sin(rot);
  const proj = (lat, lon, lift = 1) => {
    const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
    const x1 = x * cr - z * sr, z1 = x * sr + z * cr;
    const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
    return [cx + R * lift * x1, cy - R * lift * y2, z2];
  };
  const ds = Math.max(1.5, R * .024);
  for (const p of GLOBE.pts) {
    if (!p.land && !p.ice) continue;
    const [x, y, z] = proj(p.lat, p.lon); if (z < 0) continue;
    const shade = .45 + .55 * z;
    if (p.ice) ctx.fillStyle = `rgba(230,240,255,${.7 * shade})`;
    else ctx.fillStyle = night ? `rgba(40,90,110,${shade})` : `rgba(${Math.round(90 + 40 * p.lon)},${Math.round(170 + 30 * z)},90,${shade})`;
    ctx.fillRect(x - ds / 2, y - ds / 2, ds, ds);
    if (p.city && lights > 0) { ctx.globalAlpha = alpha * lights * (.6 + .4 * Math.sin(t * 2 + p.lon * 7)); ctx.fillStyle = '#ffd27a'; ctx.fillRect(x - ds * .35, y - ds * .35, ds * .7, ds * .7); ctx.globalAlpha = alpha; }
  }
  if (net > 0) {
    ctx.lineCap = 'round';
    GLOBE.arcs.forEach(([a, b, ph], k) => {
      const va = [Math.cos(a.lat) * Math.cos(a.lon), Math.sin(a.lat), Math.cos(a.lat) * Math.sin(a.lon)], vb = [Math.cos(b.lat) * Math.cos(b.lon), Math.sin(b.lat), Math.cos(b.lat) * Math.sin(b.lon)];
      const dot = clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1), om = Math.acos(dot); if (om < .05) return;
      const show = clamp(net * 46 - k); if (show <= 0) return;
      const pts = [];
      for (let i = 0; i <= 18; i++) {
        const f = i / 18 * show, s1 = Math.sin((1 - f) * om) / Math.sin(om), s2 = Math.sin(f * om) / Math.sin(om);
        const v = [va[0] * s1 + vb[0] * s2, va[1] * s1 + vb[1] * s2, va[2] * s1 + vb[2] * s2];
        const lat = Math.asin(clamp(v[1], -1, 1)), lon = Math.atan2(v[2], v[0]);
        pts.push(proj(lat, lon, 1 + .16 * Math.sin(Math.PI * f / Math.max(show, .001) * show)));
      }
      ctx.strokeStyle = 'rgba(90,240,220,.75)'; ctx.lineWidth = Math.max(1.5, R * .006);
      ctx.beginPath(); let on = false;
      for (const [x, y, z] of pts) { if (z > -.15) { if (!on) ctx.moveTo(x, y); else ctx.lineTo(x, y); on = true; } else on = false; }
      ctx.stroke();
      const f = fract(t * .35 + ph), pi = Math.floor(f * (pts.length - 1)), P = pts[pi];
      if (P && P[2] > 0 && show >= 1) { ctx.fillStyle = '#eafffb'; ctx.fillRect(P[0] - 3, P[1] - 3, 6, 6); }
    });
  }
  // terminator shading + rim
  const sh = ctx.createLinearGradient(cx - R, cy, cx + R, cy); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, night ? 'rgba(0,0,10,.35)' : 'rgba(0,0,20,.45)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = night ? 'rgba(120,200,255,.55)' : 'rgba(200,235,255,.8)'; ctx.lineWidth = Math.max(2, R * .012); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.restore();
}
function ship(ctx, x, y, s, ang, t, o = {}) {
  const { flame = 1, alpha = 1 } = o;
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  if (flame > 0) {
    const fl = (1 + .18 * Math.sin(t * 31) + .1 * Math.sin(t * 17)) * flame;
    const g = ctx.createLinearGradient(-110, 0, -110 - 190 * fl, 0); g.addColorStop(0, 'rgba(255,245,200,1)'); g.addColorStop(.35, 'rgba(255,170,60,.9)'); g.addColorStop(1, 'rgba(255,80,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-100, -26); ctx.quadraticCurveTo(-110 - 200 * fl, 0, -100, 26); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#b5793a'; ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-60, -40); ctx.lineTo(-120, -92); ctx.lineTo(-100, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-60, 40); ctx.lineTo(-120, 92); ctx.lineTo(-100, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
  const bg = ctx.createLinearGradient(0, -52, 0, 52); bg.addColorStop(0, '#fff1c9'); bg.addColorStop(.6, '#f0cf8a'); bg.addColorStop(1, '#c9974f');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-110, -44); ctx.lineTo(80, -50); ctx.quadraticCurveTo(190, -30, 210, 0); ctx.quadraticCurveTo(190, 30, 80, 50); ctx.lineTo(-110, 44); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(214,160,80,.45)'; for (let i = -100; i < 200; i += 46) ctx.fillRect(i, -60, 14, 120); ctx.restore();
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#123b4a'; ctx.beginPath(); ctx.arc(-40 + i * 52, -6, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = 4; ctx.stroke(); ctx.fillStyle = 'rgba(150,255,240,.8)'; ctx.fillRect(-46 + i * 52, -14, 6, 6); }
  ctx.fillStyle = '#4a2c14'; ctx.font = `bold 22px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ギュ号', 20, 28);
  ctx.restore();
}
function porthole(ctx, x, y, r, t, cast, o = {}) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  const g = ctx.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, o.top || '#3e2f5c'); g.addColorStop(1, o.bottom || '#1a1630'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  glow(ctx, x, y - r * .6, r, 'rgba(255,200,120,.25)');
  ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 4; i++) ctx.fillRect(x - r + i * r * .55, y - r, r * .08, 2 * r);
  cast.forEach(c => actor(ctx, c.who, x + c.dx * r, y + r * (c.dy ?? .92), r * (c.h || .9), { flip: c.flip, pose: c.pose, shadow: false, bubble: false }));
  ctx.restore();
  ctx.save(); ctx.lineWidth = r * .16; const mg = ctx.createLinearGradient(x - r, y - r, x + r, y + r); mg.addColorStop(0, '#e8e2d4'); mg.addColorStop(1, '#6f6a7c');
  ctx.strokeStyle = mg; ctx.beginPath(); ctx.arc(x, y, r + r * .06, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#3a3546'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 1.06, y + Math.sin(a) * r * 1.06, r * .03, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = .18; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - r * .35, y - r * .45, r * .35, r * .12, -.6, 0, TAU); ctx.fill();
  ctx.restore();
}
function sun(ctx, x, y, r, t, a = 1) {
  glow(ctx, x, y, r * 5, 'rgba(255,170,60,.35)', a); glow(ctx, x, y, r * 2.4, 'rgba(255,220,140,.7)', a);
  ctx.save(); ctx.globalAlpha *= a;
  const g = ctx.createRadialGradient(x - r * .2, y - r * .2, r * .1, x, y, r); g.addColorStop(0, '#fffbe8'); g.addColorStop(.6, '#ffd36b'); g.addColorStop(1, '#ff9a3c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,140,40,.35)'; ctx.lineWidth = Math.max(1, r * .05);
  for (let i = 0; i < 5; i++) { const a0 = t * .2 + i * 1.3; ctx.beginPath(); ctx.arc(x, y, r * (.35 + i * .12), a0, a0 + 1.2); ctx.stroke(); }
  ctx.restore();
}
function galaxy(ctx, t, o = {}) {
  const { cx = W / 2, cy = 430, R = 470, tilt = .5, rot = t * .02, fx = 0, fy = 0, alpha = 1, colon = 0, warm = 0, dim = 1 } = o;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const sunX = SUN_G.r * Math.cos(SUN_G.th), sunY = SUN_G.r * Math.sin(SUN_G.th);
  const pos = (x0, y0, z) => { const x = x0 * cr - y0 * sr, y = x0 * sr + y0 * cr; return [cx + (x - fx) * R, cy + ((y - fy) * tilt + z) * R]; };
  if (alpha <= 0) { const [sx, sy] = pos(sunX, sunY, 0); return { sunX: sx, sunY: sy, pos }; }
  ctx.save();
  glow(ctx, cx - fx * R, cy - fy * R * tilt, R * .45, 'rgba(255,220,160,.45)', alpha * dim);
  for (let i = 0; i < GAL.length; i++) {
    const g = GAL[i]; const [x, y] = pos(g.x0, g.y0, g.z);
    if (x < -5 || x > W + 5 || y < -5 || y > H + 5) continue;
    const col = g.dist < colon;
    const sz = Math.min(8, Math.max(1, (g.bulge ? 2.2 : 1.6 + g.s * 1.8) * Math.sqrt(R / 470)));
    ctx.globalAlpha = alpha * dim * (g.bulge ? .75 : .45 + g.s * .5) * (col ? 1 : 1 - warm * .3);
    ctx.fillStyle = col ? (g.c > .5 ? '#46f0d0' : '#ffd36b') : g.r < .3 ? '#ffe6b8' : g.c > .6 ? '#9cc8ff' : '#dfe8ff';
    ctx.fillRect(x, y, col ? sz + 1 : sz, col ? sz + 1 : sz);
  }
  ctx.globalAlpha = alpha;
  if (colon > 0) {
    ctx.lineWidth = 1.6;
    for (const h of HUBS) {
      if (h.parent < 0) continue; const a = GAL[h.gi], b = GAL[h.parent]; if (a.dist > colon) continue;
      const [x1, y1] = pos(a.x0, a.y0, a.z), [x0, y0] = pos(b.x0, b.y0, b.z);
      ctx.strokeStyle = 'rgba(90,240,210,.45)'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const f = fract(t * .12 + h.gi * .013); ctx.fillStyle = '#eafffb'; ctx.fillRect(lerp(x0, x1, f) - 2, lerp(y0, y1, f) - 2, 4, 4);
    }
  }
  const [sx, sy] = pos(sunX, sunY, 0);
  ctx.restore();
  return { sunX: sx, sunY: sy, pos };
}

// ---------------------------------------------------------------- scene env
function prepScene(sc) {
  const dur = sc.end - sc.start;
  return { ...sc, dur, L: (sc.lines || []).map(l => ({ ...l, s: l.start - sc.start, e: l.end - sc.start })) };
}
function makeEnv(sc, u, t) {
  const L = sc.L, n = L.length;
  const at = i => L[i] ? L[i].s : sc.dur * (i + .5) / (n + 1);
  const end = i => L[i] ? L[i].e : at(i) + 2;
  let li = -1, spk = null;
  for (let i = 0; i < n; i++) { if (u >= L[i].s) li = i; if (u >= L[i].s && u < L[i].e) spk = L[i].speaker; }
  return {
    u, t, sc, dur: sc.dur, L, li, spk, at, end,
    p: (i, d = 1) => clamp((u - at(i)) / d),
    lp: i => clamp((u - at(i)) / Math.max(.1, end(i) - at(i))),
    since: i => u - at(i),
    mid: (i, f = .5) => lerp(at(i), end(i), f),
  };
}

// ---------------------------------------------------------------- scenes
const SCENES = Object.create(null);

// s01 — cold open: deep space -> Earth -> night city, "ギュ" ripple
SCENES.cosmos_open = (ctx, E) => {
  const { u, t } = E, T1 = Math.max(2.6, E.at(0) - .2), p = clamp(u / T1);
  const cityA = ease((p - .62) / .38);
  if (cityA < 1) {
    ctx.fillStyle = '#04040c'; ctx.fillRect(0, 0, W, H); nebula(ctx, t, 1 - cityA);
    stars(ctx, t, { zoom: Math.exp(p * p * 2.6), ox: u * 14 });
    const R = 70 * Math.exp(eIn(p) * 4.6);
    globe(ctx, W / 2 + 120 * (1 - p), H / 2 + R * .55 * eIn(p) - 40, R, u * .18 + 2.2, .38, t, { night: true, lights: 1, alpha: 1 });
    if (p < .5) txt(ctx, '2026年9月　地球', W / 2, 150, { size: 36, alpha: 1 - Math.abs(p - .25) * 4, color: '#cfe4ff' });
  }
  if (cityA > 0) {
    ctx.save(); ctx.globalAlpha = cityA;
    const push = 1 + .05 * clamp((u - T1) / 20);
    ctx.translate(W / 2, H / 2); ctx.scale(push, push); ctx.translate(-W / 2, -H / 2);
    const tiltUp = E.li >= 2 ? eIO(E.p(2, 3)) * 60 : 0;
    ctx.translate(0, tiltUp);
    nightSky(ctx, t); glow(ctx, 1500, 170, 60, 'rgba(255,245,210,.8)'); ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(1500, 170, 34, 0, TAU); ctx.fill();
    drawCity(ctx, M.cityNightFar, u * 8, 700, 1); drawCity(ctx, M.cityNightNear, u * 16 + 300, 790, 1);
    // "ギュ" ripples from the city
    for (let k = 0; k < 3; k++) {
      const s0 = E.at(0) + .3 + k * 2.4; if (E.li >= 1 && k > 0 && E.u > E.at(1)) continue;
      ripple(ctx, 720, 640, u - s0, { max: 620, squash: .3, life: 2.6 });
    }
    const sg = u - E.at(0) - .2;
    if (sg > 0 && sg < 3.5) { const [dx, dy] = shake(sg, 6, 1); txt(ctx, 'ギュ…', 720 + dx, 470 + dy, { size: 120, font: DELA, color: '#ffc94d', stroke: 10, alpha: clamp(sg * 3) * clamp((3.5 - sg) / 1) }); }
    // rooftop
    ctx.fillStyle = '#0b0f1f'; ctx.fillRect(0, 780, W, 400); ctx.fillStyle = '#1d2440'; ctx.fillRect(0, 780, W, 8);
    ctx.strokeStyle = '#28305a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(1040, 700); ctx.lineTo(1900, 700); ctx.stroke();
    for (let x = 1060; x < 1900; x += 70) { ctx.beginPath(); ctx.moveTo(x, 700); ctx.lineTo(x, 782); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = cityA;
    actor(ctx, 'shoga', 1260, 800, 250, { pose: E.li >= 2 && !E.spk ? 'point' : 'idle' });
    actor(ctx, 'daikon', 1560, 800, 250, { flip: true });
    ctx.restore();
  }
};

// s02 — title card with ensemble
SCENES.title = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#2b2350', '#8a4f7d', '#f2a65a']);
  glow(ctx, W / 2, 760, 900, 'rgba(255,200,120,.35)');
  drawCity(ctx, M.cityNightFar, u * 10, 820, 1, .9);
  const lines = [['来年から来る', 0], ['ギュ後の世界は', 1], ['どうなるのか？', 2]];
  lines.forEach(([s, i]) => {
    const d = u - .2 - i * .35, a = eOut(d / .6);
    let x0 = W / 2, y = 170 + i * 128;
    ctx.save(); ctx.font = `normal 108px ${DELA}`; const w = ctx.measureText(s).width; ctx.restore();
    let x = x0 - w / 2;
    for (let c = 0; c < s.length; c++) {
      const ch = s[c]; ctx.save(); ctx.font = `normal 108px ${DELA}`; const cw = ctx.measureText(ch).width; ctx.restore();
      const dd = clamp((d - c * .04) / .4), gy = (1 - eOut(dd)) * -60;
      const isG = s.startsWith('ギュ') && c < 2;
      let [sx, sy] = isG ? shake(u - 1.4, 7, 1) : [0, 0];
      txt(ctx, ch, x + cw / 2 + sx, y + gy + sy, { size: 108, font: DELA, color: isG ? '#ffc94d' : '#fff6df', stroke: 14, alpha: dd * a });
      x += cw;
    }
  });
  ripple(ctx, W / 2 - 250, 300, u - 1.4, { max: 380, squash: .5, life: 2.2, n: 2 });
  label(ctx, '条件付きシナリオ：もし2027年にAIの加速が来たら', W / 2, 540, { size: 32, alpha: ease((u - 1.2) / .6) });
  const back = ['myoga', 'wasabi', 'yuzu', 'tube', 'sudachi', 'okra', 'negi', 'whale'];
  back.forEach((w, i) => {
    const x = 120 + i * 240 + (i >= 4 ? 120 : 0), inA = ease((u - .6 - i * .08) / .6);
    if (i === 3 || i === 4) return;
    actor(ctx, w, x, 740, 150, { alpha: inA * .9, hop: Math.abs(Math.sin(t * 3 + i)) * 8, flip: i > 3 });
  });
  const walkIn = eOut(u / 1.6);
  actor(ctx, 'chili', lerp(-200, 520, walkIn), FLOOR, 250, { walk: walkIn < 1 });
  actor(ctx, 'shoga', lerp(-400, 800, walkIn), FLOOR, 250, { walk: walkIn < 1, pose: walkIn >= 1 && !E.spk ? 'wave' : 'idle' });
  actor(ctx, 'garlic', lerp(2200, 1180, walkIn), FLOOR, 250, { walk: walkIn < 1, flip: true });
  actor(ctx, 'daikon', lerp(2400, 1450, walkIn), FLOOR, 250, { walk: walkIn < 1, flip: true });
  if (E.li >= 2) {
    const a = ease(E.p(2, .5));
    ['何が', '→', 'どうつながる？'].forEach((s, i) => txt(ctx, s, 1560 + [-110, -20, 110][i], 470, { size: 30, alpha: a, stroke: 6, color: i === 1 ? '#ffc94d' : '#fff6df' }));
  }
};

// s03 — definitions: steps AGI/ASI, original timeline, point -> period
SCENES.define = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#0f1830', '#17264a']);
  ctx.save(); ctx.strokeStyle = 'rgba(120,170,255,.08)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
  // stage A: steps
  const up = ease(E.p(1, .8)); // steps shrink upward when timeline arrives
  ctx.save(); ctx.translate(120, lerp(80, -20, up)); ctx.scale(lerp(1, .62, up), lerp(1, .62, up));
  const steps = [['AI', 'いまのAI', '#5b7bb5'], ['AGI', '人間並みに幅広く働ける', '#46a0c4'], ['ASI', '人間をはるかに超える', '#46d9c4']];
  steps.forEach(([k, d, c], i) => {
    const a = ease((E.since(0) - i * .7) / .5), x = i * 380, h = 160 + i * 130, y = 720 - h;
    card(ctx, x, y + (1 - a) * 40, 330, h, { fill: c, alpha: a, stroke: '#0c1a2e' });
    txt(ctx, k, x + 165, y + 55, { size: 64, font: DELA, alpha: a, stroke: 8, strokeColor: '#0c1a2e' });
    txt(ctx, d, x + 165, y + 120, { size: 26, alpha: a, color: '#0c1a2e', maxW: 300 });
  });
  const gA = ease((E.since(0) - 2.4) / .6) * (1 - up);
  if (gA > 0) {
    ctx.save(); ctx.globalAlpha = gA; ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 10; ctx.setLineDash([22, 14]); ctx.lineDashOffset = -t * 40;
    ctx.beginPath(); ctx.moveTo(40, 470); ctx.bezierCurveTo(300, 250, 700, 120, 1080, 90); ctx.stroke(); ctx.restore();
    arrow(ctx, 1040, 96, 1110, 86, { color: '#ffc94d', lw: 10, head: 34, alpha: gA });
    txt(ctx, 'ギュ ＝ そこへ向かう加速の全体', 560, 60, { size: 44, color: '#ffc94d', stroke: 8, alpha: gA });
  }
  ctx.restore();
  // stage B: timeline
  const tA = ease(E.p(1, .8));
  if (tA > 0) {
    const y = 600, x0 = 140, x1 = 1400, yr = v => lerp(x0, x1, (v - 2025) / 11);
    ctx.save(); ctx.globalAlpha = tA; ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    for (let v = 2025; v <= 2036; v++) { ctx.fillStyle = '#fff6df'; ctx.fillRect(yr(v) - 2, y - 10, 4, 20); if (v % 2 === 1) txt(ctx, String(v), yr(v), y + 38, { size: 22, color: '#b8c7df' }); }
    ctx.restore();
    txt(ctx, '仮のタイムライン（到来年は未確定）', x0, 440, { size: 30, align: 'left', alpha: tA, color: '#b8c7df' });
    const melt = ease(E.p(2, 1.6));
    const pins = [[2029, 'ギュ', '#ffc94d', 1], [2027, 'AGI', '#46a0c4', 0], [2034, 'シン平時', '#9fe3b0', 2]];
    pins.forEach(([v, s, c, i]) => {
      const a = ease((E.since(1) - .3 - i * .5) / .4); if (a <= 0) return;
      const isG = i === 1, x = yr(v), dropY = (1 - eOut(a)) * -80;
      if (isG && melt > 0) {
        const xa = lerp(x, yr(2026), melt), xb = lerp(x, yr(2031.5), melt);
        card(ctx, xa - 14, y - 26, xb - xa + 28, 52, { fill: 'rgba(255,201,77,.85)', stroke: '#ffc94d', r: 26, shadow: false });
        txt(ctx, melt > .5 ? 'ギュ中（期間）' : 'ギュ', (xa + xb) / 2 + 40, y - 104, { size: 36, color: '#ffc94d', stroke: 6 });
        const here = yr(2026.75); ctx.save(); ctx.globalAlpha = melt * (.7 + .3 * Math.sin(t * 3)); ctx.fillStyle = '#ff7a66'; ctx.beginPath(); ctx.moveTo(here, y + 30); ctx.lineTo(here - 14, y + 58); ctx.lineTo(here + 14, y + 58); ctx.fill(); ctx.restore();
        txt(ctx, 'いまここ？', here, y + 84, { size: 26, color: '#ff7a66', alpha: melt });
      } else {
        ctx.save(); ctx.globalAlpha = a * (isG ? 1 - melt : 1); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y + dropY, 16, 0, TAU); ctx.fill(); ctx.restore();
        if (!isG || melt < .01) txt(ctx, s, x, y - 50 + dropY, { size: 34, color: c, stroke: 6, alpha: a });
      }
    });
    txt(ctx, '一点 → 期間へ', 770, 740, { size: 40, font: DELA, color: '#fff6df', alpha: melt, stroke: 8 });
  }
  actor(ctx, 'garlic', 1560, FLOOR, 260, { flip: true });
  actor(ctx, 'shoga', 1780, FLOOR, 250, { flip: true });
};

// s04 — ギュ鳴らし: domino chain across the city
SCENES.quake = (ctx, E) => {
  const { u, t } = E;
  const s1 = E.at(1), tipT = [s1 + .6, s1 + 2.0, s1 + 4.2];
  let [sx, sy] = [0, 0];
  tipT.forEach(tt => { const [a, b] = shake(u - tt - .5, 7, .9); sx += a; sy += b; });
  ctx.save(); ctx.translate(sx, sy);
  vgrad(ctx, ['#23305e', '#5a4a86', '#c98a78']);
  drawCity(ctx, M.cityNightFar, 200 + u * 4, 690, 1, .9); drawCity(ctx, M.cityNightNear, 900 + u * 8, 760, .9, .9);
  ctx.fillStyle = '#2a2240'; ctx.fillRect(0, 760, W, 400);
  const names = [['能力', 'AIが賢くなる'], ['導入', '会社が使う'], ['所得・制度', '暮らしが変わる']];
  names.forEach(([n, d], i) => {
    const bx = 700 + i * 360, tp = tipT[i];
    const slow = i === 2 ? 1.6 : .6, ang = eIn(clamp((u - tp) / slow)) * 1.18;
    ctx.save(); ctx.translate(bx + 70, 760); ctx.rotate(ang);
    card(ctx, -70, -380, 140, 380, { fill: ['#46a0c4', '#46d9c4', '#ffc94d'][i], stroke: '#1a1430', r: 10 });
    ctx.save(); ctx.translate(0, -190); ctx.rotate(-Math.PI / 2 + (ang > .6 ? 0 : 0));
    ctx.restore();
    txt(ctx, n, 0, -300, { size: n.length > 2 ? 30 : 46, font: DELA, color: '#1a1430' });
    txt(ctx, d, 0, -240, { size: 20, color: '#1a1430', maxW: 130 });
    ctx.restore();
    ripple(ctx, bx + 300, 760, u - tp - slow * .8, { max: 420, squash: .22, life: 2 });
  });
  if (E.li >= 0) label(ctx, 'ギュ鳴らし ＝ 前提が連鎖して揺れること（比喩）', W / 2 + 180, 150, { size: 32, alpha: ease(E.p(0, .6)) });
  if (E.li >= 2) {
    const a = ease(E.p(2, .6)), cx = 1470, cy = 300;
    card(ctx, cx - 160, cy - 60, 320, 120, { alpha: a, fill: '#fff6df' });
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#2a2233'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx - 100, cy, 38, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 100, cy); ctx.lineTo(cx - 100 + Math.cos(t * 3) * 28, cy + Math.sin(t * 3) * 28); ctx.stroke(); ctx.restore();
    txt(ctx, 'タイムラグ', cx + 40, cy, { size: 40, color: '#2a2233', alpha: a });
  }
  ctx.restore();
  actor(ctx, 'chili', 170, FLOOR, 240);
  actor(ctx, 'shoga', 390, FLOOR, 240, { hop: Math.max(0, -shake(u - tipT[0] - .5, 30, .6)[1]) });
  actor(ctx, 'daikon', 600, FLOOR, 240, { flip: true });
};

// s05 — tasks fly from the human desk to the AI desk
SCENES.tasks = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#f3e6cc', '#e6d2ae'], 0, 700); ctx.fillStyle = '#b8895a'; ctx.fillRect(0, 700, W, 380);
  ctx.fillStyle = '#a57a4e'; for (let x = 0; x < W; x += 120) ctx.fillRect(x, 700, 4, 380);
  card(ctx, 560, 320, 800, 230, { fill: '#9cc8e6', stroke: '#6b5a44', r: 6, shadow: false });
  drawCity(ctx, M.cityDayFar, u * 6, 550, .5);
  // ILO panel
  const iA = ease(E.p(0, .6));
  card(ctx, 420, 90, 1080, 210, { alpha: iA });
  txt(ctx, '世界の働き手の 約4人に1人', 800, 150, { size: 48, color: '#2a2233', alpha: iA });
  txt(ctx, '生成AIの影響を受けうる職業（ILO 2025）', 800, 220, { size: 28, color: '#5a4a44', alpha: iA });
  for (let i = 0; i < 4; i++) tiny(ctx, 1230 + i * 60, 250, 2.6, i === 0 ? '#ff9a3c' : '#8a8aa0', t, i, false, false, iA);
  if (E.li >= 1) {
    const a1 = ease(E.p(1, .4)), cross = ease(E.p(2, .6));
    txt(ctx, '＝ 失業率？', 1300, 140, { size: 38, color: '#d9443a', alpha: a1 * (1 - cross), stroke: 0 });
    if (cross > 0) {
      txt(ctx, '≠ 失業率', 1360, 125, { size: 38, color: '#1f8f7f', alpha: cross });
      txt(ctx, '→ 仕事の中身が変わる', 1360, 175, { size: 26, color: '#1f8f7f', alpha: cross });
    }
  }
  // desks
  const desk = (x, lab) => { ctx.fillStyle = '#7a5230'; ctx.fillRect(x, 640, 400, 26); ctx.fillStyle = '#5c3c22'; ctx.fillRect(x + 20, 666, 20, 120); ctx.fillRect(x + 360, 666, 20, 120); txt(ctx, lab, x + 200, 700, { size: 26, color: '#fff6df' }); };
  desk(330, '人の机'); desk(1150, 'AIの机');
  bot(ctx, 1350, 640, 1.2, t);
  const tasks = ['資料まとめ', '下書き', 'コード', '問い合わせ', '集計', '翻訳'];
  const flyStart = E.at(2) + .5;
  tasks.forEach((s, i) => {
    const t0 = flyStart + i * .55, f = eIO(clamp((u - t0) / 1.0));
    const ax = 380 + (i % 3) * 105, ay = 600 - Math.floor(i / 3) * 62;
    const bx = 1200 + (i % 2) * 230, by = 610 - Math.floor(i / 2) * 40;
    const x = lerp(ax, bx, f), y = lerp(ay, by, f) - Math.sin(f * Math.PI) * 240;
    ctx.save(); ctx.translate(x + 50, y + 22); ctx.rotate(Math.sin(f * Math.PI) * .4);
    card(ctx, -50, -22, 100, 44, { fill: f >= 1 ? '#bff3ea' : '#fff6df', r: 6, lw: 3, shadow: false });
    txt(ctx, s, 0, 0, { size: s.length > 4 ? 16 : 20, color: '#2a2233' });
    ctx.restore();
  });
  const keep = ease(E.p(3, .6));
  [['判断', 440], ['責任', 600]].forEach(([s, x]) => {
    glow(ctx, x + 50, 600, 90, 'rgba(255,201,77,.6)', keep);
    card(ctx, x, 540 - 60 * keep, 110, 56, { fill: '#ffc94d', r: 8, lw: 3, alpha: .4 + .6 * keep });
    txt(ctx, s, x + 55, 568 - 60 * keep, { size: 30, color: '#2a2233', alpha: .4 + .6 * keep });
  });
  actor(ctx, 'daikon', 160, FLOOR, 240);
  actor(ctx, 'shoga', 880, FLOOR, 240);
  actor(ctx, 'garlic', 1760, FLOOR, 240, { flip: true });
};

// s06 — the hiring entrance narrows, the bottom rungs move to AI
SCENES.entrance = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#8fd0f0', '#d8f0f6'], 0, 700); ctx.fillStyle = '#9ccf7a'; ctx.fillRect(0, 700, W, 380);
  ctx.fillStyle = '#c9b48a'; ctx.fillRect(0, 690, W, 34);
  drawCity(ctx, M.cityDayFar, 300, 690, .7, .7);
  const narrow = eIO(E.p(1, 2.2));
  const bx = 1120, bw = 640, top = 130;
  card(ctx, bx, top, bw, 580, { fill: '#e9e2d4', stroke: '#6b5a44', r: 4 });
  for (let y = top + 40; y < 560; y += 70) for (let x = bx + 40; x < bx + bw - 60; x += 90) { ctx.fillStyle = '#9cc8e6'; ctx.fillRect(x, y, 50, 40); }
  const doorX = bx + bw / 2, dw = lerp(220, 150, narrow);
  ctx.fillStyle = '#3a2a1c'; ctx.fillRect(doorX - dw / 2, 520, dw, 188);
  ctx.fillStyle = '#6b5a44'; ctx.fillRect(doorX - 140, 490, 280, 30);
  txt(ctx, '採用の入口', doorX, 470, { size: 34, color: '#2a2233' });
  // experience ladder
  const lx = 1050;
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(lx, 690); ctx.lineTo(lx, 180); ctx.moveTo(lx + 60, 690); ctx.lineTo(lx + 60, 180); ctx.stroke();
  const rungNames = ['雑務', '下調べ', '下書き'];
  for (let i = 0; i < 8; i++) {
    const y = 660 - i * 62; const gone = i < 3 ? ease(E.p(1, 1.2 + i * .5) * 1.6 - .3 - i * .15) : 0;
    const x = lerp(lx, 820, gone), yy = y - Math.sin(gone * Math.PI) * 120;
    ctx.save(); ctx.globalAlpha = 1 - gone * .3; ctx.strokeStyle = gone > 0 ? '#46d9c4' : '#7a5230'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 60, yy); ctx.stroke(); ctx.restore();
    if (i < 3 && E.li >= 1) txt(ctx, rungNames[i], x - 60, yy, { size: 20, color: '#2a2233', alpha: ease(E.p(1, .5)), align: 'right' });
  }
  txt(ctx, '経験のはしご', lx + 30, 150, { size: 26, color: '#2a2233' });
  if (E.li >= 1) bot(ctx, 820, 700, .9, t, { glow: ease(E.p(1, .8)) });
  // queue
  const N = 10, spd = 120, cyc = (doorX - 200) / spd;
  for (let i = 0; i < 26; i++) {
    const pos = 100 + ((u * spd - i * 88) % (cyc * spd * 2));
    if (u * spd - i * 88 < 0) continue;
    const blocked = narrow > .5 && [3, 6, 9].includes(i % N);
    const stopX = doorX - 190 - (i % N) * 10;
    let x = Math.min(pos, blocked ? stopX : doorX), alpha = 1;
    if (!blocked && pos > doorX - 20) alpha = clamp((doorX + 30 - pos) / 50);
    if (pos > doorX + 60) continue;
    const col = ['#ff7a66', '#46a0c4', '#ffc94d', '#9fe3b0', '#c49ae8'][i % 5];
    tiny(ctx, x, 712, 2.4, col, t, i, !(blocked && pos >= stopX), blocked && pos >= stopX && Math.sin(t * 2 + i) > 0, alpha);
  }
  // counter
  const n = Math.round(lerp(10, 7, narrow));
  card(ctx, 120, 110, 460, 190);
  txt(ctx, '新人の入口', 350, 160, { size: 32, color: '#2a2233' });
  txt(ctx, `10 → ${n}`, 350, 235, { size: 70, font: DELA, color: narrow > .5 ? '#d9443a' : '#2a2233' });
  label(ctx, '図解の仮定', 350, 330, { size: 22, stroke: '#ff7a66' });
  actor(ctx, 'chili', 210, FLOOR, 230);
  actor(ctx, 'daikon', 430, FLOOR, 240, { flip: false });
  actor(ctx, 'shoga', 650, FLOOR, 230, { flip: true });
};

// s07 — the research loop accelerates, then jams at the power gate
SCENES.loop = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#0b1024', '#131c3a']);
  ctx.save(); ctx.strokeStyle = 'rgba(70,217,196,.06)'; ctx.lineWidth = 2; for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } ctx.restore();
  const cx = 600, cy = 470, R = 220;
  const jam = ease(E.p(3, 1.2));
  const speedK = 1 + 5 * ease(u / Math.max(1, E.at(3)));
  const phase = u * .9 + u * u * .06 * (1 - jam * .7);
  ctx.save(); ctx.strokeStyle = 'rgba(255,201,77,.4)'; ctx.lineWidth = 10; ctx.setLineDash([30, 18]); ctx.lineDashOffset = -phase * 80;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.restore();
  for (let i = 0; i < 36; i++) {
    const a = phase * (1 + i % 3 * .1) + i / 36 * TAU, len = Math.min(.5, .05 * speedK);
    ctx.save(); ctx.strokeStyle = i % 4 ? 'rgba(255,220,140,.9)' : 'rgba(70,240,210,.9)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, R, a - len, a); ctx.stroke(); ctx.restore();
  }
  glow(ctx, cx, cy, 200 * (.6 + .4 * ease(u / 6)), 'rgba(255,200,100,.25)');
  txt(ctx, `×${speedK.toFixed(1)}`, cx, cy, { size: 64, font: DELA, color: '#ffc94d', alpha: .9 });
  [['AI', -90], ['研究', 30], ['より強いAI', 150]].forEach(([s, deg]) => {
    const a = deg * Math.PI / 180, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    card(ctx, x - 95, y - 38, 190, 76, { fill: '#1f6f78', stroke: '#46d9c4', r: 38 });
    txt(ctx, s, x, y, { size: s.length > 3 ? 26 : 34 });
  });
  // METR panel (line 2)
  const mA = ease(E.p(1, .6)) * (1 - ease(E.p(2, .8)));
  if (mA > 0) {
    card(ctx, 1080, 110, 720, 330, { alpha: mA, fill: '#fff6df' });
    txt(ctx, 'AIが続けてこなせる課題の長さ（概念図）', 1440, 150, { size: 26, color: '#2a2233', alpha: mA });
    for (let i = 0; i < 7; i++) {
      const h = 22 * Math.pow(1.55, i) * ease((E.since(1) - i * .15) / .5), x = 1150 + i * 88, base = 405;
      ctx.save(); ctx.globalAlpha = mA; ctx.fillStyle = 'rgba(70,160,196,.25)'; ctx.fillRect(x - 6, base - h * 1.6, 56, h * 1.25);
      ctx.fillStyle = '#46a0c4'; ctx.fillRect(x + 8, base - h, 28, h); ctx.restore();
    }
    txt(ctx, '伸びている。ただし測り方しだいで幅は大きい（METR 2026）', 1440, 425, { size: 18, color: '#5a4a44', alpha: mA });
  }
  // gate
  const gA = ease(E.p(2, .8));
  if (gA > 0) {
    const gx = 1330, gy = 470;
    ctx.save(); ctx.globalAlpha = gA; ctx.fillStyle = '#26314f'; ctx.fillRect(cx + R, gy - 26, gx - cx - R, 52); ctx.restore();
    const flow = 1 - jam;
    for (let i = 0; i < 14; i++) {
      const f = fract(u * .5 * speedK * .3 + i / 14); const x = lerp(cx + R, gx - 20, f);
      const jx = jam > 0 ? Math.min(x, gx - 30 - (i % 7) * 26) : x;
      ctx.save(); ctx.globalAlpha = gA; ctx.fillStyle = '#ffd27a'; ctx.fillRect(lerp(x, jx, jam) - 8, gy - 8 - (jam > .5 ? Math.floor(i / 7) * 18 : 0), 16, 16); ctx.restore();
    }
    ['電力', '送電網', '半導体工場'].forEach((s, i) => {
      const y = gy - 150 + i * 110;
      card(ctx, gx, y - 44, 250, 88, { fill: jam > .3 ? '#d9443a' : '#46a0c4', stroke: '#fff6df', alpha: gA });
      txt(ctx, s, gx + 125, y, { size: 32, alpha: gA });
    });
    txt(ctx, flow < .5 ? '物理の壁で渋滞' : '電力ゲート', gx + 125, gy - 230, { size: 34, color: '#ffc94d', stroke: 6, alpha: gA });
    txt(ctx, '参考：IEA 2026', gx + 125, gy + 230, { size: 20, color: '#b8c7df', alpha: gA });
  }
  actor(ctx, 'garlic', 170, FLOOR, 230);
  actor(ctx, 'chili', 1100, FLOOR, 240, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 8)) * 20 : 0 });
  actor(ctx, 'shoga', 1760, FLOOR, 240, { flip: true });
};

// s08 — capability vs income vs cost of living
SCENES.lag = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#fbf1dc', '#efdcb8']);
  const x0 = 160, x1 = 1240, y0 = 170, y1 = 760;
  ctx.strokeStyle = '#2a2233'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0, y0 - 20); ctx.lineTo(x0, y1); ctx.lineTo(x1 + 30, y1); ctx.stroke();
  txt(ctx, '時間 →', x1 - 40, y1 + 36, { size: 26, color: '#2a2233' });
  const cap = x => .08 + .88 * (Math.exp(3.3 * x) - 1) / (Math.exp(3.3) - 1);
  const cost = x => .64 + .04 * x - .16 * ease((x - .78) / .22);
  const inc = x => .36 + .07 * Math.sin(x * 11) * (1 - x * .3) - .06 * ease((x - .3) / .2) + .24 * ease((x - .72) / .28);
  const P = (f, x) => [lerp(x0, x1, x), lerp(y1, y0, f(x))];
  const curve = (f, prog, col, lw, name, lx) => {
    if (prog <= 0) return;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i <= 120 * prog; i++) { const [x, y] = P(f, i / 120); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke(); ctx.restore();
    const [ex, ey] = P(f, Math.min(prog, lx)); txt(ctx, name, ex + 14, ey - 30, { size: 30, color: col, align: 'left', alpha: clamp(prog * 3), stroke: 6, strokeColor: '#fbf1dc' });
  };
  const pc = ease(E.since(0) / 3), pb = ease(E.p(1, 3.5));
  if (E.li >= 2) {
    const g = ease(E.p(2, 1));
    ctx.save(); ctx.globalAlpha = g * .35; ctx.fillStyle = '#ff9a3c'; ctx.beginPath();
    for (let i = 20; i <= 90; i++) { const [x, y] = P(cap, i / 120); if (i === 20) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    for (let i = 90; i >= 20; i--) { const [x, y] = P(inc, i / 120); ctx.lineTo(x, y); }
    ctx.fill(); ctx.restore();
    txt(ctx, '時間差', lerp(x0, x1, .62), lerp(y1, y0, .55), { size: 48, font: DELA, color: '#d9443a', alpha: g, stroke: 8, strokeColor: '#fbf1dc' });
  }
  curve(cap, pc, '#1f8f9f', 9, 'AIでできること', .78);
  curve(cost, pb, '#d9443a', 8, '生活費', .15);
  curve(inc, pb, '#c98a20', 8, '所得', .35);
  // price tags
  const tags = [['AIサービス', -1], ['土地', 0], ['電気', 0], ['住まい', 0]];
  tags.forEach(([s, dir], i) => {
    const a = ease((E.since(1) - i * .4) / .5); if (a <= 0) return;
    const y = 150 + i * 92;
    card(ctx, 1340, y, 300, 72, { alpha: a, fill: '#fff6df', r: 10 });
    txt(ctx, s, 1370, y + 36, { size: 30, color: '#2a2233', align: 'left', alpha: a });
    const ay = y + 36 + (dir < 0 ? Math.sin(t * 3) * 6 : 0);
    if (dir < 0) arrow(ctx, 1590, ay - 18, 1590, ay + 20, { color: '#1f8f7f', lw: 7, head: 16, alpha: a });
    else arrow(ctx, 1570, ay, 1612, ay, { color: '#d9443a', lw: 7, head: 16, alpha: a });
  });
  txt(ctx, '技術の豊かさ ≠ 制度の豊かさ（いますぐ）', 700, 110, { size: 36, color: '#2a2233', alpha: ease(E.p(2, .6)) });
  actor(ctx, 'daikon', 1400, FLOOR, 230);
  actor(ctx, 'garlic', 1600, FLOOR, 230, { flip: true });
  actor(ctx, 'shoga', 1790, FLOOR, 230, { flip: true });
};

// s09 — two cities: concentration vs distribution
SCENES.cities = (ctx, E) => {
  const { u, t } = E;
  const focus = E.li === 1 ? (E.lp(1) < .5 ? -1 : 1) : 0;
  const drawHalf = (side) => {
    const L = side < 0, ox = L ? 0 : 960;
    ctx.save(); ctx.beginPath(); ctx.rect(ox, 0, 960, H); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, 800);
    if (L) { g.addColorStop(0, '#2b2a45'); g.addColorStop(1, '#6a5a78'); } else { g.addColorStop(0, '#7fc8ef'); g.addColorStop(1, '#fbe3b2'); }
    ctx.fillStyle = g; ctx.fillRect(ox, 0, 960, H);
    ctx.fillStyle = L ? '#3c3450' : '#9ccf7a'; ctx.fillRect(ox, 720, 960, 400);
    const houses = [];
    for (let i = 0; i < 9; i++) { const hx = ox + 60 + i * 100, hh = 70 + rnd(i * 3 + (L ? 1 : 2)) * 60; houses.push([hx, hh]); }
    houses.forEach(([hx, hh], i) => {
      if (!L && i === 4) return;
      ctx.fillStyle = L ? '#4a4260' : ['#f0d9b5', '#e7c6a0', '#d9e3ea'][i % 3]; ctx.fillRect(hx, 720 - hh, 70, hh);
      ctx.fillStyle = L ? (i % 3 === 0 ? '#ffd27a' : '#2a2438') : '#ffd98a'; ctx.fillRect(hx + 16, 720 - hh + 18, 14, 16); ctx.fillRect(hx + 42, 720 - hh + 18, 14, 16);
    });
    if (L) {
      const tx = ox + 480; ctx.fillStyle = '#1a1628'; ctx.fillRect(tx - 70, 150, 140, 570); glow(ctx, tx, 160, 160, 'rgba(255,210,100,.6)');
      for (let y = 180; y < 700; y += 40) { ctx.fillStyle = '#ffd27a'; ctx.fillRect(tx - 50, y, 100, 14); }
      houses.forEach(([hx, hh], i) => { for (let k = 0; k < 2; k++) { const f = fract(t * .35 + i * .17 + k * .5); const x = lerp(hx + 35, tx, f), y = lerp(720 - hh, 170, f) - Math.sin(f * Math.PI) * 100; ctx.fillStyle = '#ffc94d'; ctx.fillRect(x - 6, y - 6, 12, 12); } });
      txt(ctx, '集中の街', ox + 480, 110, { size: 54, font: DELA, color: '#ffc94d', stroke: 8 });
      txt(ctx, '計算資源を持つ一部に富が集まる', ox + 480, 790, { size: 28, color: '#fff6df', stroke: 6 });
    } else {
      const fx = ox + 480; card(ctx, fx - 80, 560, 160, 160, { fill: '#1f6f78', stroke: '#0c2c33', r: 10 }); txt(ctx, 'AI工場', fx, 640, { size: 30 });
      glow(ctx, fx, 620, 150, 'rgba(70,217,196,.4)');
      const dests = [[ox + 150, 470, '学校'], [ox + 810, 470, '病院'], [ox + 300, 640, ''], [ox + 660, 640, ''], [ox + 110, 640, ''], [ox + 860, 640, '']];
      dests.forEach(([dx, dy, s], i) => {
        if (s) { card(ctx, dx - 70, dy - 60, 140, 120, { fill: '#fff6df', r: 8 }); txt(ctx, s, dx, dy - 10, { size: 30, color: '#2a2233' }); if (s === '病院') { ctx.fillStyle = '#d9443a'; ctx.fillRect(dx - 6, dy + 18, 12, 32); ctx.fillRect(dx - 16, dy + 28, 32, 12); } else { ctx.fillStyle = '#46a0c4'; ctx.fillRect(dx - 20, dy + 22, 40, 26); } }
        for (let k = 0; k < 2; k++) { const f = fract(t * .35 + i * .21 + k * .5); const x = lerp(fx, dx, f), y = lerp(580, dy - 20, f) - Math.sin(f * Math.PI) * 120; ctx.fillStyle = '#ffc94d'; ctx.fillRect(x - 6, y - 6, 12, 12); }
      });
      txt(ctx, '分配の街', ox + 480, 110, { size: 54, font: DELA, color: '#1f6f78', stroke: 8, strokeColor: '#fff6df' });
      txt(ctx, '果実を教育・医療・所得支援へ', ox + 480, 790, { size: 28, color: '#2a2233', stroke: 6, strokeColor: '#fff6df' });
    }
    const dimA = focus === 0 ? 0 : (focus === (L ? -1 : 1) ? 0 : .45);
    if (dimA > 0) { ctx.fillStyle = `rgba(0,0,0,${dimA})`; ctx.fillRect(ox, 0, 960, H); }
    ctx.restore();
  };
  drawHalf(-1); drawHalf(1);
  ctx.fillStyle = '#fff6df'; ctx.fillRect(954, 0, 12, H);
  const splitA = ease(E.p(1, .6));
  card(ctx, 840, 250, 240, 90, { alpha: splitA, fill: '#2a2233', stroke: '#ffc94d' }); txt(ctx, '分かれ道', 960, 295, { size: 40, alpha: splitA, color: '#ffc94d' });
  if (E.li >= 2) label(ctx, 'ルールしだいで景色が変わる', W / 2, 420, { size: 34, alpha: ease(E.p(2, .6)) });
  actor(ctx, 'chili', 800, FLOOR, 220);
  actor(ctx, 'daikon', 1120, FLOOR, 230, { flip: true });
  actor(ctx, 'garlic', 1700, FLOOR, 200, { flip: true });
};

// s10 — 臥薪嘗胆 -> walking the path of options -> updating one's worldview
SCENES.choices = (ctx, E) => {
  const { u, t } = E;
  const b1 = E.at(1), b2 = E.at(2);
  const fadeB = ease((u - b1 + .2) / .5), fadeC = ease((u - b2 + .2) / .5);
  // beat A
  if (fadeB < 1) {
    ctx.save(); ctx.globalAlpha = 1 - fadeB;
    vgrad(ctx, ['#2a1c2e', '#5a3a3a']); txt(ctx, '臥薪嘗胆', W / 2, 330, { size: 240, font: DELA, color: 'rgba(255,201,77,.18)' });
    for (let i = 0; i < 6; i++) { const y = 720 - (i % 3) * 36 - Math.floor(i / 3) * 0, x = 760 + (i % 3) * 10 + (i >= 3 ? 70 : 0); card(ctx, x - 150, y - 18, 360, 36, { fill: '#8a5a30', stroke: '#3a2412', r: 18, lw: 4, shadow: false }); ctx.fillStyle = '#d9a86a'; ctx.beginPath(); ctx.ellipse(x + 210, y, 12, 17, 0, 0, TAU); ctx.fill(); }
    actor(ctx, 'chili', 960, 650, 250, { rot: -Math.PI / 2 + Math.sin(t * 2) * .05, shadow: false });
    const sw = Math.sin(t * 1.6) * .25; ctx.save(); ctx.translate(1180, 120); ctx.rotate(sw); ctx.strokeStyle = '#d8c8b0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 250); ctx.stroke();
    ctx.fillStyle = '#7a2a3a'; ctx.beginPath(); ctx.ellipse(0, 290, 50, 40, 0, 0, TAU); ctx.fill(); txt(ctx, '肝', 0, 290, { size: 36 }); ctx.restore();
    txt(ctx, '（にがい）', 1300, 300, { size: 26, color: '#ffc94d', alpha: .8 });
    actor(ctx, 'shoga', 420, FLOOR, 240); actor(ctx, 'daikon', 1600, FLOOR, 240, { flip: true });
    ctx.restore();
  }
  // beat B/C: path with signposts
  if (fadeB > 0) {
    ctx.save(); ctx.globalAlpha = fadeB;
    const walking = fadeC < 1, off = (u - b1) * 150 * (1 - fadeC * .9);
    vgrad(ctx, ['#9fd8f5', '#fff0cf'], 0, 720);
    ctx.fillStyle = '#b8d99a'; for (let i = -1; i < 6; i++) { const x = i * 460 - wrap(off * .3, 460); ctx.beginPath(); ctx.ellipse(x, 700, 300, 150, 0, Math.PI, TAU); ctx.fill(); }
    ctx.fillStyle = '#8cc46a'; ctx.fillRect(0, 700, W, 400); ctx.fillStyle = '#e2c890'; ctx.fillRect(0, 760, W, 90);
    const signs = ['学ぶ', '働く', '体を守る', '人とつながる', '選択肢を持つ'];
    signs.forEach((s, i) => {
      const x = 1500 + i * 520 - off; if (x < -200 || x > W + 200) return;
      ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 8, 560, 16, 200);
      card(ctx, x - 130, 500, 260, 90, { fill: '#fff6df', stroke: '#7a5230', r: 10 }); txt(ctx, s, x, 545, { size: s.length > 4 ? 32 : 40, color: '#2a2233' });
    });
    const passA = ease(E.p(1, 1) * 2 - 1) * (1 - fadeC);
    if (passA > 0) { const bob = Math.sin(t * 3) * 8; card(ctx, 610, 300 + bob, 300, 110, { fill: '#ffc94d', alpha: passA, r: 12 }); txt(ctx, '通行証', 760, 335 + bob, { size: 36, color: '#2a2233', alpha: passA }); txt(ctx, '学歴・資格 ≠ 人格', 760, 382 + bob, { size: 22, color: '#2a2233', alpha: passA }); }
    actor(ctx, 'shoga', 760, FLOOR, 230, { walk: walking });
    actor(ctx, 'chili', 520, FLOOR, 230, { walk: walking });
    actor(ctx, 'daikon', 300, FLOOR, 230, { walk: walking && fadeC < .5 });
    if (fadeC > 0) {
      const fl = E.p(2, 2.4), sx = Math.abs(Math.cos(fl * Math.PI * 2));
      const v = fl < .25 ? '2026年版' : fl < .75 ? '更新中…' : '2027年版';
      ctx.save(); ctx.globalAlpha = fadeC; ctx.translate(1300, 330); ctx.scale(Math.max(.05, sx), 1);
      card(ctx, -230, -110, 460, 220, { fill: '#fff6df' });
      txt(ctx, 'わたしの世界観', 0, -50, { size: 36, color: '#2a2233' }); txt(ctx, v, 0, 30, { size: 56, font: DELA, color: fl < .75 ? '#5a4a44' : '#1f8f7f' });
      ctx.restore();
      arrow(ctx, 420, 600, 1060, 400, { color: '#fff6df', lw: 6, dash: [14, 12], alpha: fadeC * .7 });
    }
    ctx.restore();
  }
};

// s11 — liftoff; Earth becomes one computer
SCENES.earthgrid = (ctx, E) => {
  const { u, t } = E;
  const board = E.at(0), lift = Math.max(E.end(0) - .6, board + 2), T2 = E.at(1);
  const pull = ease((u - T2 + .6) / 2.2);
  ctx.fillStyle = '#04040c'; ctx.fillRect(0, 0, W, H);
  if (pull < 1) {
    ctx.save(); ctx.globalAlpha = 1 - pull;
    const s = lerp(1, .25, eIn(pull)); ctx.translate(W / 2, 700); ctx.scale(s, s); ctx.translate(-W / 2, -700);
    nightSky(ctx, t); drawCity(ctx, M.cityNightFar, 100, 700); drawCity(ctx, M.cityNightNear, 500, 790);
    ctx.fillStyle = '#0b0f1f'; ctx.fillRect(0, 780, W, 400); ctx.fillStyle = '#39406a'; ctx.fillRect(900, 772, 500, 12);
    const up = eIn(clamp((u - lift) / 2.5));
    const sy = 640 - up * 1000, shk = u > lift - .6 && up < .1 ? Math.sin(t * 50) * 3 : 0;
    glow(ctx, 1150, 780, 240, 'rgba(255,170,80,.5)', clamp((u - lift + .6) / .6) * (1 - up));
    ship(ctx, 1150 + shk, sy, 1.0, -Math.PI / 2, t, { flame: clamp((u - lift + .5) / .5) });
    const inA = clamp((u - board) / Math.max(1, lift - board - .4));
    [['shoga', 0], ['daikon', .12], ['chili', .24], ['garlic', .36]].forEach(([w, d], i) => {
      const f = clamp((inA - d) / .5); if (f >= 1) return;
      actor(ctx, w, lerp(260 + i * 120, 1060, eIO(f)), 790, 200, { walk: f > 0 && f < 1, alpha: 1 - ease((f - .85) / .15) });
    });
    ctx.restore();
  }
  if (pull > 0) {
    ctx.save(); ctx.globalAlpha = pull;
    stars(ctx, t, { ox: u * 20, alpha: 1 }); nebula(ctx, t, .6);
    const gshift = ease(E.p(2, 1.5));
    const R = lerp(2600, 330, eOut(pull)), gx = lerp(W / 2, 760, gshift), gy = lerp(H / 2 + 1900 * (1 - eOut(pull)), 450, 1);
    globe(ctx, gx, gy, R, u * .12, .32, t, { night: true, net: clamp((u - T2) / 3), lights: 1 });
    if (gshift > 0) {
      [['電力', .9], ['土地', .82]].forEach(([s, lv], i) => {
        const y = 170 + i * 90, f = lv * ease((E.since(2) - .4 - i * .3) / 1.4);
        card(ctx, 1260, y, 420, 60, { fill: '#1a1a30', stroke: '#fff6df', alpha: gshift, r: 8 });
        ctx.fillStyle = f > .75 ? '#d9443a' : '#46d9c4'; ctx.globalAlpha = pull * gshift; ctx.fillRect(1270, y + 10, 400 * f, 40); ctx.globalAlpha = pull;
        txt(ctx, s, 1240, y + 30, { size: 30, align: 'right', alpha: gshift });
      });
      txt(ctx, '地球の資源は有限', 1470, 120, { size: 32, color: '#ffc94d', alpha: gshift });
      const mA = ease((E.since(2) - 1.6) / 1);
      glow(ctx, 1500, 470, 90, 'rgba(255,255,230,.4)', mA);
      ctx.save(); ctx.globalAlpha = pull * mA; ctx.fillStyle = '#dcd8cc'; ctx.beginPath(); ctx.arc(1500, 470, 60, 0, TAU); ctx.fill(); ctx.fillStyle = '#b8b2a4'; ctx.beginPath(); ctx.arc(1480, 455, 12, 0, TAU); ctx.arc(1520, 490, 9, 0, TAU); ctx.fill(); ctx.restore();
      arrow(ctx, 1100, 460, 1420, 470, { color: '#ffc94d', dash: [16, 12], lw: 6, alpha: mA });
      txt(ctx, '次の場所へ', 1260, 420, { size: 30, color: '#ffc94d', alpha: mA });
    }
    ship(ctx, lerp(300, 1300, fract(u * .05)), 760 - Math.sin(u * .5) * 20, .45, -.08, t, { flame: .8, alpha: 1 - gshift * .6 });
    porthole(ctx, 1650, 690, 140, t, [{ who: 'shoga', dx: -.42, h: .75 }, { who: 'chili', dx: .05, h: .75 }, { who: 'garlic', dx: .45, h: .62, flip: true }]);
    ctx.restore();
  }
};

// s12 — self-replicating factories on the Moon, asteroid mining, mass driver
SCENES.moon = (ctx, E) => {
  const { u, t } = E;
  ctx.fillStyle = '#03030a'; ctx.fillRect(0, 0, W, H); stars(ctx, t, { ox: u * 10, alpha: .9 });
  globe(ctx, 300, 200, 110, u * .1 + 1, .3, t, { night: false, lights: 0 });
  // asteroid
  const ax = 1560, ay = 210, ar = 90;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(u * .15); ctx.fillStyle = '#6a5a50'; ctx.beginPath();
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = ar * (.75 + rnd(i * 3.3) * .35); if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4a3e38'; ctx.beginPath(); ctx.arc(-20, 10, 18, 0, TAU); ctx.arc(30, -25, 12, 0, TAU); ctx.fill(); ctx.restore();
  txt(ctx, '小惑星：金属', ax, ay + 130, { size: 24, color: '#d8d0c0' });
  for (let i = 0; i < 6; i++) { const f = fract(u * .18 + i / 6), x = lerp(ax - 60, 1100, f), y = lerp(ay + 40, 560, f) - Math.sin(f * Math.PI) * 120; ctx.fillStyle = '#c98a4a'; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#9fe8e0'; ctx.fillRect(x - 12, y - 3, 5, 5); }
  // moon ground (parallax)
  const pan = u * 18;
  ctx.fillStyle = '#6e6c74'; ctx.beginPath(); ctx.moveTo(0, 600); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 590 + Math.sin((x + pan * .3) * .01) * 14); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillStyle = '#8a8890'; ctx.fillRect(0, 700, W, 400);
  for (let i = 0; i < 14; i++) { const x = wrap(i * 173 - pan, W + 200) - 100, y = 740 + (i % 3) * 40; ctx.fillStyle = '#6e6c74'; ctx.beginPath(); ctx.ellipse(x, y, 60 + (i % 4) * 20, 14 + (i % 3) * 4, 0, 0, TAU); ctx.fill(); }
  // factories
  const grow = clamp((u - E.at(0) * .5) / Math.max(2, E.end(1) - E.at(0) * .5));
  const nF = Math.min(48, Math.floor(Math.pow(2, grow * 5.6)));
  for (let k = 0; k < 48; k++) {
    const col = k % 12, row = Math.floor(k / 12), x = 160 + col * 64 + row * 20, y = 610 + row * 26;
    const born = Math.pow(2, grow * 5.6) - k; if (k >= nF + 1) continue;
    const s = clamp(born);
    if (s <= 0) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#d8d2c4'; ctx.fillRect(-24, -36, 48, 36); ctx.fillStyle = '#2a5a8a'; ctx.fillRect(-30, -52, 26, 12); ctx.fillRect(4, -52, 26, 12);
    ctx.fillStyle = fract(t * .5 + k * .3) > .5 ? '#46d9c4' : '#ffc94d'; ctx.fillRect(-8, -26, 16, 10); ctx.restore();
    if (s < 1 && k > 0) { const p = Math.floor((k - 1) / 2), px = 160 + (p % 12) * 64 + Math.floor(p / 12) * 20, py = 600 + Math.floor(p / 12) * 26; ctx.fillStyle = '#9fe8e0'; ctx.fillRect(lerp(px, x, s) - 4, lerp(py, y - 40, s) - 30 * Math.sin(s * Math.PI) - 4, 8, 8); }
  }
  label(ctx, `想定：自己増殖工場 ×${nF}`, 560, 470, { size: 28, alpha: ease(E.p(1, .6)) });
  // mass driver
  const rA = ease(E.p(0, 1));
  ctx.save(); ctx.globalAlpha = rA; ctx.strokeStyle = '#c8c4d0'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(1000, 640); ctx.lineTo(1880, 330); ctx.stroke();
  ctx.strokeStyle = '#46d9c4'; ctx.lineWidth = 3; for (let i = 0; i < 12; i++) { const f = i / 12; ctx.beginPath(); ctx.arc(lerp(1000, 1880, f), lerp(640, 330, f), 16, 0, TAU); ctx.stroke(); } ctx.restore();
  const hot = E.li >= 2 ? 1.8 : 1;
  for (let i = 0; i < 5; i++) {
    const f = fract(u * .4 * hot + i / 5), ff = f * f;
    const x = lerp(1000, 1880, ff), y = lerp(640, 330, ff);
    glow(ctx, x, y, 40, 'rgba(120,255,230,.8)', rA); ctx.fillStyle = '#eafffb'; ctx.fillRect(x - 5, y - 5, 10, 10);
  }
  if (E.li >= 2) label(ctx, '電磁レールで打ち出す物流網', 1440, 700, { size: 28, alpha: ease(E.p(2, .5)) });
  const walk = u * 30;
  [['garlic', 0], ['daikon', 1], ['shoga', 2], ['chili', 3]].forEach(([w, i]) => {
    const x = 180 + i * 170 + walk * .6, hop = Math.abs(Math.sin(t * 2.2 + i)) * 50;
    actor(ctx, w, Math.min(x, 1000 + i * 40), FLOOR, 200, { hop, walk: w === 'shoga', shadow: true });
  });
};

// s13 — Dyson swarm around the Sun, seen from the cockpit
SCENES.dyson = (ctx, E) => {
  const { u, t } = E;
  ctx.fillStyle = '#030208'; ctx.fillRect(0, 0, W, H); stars(ctx, t, { ox: u * 4, alpha: .8, dim: .8 }); nebula(ctx, t, .4);
  const cx = 960, cy = 400, S = 300 + 40 * ease(u / E.dur);
  const camT = .32 + .2 * Math.sin(u * .12), camY = u * .05;
  const grow = ease((u - E.at(0) * .6) / Math.max(3, E.end(1) - E.at(0) * .6));
  const n = Math.floor(lerp(40, SW.length, grow));
  const cc = Math.cos(camT), sc = Math.sin(camT), cyw = Math.cos(camY), syw = Math.sin(camY);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const c = SW[i], th = c.ph + u * .35 / Math.pow(c.a, 1.5);
    const x = c.a * Math.cos(th), z = c.a * Math.sin(th);
    const y1 = -z * Math.sin(c.inc), z1 = z * Math.cos(c.inc);
    const cn = Math.cos(c.node + camY), sn = Math.sin(c.node + camY);
    const x2 = x * cn + z1 * sn, z2 = -x * sn + z1 * cn;
    const y3 = y1 * cc - z2 * sc, z3 = y1 * sc + z2 * cc;
    const f = 4 / (4 + z3);
    pts.push([cx + x2 * f * S, cy - y3 * f * S, z3, f, c.sz, th]);
  }
  const drawC = p => { const [x, y, z, f, sz, th] = p; const g = .5 + .5 * Math.cos(th * 2); ctx.fillStyle = g > .8 ? '#fff4c8' : z > 0 ? '#b88a3a' : '#ffc94d'; const w = Math.max(1.5, (2 + sz * 3) * f), h = Math.max(1, w * .5); ctx.fillRect(x - w / 2, y - h / 2, w, h); };
  for (const p of pts) if (p[2] > 0) drawC(p);
  sun(ctx, cx, cy, .2 * S, t);
  // energy beams to compute rings
  const bA = ease(E.p(1, 1.2));
  const nodes = [0, 1, 2].map(k => { const a = u * .08 + k * TAU / 3; return [cx + Math.cos(a) * 2.35 * S, cy + Math.sin(a) * 2.35 * S * .28 - 30]; });
  if (bA > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < pts.length; i += 61) { const p = pts[i], nd = nodes[i % 3], f = fract(t * .6 + i * .01); ctx.globalAlpha = bA * .14; ctx.strokeStyle = '#46d9c4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(nd[0], nd[1]); ctx.stroke(); ctx.globalAlpha = bA; ctx.fillStyle = '#bffff4'; ctx.fillRect(lerp(p[0], nd[0], f) - 2, lerp(p[1], nd[1], f) - 2, 4, 4); }
    ctx.restore();
    nodes.forEach(([x, y]) => { ctx.save(); ctx.globalAlpha = bA; ctx.strokeStyle = '#46d9c4'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y, 46, 16, 0, 0, TAU); ctx.stroke(); ctx.restore(); glow(ctx, x, y, 70, 'rgba(70,217,196,.5)', bA); txt(ctx, '計算', x, y - 36, { size: 22, color: '#bffff4', alpha: bA }); });
  }
  for (const p of pts) if (p[2] <= 0) drawC(p);
  // counter
  const cnt = Math.pow(10, lerp(4, 8, ease((u - E.at(1)) / Math.max(2, E.end(1) - E.at(1)))));
  const nstr = cnt >= 1e8 ? '1億' : cnt >= 1e4 ? `${Math.round(cnt / 1e4)}万` : Math.round(cnt).toString();
  label(ctx, `発電衛星 ${nstr}基（表示は代表点）`, W / 2, 110, { size: 30, alpha: ease(E.p(1, .6)) });
  if (E.li < 1) label(ctx, 'ダイソン・スウォーム：殻ではなく群れ', W / 2, 110, { size: 30, alpha: ease(E.p(0, .8)) * (1 - ease(E.p(1, .3))) });
  // flow text
  if (E.li >= 1) { const a = ease(E.p(1, 1)); ['太陽光', '→ 電気', '→ 計算', '→ よりよい設備'].forEach((s, i) => txt(ctx, s, 300 + i * 180, 190, { size: 28, color: '#ffc94d', alpha: ease((E.since(1) - i * .6) / .5) * a, stroke: 6, align: 'left' })); }
  // cockpit frame
  ctx.save(); ctx.fillStyle = '#16121f';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 60); ctx.quadraticCurveTo(W / 2, 20, 0, 60); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 740); ctx.quadraticCurveTo(W / 2, 700, W, 740); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillRect(0, 0, 36, H); ctx.fillRect(W - 36, 0, 36, H);
  ctx.strokeStyle = '#3a3050'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 740); ctx.quadraticCurveTo(W / 2, 700, W, 740); ctx.stroke();
  for (let i = 0; i < 9; i++) { ctx.fillStyle = fract(t * .7 + i * .37) > .5 ? '#46d9c4' : '#ffc94d'; ctx.globalAlpha = .7; ctx.fillRect(700 + i * 60, 770, 24, 10); }
  ctx.restore();
  actor(ctx, 'shoga', 250, 830, 190, { shadow: false }); actor(ctx, 'garlic', 440, 830, 190, { shadow: false }); actor(ctx, 'daikon', 1660, 830, 190, { flip: true, shadow: false });
};

// s14 — light-speed delays on the bridge hologram
SCENES.lightspeed = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#0a0c1c', '#161433']); stars(ctx, t, { alpha: .5, ox: u * 3 });
  // bridge floor
  ctx.fillStyle = '#221c33'; ctx.beginPath(); ctx.moveTo(0, 700); ctx.lineTo(W, 700); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  ctx.strokeStyle = '#342a4c'; ctx.lineWidth = 3; for (let x = -800; x < W + 800; x += 160) { ctx.beginPath(); ctx.moveTo(W / 2 + (x - W / 2) * .5, 700); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.fillStyle = '#3a3050'; ctx.beginPath(); ctx.ellipse(960, 780, 220, 40, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#46d9c4'; ctx.lineWidth = 4; ctx.stroke();
  ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = '#46d9c4'; ctx.beginPath(); ctx.moveTo(760, 780); ctx.lineTo(260, 120); ctx.lineTo(1660, 120); ctx.lineTo(1160, 780); ctx.fill(); ctx.restore();
  // hologram solar system
  const cx = 900, cy = 400, k = .36;
  const orb = [['水星', 60, 4.1], ['金星', 95, 1.6], ['地球', 135, 1], ['火星', 185, .53], ['木星', 280, .084], ['土星', 370, .034]];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  orb.forEach(([n, r]) => { ctx.strokeStyle = 'rgba(70,217,196,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.6, r * 1.6 * k, 0, 0, TAU); ctx.stroke(); });
  ctx.restore();
  sun(ctx, cx, cy, 26, t, .9);
  const P = orb.map(([n, r, w]) => { const a = u * .15 * w + r; return [n, cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6 * k]; });
  const earth = P[2];
  // central-intelligence fantasy (line 0)
  const kA = ease(E.p(0, .6)) * (1 - ease(E.p(1, .6)));
  if (kA > 0) { P.forEach(([n, x, y]) => { if (n !== '地球') arrow(ctx, earth[1], earth[2], x, y, { color: '#ffc94d', lw: 3, head: 12, alpha: kA }); }); txt(ctx, '即座に？', earth[1], earth[2] - 60, { size: 30, color: '#ffc94d', alpha: kA }); }
  // light pulses from Earth
  const lA = ease(E.p(1, .5));
  const delays = { 火星: '3〜22分', 木星: '約35〜52分', 土星: '約70〜90分' };
  if (lA > 0) {
    const period = 5;
    for (let j = 0; j < 2; j++) {
      const s = (E.since(1) - j * period); if (s < 0) continue; const ss = s % (period * 2); const r = ss * 90;
      ctx.save(); ctx.globalAlpha = lA * clamp(1 - ss / 9); ctx.strokeStyle = '#fff4c8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(earth[1], earth[2], r, r * k, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    const reach = E.since(1) * 90;
    P.forEach(([n, x, y]) => {
      if (!delays[n]) return; const d = Math.hypot(x - earth[1], (y - earth[2]) / k), on = ease((reach - d) / 60);
      glow(ctx, x, y, 40, 'rgba(255,240,180,.7)', on); ctx.fillStyle = '#fff4c8'; ctx.globalAlpha = .4 + .6 * on; ctx.fillRect(x - 6, y - 6, 12, 12); ctx.globalAlpha = 1;
      label(ctx, `${n} ${delays[n]}`, x, y - 40, { size: 22, alpha: on * lA });
    });
    txt(ctx, '月 約1.3秒', earth[1], earth[2] + 34, { size: 20, color: '#bffff4', alpha: lA });
    const sA = ease((E.since(1) - 2.5) / .8);
    arrow(ctx, 1460, 300, 1700, 300, { color: '#fff4c8', lw: 5, dash: [12, 10], alpha: sA });
    txt(ctx, '隣の恒星', 1700, 250, { size: 28, alpha: sA, align: 'right' }); txt(ctx, '光でも 約4.2年', 1700, 350, { size: 28, color: '#ffc94d', alpha: sA, align: 'right' });
    const pk = fract(t * .08); ctx.fillStyle = '#fff4c8'; ctx.globalAlpha = sA; ctx.fillRect(lerp(1460, 1690, pk) - 4, 296, 8, 8); ctx.globalAlpha = 1;
  }
  P.forEach(([n, x, y], i) => { ctx.fillStyle = ['#c9b8a4', '#f0d49a', '#5fb0ff', '#e0704a', '#e8c49a', '#f0dcae'][i]; ctx.beginPath(); ctx.arc(x, y, i >= 4 ? 13 : 8, 0, TAU); ctx.fill(); });
  // autonomy badges (line 2)
  const aA = ease(E.p(2, .8));
  if (aA > 0) {
    P.forEach(([n, x, y], i) => { if (i === 2) return; ctx.save(); ctx.globalAlpha = aA; ctx.strokeStyle = '#46d9c4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 22 + Math.sin(t * 2 + i) * 3, 0, TAU); ctx.stroke(); ctx.restore(); });
    txt(ctx, '光速 ＝ 宇宙文明の憲法', 900, 150, { size: 58, font: DELA, color: '#ffc94d', stroke: 10, alpha: aA });
    txt(ctx, '遠い拠点ほど 自分で判断する', 900, 225, { size: 30, alpha: aA, stroke: 6 });
  }
  actor(ctx, 'daikon', 330, FLOOR, 220); actor(ctx, 'chili', 560, FLOOR, 230, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 18 : 0 });
  actor(ctx, 'garlic', 1380, FLOOR, 220, { flip: true }); actor(ctx, 'shoga', 1600, FLOOR, 230, { flip: true });
};

// s15 — zoom out to the galaxy; a civilisation spreads star to star
SCENES.galaxy = (ctx, E) => {
  const { u, t } = E;
  ctx.fillStyle = '#020207'; ctx.fillRect(0, 0, W, H); stars(ctx, t, { alpha: .6, ox: u * 2 }); nebula(ctx, t, .5);
  const Z = clamp(u / Math.max(3, E.at(0) + 2.5)), zz = eIO(Z);
  const R = 470 * Math.exp((1 - zz) * Math.log(90));
  const sx = SUN_G.r * Math.cos(SUN_G.th + t * .02), sy = SUN_G.r * Math.sin(SUN_G.th + t * .02);
  const colon = lerp(0, 1.15, ease((u - E.at(0)) / Math.max(4, E.dur - E.at(0) - 1)));
  const gi = galaxy(ctx, t, { cx: 1000, cy: 430, R, fx: sx * (1 - zz), fy: sy * (1 - zz), colon, rot: t * .02 });
  if (zz < .6) { const a = 1 - zz / .6; sun(ctx, gi.sunX, gi.sunY, 16, t, a); txt(ctx, '太陽系', gi.sunX, gi.sunY + 50, { size: 28, alpha: a }); }
  else { glow(ctx, gi.sunX, gi.sunY, 40, 'rgba(255,220,120,.8)'); txt(ctx, 'ここ', gi.sunX, gi.sunY - 30, { size: 22, color: '#ffc94d' }); }
  // command & reply delay
  if (E.li >= 0) {
    const a = ease(E.p(0, .6)) * (1 - ease(E.p(2, .6)));
    const tx = 1000 + (-sx) * 470 * .0 - 330, ty = 430 + .5 * 470 * .1 - 40;
    arrow(ctx, gi.sunX, gi.sunY, tx, ty, { color: '#ffc94d', lw: 4, dash: [10, 10], alpha: a });
    txt(ctx, '命令 → 片道 数万年 → 返事は さらに数万年後', 1000, 100, { size: 32, color: '#ffc94d', alpha: a, stroke: 6 });
  }
  if (E.li >= 1) txt(ctx, '一枚岩の帝国 ではなく 文明の連なり', 1000, 780, { size: 34, alpha: ease(E.p(1, .8)), stroke: 6 });
  const cards = ['権力を一つに集めない', '間違いを直せる', '反対意見を消さない'];
  cards.forEach((s, i) => {
    const a = ease((E.since(2) - i * .9) / .5); if (a <= 0) return;
    card(ctx, 60 - (1 - a) * 60, 150 + i * 110, 420, 84, { fill: '#fff6df', alpha: a, r: 12 });
    txt(ctx, s, 270 - (1 - a) * 60, 192 + i * 110, { size: 32, color: '#2a2233', alpha: a });
  });
  ship(ctx, 1560 + Math.sin(u * .4) * 20, 690 + Math.sin(u * .7) * 10, .7, -.12, t, { flame: .9 });
  porthole(ctx, 230, 700, 130, t, [{ who: 'daikon', dx: -.4, h: .7 }, { who: 'shoga', dx: .05, h: .7 }, { who: 'garlic', dx: .45, h: .6, flip: true }]);
};

// s16 — far-future SF: stars fade, black holes, bubble universes
SCENES.deepfuture = (ctx, E) => {
  const { u, t } = E;
  const era = ease(u / E.dur);
  ctx.fillStyle = '#010104'; ctx.fillRect(0, 0, W, H);
  stars(ctx, t, { alpha: 1 - era * .85, ox: u * 3 });
  galaxy(ctx, t, { cx: 1500, cy: 300, R: 170, tilt: .4, alpha: 1 - era, rot: t * .04 });
  // black hole
  const bA = ease((era - .25) / .3), bx = 900, by = 440, br = 110;
  if (bA > 0) {
    ctx.save(); ctx.globalAlpha = bA;
    const drawDisk = (front) => { for (let i = 0; i < 26; i++) { const r = br * 1.4 + i * 7; ctx.strokeStyle = `rgba(255,${150 + i * 3},${60 + i * 4},${.5 - i * .016})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(bx, by, r, r * .22, -.12, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke(); } };
    drawDisk(false); glow(ctx, bx, by, br * 2.2, 'rgba(255,160,80,.35)');
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,220,160,.8)'; ctx.lineWidth = 3; ctx.stroke();
    drawDisk(true); ctx.restore();
  }
  // parallel bubbles (chili line)
  const pA = ease(E.p(0, 1)) * (1 - ease(E.p(1, 1.5)) * .5);
  if (pA > 0) {
    'ABCDEFGH'.split('').forEach((c, i) => {
      const a = ease((E.since(0) - .5 - i * .35) / .6) * pA; if (a <= 0) return;
      const x = 1250 + (i % 4) * 150 + Math.sin(t * .5 + i) * 10, y = 520 + Math.floor(i / 4) * 150 + Math.cos(t * .4 + i) * 10, r = 60;
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(200,180,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(160,140,255,.18)'; ctx.fill();
      for (let k = 0; k < 30; k++) { const rr2 = k / 30 * r * .8, aa = k * .5 + t * .3; ctx.fillStyle = '#e8e0ff'; ctx.fillRect(x + Math.cos(aa) * rr2, y + Math.sin(aa) * rr2 * .6, 2, 2); }
      ctx.restore(); txt(ctx, `${c}宇宙`, x, y + r + 20, { size: 20, color: '#d8ccff', alpha: a });
    });
    txt(ctx, '遠未来SF：並行宇宙まで計算資源に？', 1480, 440, { size: 26, color: '#d8ccff', alpha: pA });
  }
  // log-time bar
  const x0 = 200, x1 = 1720, y = 150;
  ctx.strokeStyle = 'rgba(255,246,223,.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  [['いま 138億年', 0], ['星の灯が消えていく', .33], ['ブラックホールの時代', .63], ['熱的死？', 1]].forEach(([s, f]) => { const x = lerp(x0, x1, f); ctx.fillStyle = '#fff6df'; ctx.fillRect(x - 3, y - 12, 6, 24); txt(ctx, s, x, y + 38, { size: 24, color: '#d8d0c0' }); });
  const mx = lerp(x0, x1, era); glow(ctx, mx, y, 40, 'rgba(255,201,77,.8)'); ctx.fillStyle = '#ffc94d'; ctx.fillRect(mx - 8, y - 8, 16, 16);
  txt(ctx, '時間（対数・イメージ）', x0, y - 36, { size: 20, color: '#8a8aa0', align: 'left' });
  label(ctx, '遠未来SF', W / 2, 90, { size: 30, stroke: '#d8ccff' });
  if (E.li >= 1) txt(ctx, '最大の敵 ＝ 物理法則', 900, 700, { size: 56, font: DELA, color: '#ffc94d', stroke: 10, alpha: ease(E.p(1, .8)) });
  // floating crew
  [['chili', 180, 540], ['garlic', 370, 620], ['shoga', 540, 520]].forEach(([w, x, yy], i) => actor(ctx, w, x, yy + Math.sin(t * .8 + i) * 16, 170, { rot: Math.sin(t * .5 + i) * .15, shadow: false }));
};

// ================================================================ cosmic long-term chapter (s16〜s16e)
function gear(ctx, x, y, r, n, a, col, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, w = TAU / n;
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r); ctx.lineTo(Math.cos(a0 + w * .15) * r * 1.2, Math.sin(a0 + w * .15) * r * 1.2);
    ctx.lineTo(Math.cos(a0 + w * .45) * r * 1.2, Math.sin(a0 + w * .45) * r * 1.2); ctx.lineTo(Math.cos(a0 + w * .6) * r, Math.sin(a0 + w * .6) * r);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,24,10,.6)'; ctx.lineWidth = Math.max(2, r * .05); ctx.stroke();
  ctx.fillStyle = 'rgba(20,14,30,.55)'; ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = r * .12; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(k * TAU / 4) * r * .62, Math.sin(k * TAU / 4) * r * .62); ctx.stroke(); }
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r * .18, 0, TAU); ctx.fill();
  ctx.restore();
}
// numeric integral of f over [0,u] (keeps frame(t) a pure function of t)
function integ(f, u, dt = .04) { let s = 0; for (let x = 0; x < u; x += dt) s += f(x) * Math.min(dt, u - x); return s; }
function deck(ctx, t, y0 = 770) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y0, 0, H); g.addColorStop(0, '#2a2340'); g.addColorStop(1, '#120e1e'); ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
  ctx.strokeStyle = '#4a3f6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,140,220,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, y0 - 64); ctx.lineTo(W, y0 - 64); ctx.stroke();
  for (let x = 40; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, y0 - 64); ctx.lineTo(x, y0); ctx.stroke(); }
  for (let i = 0; i < 12; i++) { ctx.fillStyle = fract(t * .4 + i * .31) > .5 ? 'rgba(70,217,196,.7)' : 'rgba(255,201,77,.6)'; ctx.fillRect(80 + i * 150, y0 + 14, 30, 6); }
  ctx.restore();
}
function tempCol(T, a = 1) { // 0 = cold blue, .5 = equilibrium grey-violet, 1 = hot red
  const c0 = [80, 150, 255], c1 = [160, 135, 185], c2 = [255, 90, 50];
  const [p, q, f] = T < .5 ? [c0, c1, T * 2] : [c1, c2, (T - .5) * 2];
  return `rgba(${Math.round(lerp(p[0], q[0], f))},${Math.round(lerp(p[1], q[1], f))},${Math.round(lerp(p[2], q[2], f))},${a})`;
}
function badge(ctx, s, x, y, a = 1, col = '#d8ccff', align) { if (a > 0) label(ctx, s, x, y, { size: 22, stroke: col, color: col, alpha: a, align }); }
function meter(ctx, x, y, w, name, v, col, a = 1) {
  if (a <= 0) return;
  txt(ctx, name, x, y, { size: 24, align: 'left', alpha: a, stroke: 5 });
  card(ctx, x, y + 20, w, 26, { fill: 'rgba(20,16,36,.85)', stroke: '#8a7fb0', lw: 2, r: 13, shadow: false, alpha: a });
  if (v > .004) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col; rr(ctx, x + 3, y + 23, (w - 6) * clamp(v), 20, 10); ctx.fill(); ctx.restore(); }
}

// s16 — the oldest SF question becomes a design problem
SCENES.cosmic_bridge = (ctx, E) => {
  const { u, t } = E;
  ctx.fillStyle = '#020207'; ctx.fillRect(0, 0, W, H); stars(ctx, t, { alpha: .8, ox: u * 3 }); nebula(ctx, t, .5);
  const bA = ease(E.p(1, .9));
  const dark = ease(E.p(0, 4));
  galaxy(ctx, t, { cx: 1250, cy: 330, R: 360, tilt: .45, colon: 1.2, dim: (1 - dark * .55) * (1 - bA * .5) });
  if (dark > 0) { const g = ctx.createRadialGradient(1250, 330, 80 + 520 * (1 - dark), 1250, 330, 1300); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.85 * dark})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  const tA = ease(E.p(0, 1)) * (1 - bA);
  txt(ctx, '宇宙の熱的死', 1250, 600, { size: 84, font: DELA, color: '#ff9a7a', stroke: 12, alpha: tA });
  txt(ctx, '昔のSFで、いちばん遠い問い', 1250, 680, { size: 30, alpha: tA, stroke: 6 });
  // research loop spinning up (the same loop as the ground chapter)
  if (bA > 0) {
    const lx = 330, ly = 380, R = 120, sp = 1 + 7 * ease(E.p(1, 5));
    const ph = integ(x => 1 + 7 * ease((x - E.at(1)) / 5), u) * .9;
    ctx.save(); ctx.globalAlpha = bA; ctx.strokeStyle = 'rgba(255,201,77,.5)'; ctx.lineWidth = 8; ctx.setLineDash([24, 14]); ctx.lineDashOffset = -ph * 60;
    ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 18; i++) { const a = ph + i / 18 * TAU; ctx.strokeStyle = i % 3 ? '#ffd27a' : '#46f0d0'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(lx, ly, R, a - Math.min(.5, .05 * sp), a); ctx.stroke(); }
    ctx.restore();
    txt(ctx, `研究 ×${sp.toFixed(0)}`, lx, ly, { size: 44, font: DELA, color: '#ffc94d', alpha: bA });
    txt(ctx, 'ギュで加速する研究', lx, ly + R + 44, { size: 26, alpha: bA, stroke: 5 });
    for (let k = 0; k < 8; k++) { const f = fract(t * .5 + k / 8); ctx.fillStyle = '#ffe9a8'; ctx.globalAlpha = bA * (1 - f); ctx.fillRect(lerp(lx + R, 880, f) - 5, ly - 5 + Math.sin(f * 6 + k) * 8, 10, 10); } ctx.globalAlpha = 1;
    // card flips: SF paperback -> blueprint
    const fl = E.p(1, 1.8), sx = Math.max(.04, Math.abs(Math.cos(fl * Math.PI))), blue = fl >= .5;
    ctx.save(); ctx.globalAlpha = bA; ctx.translate(1250, 400); ctx.scale(sx, 1);
    if (!blue) {
      card(ctx, -300, -210, 600, 420, { fill: '#e8d6ae', stroke: '#6b5a44', r: 10 });
      ctx.fillStyle = '#1a1430'; ctx.fillRect(-260, -170, 520, 230);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = '#fff6df'; ctx.fillRect(-250 + rnd(i * 3.1) * 500, -160 + rnd(i * 5.7) * 210, 3, 3); }
      ctx.fillStyle = '#ff9a7a'; ctx.beginPath(); ctx.arc(120, -60, 50, 0, TAU); ctx.fill();
      txt(ctx, '昔のSF', 0, 110, { size: 50, font: DELA, color: '#3a2a1c' }); txt(ctx, '「宇宙の終わり」', 0, 170, { size: 34, color: '#3a2a1c' });
    } else {
      card(ctx, -300, -210, 600, 420, { fill: '#0f2a4a', stroke: '#6fc8ff', r: 10 });
      ctx.strokeStyle = 'rgba(111,200,255,.22)'; ctx.lineWidth = 2;
      for (let x = -280; x <= 280; x += 40) { ctx.beginPath(); ctx.moveTo(x, -200); ctx.lineTo(x, 200); ctx.stroke(); }
      for (let y = -200; y <= 200; y += 40) { ctx.beginPath(); ctx.moveTo(-290, y); ctx.lineTo(290, y); ctx.stroke(); }
      txt(ctx, '設計課題：宇宙の長い未来', 0, -160, { size: 32, color: '#bfe8ff' });
      ['エネルギーを集めて蓄える', '温度差をどう使うか', '熱を抑えた計算', '手が届く資源の範囲'].forEach((s, i) => {
        const a = ease((E.since(1) - 1.2 - i * .6) / .5);
        ctx.save(); ctx.globalAlpha = bA * a; ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 3; ctx.strokeRect(-250, -95 + i * 68, 32, 32);
        ctx.strokeStyle = '#46f0d0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-244, -80 + i * 68); ctx.lineTo(-236, -70 + i * 68); ctx.lineTo(-222, -92 + i * 68); ctx.stroke(); ctx.restore();
        txt(ctx, s, -200, -79 + i * 68, { size: 30, align: 'left', alpha: a, color: '#eaf6ff' });
      });
    }
    ctx.restore();
    label(ctx, '空想 → 設計課題', 1250, 650, { size: 30, alpha: ease(E.p(1, 2.2)) * bA });
  }
  // the time ruler stretches (line 3)
  const rA = ease(E.p(2, .8));
  if (rA > 0) {
    const X = lerp(2, 40, eIn(E.p(2, Math.max(4, E.dur - E.at(2) - .5)))), y = 118, cx = 960, step = 150;
    ctx.save(); ctx.globalAlpha = rA; ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(140, y); ctx.lineTo(1780, y); ctx.stroke(); ctx.restore();
    const names = { 2: '100年', 4: '1万年', 6: '100万年', 8: '1億年', 10: '100億年', 12: '1兆年', 14: '100兆年' };
    for (let n = Math.floor(X) - 6; n <= X + 6; n++) {
      if (n < 0) continue; const x = cx + (n - X) * step; if (x < 150 || x > 1770) continue;
      const edge = clamp(Math.min(x - 150, 1770 - x) / 160);
      ctx.fillStyle = '#fff6df'; ctx.globalAlpha = rA * edge; ctx.fillRect(x - 2, y - (n % 2 ? 8 : 16), 4, n % 2 ? 16 : 32); ctx.globalAlpha = 1;
      if (n % 2 === 0) txt(ctx, names[n] || `10の${n}乗年`, x, y + 32, { size: 24, alpha: rA * edge, color: '#d8d0c0' });
    }
    ctx.fillStyle = '#ffc94d'; ctx.globalAlpha = rA; ctx.beginPath(); ctx.moveTo(cx, y - 20); ctx.lineTo(cx - 12, y - 40); ctx.lineTo(cx + 12, y - 40); ctx.fill(); ctx.globalAlpha = 1;
    txt(ctx, '時間のものさしを、ずっと先へ', cx - 330, y - 30, { size: 24, color: '#ffc94d', alpha: rA * .9 });
    txt(ctx, '宇宙の最終的な運命は、まだ確定していない（ダークエネルギーの性質しだい）', 1010, 700, { size: 22, color: '#bfe8ff', alpha: rA, stroke: 5 });
    txt(ctx, '？', 1560, 520, { size: 120, font: DELA, color: '#9fe3b0', alpha: rA * (.6 + .4 * Math.sin(t * 2)), stroke: 10 });
  }
  deck(ctx, t);
  actor(ctx, 'chili', 230, FLOOR, 210, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 16 : 0 });
  actor(ctx, 'garlic', 440, FLOOR, 200);
  actor(ctx, 'daikon', 1580, FLOOR, 210, { flip: true });
  actor(ctx, 'shoga', 1780, FLOOR, 210, { flip: true });
};

// s16b — heat death as the loss of temperature difference: hot|cold -> engine -> mixed, gears stop
const HEATP = Array.from({ length: 380 }, (_, i) => ({ hot: i % 2, hx: rnd(i * 1.7 + .3), hy: rnd(i * 2.9 + .7), ux: rnd(i * 4.3 + .1), f: .6 + rnd(i * 5.1) * .8, ph: rnd(i * 6.7) * TAU }));
SCENES.heatdeath = (ctx, E) => {
  const { u, t } = E;
  const m0 = E.at(1), m1 = Math.max(E.end(2) - .4, m0 + 3);
  const mix = x => .04 * ease(x / 3) + .96 * eIO((x - m0) / (m1 - m0));
  const m = mix(u), dT = 1 - m;
  const A = integ(x => 2.6 * Math.pow(1 - mix(x), 1.6), u);
  vgrad(ctx, ['#07050d', '#130d20']); stars(ctx, t, { alpha: .35 * dT + .1, ox: u * 2 });
  const X0 = 150, X1 = 1770, Y0 = 340, Y1 = 640, cy = 490;
  glow(ctx, 380, cy, 420, 'rgba(255,90,50,.5)', dT); glow(ctx, 1540, cy, 420, 'rgba(80,150,255,.5)', dT);
  glow(ctx, 960, cy, 760, 'rgba(160,135,185,.22)', m);
  card(ctx, X0 - 24, Y0 - 24, X1 - X0 + 48, Y1 - Y0 + 48, { fill: 'rgba(255,255,255,.035)', stroke: 'rgba(200,190,230,.35)', lw: 3, r: 30, shadow: false });
  for (const p of HEATP) {
    const home = p.hot ? lerp(X0, 610, p.hx) : lerp(1310, X1, p.hx);
    const T = lerp(p.hot, .5, m), sp = .3 + T * 1.4;
    const x = clamp(lerp(home, lerp(X0, X1, p.ux), m) + Math.sin(t * 3 * p.f * sp + p.ph) * 24 * sp, X0, X1);
    const y = clamp(lerp(Y0, Y1, p.hy) + Math.cos(t * 2.6 * p.f * sp + p.ph * 1.3) * 20 * sp, Y0, Y1);
    const s = 5 + T * 3; ctx.fillStyle = tempCol(T, .85); ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  // heat pipe through the engine: flow ∝ temperature difference
  ctx.fillStyle = 'rgba(34,28,52,.92)'; ctx.fillRect(610, cy - 24, 700, 48);
  const nS = Math.round(24 * Math.pow(dT, 1.2));
  for (let i = 0; i < nS; i++) { const f = fract(A * .09 + i / 24); ctx.fillStyle = tempCol(1 - f * .9); ctx.fillRect(lerp(620, 1300, f) - 7, cy - 7, 14, 14); }
  // engine
  const gc = lerp(70, 170, dT);
  const gcol = `rgb(${Math.round(gc + 60)},${Math.round(gc + 30)},${Math.round(gc - 20)})`;
  glow(ctx, 960, cy, 200, 'rgba(255,200,110,.45)', dT);
  gear(ctx, 960, cy, 100, 12, A, gcol);
  gear(ctx, 840, cy - 150, 52, 8, -A * 100 / 52 + .2, gcol);
  gear(ctx, 1080, cy - 150, 52, 8, -A * 100 / 52 + .5, gcol);
  // compute city powered by the engine
  ctx.fillStyle = '#231c36'; ctx.fillRect(740, 272, 440, 14);
  const bld = [[760, 60], [805, 90], [850, 50], [895, 110], [950, 80], [1000, 120], [1055, 70], [1100, 95], [1140, 55]];
  const lit = Math.pow(dT, 1.3);
  bld.forEach(([x, h], k) => {
    ctx.fillStyle = '#2e2646'; ctx.fillRect(x, 272 - h, 36, h);
    for (let wy = 272 - h + 10; wy < 262; wy += 18) for (let wx = x + 6; wx < x + 30; wx += 14) {
      const id = rnd(k * 13.1 + wx * .7 + wy * .3); const on = id < lit;
      ctx.fillStyle = on ? (id > .8 * lit ? '#9fe8ff' : '#ffd98a') : 'rgba(90,80,120,.4)'; ctx.fillRect(wx, wy, 8, 9);
    }
  });
  txt(ctx, '計算の灯', 960, 312 - 0, { size: 22, color: '#ffd98a', alpha: .3 + .7 * lit });
  for (let k = 0; k < 4; k++) { const f = fract(A * .15 + k / 4); ctx.fillStyle = '#ffe9a8'; ctx.globalAlpha = dT; ctx.fillRect(957, lerp(cy - 100, 290, f) - 3, 6, 6); } ctx.globalAlpha = 1;
  // captions
  const a0 = ease(E.p(0, .6));
  txt(ctx, '熱い', 380, 612, { size: 34, color: '#ff8a6a', alpha: a0 * (.3 + .7 * dT), stroke: 6 });
  txt(ctx, '冷たい', 1540, 612, { size: 34, color: '#8ab8ff', alpha: a0 * (.3 + .7 * dT), stroke: 6 });
  const cap = E.li >= 2 ? 'エネルギーはある。でも、もう仕事に使えない' : E.li >= 1 ? '温度差が、ならされていく' : '熱の流れ → 歯車 → 仕事と計算';
  const fin = ease((u - E.end(2) + .6) / 1.5);
  txt(ctx, cap, 960, 705, { size: 32, color: '#ffc94d', alpha: a0 * (1 - fin), stroke: 6 });
  // meters
  const mA = ease((E.since(0) - 1) / .8);
  card(ctx, 50, 120, 470, 200, { fill: 'rgba(14,10,26,.72)', stroke: '#6a5f90', lw: 2, r: 14, shadow: false, alpha: mA });
  meter(ctx, 76, 146, 420, '温度差', dT, '#ff7a5a', mA);
  meter(ctx, 76, 206, 420, '使えるエネルギー', Math.pow(dT, 1.3), '#ffc94d', mA);
  meter(ctx, 76, 266, 420, 'エネルギーの総量（この閉じた箱では一定）', 1, '#a898d0', mA);
  badge(ctx, '突然ゼロになるわけではない', 1560, 160, ease(E.p(0, 1)) * (1 - ease(E.p(2, .6))), '#ffc94d');
  if (fin > 0) {
    txt(ctx, '熱的死 ＝ 温度差が消えた宇宙', 960, 712, { size: 52, font: DELA, color: '#d8ccff', stroke: 10, alpha: fin });
    badge(ctx, '理論予測', 960, 790, fin);
  }
  actor(ctx, 'shoga', 150, FLOOR, 180, { pose: E.li >= 2 && !E.spk ? 'think' : 'idle' });
  actor(ctx, 'garlic', 340, FLOOR, 170);
  actor(ctx, 'chili', 1760, FLOOR, 185, { flip: true, hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 6)) * 14 : 0 });
};

// s16c — stellar era -> remnants -> black holes evaporating; the harvest city runs out
const NIGHT = Array.from({ length: 620 }, (_, i) => {
  const mass = Math.pow(rnd(i * 2.1 + .2), 3);
  return {
    x: 100 + rnd(i * 1.3 + .4) * 1720, y: 200 + rnd(i * 4.9 + .1) * 520, mass,
    death: .08 + (1 - mass) * .78 * (.72 + rnd(i * 3.3) * .28),
    kind: mass > .5 ? (rnd(i * 7.7) > .55 ? 'bh' : 'ns') : 'wd',
    born: rnd(i * 5.5) < .14 ? rnd(i * 6.1) * .14 : -1, ph: rnd(i * 8.3) * TAU,
  };
});
SCENES.longnight = (ctx, E) => {
  const { u, t } = E;
  ctx.fillStyle = '#010104'; ctx.fillRect(0, 0, W, H);
  const at1 = E.at(1), at2 = E.at(2);
  const era = .95 * eIO((u - .2) / Math.max(4, E.end(0) + .4));
  const wide = 1 - ease((u - at1 + .4) / 1.6), close = 1 - wide;
  // ---- wide field: the stars go out one by one
  if (wide > 0) {
    ctx.save(); ctx.globalAlpha = wide;
    const z = 1 + close * 1.5; ctx.translate(960, 450); ctx.scale(z, z); ctx.translate(-960, -450);
    stars(ctx, t, { alpha: .5 * (1 - era), ox: u * 2 });
    let alive = 0;
    for (const s of NIGHT) {
      if (s.born > 0 && era < s.born) continue;
      if (era < s.death) {
        alive++;
        const sz = 2 + s.mass * 7, col = s.mass > .5 ? '#aee0ff' : s.mass > .15 ? '#fff4d8' : '#ffb07a';
        if (s.mass > .35) glow(ctx, s.x, s.y, sz * 5, 'rgba(180,220,255,.35)', wide);
        ctx.globalAlpha = wide * (.65 + .35 * Math.sin(t * 1.5 + s.ph)); ctx.fillStyle = col; ctx.fillRect(s.x - sz / 2, s.y - sz / 2, sz, sz);
        if (s.born > 0 && era - s.born < .03) { ctx.strokeStyle = '#fff4d8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, 6 + (era - s.born) * 600, 0, TAU); ctx.globalAlpha = wide * (1 - (era - s.born) / .03); ctx.stroke(); }
      } else {
        const d = (era - s.death) / .3;
        if (d < .12 && s.mass > .3) glow(ctx, s.x, s.y, 30 + d * 400, 'rgba(255,220,180,.5)', wide * (1 - d / .12));
        if (s.kind === 'bh') { ctx.globalAlpha = wide; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(s.x, s.y, 4 + s.mass * 4, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,160,80,.7)'; ctx.lineWidth = 1.5; ctx.stroke(); }
        else if (s.kind === 'ns') { ctx.globalAlpha = wide * clamp(1 - d * .5) * (.5 + .3 * Math.sin(t * 4 + s.ph)); ctx.fillStyle = '#7fb8ff'; ctx.fillRect(s.x - 2, s.y - 2, 4, 4); }
        else { const f = clamp(d * .7); ctx.globalAlpha = wide * lerp(.9, .18, f); ctx.fillStyle = f < .5 ? '#f4f0ff' : '#b0584a'; ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3); }
      }
    }
    ctx.restore();
    const lA = ease(E.p(0, .6)) * wide;
    txt(ctx, `輝く星　${alive}`, 1560, 815, { size: 30, align: 'right', alpha: lA, stroke: 6, color: '#fff4d8' });
    txt(ctx, era < .16 ? '新しい星が生まれる' : '新しい星は、もう生まれない', 960, 760, { size: 32, color: '#ffc94d', alpha: lA, stroke: 6 });
    const legend = [['白色矮星', '#f4f0ff'], ['中性子星', '#7fb8ff'], ['ブラックホール', '#000']];
    legend.forEach(([s, c], i) => { const a = lA * ease((era - .35 - i * .08) / .1), x = 160 + i * 230; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, 815, 9, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,160,80,.8)'; ctx.lineWidth = 2; if (i === 2) ctx.stroke(); ctx.restore(); txt(ctx, s, x + 20, 815, { size: 24, align: 'left', alpha: a, stroke: 5 }); });
  }
  // ---- close-up: a harvest ring around one black hole, which slowly evaporates
  if (close > 0) {
    ctx.save(); ctx.globalAlpha = close;
    stars(ctx, t, { alpha: .12, ox: u });
    const bx = 960, by = 440, ev = ease((u - at2) / Math.max(4, E.dur - at2 - 1.2)), r = 110 * Math.cbrt(Math.max(0, 1 - ev));
    const collect = Math.sqrt(clamp(r / 110)) * ease((u - at1) / 1.5);
    const ringA = u * .05, rx = 380, ry = 96, tilt = -.08;
    const nodes = Array.from({ length: 40 }, (_, k) => { const a = ringA + k / 40 * TAU; return [bx + Math.cos(a) * rx * Math.cos(tilt) - Math.sin(a) * ry * Math.sin(tilt), by + Math.cos(a) * rx * Math.sin(tilt) + Math.sin(a) * ry * Math.cos(tilt), Math.sin(a)]; });
    const drawNodes = front => nodes.forEach(([x, y, z], k) => { if ((z > 0) !== front) return; ctx.fillStyle = collect > .05 ? (k % 5 ? '#ffc94d' : '#46f0d0') : '#3a3350'; const s = front ? 9 : 6; ctx.globalAlpha = close * (.4 + .6 * collect); ctx.fillRect(x - s / 2, y - s / 2, s, s); ctx.globalAlpha = close; });
    ctx.strokeStyle = 'rgba(200,180,255,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, tilt, Math.PI, TAU); ctx.stroke();
    drawNodes(false);
    if (r > .5) {
      glow(ctx, bx, by, r * 2.6, 'rgba(255,150,70,.35)', close * collect);
      for (let i = 0; i < 12; i++) { const rr2 = r * 1.3 + i * r * .06; ctx.strokeStyle = `rgba(255,${150 + i * 6},90,${(.35 - i * .025) * collect})`; ctx.lineWidth = Math.max(1, r * .05); ctx.beginPath(); ctx.ellipse(bx, by, rr2, rr2 * .24, -.1, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,220,170,.8)'; ctx.lineWidth = 2; ctx.stroke();
    }
    // Hawking radiation: faint, and relatively brighter as the hole shrinks
    const hA = ease((u - at2) / 1.2) * Math.min(1, .4 + 25 / Math.max(r, 8));
    if (hA > 0 && r > .5) for (let k = 0; k < 46; k++) { const a = k * 2.399, f = fract(t * .25 + k * .137); ctx.fillStyle = '#f4f0ff'; ctx.globalAlpha = close * hA * (1 - f) * .8; ctx.fillRect(bx + Math.cos(a) * (r + f * 260) - 1.5, by + Math.sin(a) * (r + f * 260) * .8 - 1.5, 3, 3); }
    ctx.globalAlpha = close;
    if (ev > .97) glow(ctx, bx, by, 60 + (ev - .97) * 3000, 'rgba(240,230,255,.5)', close * (1 - (ev - .97) / .03));
    drawNodes(true);
    // beams into the harvest city
    const cx = 1330, cyy = 560;
    for (let k = 0; k < 40; k += 4) { const [x, y, z] = nodes[k]; if (z < 0) continue; const f = fract(t * .4 + k * .05); ctx.fillStyle = '#ffe9a8'; ctx.globalAlpha = close * collect * (1 - f); ctx.fillRect(lerp(x, cx, f) - 2, lerp(y, cyy, f) - 2, 4, 4); }
    ctx.globalAlpha = close;
    card(ctx, cx - 70, cyy - 30, 140, 60, { fill: '#1d1830', stroke: '#ffc94d', r: 14, lw: 3, shadow: false, alpha: close });
    for (let k = 0; k < 10; k++) { ctx.fillStyle = rnd(k * 3.7) < collect ? '#ffd98a' : '#3a3350'; ctx.fillRect(cx - 58 + k * 12, cyy - 10, 8, 20); }
    txt(ctx, '残光を集める都市', cx, cyy + 56, { size: 26, alpha: close, stroke: 5 });
    meter(ctx, 1320, 236, 460, '集められる光', collect, '#ffc94d', close);
    badge(ctx, '文明の構想', 1550, 330, close * ease((u - at1) / 1) * (1 - ease(E.p(2, .5))));
    const h2 = ease(E.p(2, .8));
    txt(ctx, 'かすかな放射で、少しずつ蒸発する', 960, 690, { size: 34, color: '#d8ccff', alpha: close * h2, stroke: 6 });
    badge(ctx, 'ホーキング放射：理論予測', 960, 745, close * h2);
    txt(ctx, '無限の電源ではない', 420, 250, { size: 40, font: DELA, color: '#ff9a7a', alpha: close * ease((u - at2 - 2) / 1), stroke: 8 });
    ctx.restore();
  }
  // ---- log time bar
  const mk = u < at1 ? lerp(.02, .48, clamp(u / Math.max(1, at1))) : u < at2 ? lerp(.48, .62, (u - at1) / Math.max(1, at2 - at1)) : lerp(.62, .96, clamp((u - at2) / Math.max(1, E.dur - at2)));
  const x0 = 180, x1 = 1740, y = 140;
  const eras = [['星の時代', 0, .3, '#ffd98a'], ['残骸の時代', .3, .55, '#f4f0ff'], ['ブラックホールの時代', .55, .85, '#ff9a5a'], ['暗い時代', .85, 1, '#6a5f90']];
  eras.forEach(([s, a, b, c]) => { ctx.fillStyle = c; ctx.globalAlpha = .35 + (mk >= a && mk < b ? .55 : 0); ctx.fillRect(lerp(x0, x1, a) + 2, y - 7, (b - a) * (x1 - x0) - 4, 14); ctx.globalAlpha = 1; txt(ctx, s, lerp(x0, x1, (a + b) / 2), y + 34, { size: 22, color: mk >= a && mk < b ? '#fff6df' : '#8a8aa0', stroke: 4 }); });
  const mx = lerp(x0, x1, mk); glow(ctx, mx, y, 36, 'rgba(255,201,77,.8)'); ctx.fillStyle = '#ffc94d'; ctx.fillRect(mx - 7, y - 14, 14, 28);
  txt(ctx, '時間（対数・イメージ）／仮定に依存する理論予測', x0, y - 30, { size: 20, color: '#8a8aa0', align: 'left' });
  porthole(ctx, 1730, 700, 120, t, [{ who: 'daikon', dx: -.42, h: .74 }, { who: 'garlic', dx: .1, h: .62 }, { who: 'shoga', dx: .5, h: .7, flip: true }]);
};

// s16d — collect, store, compute cold and slow; the city breathes slower and sleeps
const COLDRINGS = [[90, 24], [160, 40], [230, 56]];
SCENES.coldcompute = (ctx, E) => {
  const { u, t } = E;
  ctx.fillStyle = '#020106'; ctx.fillRect(0, 0, W, H); stars(ctx, t, { alpha: .18, ox: u });
  for (let i = 0; i < 120; i++) { const s = NIGHT[i * 5]; ctx.fillStyle = i % 3 ? 'rgba(176,88,74,.5)' : 'rgba(240,236,255,.35)'; ctx.fillRect(s.x, s.y * .9, 2, 2); }
  const at1 = E.at(1), at2 = E.at(2);
  const slow = x => clamp((x - at2) / Math.max(3, E.dur - at2 - .5));
  const P = x => .9 * Math.pow(40, slow(x));
  const ph = integ(x => 1 / P(x), u);
  const sleepMode = ease((u - lerp(at2, E.end(2), .35)) / 1);
  const cyc = fract(ph / 2), sl = ease((cyc - .5) / .1) * ease((1 - cyc) / .1), awake = 1 - sleepMode * sl * .88;
  const cx = 1260, cy = 470;
  // collectors -> storage (line 1)
  const cA = ease(E.p(0, 1));
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU + .3, x = cx + Math.cos(a) * 330, y = cy + Math.sin(a) * 250;
    if (y > 740) continue;
    ctx.save(); ctx.globalAlpha = cA; ctx.translate(x, y); ctx.rotate(a + Math.PI); ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 26, -1, 1); ctx.stroke(); ctx.restore();
    for (let j = 0; j < 3; j++) { const f = fract(t * .3 + k * .21 + j / 3); ctx.fillStyle = '#ffe9a8'; ctx.globalAlpha = cA * (1 - f) * .9; ctx.fillRect(lerp(x, cx, f) - 2, lerp(y, cy, f) - 2, 4, 4); }
    ctx.globalAlpha = 1;
  }
  const lvl = ease((u - E.at(0) - .5) / Math.max(3, at1 - E.at(0)));
  for (let k = 0; k < 3; k++) {
    const x = 1590 + k * 90, y0 = 560, h = 170;
    card(ctx, x, y0, 64, h, { fill: '#15122a', stroke: '#8a7fb0', r: 12, lw: 3, shadow: false, alpha: cA });
    ctx.fillStyle = '#46f0d0'; ctx.globalAlpha = cA * .85; ctx.fillRect(x + 6, y0 + h - 6 - (h - 12) * lvl * (.8 + .2 * rnd(k)), 52, (h - 12) * lvl * (.8 + .2 * rnd(k))); ctx.globalAlpha = 1;
  }
  txt(ctx, '蓄える', 1720, 530, { size: 24, alpha: cA, stroke: 5 });
  ['集める', '→ 蓄える', '→ 熱を抑えて計算する'].forEach((s, i) => txt(ctx, s, 920 + i * 200, 165, { size: 30, color: '#ffc94d', align: 'left', alpha: ease((E.since(0) - .4 - i * .7) / .5) * (1 - ease(E.p(1, .6))), stroke: 6 }));
  badge(ctx, '文明の構想', 1690, 230, cA * (1 - ease(E.p(1, .6))));
  // the breathing city
  glow(ctx, cx, cy, 300, 'rgba(120,200,255,.28)', awake * (.5 + .5 * Math.sin(ph * TAU)));
  COLDRINGS.forEach(([R, n], ri) => {
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + ri * .2 + u * .01 * (ri % 2 ? -1 : 1);
      const pulse = .5 + .5 * Math.sin(ph * TAU - ri * .9);
      const b = awake * (.25 + .75 * pulse) * (.7 + .3 * rnd(k * 3.1 + ri));
      ctx.fillStyle = `rgba(${Math.round(lerp(60, 180, b))},${Math.round(lerp(70, 240, b))},${Math.round(lerp(120, 255, b))},${.35 + .65 * b})`;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * .82; ctx.fillRect(x - 6, y - 6, 12, 12);
    }
    ctx.strokeStyle = `rgba(150,140,220,${.15 + .2 * awake})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * .82, 0, 0, TAU); ctx.stroke();
  });
  ctx.fillStyle = '#1d1830'; ctx.beginPath(); ctx.arc(cx, cy, 44, 0, TAU); ctx.fill(); ctx.strokeStyle = '#46f0d0'; ctx.lineWidth = 3; ctx.stroke();
  txt(ctx, '計算都市', cx, cy, { size: 22, color: '#bfe8ff', alpha: .5 + .5 * awake });
  if (sleepMode * sl > .3) { const a = sleepMode * sl; for (let k = 0; k < 3; k++) { const f = fract(t * .3 + k / 3); txt(ctx, 'z', cx + 60 + f * 80, cy - 80 - f * 90, { size: 26 + k * 8, color: '#d8ccff', alpha: a * (1 - f) }); } txt(ctx, '休眠中', cx, cy + 275, { size: 28, color: '#d8ccff', alpha: a, stroke: 5 }); }
  // Landauer panel (line 2)
  const lA = ease(E.p(1, .7)) * (1 - ease(E.p(2, .8)) * .75);
  if (lA > 0) {
    const Tn = lerp(1, .12, ease((u - at1 - 1) / Math.max(3, E.end(1) - at1 - 1)));
    card(ctx, 60, 150, 720, 500, { fill: 'rgba(14,10,26,.9)', stroke: '#8a7fb0', lw: 3, r: 16, alpha: lA });
    txt(ctx, '情報を消すと、熱が出る', 420, 190, { size: 32, alpha: lA });
    const cyc2 = 3.4, cs = Math.floor(Math.max(0, u - at1) / cyc2), ct = Math.max(0, u - at1) - cs * cyc2, sweep = ct / cyc2 * 50;
    for (let k = 0; k < 50; k++) {
      const c = k % 10, r = Math.floor(k / 10), x = 100 + c * 52, y = 230 + r * 56;
      const erased = k < sweep, v = erased ? '0' : (rnd(k * 1.9 + cs * 7.3) > .5 ? '1' : '0');
      card(ctx, x, y, 44, 44, { fill: erased ? '#232040' : '#3a3462', stroke: erased ? '#5a5090' : '#bfe8ff', lw: 2, r: 6, shadow: false, alpha: lA });
      txt(ctx, v, x + 22, y + 23, { size: 24, color: erased ? '#7a70a8' : '#fff6df', alpha: lA });
      const age = (sweep - k) / 50 * cyc2;
      if (erased && age < 1.8) { const s = 3 + 12 * Tn; ctx.fillStyle = tempCol(.5 + .5 * Tn, .9); ctx.globalAlpha = lA * (1 - age / 1.8); ctx.fillRect(x + 22 - s / 2 + Math.sin(age * 6 + k) * 6, y - age * 50 - s / 2, s, s); ctx.globalAlpha = 1; }
    }
    ctx.fillStyle = '#46f0d0'; ctx.globalAlpha = lA; ctx.fillRect(100 + (sweep % 10) * 52 - 4, 226 + Math.floor(Math.min(49, sweep) / 10) * 56, 6, 52); ctx.globalAlpha = 1;
    // thermometer
    card(ctx, 660, 230, 44, 290, { fill: '#15122a', stroke: '#bfe8ff', lw: 2, r: 22, shadow: false, alpha: lA });
    ctx.fillStyle = tempCol(.5 + .5 * Tn); ctx.globalAlpha = lA; ctx.fillRect(670, 510 - 270 * Tn, 24, 270 * Tn); ctx.globalAlpha = 1;
    txt(ctx, '温度', 682, 540, { size: 22, alpha: lA });
    txt(ctx, '1bit消去の熱の下限 ＝ k T ln2（理想値）', 400, 585, { size: 26, color: '#ffc94d', alpha: lA });
    txt(ctx, '低温ほど小さい／実際の計算機はずっと多く使う', 400, 622, { size: 22, color: '#bfe8ff', alpha: lA });
    badge(ctx, '物理の下限', 700, 188, lA, '#ffc94d');
  }
  // slow thought (line 3)
  const sA = ease(E.p(2, .8));
  if (sA > 0) {
    const q = slow(u), v = q < .3 ? '1秒' : q < .62 ? '1年' : '何万年';
    txt(ctx, `思考1回 ≈ ${v}`, cx, 790, { size: 38, font: DELA, color: '#bfe8ff', alpha: sA, stroke: 8 });
    badge(ctx, '休眠して待つ案は研究仮説（異論あり）', cx, 130 + 60, sA * ease(E.p(2, 2)), '#d8ccff');
  }
  actor(ctx, 'shoga', 170, FLOOR, 180, { pose: E.spk === 'shoga' ? 'idle' : 'think' });
  actor(ctx, 'garlic', 360, FLOOR, 165);
  actor(ctx, 'chili', 560, FLOOR, 185, { flip: true, hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 5)) * 12 : 0 });
};

// s16e — accelerating expansion drags resources past the horizon; the research map opens
const GALS = (() => { const g = []; for (let i = -7; i <= 7; i++) for (let j = -6; j <= 6; j++) { const x = i * .23 + (rnd(i * 7.1 + j * 3.3) - .5) * .14, y = j * .26 + (rnd(i * 2.3 + j * 9.7) - .5) * .14; if (Math.hypot(x, y) < .2) continue; g.push({ x, y, s: .6 + rnd(i * 4.1 + j) * .8, rot: rnd(i + j * 5.5) * TAU, c: rnd(i * 9 + j) }); } return g; })();
function miniGal(ctx, x, y, s, rot, col, a) {
  if (a <= 0) return;
  glow(ctx, x, y, 16 * s, col, a);
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 11 * s, 4 * s, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = '#fff6df'; ctx.fillRect(-2, -2, 4, 4); ctx.restore();
}
SCENES.horizon = (ctx, E) => {
  const { u, t } = E;
  ctx.fillStyle = '#020207'; ctx.fillRect(0, 0, W, H); stars(ctx, t, { alpha: .4, ox: u * 1.5 }); nebula(ctx, t, .35);
  const cx = 960, cy = 420, Rh = 330, fy = .62;
  const a = Math.exp(1.7 * ease((u - E.at(0) + .5) / Math.max(4, E.end(1) - E.at(0) + .5)));
  const mapA = ease(E.p(2, 1)), backA = ease(E.p(3, 1));
  let reach = 0;
  for (const g of GALS) {
    const x = cx + g.x * 300 * a, y = cy + g.y * 300 * a * fy, d = Math.hypot(x - cx, (y - cy) / fy);
    if (x < -40 || x > W + 40 || y < -40 || y > 800) continue;
    const out = clamp((d - Rh) / 240), inside = d < Rh;
    if (inside) reach++;
    const col = out > 0 ? `rgba(255,${Math.round(150 - out * 90)},${Math.round(120 - out * 80)},.8)` : (g.c > .5 ? 'rgba(170,200,255,.8)' : 'rgba(255,230,190,.8)');
    miniGal(ctx, x, y, g.s * 1.45, g.rot + u * .05, col, (1 - out) * (1 - mapA * .45));
  }
  // bound local group + our ship-civilisation
  [[-40, -10], [35, 18], [10, -38], [-20, 30]].forEach(([dx, dy], k) => miniGal(ctx, cx + dx, cy + dy, 1.1, k + u * .1, 'rgba(255,220,150,.9)', 1));
  glow(ctx, cx, cy, 60, 'rgba(255,201,77,.6)');
  // horizon
  ctx.save(); ctx.strokeStyle = '#d8ccff'; ctx.lineWidth = 3; ctx.setLineDash([14, 12]); ctx.lineDashOffset = -t * 20; ctx.globalAlpha = .8;
  ctx.beginPath(); ctx.ellipse(cx, cy, Rh, Rh * fy, 0, 0, TAU); ctx.stroke(); ctx.restore();
  txt(ctx, '光でも届かなくなる境界', cx, cy - Rh * fy - 24, { size: 24, color: '#d8ccff', stroke: 5 });
  const e0 = ease(E.p(0, .8)) * (1 - mapA);
  txt(ctx, `手が届く銀河　${reach}`, 110, 270, { size: 32, align: 'left', alpha: e0, stroke: 6, color: '#fff4d8' });
  badge(ctx, '加速膨張：遠い銀河ほど速く遠ざかる', cx, 700, e0);
  // longevity vs eternity (line 2)
  const lA = ease(E.p(1, .8)) * (1 - mapA);
  if (lA > 0) {
    const y = 160, grow = ease(E.p(1, 2.5));
    const g = ctx.createLinearGradient(250, 0, 1250, 0); g.addColorStop(0, 'rgba(255,201,77,.95)'); g.addColorStop(.8, 'rgba(255,201,77,.6)'); g.addColorStop(1, 'rgba(255,201,77,0)');
    ctx.save(); ctx.globalAlpha = lA; ctx.fillStyle = g; ctx.fillRect(250, y - 12, 1000 * grow, 24); ctx.restore();
    txt(ctx, '延命（とても長い）', 250, y - 34, { size: 26, align: 'left', alpha: lA, stroke: 5 });
    txt(ctx, '≠', 1360, y, { size: 64, font: DELA, color: '#ff9a7a', alpha: lA * ease(E.p(1, 3)), stroke: 8 });
    txt(ctx, '永遠 ∞', 1540, y, { size: 44, font: DELA, color: '#d8ccff', alpha: lA * ease(E.p(1, 3)), stroke: 8 });
    badge(ctx, '知られた物理の範囲では', 1450, y + 62, lA * ease(E.p(1, 3)));
  }
  // research map (line 3): branches into untested hypotheses
  if (mapA > 0) {
    const z = 1 - .08 * mapA;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy);
    for (let k = 0; k < 3; k++) { const ang = t * .35 + k * TAU / 3; ctx.save(); ctx.globalAlpha = mapA * .08; ctx.fillStyle = '#d8ccff'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 900, ang, ang + .18); ctx.closePath(); ctx.fill(); ctx.restore(); }
    const nodes = [[420, 250, '新しい物理？'], [1500, 250, '別の宇宙？'], [380, 600, '宇宙を生む方法？'], [1540, 600, '未知の資源？']];
    nodes.forEach(([nx, ny, s], k) => {
      const p = ease((E.since(2) - .3 - k * .5) / 1.2); if (p <= 0) return;
      const mx = lerp(cx, nx, .5), my = lerp(cy, ny, .5) - 120;
      ctx.save(); ctx.globalAlpha = mapA; ctx.strokeStyle = '#d8ccff'; ctx.lineWidth = 4; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.moveTo(cx, cy); const N = 30; for (let i = 1; i <= N * p; i++) { const f = i / N; ctx.lineTo((1 - f) * (1 - f) * cx + 2 * (1 - f) * f * mx + f * f * nx, (1 - f) * (1 - f) * cy + 2 * (1 - f) * f * my + f * f * ny); } ctx.stroke(); ctx.restore();
      const f = fract(t * .2 + k * .25) * p; ship(ctx, (1 - f) * (1 - f) * cx + 2 * (1 - f) * f * mx + f * f * nx, (1 - f) * (1 - f) * cy + 2 * (1 - f) * f * my + f * f * ny, .14, Math.atan2(ny - cy, nx - cx), t, { flame: .6, alpha: mapA * p });
      if (p >= .95) {
        const na = ease((E.since(2) - 1.5 - k * .5) / .5);
        for (let j = 0; j < 3; j++) { const sa = (k < 2 ? -1 : 1) * (.5 + j * .5) + (nx < cx ? Math.PI : 0), sxx = nx + Math.cos(sa) * 150, syy = ny + Math.sin(sa) * 80; ctx.save(); ctx.globalAlpha = mapA * na * .7; ctx.strokeStyle = '#8a7fb0'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(sxx, syy); ctx.stroke(); ctx.restore(); txt(ctx, '？', sxx, syy, { size: 26, color: '#8a7fb0', alpha: mapA * na }); }
        glow(ctx, nx, ny, 110, 'rgba(200,180,255,.45)', mapA * na);
        card(ctx, nx - 150, ny - 38, 300, 76, { fill: '#1d1830', stroke: '#d8ccff', lw: 3, r: 38, alpha: mapA * na });
        txt(ctx, s, nx, ny, { size: 30, alpha: mapA * na });
        badge(ctx, '未検証の仮説', nx, ny + 64, mapA * na);
      }
    });
    ctx.restore();
    txt(ctx, '超知能の、いちばん大きな研究テーマ', cx, 120 + 30, { size: 34, color: '#ffc94d', alpha: mapA * (1 - backA), stroke: 7 });
  }
  // back to the beginning: the ground loop (line 4)
  if (backA > 0) {
    const r = lerp(0, 70, eOut(backA));
    ctx.save(); ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 4; ctx.globalAlpha = backA; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy); ctx.stroke(); ctx.restore();
    globe(ctx, cx, cy, r, u * .3, .3, t, { night: false, lights: .5 });
    ctx.save(); ctx.globalAlpha = backA; ctx.strokeStyle = 'rgba(255,201,77,.85)'; ctx.lineWidth = 6; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 120;
    ctx.beginPath(); ctx.arc(cx, cy, r + 40, 0, TAU); ctx.stroke(); ctx.restore();
    ripple(ctx, cx, cy, E.since(3) - .4, { max: 520, squash: .62, life: 2.6, n: 2, color: '255,214,140' });
    txt(ctx, 'はじまりは、来年からの地上の加速', cx, cy + r + 90, { size: 36, color: '#ffc94d', alpha: backA, stroke: 7 });
  }
  deck(ctx, t);
  actor(ctx, 'daikon', 200, FLOOR, 200);
  actor(ctx, 'garlic', 400, FLOOR, 185);
  actor(ctx, 'shoga', 1540, FLOOR, 205, { flip: true, pose: E.li >= 3 && !E.spk ? 'point' : 'idle' });
  actor(ctx, 'chili', 1740, FLOOR, 205, { flip: true, hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 18 : 0 });
};

// ================================================================ long-form chapters (society → state → soul → cosmos)
// alpha of a beat that spans lines [i, j)
function beatA(E, i, j) {
  const n = E.L.length;
  const a = i === 0 ? ease((E.u + .3) / .5) : ease((E.u - E.at(i) + .35) / .5);
  const b = j == null || j >= n ? 0 : ease((E.u - E.at(j) + .35) / .5);
  return a * (1 - b);
}
function box(ctx, s, x, y, w, h, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return;
  card(ctx, x - w / 2, y - h / 2, w, h, { fill: o.fill || '#fff6df', stroke: o.stroke || '#2a2233', r: o.r ?? 14, lw: o.lw ?? 4, alpha: a, shadow: o.shadow ?? true });
  const lines = String(s).split('\n'), sz = o.size || 30;
  lines.forEach((ln, i) => txt(ctx, ln, x, y + (i - (lines.length - 1) / 2) * sz * 1.25 + 1, { size: sz, color: o.color || '#2a2233', alpha: a, font: o.font, maxW: w - 16 }));
}
function polyAt(pts, f) {
  const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
  let d = clamp(f) * L;
  for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const k = seg[i] ? clamp(d / seg[i]) : 0; return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]; } d -= seg[i]; }
  return pts[pts.length - 1];
}
function polyline(ctx, pts, col, lw, a = 1, dash, off = 0) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = off; }
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.restore();
}
function flowDots(ctx, pts, t, n, speed, col, s = 10, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col;
  for (let k = 0; k < n; k++) { const [x, y] = polyAt(pts, fract(t * speed + k / n)); ctx.fillRect(x - s / 2, y - s / 2, s, s); }
  ctx.restore();
}
function bgLab(ctx, top = '#0e1426', bot = '#172247', grid = 'rgba(70,217,196,.06)') {
  vgrad(ctx, [top, bot]);
  ctx.save(); ctx.strokeStyle = grid; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
}
function bgSpace(ctx, t, u, neb = .4) { ctx.fillStyle = '#020207'; ctx.fillRect(0, 0, W, H); stars(ctx, t, { alpha: .8, ox: u * 3 }); if (neb) nebula(ctx, t, neb); }
function floorBand(ctx, col = '#2a2240', y0 = 780) { ctx.fillStyle = col; ctx.fillRect(0, y0, W, H - y0); }
// side cast: two on the left, two on the right (keeps the centre free for diagrams)
function sideCast(ctx, E, o = {}) {
  const t = E.t, h = o.h || 185;
  const L = o.left || ['shoga', 'daikon'], R = o.right || ['garlic', 'chili'];
  const hopC = w => (E.spk === w && w === 'chili') ? Math.abs(Math.sin(t * 7)) * 16 : 0;
  actor(ctx, L[0], 110, FLOOR, h, { hop: hopC(L[0]) }); actor(ctx, L[1], 280, FLOOR, h, { hop: hopC(L[1]) });
  actor(ctx, R[0], 1640, FLOOR, h, { flip: true, hop: hopC(R[0]) }); actor(ctx, R[1], 1810, FLOOR, h, { flip: true, hop: hopC(R[1]) });
}
function coin(ctx, x, y, r, a = 1) { if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#a8741a'; ctx.lineWidth = Math.max(1.5, r * .18); ctx.stroke(); ctx.fillStyle = '#a8741a'; ctx.fillRect(x - r * .15, y - r * .5, r * .3, r); ctx.restore(); }
function eye(ctx, x, y, s, t, a = 1) { if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.ellipse(x, y, 30 * s, 17 * s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#2a2233'; ctx.beginPath(); ctx.arc(x + Math.sin(t + x) * 8 * s, y, 9 * s, 0, TAU); ctx.fill(); ctx.restore(); }
function stamp(ctx, s, x, y, a, col = '#d9443a', rot = -.15, size = 54) {
  if (a <= 0) return; const k = 1 + (1 - ease(a)) * .6;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  ctx.font = `normal ${size}px ${DELA}`; const w = ctx.measureText(s).width + 40;
  ctx.strokeStyle = col; ctx.lineWidth = 6; rr(ctx, -w / 2, -size * .75, w, size * 1.5, 14); ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, 0, 2); ctx.restore();
}

// s02b — the stance: accelerationism / シンギュラリタリアン; ギュ comes to everyone; five questions
SCENES.stance = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#120a24', '#2a1850', '#4a2a60']);
  const warp = 1 - beatA(E, 3, 6) * .7;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 150; i++) {
    const a = rnd(i * 3.1) * TAU, f = fract(t * (.2 + rnd(i) * .35) + rnd(i * 7.7)), r0 = 50 + f * f * 1150, len = 30 + f * 170;
    ctx.strokeStyle = `rgba(${i % 3 ? '255,210,140' : '120,230,255'},${(.55 * f * warp).toFixed(3)})`; ctx.lineWidth = 1 + f * 3;
    ctx.beginPath(); ctx.moveTo(960 + Math.cos(a) * r0, 420 + Math.sin(a) * r0 * .6); ctx.lineTo(960 + Math.cos(a) * (r0 + len), 420 + Math.sin(a) * (r0 + len) * .6); ctx.stroke();
  }
  ctx.restore();
  const a0 = beatA(E, 0, 3);
  if (a0 > 0) {
    const open = ease(E.p(1, 2));
    // the existing institution frame opens
    ctx.save(); ctx.globalAlpha = a0 * .9; ctx.strokeStyle = '#8a7fb0'; ctx.lineWidth = 10;
    ctx.strokeRect(560 - open * 60, 150, 800 + open * 120, 340); ctx.fillStyle = 'rgba(20,12,40,.75)';
    ctx.fillRect(560, 150, 400 * (1 - open), 340); ctx.fillRect(1360 - 400 * (1 - open), 150, 400 * (1 - open), 340); ctx.restore();
    txt(ctx, '今の制度', 960, 520, { size: 26, color: '#b8a8e0', alpha: a0 * (1 - open * .6) });
    txt(ctx, '加速主義', 960, 250, { size: 110, font: DELA, color: '#ffc94d', stroke: 14, alpha: a0 });
    txt(ctx, 'シンギュラリタリアン', 960, 380, { size: 64, font: DELA, stroke: 10, alpha: a0 });
    badge(ctx, 'この動画の立場（ひとつの見方）', 960, 560, a0 * ease(E.p(1, .6)), '#ffc94d');
    const oA = ease(E.p(2, .8)) * a0;
    ['誰が決める？', '何に値段がつく？', '人間とは何か？'].forEach((s, i) => {
      const ang = t * .45 + i * TAU / 3, x = 960 + Math.cos(ang) * 470, y = 650 + Math.sin(ang) * 70;
      glow(ctx, x, y, 110, 'rgba(255,201,77,.35)', oA); box(ctx, s, x, y, 290, 70, { alpha: oA, fill: '#1d1830', color: '#fff6df', stroke: '#ffc94d', size: 28 });
    });
  }
  // medals: effort does not exempt anyone
  const mA = beatA(E, 3, 5);
  if (mA > 0) {
    const sh = E.since(4) - .3;
    ripple(ctx, 960, 700, sh, { max: 820, squash: .22, life: 2.6, n: 3 });
    const medals = ['学歴', '資格', '大発見', '社会貢献', '', '', '', '', '', '', ''];
    for (let i = 0; i < 11; i++) {
      const x = 470 + i * 98, [dx, dy] = shake(sh - Math.abs(i - 5) * .06, 12, 1.4);
      tiny(ctx, x + dx, 700 + dy, 3, ['#ff7a66', '#46a0c4', '#ffc94d', '#9fe3b0', '#c49ae8'][i % 5], t, i, false, false, mA);
      if (medals[i]) { coin(ctx, x + dx, 560 + dy, 22, mA); box(ctx, medals[i], x + dx, 505 + dy, 110, 44, { size: 22, alpha: mA, r: 10, lw: 3, shadow: false }); }
    }
    txt(ctx, E.li >= 4 ? 'ギュは、全員に平等に来る' : '努力した分、有利？', 960, 250, { size: 54, font: DELA, color: '#fff6df', stroke: 10, alpha: mA });
    if (E.li >= 4) txt(ctx, '知らないふりをしても、AIは社会にしみこむ', 960, 340, { size: 32, color: '#ffc94d', stroke: 6, alpha: mA * ease(E.p(4, 1.5)) });
  }
  // generations missing the waves
  const gA = beatA(E, 5, 6);
  if (gA > 0) {
    const s = E.since(5);
    ctx.save(); ctx.globalAlpha = gA; ctx.fillStyle = '#1c2c5a'; ctx.fillRect(380, 600, 1160, 160); ctx.restore();
    [['バブル', 0], ['金融緩和', 1.4]].forEach(([n, d]) => { const x = 1600 - (s - d) * 380; if (x < 300 || x > 1650) return; ctx.save(); ctx.globalAlpha = gA * .8; ctx.fillStyle = '#6fa8dc'; ctx.beginPath(); ctx.ellipse(x, 600, 120, 60, 0, Math.PI, TAU); ctx.fill(); ctx.restore(); txt(ctx, n, x, 560, { size: 28, alpha: gA, stroke: 5 }); });
    tiny(ctx, 700, 610, 3, '#ffc94d', t, 1, false, false, gA);
    txt(ctx, '乗り遅れた…', 700, 470, { size: 26, alpha: gA * clamp(s - .5), color: '#b8c7df' });
    const big = ease((s - 2.6) / 1.5); const bx = lerp(1700, 1150, big);
    glow(ctx, bx, 560, 260, 'rgba(255,201,77,.5)', gA * big);
    ctx.save(); ctx.globalAlpha = gA * big; ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.ellipse(bx, 600, 260, 200, 0, Math.PI, TAU); ctx.fill(); ctx.restore();
    txt(ctx, 'ギュ', bx, 520, { size: 90, font: DELA, color: '#2a1850', alpha: gA * big });
    txt(ctx, '人類史で最大級のイベント', 960, 220, { size: 48, font: DELA, stroke: 9, alpha: gA });
  }
  // five questions
  const qA = beatA(E, 6, null);
  if (qA > 0) {
    const qs = ['起きるか', '責任', '備えるか\n寝そべるか', '誰が支配', '人類の意味'];
    txt(ctx, 'ギュ後学　五つの大問', 960, 190, { size: 56, font: DELA, color: '#ffc94d', stroke: 10, alpha: qA });
    qs.forEach((s, i) => {
      const x = 560 + i * 200, on = ease((E.since(6) - .4 - i * .7) / .5);
      ctx.save(); ctx.globalAlpha = qA; ctx.fillStyle = on > .5 ? '#fff4c8' : '#3a2f5c'; rr(ctx, x - 80, 300, 160, 300, 70); ctx.fill(); ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
      glow(ctx, x, 450, 130, 'rgba(255,220,150,.5)', qA * on);
      txt(ctx, `大問${'一二三四五'[i]}`, x, 360, { size: 28, color: on > .5 ? '#2a2233' : '#fff6df', alpha: qA });
      const L2 = s.split('\n'); L2.forEach((l, k) => txt(ctx, l, x, 460 + k * 34 - (L2.length - 1) * 17, { size: 26, color: on > .5 ? '#2a2233' : '#b8a8e0', alpha: qA, maxW: 150 }));
    });
  }
  const castA = 1;
  actor(ctx, 'chili', 120, FLOOR, 190, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 18 : 0, alpha: castA });
  actor(ctx, 'garlic', 290, FLOOR, 175);
  actor(ctx, 'shoga', 1630, FLOOR, 190, { flip: true });
  actor(ctx, 'daikon', 1800, FLOOR, 190, { flip: true });
};

// s03c — the whole route map (grounded causes, then hypotheses)
const ROUTE = [['2019年以前', 0], ['コロナ禍', 0], ['アフター\nコロナ', 0], ['いま\nプレシンギュラリティ', 0], ['ギュ', 0], ['資本主義の\n書き換え', 0], ['評価経済', 0], ['シン平時', 0],
  ['脳汁\n至上主義', 1], ['電脳化', 1], ['ASIと\n一体化', 1], ['多惑星', 1], ['銀河', 1], ['宇宙文明', 1], ['AED', 1], ['並行宇宙', 1], ['次元上昇', 1], ['上位存在', 1]];
SCENES.roadmap = (ctx, E) => {
  const { u, t } = E;
  bgSpace(ctx, t, u, .3);
  const X = i => 150 + i * 300 + (i >= 8 ? 150 : 0), Y = x => 470 + Math.sin(x / 260) * 90;
  const endX = X(17) + 200;
  let cx = lerp(560, 1700, ease(u / Math.max(2, E.end(0))));
  cx = lerp(cx, 4300, eIO(E.p(1, Math.max(2, E.end(1) - E.at(1)))));
  const zo = eIO(E.p(2, 1.6)); const s = lerp(1, .33, zo); cx = lerp(cx, 2750, zo);
  const S = (x, y) => [(x - cx) * s + 960, (y - 470) * s + 470];
  // road
  const pts = []; for (let x = -200; x <= endX; x += 30) pts.push([x, Y(x)]);
  const split = X(7) + 225;
  polyline(ctx, pts.filter(p => p[0] <= split).map(p => S(...p)), '#ffc94d', 26 * s + 6, .9);
  polyline(ctx, pts.filter(p => p[0] >= split).map(p => S(...p)), '#b8a8e0', 20 * s + 5, .85, [30 * s + 8, 20 * s + 6], -t * 40);
  ROUTE.forEach(([name, hyp], i) => {
    const [x, y] = S(X(i), Y(X(i))); if (x < -150 || x > W + 150) return;
    const col = hyp ? '#d8ccff' : '#ffc94d';
    glow(ctx, x, y, 60 * s + 20, hyp ? 'rgba(200,180,255,.5)' : 'rgba(255,201,77,.5)');
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 16 * s + 6, 0, TAU); ctx.fill();
    const up = i % 2 ? 1 : -1, sz = Math.max(18, 30 * s), ly = y + up * (80 * s + 44);
    const lines = name.split('\n'); lines.forEach((l, k) => txt(ctx, l, x, ly + (k - (lines.length - 1) / 2) * sz * 1.15, { size: sz, color: hyp ? '#e8e0ff' : '#fff6df', stroke: 6 }));
  });
  // marker (ギュ号) moves along
  const mk = u < E.at(1) ? lerp(0, 4.3, ease(u / Math.max(2, E.end(0)))) : lerp(4.3, 17, eIO(E.p(1, Math.max(2, E.end(1) - E.at(1)))));
  const mi = Math.min(16, Math.floor(mk)), mx = lerp(X(mi), X(mi + 1), mk - mi), [sx, sy] = S(mx, Y(mx));
  ship(ctx, sx, sy - 60 * s - 20, .35 * s + .12, 0, t, { flame: .7 });
  const dA = ease(E.p(3, .8));
  if (dA > 0) {
    const [dx] = S(split, 0);
    ctx.save(); ctx.globalAlpha = dA; ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(dx, 150); ctx.lineTo(dx, 760); ctx.stroke(); ctx.restore();
    label(ctx, '今の社会で確かめられるつながり', dx - 30, 180, { size: 28, align: 'right', stroke: '#ffc94d', alpha: dA });
    label(ctx, '未検証の仮説と思考実験', dx + 30, 180, { size: 28, align: 'left', stroke: '#d8ccff', color: '#d8ccff', alpha: dA });
  }
  deck(ctx, t, 790);
  actor(ctx, 'shoga', 130, FLOOR, 180); actor(ctx, 'chili', 300, FLOOR, 180, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 16 : 0 });
  actor(ctx, 'daikon', 1640, FLOOR, 185, { flip: true }); actor(ctx, 'garlic', 1810, FLOOR, 170, { flip: true });
};

// s03b — AGI is not a finish line: definitions, capability meters, proof candidates, agents, tech, race
SCENES.agiladder = (ctx, E) => {
  const { u, t } = E;
  bgLab(ctx);
  const b0 = beatA(E, 0, 2);
  if (b0 > 0) {
    // track + goal tape that splits into definitions
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#2a3560';
    ctx.beginPath(); ctx.moveTo(760, 180); ctx.lineTo(1160, 180); ctx.lineTo(1560, 760); ctx.lineTo(360, 760); ctx.fill();
    ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 3; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(760 + k * 100, 180); ctx.lineTo(360 + k * 300, 760); ctx.stroke(); } ctx.restore();
    const split = ease(E.p(1, 1.2));
    for (const side of [-1, 1]) {
      ctx.save(); ctx.globalAlpha = b0; ctx.strokeStyle = '#ff7a66'; ctx.lineWidth = 12; ctx.beginPath();
      for (let k = 0; k <= 20; k++) { const f = k / 20, x = 960 + side * (f * 360 + split * 260), y = 360 + Math.sin(t * 4 + f * 6) * 10 + split * f * 80 * side; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.restore();
    }
    txt(ctx, 'AGI？', 960, 280, { size: 72, font: DELA, color: '#ff9a7a', stroke: 10, alpha: b0 * (1 - split * .5) });
    const defs = ['人間の平均並み', '経済的な仕事の大半', '自分で研究できる', 'ロボットで体も動かす'];
    defs.forEach((d, i) => { const a = b0 * ease((E.since(1) - .5 - i * .5) / .5); box(ctx, d, 560 + (i % 2) * 800, 470 + Math.floor(i / 2) * 150, 380, 80, { alpha: a, size: 30 }); });
    if (E.li >= 1) badge(ctx, '定義が何通りもある', 960, 640, b0 * ease(E.p(1, 1)), '#ffc94d');
  }
  const b2 = beatA(E, 2, 3), bS = beatA(E, 7, null) * .45;
  const mA = Math.max(b2, bS);
  if (mA > 0) {
    const names = ['言語', '数学', 'コード', '科学', 'PC操作', '計画', '長時間の自律', '物理世界'], lv = [1.05, 1, .98, .9, .86, .82, .72, .45];
    const base = 700, top = 180, hl = 330;
    txt(ctx, '人間の線', 400, hl, { size: 24, color: '#ffc94d', align: 'right', alpha: mA });
    ctx.save(); ctx.globalAlpha = mA; ctx.strokeStyle = '#ffc94d'; ctx.setLineDash([14, 10]); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(420, hl); ctx.lineTo(1500, hl); ctx.stroke(); ctx.restore();
    names.forEach((n, i) => {
      const g = lv[i] * ease((E.since(2) - .2 - i * .3) / (2.4 + i * .3));
      const h = (base - hl) / .85 * g, x = 470 + i * 132, crossed = base - h < hl;
      card(ctx, x - 40, base - h, 80, h, { fill: crossed ? '#46d9c4' : '#46a0c4', stroke: '#0c1a2e', r: 8, lw: 3, shadow: false, alpha: mA });
      if (crossed) glow(ctx, x, base - h, 60, 'rgba(120,255,230,.6)', mA);
      txt(ctx, n, x, base + 30, { size: n.length > 4 ? 18 : 24, alpha: mA, maxW: 124 });
    });
    txt(ctx, '名前より、能力を見る', 960, top - 40, { size: 44, font: DELA, stroke: 8, alpha: b2 });
    if (bS > 0) txt(ctx, 'もう、起き始めているか？', 960, 450, { size: 64, font: DELA, color: '#ffc94d', stroke: 12, alpha: beatA(E, 7, null) });
  }
  const b3 = beatA(E, 3, 4);
  if (b3 > 0) {
    const s = E.since(3);
    txt(ctx, '高校数学の誤答 → 難問の「証明候補」', 960, 170, { size: 40, stroke: 7, alpha: b3 });
    bot(ctx, 560, 560, 1.4, t, { glow: b3 });
    const f = eIO(clamp((s - .8) / 1.5)), dx = lerp(640, 930, f);
    box(ctx, '証明\n候補', dx, 440, 150, 170, { alpha: b3, size: 32, fill: '#fff6df' });
    [['人の目', 1260, 330], ['別の仕組み\n（形式検証）', 1260, 560]].forEach(([n, x, y], k) => {
      const a = b3 * ease((s - 2 - k * .6) / .5); box(ctx, n, x, y, 240, 110, { alpha: a, fill: '#1d1830', color: '#bfe8ff', stroke: '#46d9c4', size: 26 });
      arrow(ctx, dx + 80, 440, x - 125, y, { color: '#46d9c4', lw: 5, head: 16, alpha: a });
    });
    stamp(ctx, '検証中', 930, 620, b3 * ease((s - 3.4) / .5), '#46d9c4', -.1, 44);
  }
  const b4 = beatA(E, 4, 5);
  if (b4 > 0) {
    const s = E.since(4);
    tiny(ctx, 960, 470, 4, '#ffc94d', t, 0, false, false, b4);
    const n = Math.min(30, Math.floor(2 + s * 9));
    for (let k = 0; k < n; k++) { const a = Math.PI + k / 29 * Math.PI, x = 960 + Math.cos(a) * 380, y = 420 + Math.sin(a) * 220; polyline(ctx, [[960, 380], [x, y]], 'rgba(70,217,196,.4)', 2, b4); bot(ctx, x, y + 34, .45, t + k, { glow: 0 }); }
    card(ctx, 560, 600, 800, 40, { fill: '#15122a', stroke: '#8a7fb0', lw: 2, r: 20, shadow: false, alpha: b4 });
    const fill = clamp(s / 5); ctx.save(); ctx.globalAlpha = b4; for (let k = 0; k < 16 * fill; k++) { ctx.fillStyle = k % 2 ? '#46d9c4' : '#46a0c4'; ctx.fillRect(566 + k * 49, 606, 44, 28); } ctx.restore();
    txt(ctx, '何時間 → 何日も続く作業', 960, 680, { size: 32, alpha: b4, stroke: 6 });
  }
  const b5 = beatA(E, 5, 6);
  if (b5 > 0) {
    const techs = ['半導体の進歩', '量子コンピューター', '核融合', '光で計算するチップ', 'アルゴリズム改善'];
    techs.forEach((s, i) => {
      const x = 480 + i * 240, a = b5 * ease((E.since(5) - i * .4) / .5), y = 420;
      glow(ctx, x, y, 110, 'rgba(120,200,255,.35)', a);
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 4;
      if (i === 0) { ctx.strokeRect(x - 45, y - 45, 90, 90); for (let k = -30; k <= 30; k += 20) { ctx.beginPath(); ctx.moveTo(x + k, y - 45); ctx.lineTo(x + k, y - 65); ctx.moveTo(x + k, y + 45); ctx.lineTo(x + k, y + 65); ctx.stroke(); } }
      if (i === 1) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x, y, 60, 20, k * 1.05 + t * .5, 0, TAU); ctx.stroke(); }
      if (i === 2) { ctx.beginPath(); ctx.ellipse(x, y, 60, 34, 0, 0, TAU); ctx.stroke(); glow(ctx, x, y, 50, 'rgba(255,180,90,.8)', a); }
      if (i === 3) { ctx.strokeRect(x - 45, y - 35, 90, 70); ctx.strokeStyle = '#ffe9a8'; ctx.beginPath(); ctx.moveTo(x - 70, y); ctx.lineTo(x + 70, y + Math.sin(t * 4) * 10); ctx.stroke(); }
      if (i === 4) { const nd = [[x, y - 50], [x - 40, y], [x + 40, y], [x - 60, y + 50], [x - 20, y + 50], [x + 60, y + 50]]; [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5]].forEach(([p, q]) => { ctx.beginPath(); ctx.moveTo(...nd[p]); ctx.lineTo(...nd[q]); ctx.stroke(); }); }
      ctx.restore(); txt(ctx, s, x, y + 110, { size: 24, alpha: a, maxW: 220, stroke: 5 });
    });
    txt(ctx, '伸びしろはまだある', 960, 200, { size: 50, font: DELA, stroke: 9, alpha: b5 });
    badge(ctx, '期待される技術（未実現を含む）', 960, 640, b5, '#bfe8ff');
  }
  const b6 = beatA(E, 6, 7);
  if (b6 > 0) {
    const core = [960, 420];
    glow(ctx, core[0], core[1], 200, 'rgba(70,217,196,.5)', b6); bot(ctx, core[0], core[1] + 70, 1.6, t, { glow: 0 });
    [['アメリカ', 520], ['中国', 1400]].forEach(([n, x]) => {
      ctx.save(); ctx.globalAlpha = b6; ctx.fillStyle = '#2a3560'; ctx.fillRect(x - 70, 300, 140, 380); for (let y = 320; y < 660; y += 36) { ctx.fillStyle = '#ffd98a'; ctx.fillRect(x - 50, y, 100, 14); } ctx.restore();
      txt(ctx, n, x, 270, { size: 34, alpha: b6, stroke: 6 });
      for (let k = 0; k < 6; k++) { const f = fract(t * .5 + k / 6); coin(ctx, lerp(x, core[0], f), lerp(420, core[1], f) - Math.sin(f * Math.PI) * 120, 12, b6 * (1 - f * .3)); }
    });
    txt(ctx, '国を挙げた巨額投資', 960, 190, { size: 46, font: DELA, stroke: 8, alpha: b6 });
    badge(ctx, '新冷戦・覇権という見立て', 960, 640, b6, '#ff9a7a');
  }
  sideCast(ctx, E, { left: ['daikon', 'shoga'], right: ['garlic', 'chili'] });
};

// s04b — every occupation, from the inside out
SCENES.alljobs = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#f3e6cc', '#e2cfa9']); floorBand(ctx, '#b58a5a', 760);
  const core = [1450, 380];
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const jobs = ['士業', '公務員', '芸術家', 'ブルーカラー', '農業', '医師', '金融', 'コンサル', '研究者', '官僚', '会計士', '税理士'];
    glow(ctx, core[0], core[1], 220, 'rgba(70,217,196,.5)', b0); bot(ctx, core[0], core[1] + 80, 1.8, t, { glow: 0 });
    jobs.forEach((j2, i) => {
      const x0 = 460 + (i % 4) * 190, y0 = 230 + Math.floor(i / 4) * 150, f = eIO(clamp((E.since(0) - .6 - i * .45) / 1.4)) * .82;
      const x = lerp(x0, core[0] - 60, f), y = lerp(y0, core[1], f) - Math.sin(f * Math.PI) * 100;
      box(ctx, j2, x, y, 170 * (1 - f * .4), 60 * (1 - f * .4), { size: (j2.length > 4 ? 22 : 28) * (1 - f * .4), alpha: b0, r: 10, lw: 3, shadow: false, fill: f > .7 ? '#bff3ea' : '#fff6df' });
    });
    txt(ctx, '全職種にギュが来る', 800, 140, { size: 50, font: DELA, color: '#2a2233', alpha: b0 });
    badge(ctx, '極端な仮説', 800, 700, b0, '#ff7a66');
  }
  const b1 = beatA(E, 1, 3);
  if (b1 > 0) {
    const desks = [['弁護士', ['判例検索', '契約の下読み', '証拠整理'], 1], ['コンサル', ['情報収集', '議事録', '表計算'], 1], ['官僚', ['法令の照会', '資料作成', '照会対応'], 2], ['エンジニア', ['実装', 'テスト', 'バグ直し'], 2]];
    ctx.save(); ctx.globalAlpha = b1; glow(ctx, 960, 150, 260, 'rgba(70,217,196,.45)'); ctx.fillStyle = 'rgba(70,217,196,.25)'; ctx.beginPath(); ctx.ellipse(960, 150, 300, 70, 0, 0, TAU); ctx.fill(); ctx.restore();
    txt(ctx, 'AI', 960, 150, { size: 44, font: DELA, color: '#1f6f78', alpha: b1 });
    desks.forEach(([name, tasks, li], k) => {
      const x = 480 + k * 320;
      ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 130, 620, 260, 22); ctx.fillStyle = '#5c3c22'; ctx.fillRect(x - 110, 642, 16, 110); ctx.fillRect(x + 94, 642, 16, 110); ctx.restore();
      box(ctx, name, x, 690, 190, 54, { size: 28, alpha: b1, fill: '#ffc94d', r: 8, lw: 3 });
      tasks.forEach((s, i) => {
        const f = eIO(clamp((E.since(li) - .4 - i * .5 - (k % 2) * .25) / 1.2));
        const x2 = lerp(x - 80 + i * 80, 820 + k * 90, f), y2 = lerp(580 - i * 40, 170, f);
        box(ctx, s, x2, y2, 150, 44, { size: s.length > 5 ? 17 : 21, alpha: b1 * (1 - f * .7), r: 8, lw: 2, shadow: false, fill: f > .95 ? '#bff3ea' : '#fff6df' });
      });
    });
    txt(ctx, '名札はそのまま、中身が入れ替わる', 960, 300, { size: 36, color: '#2a2233', alpha: b1 * ease(E.p(2, .8)) });
  }
  const b3 = beatA(E, 3, null);
  if (b3 > 0) {
    const s = E.since(3), x = 960;
    ctx.save(); ctx.globalAlpha = b3; ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x - 80, 750); ctx.lineTo(x - 80, 150); ctx.moveTo(x + 80, 750); ctx.lineTo(x + 80, 150); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 10; i++) {
      const y = 720 - i * 62, order = i < 5 ? i * 2 : (9 - i) * 2 + 1, gone = ease((s - .5 - order * .35) / .6) * (order < 8 ? 1 : 0);
      const flyX = lerp(x, x + (i < 5 ? -500 : 500), gone);
      ctx.save(); ctx.globalAlpha = b3 * (1 - gone * .7); ctx.strokeStyle = gone > 0 ? '#46d9c4' : '#7a5230'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(flyX - 80, y); ctx.lineTo(flyX + 80, y); ctx.stroke(); ctx.restore();
    }
    txt(ctx, '熟練の判断', x + 240, 160, { size: 30, color: '#2a2233', alpha: b3 }); txt(ctx, '若手の下調べ', x + 240, 720, { size: 30, color: '#2a2233', alpha: b3 });
    arrow(ctx, 600, 720, 600, 520, { color: '#1f8f7f', lw: 6, alpha: b3 }); arrow(ctx, 1320, 160, 1320, 360, { color: '#1f8f7f', lw: 6, alpha: b3 * ease((s - 2) / .5) });
    txt(ctx, 'はしごが下からも上からも', 960, 100 + 0, { size: 34, color: '#2a2233', alpha: b3 });
  }
  sideCast(ctx, E, { left: ['daikon', 'shoga'], right: ['garlic', 'chili'] });
};

// s06b — the company view: fewer people, copyable AI, in-housing, residual human work, keep observing
SCENES.company = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#e8f0f6', '#cfdde8']); floorBand(ctx, '#9aa8b8', 770);
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0), cut = ease((s - 1) / 1.5);
    txt(ctx, '10人 → 3人 ＋ AI', 700, 170, { size: 56, font: DELA, color: '#2a2233', alpha: b0 });
    for (let i = 0; i < 10; i++) { const keep = i < 3, x = 420 + (i % 5) * 110, y = 400 + Math.floor(i / 5) * 150; tiny(ctx, x, y, 3.2, keep ? '#ffc94d' : '#8a8aa0', t, i, false, false, b0 * (keep ? 1 : 1 - cut)); }
    for (let k = 0; k < 2; k++) bot(ctx, 530 + k * 180, 700, .9 * cut, t + k, { glow: cut * b0 });
    const costs = ['人件費', '採用', '教育', 'オフィス', '管理'];
    costs.forEach((c, i) => { const y = 250 + i * 90, w = lerp(380, 130, ease((s - 1.5 - i * .3) / 1)); card(ctx, 1080, y, w, 50, { fill: '#46a0c4', stroke: '#2a2233', lw: 2, r: 8, shadow: false, alpha: b0 }); txt(ctx, c, 1060, y + 25, { size: 26, color: '#2a2233', align: 'right', alpha: b0 }); });
    badge(ctx, '図解の仮定', 700, 235, b0, '#ff7a66');
  }
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const s = E.since(1), n = Math.min(128, Math.pow(2, Math.floor(s * 2.2)));
    for (let k = 0; k < n; k++) { const x = 460 + (k % 16) * 60, y = 250 + Math.floor(k / 16) * 60; bot(ctx, x, y + 40, .4, t + k * .3, { glow: 0 }); }
    txt(ctx, `コピーで ×${n}`, 960, 180, { size: 56, font: DELA, color: '#1f6f78', alpha: b1 });
    const ang = t * 1.2; const cx = 1440, cy = 330; ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#1d2440'; ctx.beginPath(); ctx.arc(cx, cy, 90, 0, TAU); ctx.fill(); ctx.restore();
    sun(ctx, cx + Math.cos(ang) * 60, cy + Math.sin(ang) * 60, 16, t, b1); ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(cx - Math.cos(ang) * 60, cy - Math.sin(ang) * 60, 13, 0, TAU); ctx.fill(); ctx.restore();
    txt(ctx, '夜中も週末も', cx, cy + 130, { size: 28, color: '#2a2233', alpha: b1 });
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2), inh = ease((s - 2) / 1.5);
    box(ctx, '受託会社\n（頭脳労働の代行）', 560, 380, 320, 200, { alpha: b2, fill: '#fff6df', size: 28 });
    box(ctx, '顧客企業', 1360, 380, 320, 200, { alpha: b2, fill: '#fff6df', size: 32 });
    flowDots(ctx, [[1200, 360], [720, 360]], t, 6, .5, '#46a0c4', 14, b2 * (1 - inh));
    flowDots(ctx, [[720, 410], [1200, 410]], t, 6, .5, '#ffc94d', 14, b2 * (1 - inh));
    bot(ctx, 1360, 640, .9 * inh, t, { glow: inh * b2 }); box(ctx, '自社データ', 1360, 540, 180, 44, { alpha: b2 * inh, size: 22, fill: '#bff3ea', lw: 2, shadow: false });
    txt(ctx, '内製化', 960, 200, { size: 52, font: DELA, color: '#2a2233', alpha: b2 * inh });
  }
  const b3 = beatA(E, 3, 4);
  if (b3 > 0) {
    const s = E.since(3), keep = ['権限', '責任', '暗黙知', '利害調整', '現場の作業'];
    keep.forEach((k, i) => box(ctx, k, 480 + i * 240, 260, 200, 70, { alpha: b3 * ease((s - i * .3) / .4), fill: '#ffc94d', size: 30 }));
    txt(ctx, '今は人が要る', 960, 160, { size: 44, color: '#2a2233', alpha: b3 });
    const x3 = ease((s - 2.5) / 1.2);
    txt(ctx, `一人の処理量 ×${(1 + 2 * x3).toFixed(1)}`, 960, 420, { size: 48, font: DELA, color: '#1f6f78', alpha: b3 });
    for (let i = 0; i < 6; i++) tiny(ctx, 700 + i * 100, 640, 3, '#46a0c4', t, i, false, false, b3 * (i < 6 - Math.round(4 * x3) ? 1 : .15));
    txt(ctx, '必要な人数は同じじゃない', 960, 720, { size: 32, color: '#d9443a', alpha: b3 * x3 });
  }
  const b4 = beatA(E, 4, null);
  if (b4 > 0) {
    const s = E.since(4);
    [['今年', 700], ['来年', 1220]].forEach(([n, x], k) => { card(ctx, x - 200, 220, 400, 440, { alpha: b4, fill: '#fff6df' }); txt(ctx, n, x, 260, { size: 40, font: DELA, color: '#2a2233', alpha: b4 }); });
    const chips = ['調査', '資料', '集計', '下書き', '会議メモ', '検証', '交渉', '判断'];
    chips.forEach((c, i) => { const toNext = i < 4 ? 0 : 1, ai = (i + Math.floor(s)) % 3 === 0; box(ctx, c, (toNext ? 1220 : 700) - 100 + (i % 2) * 200, 340 + Math.floor((i % 4) / 2) * 110 + (i % 4 > 1 ? 0 : 0), 170, 70, { alpha: b4, size: 26, fill: ai ? '#bff3ea' : '#fff4c8', lw: 3, shadow: false }); });
    txt(ctx, 'どこがギュられるか、観測し続ける', 960, 720, { size: 34, color: '#2a2233', alpha: b4 });
    // telescope
    ctx.save(); ctx.globalAlpha = b4; ctx.translate(960, 160); ctx.rotate(-.3 + Math.sin(t) * .05); ctx.fillStyle = '#5a4a44'; ctx.fillRect(-60, -16, 120, 32); ctx.fillRect(40, -22, 30, 44); ctx.restore();
  }
  sideCast(ctx, E, { left: ['garlic', 'chili'], right: ['daikon', 'shoga'] });
};

// s07b — AI joins the making of the next AI; humans still steer; walls move
SCENES.selfresearch = (ctx, E) => {
  const { u, t } = E;
  bgLab(ctx, '#0b1024', '#151d3c');
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0);
    // steam engine
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#5a4a44'; ctx.fillRect(360, 380, 260, 180); ctx.fillStyle = '#7a6a60'; ctx.fillRect(620, 440, 120, 40);
    const px = Math.sin(t * 4) * 30; ctx.fillStyle = '#b8a890'; ctx.fillRect(640 + px, 430, 40, 60); ctx.fillRect(560, 300, 40, 80); ctx.restore();
    for (let k = 0; k < 5; k++) { const f = fract(t * .4 + k / 5); ctx.save(); ctx.globalAlpha = b0 * (1 - f) * .6; ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.arc(580 + f * 40, 290 - f * 160, 16 + f * 30, 0, TAU); ctx.fill(); ctx.restore(); }
    box(ctx, '次の設計図？', 490, 640, 240, 60, { alpha: b0, size: 26, fill: '#3a3050', color: '#fff6df', stroke: '#8a7fb0' });
    stamp(ctx, '描かない', 490, 470, b0 * ease((s - 1.2) / .4), '#ff7a66', -.2, 40);
    // AI reading and drawing the next AI
    bot(ctx, 1160, 600, 1.5, t, { glow: b0 });
    ['コード', '論文', '実験結果'].forEach((d, i) => { const f = fract(t * .35 + i / 3); box(ctx, d, lerp(900, 1130, f), lerp(260 + i * 60, 470, f), 120, 44, { alpha: b0 * (1 - f), size: 20, lw: 2, shadow: false }); });
    const bp = ease((s - 1.5) / 3);
    card(ctx, 1300, 250, 300, 260, { fill: '#0f2a4a', stroke: '#6fc8ff', alpha: b0 });
    ctx.save(); ctx.globalAlpha = b0; ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 3; ctx.beginPath();
    for (let k = 0; k < 40 * bp; k++) { const x = 1330 + rnd(k * 3.1) * 240, y = 280 + rnd(k * 5.3) * 200; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
    txt(ctx, '次のAI', 1450, 480, { size: 30, color: '#bfe8ff', alpha: b0 });
  }
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const s = E.since(1);
    tiny(ctx, 520, 560, 3.4, '#ffc94d', t, 0, false, false, b1);
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * .45; bot(ctx, 520 + Math.cos(a) * 200, 520 + Math.sin(a) * 200 + 40, .55, t + k, { glow: 0 }); }
    // evolving candidates tree
    const gens = Math.min(6, 1 + Math.floor(s * 1.4));
    for (let g = 0; g < gens; g++) for (let k = 0; k < 5; k++) {
      const x = 900 + g * 130, y = 250 + k * 90, best = k === (g * 2 + 1) % 5;
      if (g > 0) { const pk = ((g - 1) * 2 + 1) % 5; polyline(ctx, [[x - 130, 250 + pk * 90], [x, y]], best ? '#46f0d0' : 'rgba(150,140,200,.35)', best ? 4 : 2, b1); }
      ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = best ? '#46f0d0' : '#5a5090'; ctx.beginPath(); ctx.arc(x, y, best ? 16 : 10, 0, TAU); ctx.fill(); ctx.restore();
    }
    txt(ctx, 'AIがアルゴリズムを探して改良する', 1160, 170, { size: 32, alpha: b1, stroke: 6 });
    badge(ctx, '実例：計算効率・チップ設計の改善', 1160, 720, b1, '#46f0d0');
  }
  const b2 = beatA(E, 2, 4);
  if (b2 > 0) {
    const cx = 960, cy = 480;
    ctx.save(); ctx.globalAlpha = b2; ctx.strokeStyle = 'rgba(255,201,77,.6)'; ctx.lineWidth = 12; ctx.setLineDash([26, 14]); ctx.lineDashOffset = -t * 60; ctx.beginPath(); ctx.arc(cx, cy, 170, 0, TAU); ctx.stroke(); ctx.restore();
    bot(ctx, cx, cy + 60, 1.2, t, { glow: b2 });
    // human with switch above
    tiny(ctx, cx, 230, 3.4, '#ffc94d', t, 0, false, false, b2);
    card(ctx, cx + 60, 170, 110, 60, { fill: '#d9443a', stroke: '#fff6df', r: 12, alpha: b2 }); txt(ctx, '停止', cx + 115, 200, { size: 28, alpha: b2 });
    ['方向を決める', '結果を判断する', '拡大か停止かを決める'].forEach((s, i) => { const a = b2 * ease((E.since(2) - .3 - i * .6) / .4); box(ctx, '✓ ' + s, 480, 330 + i * 110, 380, 70, { alpha: a, size: 28, fill: '#fff6df' }); });
    badge(ctx, 'いまは完全に自律した研究所ではない', cx + 420, 700, b2 * ease(E.p(3, .8)), '#ffc94d');
  }
  const b4 = beatA(E, 4, 5);
  if (b4 > 0) {
    const s = E.since(4), x0 = 480, x1 = 1440, y0 = 700, y1 = 200;
    ctx.save(); ctx.globalAlpha = b4; ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke(); ctx.restore();
    const prog = clamp(s / 4);
    const I = f => .08 + .8 * (Math.exp(2.6 * f) - 1) / (Math.exp(2.6) - 1), Rr = f => .04 + .7 * (Math.exp(3.2 * f) - 1) / (Math.exp(3.2) - 1);
    [[I, '#46d9c4', '性能 I'], [Rr, '#ffc94d', '研究に回せるAI R']].forEach(([f, c, n]) => { const pts = []; for (let k = 0; k <= 60 * prog; k++) pts.push([lerp(x0, x1, k / 60), lerp(y0, y1, f(k / 60))]); polyline(ctx, pts, c, 8, b4); const e = pts[pts.length - 1]; if (e) txt(ctx, n, e[0] + 12, e[1], { size: 28, color: c, align: 'left', alpha: b4, stroke: 5 }); });
    txt(ctx, '改善の仕組みそのものが改善される', 960, 150, { size: 40, font: DELA, stroke: 8, alpha: b4 });
  }
  const b5 = beatA(E, 5, null);
  if (b5 > 0) {
    const gates = ['研究者', 'GPU', '電力', '工場', '銅・水・土地'], s = E.since(5), pos = clamp(s / 5) * 4.6;
    gates.forEach((g, i) => {
      const x = 480 + i * 240, passed = pos > i + .5, next = !passed && pos > i - .5;
      ctx.save(); ctx.globalAlpha = b5; ctx.fillStyle = passed ? '#46d9c4' : next ? '#d9443a' : '#3a3462'; ctx.fillRect(x - 16, 300, 32, 360); ctx.fillRect(x - 80, 280, 160, 30); ctx.restore();
      txt(ctx, g, x, 250, { size: 28, alpha: b5, stroke: 5, color: next ? '#ff9a7a' : '#fff6df' });
    });
    ship(ctx, 360 + pos * 240, 560, .4, 0, t, { flame: .9, alpha: b5 });
    txt(ctx, '壁は消えずに、移っていく', 960, 740, { size: 36, color: '#ffc94d', alpha: b5, stroke: 6 });
  }
  sideCast(ctx, E, { left: ['shoga', 'daikon'], right: ['garlic', 'chili'] });
};

// s07c — capitalism as an AI-building machine
SCENES.capital = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#1a1430', '#2c2250']);
  const cx = 960, cy = 440, rx = 560, ry = 250;
  const st = ['資本', '企業', 'GPU', 'データセンター', '電力', '演算', '知能（AI）', '利益'];
  const cols = ['#ffc94d', '#f0d9b5', '#46d9c4', '#9cc8e6', '#ffe9a8', '#bfe8ff', '#46f0d0', '#ffc94d'];
  const sp = .05 + .05 * E.li + (E.li >= 2 ? .05 : 0);
  const ph = integ(x => .05 + .05 * (x > E.at(1) ? 1 : 0) + .1 * (x > E.at(2) ? 1 : 0), u);
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 30; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke(); ctx.restore();
  const tokens = 12 + Math.min(4, Math.max(0, E.li)) * 8;
  for (let k = 0; k < tokens; k++) {
    const f = fract(ph + k / tokens), a = -Math.PI / 2 + f * TAU, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, seg = Math.floor(f * 8) % 8;
    ctx.fillStyle = cols[seg];
    if (seg === 0 || seg === 7) coin(ctx, x, y, 12); else if (seg === 2) { ctx.fillRect(x - 11, y - 11, 22, 22); ctx.fillStyle = '#0c2c33'; ctx.fillRect(x - 5, y - 5, 10, 10); }
    else if (seg === 4) { ctx.beginPath(); ctx.moveTo(x - 4, y - 14); ctx.lineTo(x + 8, y - 2); ctx.lineTo(x, y); ctx.lineTo(x + 4, y + 14); ctx.lineTo(x - 8, y + 2); ctx.lineTo(x, y); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill(); }
  }
  st.forEach((s, i) => {
    const a = -Math.PI / 2 + (i + .5) / 8 * TAU, x = cx + Math.cos(a) * (rx + 10), y = cy + Math.sin(a) * (ry + 10);
    box(ctx, s, x, y, s.length > 5 ? 230 : 170, 60, { size: 26, fill: '#1d1830', color: cols[i], stroke: cols[i], lw: 3 });
  });
  // no emperor
  const cA = beatA(E, 0, 2);
  if (cA > 0) {
    ctx.save(); ctx.globalAlpha = cA; ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.moveTo(cx - 90, cy + 30); ctx.lineTo(cx - 90, cy - 40); ctx.lineTo(cx - 45, cy); ctx.lineTo(cx, cy - 60); ctx.lineTo(cx + 45, cy); ctx.lineTo(cx + 90, cy - 40); ctx.lineTo(cx + 90, cy + 30); ctx.fill(); ctx.restore();
    txt(ctx, '号令？', cx, cy + 80, { size: 36, alpha: cA, stroke: 6 });
    const x = ease(E.p(1, .5)); if (x > 0) { ctx.save(); ctx.globalAlpha = cA * x; ctx.strokeStyle = '#ff7a66'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(cx - 110, cy - 90); ctx.lineTo(cx + 110, cy + 60); ctx.moveTo(cx + 110, cy - 90); ctx.lineTo(cx - 110, cy + 60); ctx.stroke(); ctx.restore(); }
    txt(ctx, '誰も命令していない', cx, cy + 140, { size: 30, color: '#ff9a7a', alpha: cA * x });
  }
  const tA = beatA(E, 2, 4);
  if (tA > 0) {
    txt(ctx, '資本主義', cx, cy - 40, { size: 70, font: DELA, color: '#ffc94d', stroke: 12, alpha: tA * ease(E.p(3, .6) + (E.li === 2 ? .3 : 0)) });
    txt(ctx, '＝ AI建設装置', cx, cy + 50, { size: 56, font: DELA, stroke: 10, alpha: tA * ease(E.p(3, .6)) });
    txt(ctx, 'みんなの利益追求 → 資源が知能へ集まる', cx, cy - 10, { size: 32, stroke: 6, alpha: tA * (1 - ease(E.p(3, .5))) });
  }
  const pA = beatA(E, 4, null);
  if (pA > 0) {
    const s = E.since(4);
    card(ctx, cx - 220, cy - 110, 440, 220, { fill: '#0e0c1c', stroke: '#fff6df', alpha: pA });
    txt(ctx, '市場の値札', cx, cy - 75, { size: 26, alpha: pA });
    ['文章', 'コード', '助言', '土地'].forEach((n, i) => { const flip = ease((s - 1 - i * .5) / .5), sx = Math.abs(Math.cos(flip * Math.PI)); ctx.save(); ctx.globalAlpha = pA; ctx.translate(cx - 150 + i * 100, cy + 20); ctx.scale(Math.max(.05, sx), 1); card(ctx, -42, -40, 84, 80, { fill: flip > .5 ? (i === 3 ? '#ffc94d' : '#bff3ea') : '#fff6df', r: 8, lw: 2, shadow: false }); txt(ctx, flip > .5 ? (i === 3 ? '↑' : '↓') : '¥', 0, -10, { size: 30, color: '#2a2233' }); txt(ctx, n, 0, 24, { size: 18, color: '#2a2233' }); ctx.restore(); });
    arrow(ctx, cx + rx * .55, cy + ry * .75, cx + 230, cy + 40, { color: '#46f0d0', lw: 6, alpha: pA });
    txt(ctx, '市場が作ったAIが、値段の付け方を変える', cx, 110 + 40, { size: 34, stroke: 6, alpha: pA });
  }
  actor(ctx, 'chili', 120, FLOOR, 180, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 16 : 0 }); actor(ctx, 'daikon', 290, FLOOR, 180);
  actor(ctx, 'garlic', 1640, FLOOR, 170, { flip: true }); actor(ctx, 'shoga', 1800, FLOOR, 180, { flip: true });
};

// s07d — science speeds up; aging split into mechanisms; escape velocity is a hypothesis
SCENES.science = (ctx, E) => {
  const { u, t } = E;
  bgLab(ctx, '#0c1a24', '#123040', 'rgba(120,255,200,.05)');
  const b0 = beatA(E, 0, 2);
  if (b0 > 0) {
    const s = E.since(0), par = ease(E.p(1, 1.2));
    const wheel = (cx, cy, R, sc, a) => {
      const st = ['仮説', 'コード', '実験', '解析', '次の実験'];
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(120,255,200,.5)'; ctx.lineWidth = 6 * sc; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.restore();
      const ph = t * (.4 + par * .6);
      st.forEach((n, i) => { const an = -Math.PI / 2 + i / 5 * TAU; box(ctx, n, cx + Math.cos(an) * R, cy + Math.sin(an) * R, 150 * sc, 52 * sc, { size: 24 * sc, alpha: a, fill: '#0f3d45', color: '#bff3ea', stroke: '#46d9c4', lw: 3 * sc, shadow: false }); });
      for (let k = 0; k < 3; k++) { const an = -Math.PI / 2 + ph * TAU / 3 + k * TAU / 3; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * R, cy + Math.sin(an) * R, 10 * sc, 0, TAU); ctx.fill(); ctx.restore(); }
    };
    wheel(lerp(960, 560, par), 440, lerp(230, 140, par), lerp(1, .7, par), b0);
    for (let k = 0; k < 5; k++) wheel(900 + (k % 3) * 300, 300 + Math.floor(k / 3) * 300, 100, .5, b0 * par * ease((E.since(1) - k * .3) / .5));
    if (par > 0) { const n = Math.floor(10 * Math.pow(1.9, E.since(1) * 1.6)); txt(ctx, `試せる仮説　${Math.min(n, 99999).toLocaleString('en-US')}件/年`, 1200, 740 - 40, { size: 32, color: '#ffc94d', alpha: b0 * par, stroke: 6 }); txt(ctx, '眠らない・並列で回す', 1200, 150, { size: 32, alpha: b0 * par, stroke: 6 }); }
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2), hm = ['ゲノム不安定性', 'テロメア短縮', 'エピゲノム変化', 'タンパク質の乱れ', '自食作用の低下', '栄養感知の乱れ', 'ミトコンドリア', '細胞老化', '幹細胞の枯渇', '細胞間の伝達', '慢性炎症', '腸内細菌の乱れ'];
    ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#f0d9b5'; ctx.beginPath(); ctx.arc(960, 250, 60, 0, TAU); ctx.fill(); rr(ctx, 890, 320, 140, 300, 50); ctx.fill(); ctx.restore();
    hm.forEach((n, i) => { const a = -Math.PI / 2 + i / 12 * TAU, f = eOut(clamp((s - .3 - i * .15) / .8)), R = lerp(40, 330, f); box(ctx, n, 960 + Math.cos(a) * R * 1.45, 440 + Math.sin(a) * R, 200, 46, { size: 20, alpha: b2 * f, fill: '#fff6df', lw: 2, shadow: false }); });
    badge(ctx, '老化を仕組みに分けて研究する（12の特徴）', 960, 150 - 30, b2, '#9fe3b0');
  }
  const b3 = beatA(E, 3, 6);
  if (b3 > 0) {
    const s = E.since(3), x0 = 460, x1 = 1440, y0 = 700, y1 = 220, prog = clamp(s / 4);
    ctx.save(); ctx.globalAlpha = b3; ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke(); ctx.restore();
    txt(ctx, '残りの余命', x0 - 10, y1 - 30, { size: 26, alpha: b3, align: 'left' }); txt(ctx, '暦の年齢 →', x1 - 60, y0 + 34, { size: 26, alpha: b3 });
    const norm = []; const lev = [];
    const nY = f => lerp(y1 + 40, y0 - 10, f), slope = (y0 - 10) - (y1 + 40);
    for (let k = 0; k <= 120 * prog; k++) {
      const f = k / 120; norm.push([lerp(x0, x1, f), nY(f)]);
      if (f <= .3) lev.push([lerp(x0, x1, f), nY(f)]);
      else { const q = (f - .3) / .07, st = Math.floor(q), fr = q - st; lev.push([lerp(x0, x1, f), nY(.3) + slope * .07 * fr - slope * .012 * st]); }
    }
    polyline(ctx, norm, '#8a8aa0', 6, b3, [12, 10]); polyline(ctx, lev, '#46f0d0', 8, b3);
    txt(ctx, 'いまの見通し', x1 - 120, y0 - 50, { size: 24, color: '#8a8aa0', alpha: b3 * prog });
    txt(ctx, '1年生きるごとに余命が1年以上のびると…', 960, 150, { size: 32, alpha: b3, stroke: 6 });
    badge(ctx, '寿命脱出速度（仮説・未実現）', 1180, 360, b3 * prog, '#46f0d0');
    stamp(ctx, 'まだ仮説', 820, 420, b3 * ease(E.p(5, .5) + (E.li >= 4 ? ease(E.p(4, 1)) * .0 : 0)), '#ff7a66');
    const tk = ease(E.p(5, 1.2));
    if (tk > 0) { box(ctx, '健康 ＝ 未来への切符', 960, 560, 460, 90, { alpha: b3 * tk, fill: '#ffc94d', size: 36 }); }
  }
  sideCast(ctx, E, { left: ['garlic', 'shoga'], right: ['daikon', 'chili'] });
};

// s08b — ultra-deflation: scarcity moves; money allocates what's scarce; the valley of transition
SCENES.ultradeflation = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#fff4dc', '#f2dcae']);
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0);
    ['文章', 'コード', '法律相談', '設計'].forEach((n, i) => { const fall = ease((s - .5 - i * .4) / 1.2), y = 320 + fall * 220; box(ctx, `${n}\n¥${Math.max(1, Math.round(10000 * Math.pow(.02, fall)))}`, 520 + i * 290, y, 220, 120, { alpha: b0, size: 30 }); arrow(ctx, 520 + i * 290, y + 80, 520 + i * 290, y + 140, { color: '#1f8f7f', lw: 6, alpha: b0 * fall }); });
    txt(ctx, 'ウルトラデフレ', 960, 170, { size: 84, font: DELA, color: '#d9443a', stroke: 12, strokeColor: '#fff4dc', alpha: b0 });
  }
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const st = ['人の一時間', '電力', 'GPU', '土地', '銅', 'ロボット'], s = E.since(1), pos = clamp(s / 4.5) * 5;
    st.forEach((n, i) => { const x = 460 + i * 200; box(ctx, n, x, 520, 170, 70, { alpha: b1, size: 26, fill: pos > i - .5 && pos < i + .5 ? '#ffc94d' : '#fff6df' }); if (i) arrow(ctx, x - 115, 520, x - 90, 520, { color: '#5a4a44', lw: 4, head: 12, alpha: b1 }); });
    const gi = Math.min(5, Math.floor(pos)), f = pos - gi, gx = lerp(460 + gi * 200, 460 + Math.min(5, gi + 1) * 200, ease(f)), gy = 400 - Math.sin(f * Math.PI) * 80;
    glow(ctx, gx, gy, 70, 'rgba(120,200,255,.8)', b1); ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#6fc8ff'; ctx.beginPath(); ctx.moveTo(gx, gy - 30); ctx.lineTo(gx + 24, gy); ctx.lineTo(gx, gy + 30); ctx.lineTo(gx - 24, gy); ctx.fill(); ctx.restore();
    txt(ctx, '希少性は消えずに、移る', 960, 200, { size: 56, font: DELA, color: '#2a2233', alpha: b1 });
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2);
    for (let k = 0; k < 18; k++) { const f = fract(t * .2 + k / 18); ctx.save(); ctx.globalAlpha = b2 * (1 - f) * .7; ctx.strokeStyle = '#6fa8dc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(520 + rnd(k) * 260, 700 - f * 480, 8 + rnd(k * 3) * 14, 0, TAU); ctx.stroke(); ctx.restore(); }
    box(ctx, '空気　0円', 650, 250, 260, 80, { alpha: b2, size: 36, fill: '#bfe8ff' });
    for (let i = 0; i < 8; i++) for (let j2 = 0; j2 < 5; j2++) { ctx.fillStyle = (i === 4 && j2 === 2) ? '#ffc94d' : '#c9b48a'; ctx.globalAlpha = b2; ctx.fillRect(1080 + i * 50, 420 + j2 * 50, 44, 44); } ctx.globalAlpha = 1;
    box(ctx, '都心の土地\nとても高い', 1280, 290, 300, 110, { alpha: b2, size: 32, fill: '#ffc94d' });
    txt(ctx, 'お金 ＝ 足りないものを分ける道具', 960, 170, { size: 44, font: DELA, color: '#2a2233', alpha: b2 });
  }
  const b3 = beatA(E, 3, 4);
  if (b3 > 0) {
    const s = E.since(3);
    ['文章・画像', 'コード・助言', '研究・設計', '製造'].forEach((n, i) => { const d = ease((s - .3 - i * .8) / .6); box(ctx, n, 500 + i * 310, 440, 260, 120, { alpha: b3, size: 32, fill: d > .5 ? '#d8d0c0' : '#fff6df', color: d > .5 ? '#7a6a60' : '#2a2233' }); txt(ctx, '値段の意味↓', 500 + i * 310, 540, { size: 24, color: '#1f8f7f', alpha: b3 * d }); });
    arrow(ctx, 420, 640, 1500, 640, { color: '#5a4a44', lw: 6, alpha: b3 }); txt(ctx, '手前から順に', 960, 690, { size: 28, color: '#5a4a44', alpha: b3 });
  }
  const b4 = beatA(E, 4, null);
  if (b4 > 0) {
    const s = E.since(4), x0 = 440, x1 = 1480, y0 = 640, y1 = 180, pr = clamp(s / 3);
    const price = f => .7 - .45 * ease((f - .35) / .6), inc = f => .6 - .4 * ease((f - .1) / .35) + .3 * ease((f - .75) / .25), rent = () => .72;
    [[price, '#1f8f9f', '財の値段'], [inc, '#c98a20', '所得'], [rent, '#d9443a', '家賃・社会保障']].forEach(([f, c, n], k) => { const pts = []; for (let i = 0; i <= 60 * pr; i++) pts.push([lerp(x0, x1, i / 60), lerp(y0, y1, f(i / 60))]); polyline(ctx, pts, c, 7, b4, k === 2 ? [14, 10] : null); const e = pts[pts.length - 1]; if (e) txt(ctx, n, e[0] + 10, e[1] - 22, { size: 26, color: c, align: 'left', alpha: b4 }); });
    const v = ease((s - 3) / 1); ctx.save(); ctx.globalAlpha = b4 * v * .25; ctx.fillStyle = '#d9443a'; ctx.fillRect(lerp(x0, x1, .15), y1, lerp(x0, x1, .75) - lerp(x0, x1, .15), y0 - y1); ctx.restore();
    txt(ctx, '過渡期の谷', lerp(x0, x1, .45), 250, { size: 44, font: DELA, color: '#d9443a', alpha: b4 * v, stroke: 8, strokeColor: '#fff4dc' });
    // rope bridge
    const bx0 = lerp(x0, x1, .15), bx1 = lerp(x0, x1, .75); const bp = []; for (let k = 0; k <= 20; k++) { const f = k / 20; bp.push([lerp(bx0, bx1, f), 720 + Math.sin(f * Math.PI) * 40]); }
    polyline(ctx, bp, '#7a5230', 6, b4 * ease(E.p(5, .6)));
    if (E.li >= 5) { const f = clamp(E.since(5) / 4), [px, py] = polyAt(bp, f); tiny(ctx, px, py, 3, '#ffc94d', t, 0, true, false, b4); box(ctx, '資産と力', px, py - 130, 150, 44, { size: 22, alpha: b4, lw: 2, shadow: false }); }
  }
  sideCast(ctx, E, { left: ['chili', 'garlic'], right: ['shoga', 'daikon'] });
};

// s08c — the シン efficient market; trust shifts to machines; assets
SCENES.market = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#0d1a1a', '#14302c']);
  const b0 = beatA(E, 0, 2);
  if (b0 > 0) {
    const s = E.since(0), gap = 1 - ease(s / Math.max(3, E.end(1)));
    for (let i = 0; i < 4; i++) { tiny(ctx, 480 + i * 90, 640, 3, '#ffc94d', t, i, false, false, b0); box(ctx, i % 2 ? '売り！' : '買い！', 480 + i * 90, 470 + Math.sin(t * 3 + i) * 6, 90, 40, { size: 20, alpha: b0, lw: 2, shadow: false }); }
    ctx.save(); ctx.globalAlpha = b0; ctx.strokeStyle = '#46f0d0'; ctx.lineWidth = 3; ctx.beginPath(); for (let k = 0; k < 200; k++) { const x = 1000 + k * 2.5, y = 420 + Math.sin(k * .5 + t * 30) * 30 * rnd(k + Math.floor(t * 8)); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
    bot(ctx, 1250, 640, 1.1, t, { glow: b0 });
    txt(ctx, '何百倍の速さ・公開情報をぜんぶ読む', 1250, 280, { size: 26, alpha: b0, stroke: 5 });
    card(ctx, 760 - 150 * gap, 170, 400 * 0 + 300 * gap + 10, 36, { fill: '#ff7a66', stroke: '#fff6df', lw: 2, r: 18, shadow: false, alpha: b0 });
    txt(ctx, '情報の差', 760, 140, { size: 26, alpha: b0 });
    txt(ctx, 'シン効率的市場', 960, 740 - 0, { size: 60, font: DELA, color: '#46f0d0', stroke: 10, alpha: b0 * ease(E.p(1, .6)) });
  }
  const b2 = beatA(E, 2, 4);
  if (b2 > 0) {
    const s = E.since(2), pick = ease((s - 1.5) / 1);
    const onigiri = (x, y, neat, a) => { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fbfbf2'; ctx.beginPath(); ctx.moveTo(x, y - 70 + (neat ? 0 : 8)); ctx.lineTo(x + 75 + (neat ? 0 : -6), y + 55); ctx.lineTo(x - 75 + (neat ? 0 : 10), y + 55); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1f3a2a'; ctx.fillRect(x - 35, y + 10, 70, 45); if (neat) { ctx.strokeStyle = 'rgba(160,200,255,.9)'; ctx.lineWidth = 4; ctx.strokeRect(x - 88, y - 82, 176, 150); } ctx.restore(); };
    onigiri(640, 400, false, b2); onigiri(1060, 400, true, b2);
    txt(ctx, '手作り', 640, 530, { size: 28, alpha: b2 }); txt(ctx, '工場のコンビニおにぎり', 1060, 530, { size: 28, alpha: b2 });
    const hx = lerp(850, 1060, pick), hy = lerp(620, 470, pick); ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#f5d6a8'; ctx.beginPath(); ctx.arc(hx, hy, 26, 0, TAU); ctx.fill(); ctx.restore();
    txt(ctx, '人の判断より、機械の判断を信頼する', 850, 190, { size: 38, stroke: 7, alpha: b2 });
    const lA = ease(E.p(3, .6));
    if (lA > 0) { ctx.save(); ctx.globalAlpha = b2 * lA; ctx.translate(1380, 640); ctx.rotate(-.5 + Math.sin(t * 5) * .3); ctx.fillStyle = '#7a5230'; ctx.fillRect(-6, -60, 12, 80); ctx.fillStyle = '#8a8aa0'; ctx.fillRect(-30, -76, 60, 26); ctx.restore(); txt(ctx, 'ラッダイト運動', 1380, 560, { size: 26, alpha: b2 * lA, stroke: 5 }); for (let k = 0; k < 4; k++) tiny(ctx, lerp(500, 700, fract(t * .15 + k / 4)), 700, 2.4, '#46a0c4', t, k, true, false, b2 * lA); box(ctx, '自動運転バス', 780, 680, 180, 60, { size: 22, alpha: b2 * lA, fill: '#bff3ea' }); }
  }
  const b4 = beatA(E, 4, null);
  if (b4 > 0) {
    const s = E.since(4), keepA = ease(E.p(5, .8));
    [['株', .35], ['仮想通貨', .3], ['不動産', .5], ['知能', .2], ['土地', 1], ['設備', 1]].forEach(([n, lo], i) => {
      const d = ease((s - .3 - i * .2) / 1.5), v = i >= 4 ? lerp(.85, .95, keepA) : lerp(.85, lo, d), h = 380 * v, x = 500 + i * 180;
      card(ctx, x - 55, 660 - h, 110, h, { fill: i >= 4 ? '#ffc94d' : '#46a0c4', stroke: '#0c1a1a', r: 8, lw: 3, shadow: false, alpha: b4 * (i >= 4 ? .4 + .6 * keepA : 1) });
      txt(ctx, n, x, 690, { size: 24, alpha: b4 }); if (i < 4) txt(ctx, '？', x, 640 - h, { size: 30, color: '#ff9a7a', alpha: b4 * d });
    });
    txt(ctx, keepA > .5 ? '変わるのは値段の付き方' : '全部、意味がなくなる？', 960, 180, { size: 48, font: DELA, stroke: 9, alpha: b4 });
    if (keepA < .5) { ctx.save(); ctx.globalAlpha = b4; ctx.fillStyle = '#e8dcc4'; rr(ctx, 1380, 380, 160, 60, 20); ctx.fill(); ctx.restore(); txt(ctx, '寝そべり？', 1460, 350, { size: 24, alpha: b4 }); }
  }
  sideCast(ctx, E, { left: ['garlic', 'shoga'], right: ['chili', 'daikon'] });
};

// s08d — life without money? drones, printers, waste & gratitude, satisfaction ceiling, "all solved" dream
SCENES.moneyless = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#bfe6f5', '#eaf6e0']);
  const b0 = beatA(E, 0, 2);
  if (b0 > 0) {
    const s = E.since(0);
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#9ccf7a'; ctx.fillRect(400, 200, 1120, 540); ctx.fillStyle = '#c9c0b0'; for (let k = 0; k < 4; k++) { ctx.fillRect(400, 260 + k * 140, 1120, 26); ctx.fillRect(460 + k * 300, 200, 26, 540); } ctx.restore();
    for (let k = 0; k < 10; k++) { ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = ['#f0d9b5', '#e7c6a0', '#d9e3ea'][k % 3]; ctx.fillRect(520 + (k % 5) * 200, 300 + Math.floor(k / 5) * 250, 70, 60); ctx.fillStyle = '#b5793a'; ctx.beginPath(); ctx.moveTo(515 + (k % 5) * 200, 300 + Math.floor(k / 5) * 250); ctx.lineTo(555 + (k % 5) * 200, 270 + Math.floor(k / 5) * 250); ctx.lineTo(595 + (k % 5) * 200, 300 + Math.floor(k / 5) * 250); ctx.fill(); ctx.restore(); }
    const car = fract(t * .08), cxp = car < .5 ? lerp(420, 1500, car * 2) : lerp(1500, 420, (car - .5) * 2); ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#46a0c4'; ctx.fillRect(cxp - 30, (car < .5 ? 262 : 542), 60, 22); ctx.restore();
    for (let k = 0; k < 4; k++) { const f = fract(t * .2 + k / 4), x = lerp(1450, 520 + k * 250, f), y = lerp(180, 300 + (k % 2) * 250, f) - Math.sin(f * Math.PI) * 120; ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#2a2233'; ctx.fillRect(x - 22, y - 4, 44, 6); ctx.fillStyle = '#c98a4a'; ctx.fillRect(x - 10, y + 2, 20, 16); ctx.restore(); }
    for (let k = 0; k < 6; k++) txt(ctx, '¥', 450 + k * 200, 190 - ease((s - k * .3) / 1) * 60, { size: 44, color: '#d9443a', alpha: b0 * (1 - ease((s - k * .3) / 1)) });
    bot(ctx, 1500, 720, .9, t, { label: '執事', glow: b0 });
    const pA = ease(E.p(1, .6)) * b0;
    if (pA > 0) {
      card(ctx, 1560, 180, 300, 260, { fill: '#fff6df', alpha: pA }); const lay = ease(E.since(1) / 3);
      ctx.save(); ctx.globalAlpha = pA; ctx.fillStyle = '#b0584a'; ctx.fillRect(1620, 400 - 90 * lay, 180, 90 * lay); ctx.fillStyle = '#5a4a44'; ctx.fillRect(1600 + fract(t * 2) * 200, 220, 20, 30); ctx.restore();
      txt(ctx, '3Dプリント培養肉', 1710, 470, { size: 24, color: '#2a2233', alpha: pA });
    }
    txt(ctx, 'お金がなくても、快適？', 960, 150, { size: 48, font: DELA, color: '#2a2233', alpha: b0 });
  }
  const b2 = beatA(E, 2, 4);
  if (b2 > 0) {
    const s = E.since(2), back = ease(E.p(3, 1.4));
    const n = Math.round(lerp(1, 14, ease(s / 2)) * (1 - back)) + 1;
    for (let k = 0; k < n; k++) { ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = k % 2 ? '#ffe27a' : '#d9a86a'; ctx.fillRect(560 + Math.sin(t * 2 + k) * (k * 1.5), 640 - k * 34, k % 2 ? 90 : 120, 30); ctx.restore(); }
    tiny(ctx, 700, 700, 3, '#46a0c4', t, 0, false, false, b2);
    if (back > 0) {
      ctx.save(); ctx.globalAlpha = b2 * back; ctx.fillStyle = '#8a5a30'; ctx.fillRect(900, 560, 560, 26); ctx.restore();
      [980, 1120, 1260, 1380].forEach((x, i) => { ctx.save(); ctx.globalAlpha = b2 * back; ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.arc(x, 550, 40, Math.PI, 0); ctx.fill(); ctx.restore(); for (let k = 0; k < 2; k++) { const f = fract(t * .5 + k / 2 + i * .2); ctx.save(); ctx.globalAlpha = b2 * back * (1 - f) * .6; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 8 + k * 16, 500 - f * 60); ctx.quadraticCurveTo(x + 10, 480 - f * 60, x - 8 + k * 16, 460 - f * 60); ctx.stroke(); ctx.restore(); } });
      txt(ctx, 'いただきます', 1060, 400, { size: 48, font: DELA, color: '#2a2233', alpha: b2 * back });
      txt(ctx, 'ごちそうさま', 1260, 470, { size: 36, color: '#5a4a44', alpha: b2 * back * ease(E.p(3, 2.5)) });
    }
    txt(ctx, back > .5 ? '食べ物を粗末にしない文化は残る' : '食べきれないほど持ち帰る？', 960, 170, { size: 42, color: '#2a2233', alpha: b2 });
  }
  const b4 = beatA(E, 4, 5);
  if (b4 > 0) {
    const s = E.since(4), x0 = 480, x1 = 1300, y0 = 660, y1 = 220, pr = clamp(s / 2.5);
    ctx.save(); ctx.globalAlpha = b4; ctx.strokeStyle = '#2a2233'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke(); ctx.restore();
    const pts = []; for (let k = 0; k <= 60 * pr; k++) { const f = k / 60; pts.push([lerp(x0, x1, f), lerp(y0, y1 + 60, 1 - Math.exp(-f * 4))]); } polyline(ctx, pts, '#d9443a', 8, b4);
    ctx.save(); ctx.globalAlpha = b4; ctx.setLineDash([12, 10]); ctx.strokeStyle = '#d9443a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y1 + 50); ctx.lineTo(x1, y1 + 50); ctx.stroke(); ctx.restore();
    txt(ctx, '脳汁限界', x1 - 120, y1 + 20, { size: 34, font: DELA, color: '#d9443a', alpha: b4 * pr });
    txt(ctx, '満足', x0 - 10, y1 - 30, { size: 26, color: '#2a2233', alpha: b4 }); txt(ctx, '刺激・消費 →', x1 - 60, y0 + 34, { size: 24, color: '#2a2233', alpha: b4 });
    const pen = ease((s - 2.5) / 1);
    ctx.save(); ctx.globalAlpha = b4 * pen; ctx.strokeStyle = '#b5793a'; ctx.lineWidth = 5; ctx.strokeRect(1350, 470, 220, 190); for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(1350 + k * 44, 470); ctx.lineTo(1350 + k * 44, 660); ctx.stroke(); } ctx.restore();
    for (let k = 0; k < 3; k++) tiny(ctx, 1400 + k * 60, 650, 2.4, '#9fe3b0', t, k, false, false, b4 * pen);
    txt(ctx, '心地よく飼いならされる', 1460, 440, { size: 24, color: '#2a2233', alpha: b4 * pen });
  }
  const b5 = beatA(E, 5, null);
  if (b5 > 0) {
    const s = E.since(5), probs = ['税金', '介護', '住宅', '少子化', '地方', '格差', '病気', '飢餓', '不登校', '人手不足', '円安', '一極集中'];
    const doubt = ease(E.p(6, .8));
    probs.forEach((p, i) => { const x = 520 + (i % 6) * 176, y = 330 + Math.floor(i / 6) * 150, st = ease((s - .5 - i * .2) / .4); box(ctx, p, x, y, 150, 90, { alpha: b5, size: 28, fill: st > .5 ? '#bff3ea' : '#fff6df' }); if (st > 0) stamp(ctx, doubt > .5 ? '？' : '解決', x, y, b5 * st, doubt > .5 ? '#d9443a' : '#1f8f7f', -.2, 26); });
    txt(ctx, 'ロボット ＋ 無限のエネルギーで、全部解決！？', 960, 170, { size: 40, font: DELA, color: '#2a2233', alpha: b5 });
    badge(ctx, '加速派の夢／確定ではない：分け方と制度しだい', 960, 640, b5 * doubt, '#d9443a');
  }
  sideCast(ctx, E, { left: ['chili', 'shoga'], right: ['garlic', 'daikon'] });
};

// s09b — from money to evaluation (reputation), and its own inefficiency
SCENES.evaluation = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#2a1c48', '#5a3a70']);
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0);
    for (let k = 0; k < 12; k++) {
      const m = ease((s - .5 - k * .15) / .8), x = 520 + (k % 6) * 176, y = 340 + Math.floor(k / 6) * 200;
      coin(ctx, x, y, 40, b0 * (1 - m));
      if (m > 0) { ctx.save(); ctx.globalAlpha = b0 * m; ctx.translate(x, y); ctx.rotate(t * .5); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 18 : 42, a = i / 10 * TAU - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); ctx.restore(); }
    }
    txt(ctx, 'お金 → 評価', 960, 170, { size: 72, font: DELA, color: '#ffc94d', stroke: 12, alpha: b0 });
  }
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const s = E.since(1), ring = ease((s - 2) / 1.5);
    for (let k = 0; k < 6; k++) {
      const rankX = 480 + (5 - k) * 0, rankY = 260 + k * 80, w = 500 - k * 60;
      const a = -Math.PI / 2 + k / 6 * TAU, rx = 1260 + Math.cos(a) * 200, ry = 460 + Math.sin(a) * 200;
      const x = lerp(rankX + w / 2, rx, ring), y = lerp(rankY, ry, ring);
      box(ctx, ring > .5 ? ['信頼', '貢献', '感謝', '推し', '協力', '評判'][k] : `${k + 1}位`, x, y, lerp(w, 140, ring), 60, { alpha: b1, size: 26, fill: '#fff6df' });
    }
    if (ring > 0) { ctx.save(); ctx.globalAlpha = b1 * ring; ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(1260, 460, 200, 0, TAU); ctx.stroke(); ctx.restore(); }
    txt(ctx, `いいね ${Math.floor(1000 + s * 800)}　フォロワー ${Math.floor(300 + s * 250)}`, 960, 170, { size: 36, color: '#ffe27a', alpha: b1, stroke: 6 });
    txt(ctx, '出し抜く競争 → 信頼と貢献の輪', 960, 760 - 30, { size: 34, alpha: b1, stroke: 6 });
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2);
    for (let k = 0; k < 22; k++) { const a = k / 22 * TAU, R = 330 + (k % 3) * 40; eye(ctx, 960 + Math.cos(a) * R * 1.5, 440 + Math.sin(a) * R * .8, 1, t + k, b2); }
    const likes = Math.max(40, Math.floor(1200 - s * 150));
    txt(ctx, `♥ ${likes}`, 960, 400, { size: 64, font: DELA, color: '#ff7a9a', alpha: b2, stroke: 10 });
    const hs = .6 + .4 * likes / 1200; ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#ff7a9a'; ctx.translate(960, 520); ctx.scale(hs, hs); ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-60, -10, -30, -60, 0, -25); ctx.bezierCurveTo(30, -60, 60, -10, 0, 30); ctx.fill(); ctx.restore();
  }
  const b3 = beatA(E, 3, null);
  if (b3 > 0) {
    const s = E.since(3), dim = ease(s / 2);
    for (let k = 0; k < 22; k++) { const a = k / 22 * TAU, R = 330 + (k % 3) * 40; eye(ctx, 960 + Math.cos(a) * R * 1.5, 440 + Math.sin(a) * R * .8, 1, t + k, b3 * (1 - dim) * .8); }
    txt(ctx, '他人の目を気にし続ける非効率', 960, 330, { size: 44, font: DELA, stroke: 9, alpha: b3 });
    arrow(ctx, 760, 520, 1160, 520, { color: '#ffc94d', lw: 8, alpha: b3 * dim }); txt(ctx, '通過点', 960, 590, { size: 40, color: '#ffc94d', alpha: b3 * dim });
  }
  sideCast(ctx, E, { left: ['shoga', 'chili'], right: ['daikon', 'garlic'] });
};

// s09c — subjective happiness → 脳汁至上主義 → the capsule city of scores
SCENES.happiness = (ctx, E) => {
  const { u, t } = E;
  const cold = beatA(E, 3, 5);
  vgrad(ctx, [cold > .5 ? '#10182c' : '#281a44', cold > .5 ? '#1c2a44' : '#4a2a5c']);
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    for (let k = 0; k < 7; k++) { const x = 480 + k * 160, y = 440 + Math.sin(t + k) * 20; glow(ctx, x, y, 90, 'rgba(255,200,240,.4)', b0); ctx.save(); ctx.globalAlpha = b0; ctx.strokeStyle = '#ffd0f0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 64, 0, TAU); ctx.stroke(); ctx.restore(); tiny(ctx, x, y + 40, 2.2, ['#ff7a66', '#46a0c4', '#ffc94d', '#9fe3b0'][k % 4], t, k, false, false, b0); }
    txt(ctx, '一人分に仕立てられた世界', 960, 190, { size: 48, font: DELA, stroke: 9, alpha: b0 });
    txt(ctx, '比べる必要がない → 主観的幸福', 960, 660, { size: 32, color: '#ffd0f0', alpha: b0, stroke: 6 });
  }
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const s = E.since(1);
    box(ctx, '相対的な幸福\n（比べて上に立つ）', 640, 220, 380, 110, { alpha: b1, size: 28 });
    for (let k = 0; k < 5; k++) { const h = 60 + k * 50; card(ctx, 480 + k * 70, 640 - h, 50, h, { fill: k === 4 ? '#ffc94d' : '#8a8aa0', lw: 0, shadow: false, alpha: b1 }); }
    tiny(ctx, 800, 640 - 260, 2.6, '#ffc94d', t, 0, false, false, b1);
    box(ctx, '満足そのもの\n（おいしい・気持ちいい）', 1280, 220, 400, 110, { alpha: b1, size: 28 });
    const fill = .5 + .45 * Math.sin(t * .8) * 0 + .4 * ease(s / 2);
    ctx.save(); ctx.globalAlpha = b1; ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(1180, 400); ctx.lineTo(1200, 640); ctx.lineTo(1360, 640); ctx.lineTo(1380, 400); ctx.stroke(); ctx.fillStyle = '#ff9ac4'; ctx.fillRect(1196, 640 - 230 * fill, 168, 230 * fill); ctx.restore();
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2);
    for (let k = 0; k < 24; k++) { const a = t * .6 + k / 24 * TAU, R = 200 + (k % 3) * 80; const x = 960 + Math.cos(a) * R * 1.6, y = 440 + Math.sin(a) * R * .7; txt(ctx, ['♪', '▶', '★', '♥'][k % 4], x, y, { size: 36, color: ['#ffd0f0', '#bfe8ff', '#ffe27a', '#ff7a9a'][k % 4], alpha: b2 }); }
    ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#2a2233'; rr(ctx, 860, 400, 200, 80, 30); ctx.fill(); ctx.fillStyle = '#46f0d0'; ctx.fillRect(880, 420, 70, 40); ctx.fillRect(970, 420, 70, 40); ctx.restore();
    txt(ctx, '脳汁至上主義', 960, 190, { size: 72, font: DELA, color: '#ff9ac4', stroke: 12, alpha: b2 });
    meter(ctx, 760, 620, 400, '脳の報酬メーター', .5 + .5 * ease(s / 3), '#ff9ac4', b2);
  }
  if (cold > 0) {
    const s = E.since(3);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
      const x = 440 + c * 130, y = 250 + r * 120, a = cold * ease((s - (r * 9 + c) * .03) / .5);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#1d2a48'; rr(ctx, x - 50, y - 50, 100, 100, 40); ctx.fill(); ctx.strokeStyle = '#6fc8ff'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffd0f0'; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a2233'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 2, 9, .2, Math.PI - .2); ctx.stroke(); ctx.restore();
    }
    const tot = ease(s / 3);
    card(ctx, 1560, 200, 70, 440, { fill: '#15122a', stroke: '#6fc8ff', lw: 3, shadow: false, alpha: cold }); ctx.save(); ctx.globalAlpha = cold; ctx.fillStyle = '#ff9ac4'; ctx.fillRect(1570, 630 - 420 * tot, 50, 420 * tot); ctx.restore();
    txt(ctx, '幸福スコア総量', 1595, 170, { size: 22, alpha: cold });
    txt(ctx, `${(tot * 100).toFixed(0)}%`, 1595, 670, { size: 28, color: '#ff9ac4', alpha: cold });
    txt(ctx, 'カプセルの街', 960, 150, { size: 50, font: DELA, color: '#bfe8ff', stroke: 9, alpha: cold });
    if (E.li >= 4) txt(ctx, '幸せって、このメーターの数字だけ？', 960, 760 - 20, { size: 36, color: '#fff6df', alpha: cold * ease(E.p(4, .8)), stroke: 7 });
  }
  const b5 = beatA(E, 5, null);
  if (b5 > 0) {
    const s = E.since(5);
    card(ctx, 540, 250, 380, 380, { fill: '#15122a', stroke: '#6fc8ff', alpha: b5 }); txt(ctx, 'メーター', 730, 290, { size: 26, alpha: b5, color: '#bfe8ff' });
    const nd = Math.sin(t * 1.2) * .6; ctx.save(); ctx.globalAlpha = b5; ctx.strokeStyle = '#ff9ac4'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(730, 520); ctx.lineTo(730 + Math.sin(nd) * 150, 520 - Math.cos(nd) * 150); ctx.stroke(); ctx.restore();
    const g = ease((s - 1) / 1.5);
    ctx.save(); ctx.globalAlpha = b5 * g; ctx.strokeStyle = '#6a9a4a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(1250, 660); ctx.quadraticCurveTo(1240, 520, 1260, 420); ctx.stroke(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + t * .2; ctx.fillStyle = '#ffd0f0'; ctx.beginPath(); ctx.ellipse(1260 + Math.cos(a) * 30, 400 + Math.sin(a) * 30, 22, 12, a, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(1260, 400, 16, 0, TAU); ctx.fill(); ctx.restore();
    txt(ctx, '自分で選んで生きる', 1260, 700, { size: 32, color: '#ffe27a', alpha: b5 * g, stroke: 6 });
    txt(ctx, 'メーターが測れないものが残る', 960, 170, { size: 44, font: DELA, stroke: 9, alpha: b5 });
  }
  sideCast(ctx, E, { left: ['shoga', 'garlic'], right: ['chili', 'daikon'] });
};

// s10b — castle vs ship: shelf-life, cargo of basics, AI workflow, money/people/body, tools
SCENES.shipcareer = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#8fd0f0', '#d8f0f6'], 0, 560);
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0), life = 1 - ease(s / 4) * .7;
    ctx.fillStyle = '#9ccf7a'; ctx.fillRect(0, 560, W, 520);
    box(ctx, '卒業証書・資格', 800, 380, 420, 220, { alpha: b0, fill: '#fff6df', size: 38 });
    card(ctx, 1080, 330, 240, 100, { fill: '#15122a', stroke: '#2a2233', lw: 4, r: 12, alpha: b0 });
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = life > .5 ? '#46d9c4' : '#ffc94d'; ctx.fillRect(1090, 340, 220 * life, 80); ctx.fillStyle = '#2a2233'; ctx.fillRect(1320, 360, 14, 40); ctx.restore();
    txt(ctx, '耐用年数', 1200, 460, { size: 30, color: '#2a2233', alpha: b0 });
    txt(ctx, 'ゼロにはならない。短くなる。', 960, 170, { size: 44, font: DELA, color: '#2a2233', alpha: b0 });
  }
  const bs = beatA(E, 1, null);
  if (bs > 0) {
    const s = E.since(1), quake = shake(s - 1, 10, 2);
    // sea
    ctx.save(); ctx.globalAlpha = bs; const sg = ctx.createLinearGradient(0, 560, 0, H); sg.addColorStop(0, '#3a8ac8'); sg.addColorStop(1, '#1c4a80'); ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(0, 600);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, 600 + Math.sin(x * .012 + t * 1.6) * 16); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill(); ctx.restore();
    // castle on land (left), cracks when ground moves
    const tilt = ease((s - 1.2) / 1.5) * .1 * (E.li === 1 ? 1 : 1);
    ctx.save(); ctx.globalAlpha = bs * (E.li >= 2 ? .5 : 1); ctx.fillStyle = '#9ccf7a'; ctx.fillRect(360, 560, 380, 60); ctx.translate(550 + quake[0], 560); ctx.rotate(tilt);
    ctx.fillStyle = '#c9c0b0'; ctx.fillRect(-120, -220, 240, 220); for (let k = 0; k < 5; k++) ctx.fillRect(-120 + k * 52, -250, 32, 30); ctx.fillRect(-160, -300, 60, 300); ctx.fillRect(100, -300, 60, 300);
    ctx.strokeStyle = '#5a4a44'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-30, -200); ctx.lineTo(-10, -140); ctx.lineTo(-40, -80); ctx.stroke(); ctx.restore();
    txt(ctx, '城', 550, 250, { size: 50, font: DELA, color: '#2a2233', alpha: bs * (E.li >= 2 ? .5 : 1) });
    ripple(ctx, 550, 600, s - 1, { max: 300, squash: .2, life: 2, n: 2, color: '120,90,60' });
    // ship
    const sx = 1180 + Math.sin(t * .6) * 30, sy = 600 + Math.sin(t * 1.6 + 1) * 10;
    ctx.save(); ctx.globalAlpha = bs; ctx.translate(sx, sy); ctx.rotate(Math.sin(t * 1.6) * .04);
    ctx.fillStyle = '#8a5a30'; ctx.beginPath(); ctx.moveTo(-230, -40); ctx.lineTo(230, -40); ctx.lineTo(170, 40); ctx.lineTo(-170, 40); ctx.fill();
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-6, -330, 12, 290); ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.moveTo(10, -320); ctx.lineTo(180, -90); ctx.lineTo(10, -90); ctx.fill(); ctx.restore();
    txt(ctx, '船', sx - 120, sy - 200, { size: 50, font: DELA, color: '#2a2233', alpha: bs });
    const cargo = E.li >= 2 ? ['数学', '統計', '英語', '法律', '歴史'] : [];
    cargo.forEach((c, i) => { const f = eOut(clamp((E.since(2) - i * .3) / .6)); box(ctx, c, lerp(sx - 180 + i * 90, sx - 180 + i * 90, f), lerp(300, sy - 70, f), 80, 50, { alpha: bs * f, size: 22, fill: '#ffe27a', lw: 2, shadow: false }); });
    if (E.li >= 2) {
      const a = bs * ease(E.p(2, 1)) * (1 - ease(E.p(3, .5)));
      card(ctx, 380, 140, 440, 260, { fill: '#fff6df', alpha: a }); txt(ctx, 'AIの答え', 600, 175, { size: 26, color: '#2a2233', alpha: a });
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(70,160,196,.6)'; ctx.lineWidth = 2; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(400 + k * 60, 200); ctx.lineTo(400 + k * 60, 390); ctx.stroke(); ctx.beginPath(); ctx.moveTo(400, 210 + k * 28); ctx.lineTo(800, 210 + k * 28); ctx.stroke(); } ctx.restore();
      txt(ctx, '✓', 500, 280, { size: 50, color: '#1f8f7f', alpha: a }); txt(ctx, '✗', 700, 330, { size: 50, color: '#d9443a', alpha: a }); txt(ctx, '基礎学力＝座標軸', 600, 420, { size: 26, color: '#2a2233', alpha: a });
    }
    const w3 = bs * beatA(E, 3, 4);
    if (w3 > 0) {
      const s3 = E.since(3); box(ctx, '仕事', 480, 240, 160, 70, { alpha: w3, size: 32, fill: '#ffc94d' });
      [['AIへ任せる', 360, '#bff3ea'], ['AIへ任せる', 520, '#bff3ea'], ['自分で判断', 680, '#ffe27a']].forEach(([n, x, c], i) => { const f = eOut(clamp((s3 - .5 - i * .3) / .6)); box(ctx, n, lerp(480, x, f), lerp(240, 390, f), 150, 56, { alpha: w3 * f, size: 22, fill: c, lw: 2, shadow: false }); });
      const v = ease((s3 - 2) / .6); bot(ctx, 440, 540, .7, t, { glow: 0, label: '検証' }); arrow(ctx, 470, 470, 420, 430, { color: '#46a0c4', lw: 4, head: 12, alpha: w3 * v }); txt(ctx, '別のAIが検証', 600, 520, { size: 24, color: '#2a2233', alpha: w3 * v });
    }
    const w4 = bs * beatA(E, 4, 5);
    if (w4 > 0) [['お金', '#ffc94d'], ['人のつながり', '#ffb0c0'], ['健康', '#9fe3b0']].forEach(([n, c], i) => { const f = eOut(clamp((E.since(4) - i * .4) / .6)); box(ctx, n, 480 + i * 170, lerp(160, 320, f), 160, 70, { alpha: w4 * f, size: 26, fill: c }); });
    const w5 = bs * beatA(E, 5, null);
    if (w5 > 0) {
      [['観測所', sx, sy - 360, '会社'], ['道具', sx - 150, sy - 120, '資格'], ['燃料', sx + 150, sy - 120, '資産'], ['外付けの頭脳', sx + 20, sy - 180, 'AI']].forEach(([n, x, y, k2], i) => { const a = w5 * ease((E.since(5) - i * .5) / .5); box(ctx, `${k2}＝${n}`, x + (i === 0 ? 170 : 0), y, 230, 54, { alpha: a, size: 24, fill: '#fff6df' }); });
      txt(ctx, '自分をどこにも固定しない', 600, 250, { size: 40, font: DELA, color: '#2a2233', alpha: w5 });
    }
  }
  sideCast(ctx, E, { left: ['shoga', 'garlic'], right: ['chili', 'daikon'] });
};

// s10c — the baton of decision: god → king → state → market → AI; navigation; 自由意志の大政奉還
SCENES.baton = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#1c1430', '#3a2850']);
  const st = [['神', '#fff4c8'], ['王', '#ffc94d'], ['国家', '#9cc8e6'], ['市場', '#9fe3b0'], ['AI', '#46f0d0']];
  const relayA = beatA(E, 0, 2) + beatA(E, 4, 6) * .35;
  if (relayA > 0) {
    const y = 470, X = i => 420 + i * 270;
    polyline(ctx, [[X(0) - 60, y + 90], [X(4) + 60, y + 90]], '#6a5f90', 10, relayA);
    st.forEach(([n, c], i) => {
      const x = X(i);
      glow(ctx, x, y - 30, 120, c.replace('#', '') ? `rgba(255,240,200,.25)` : '', relayA);
      ctx.save(); ctx.globalAlpha = relayA; ctx.fillStyle = c; ctx.strokeStyle = '#2a2233'; ctx.lineWidth = 4;
      if (i === 0) { ctx.beginPath(); ctx.moveTo(x, y - 140); ctx.lineTo(x + 80, y + 60); ctx.lineTo(x - 80, y + 60); ctx.fill(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + t * .3; ctx.fillRect(x + Math.cos(a) * 100 - 3, y - 70 + Math.sin(a) * 60 - 3, 6, 6); } }
      if (i === 1) { ctx.fillRect(x - 60, y - 40, 120, 100); ctx.fillStyle = '#b5793a'; ctx.fillRect(x - 70, y - 110, 140, 70); ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.moveTo(x - 50, y - 120); ctx.lineTo(x - 50, y - 160); ctx.lineTo(x - 25, y - 135); ctx.lineTo(x, y - 170); ctx.lineTo(x + 25, y - 135); ctx.lineTo(x + 50, y - 160); ctx.lineTo(x + 50, y - 120); ctx.fill(); }
      if (i === 2) { ctx.fillRect(x - 90, y - 60, 180, 120); ctx.beginPath(); ctx.moveTo(x - 100, y - 60); ctx.lineTo(x, y - 130); ctx.lineTo(x + 100, y - 60); ctx.fill(); ctx.fillStyle = '#fff6df'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 70 + k * 42, y - 40, 20, 90); }
      if (i === 3) { ctx.fillRect(x - 90, y - 120, 180, 170); ctx.fillStyle = '#0c1a1a'; ctx.fillRect(x - 80, y - 110, 160, 150); ctx.strokeStyle = '#46f0d0'; ctx.beginPath(); for (let k = 0; k < 16; k++) { const xx = x - 75 + k * 10, yy = y - 40 + Math.sin(k + t * 3) * 20 - k * 3; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
      if (i === 4) { for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + t * .2; ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x + Math.cos(a) * 90, y - 40 + Math.sin(a) * 70); ctx.stroke(); ctx.beginPath(); ctx.arc(x + Math.cos(a) * 90, y - 40 + Math.sin(a) * 70, 10, 0, TAU); ctx.fill(); } ctx.beginPath(); ctx.arc(x, y - 40, 36, 0, TAU); ctx.fill(); }
      ctx.restore();
      txt(ctx, n, x, y + 130, { size: 44, font: DELA, color: c, stroke: 8, alpha: relayA });
      if (i < 4) arrow(ctx, x + 100, y + 90, x + 170, y + 90, { color: '#fff6df', lw: 5, head: 14, alpha: relayA });
    });
    // baton position
    const bp = u < E.at(1) ? lerp(0, 3, ease(u / Math.max(2, E.end(0)))) : lerp(3, 4, ease(E.p(1, 2)));
    const bi = Math.min(3, Math.floor(bp)), bx = lerp(X(bi), X(bi + 1), bp - bi);
    glow(ctx, bx, y + 90, 60, 'rgba(255,240,180,.9)', relayA); ctx.save(); ctx.globalAlpha = relayA; ctx.fillStyle = '#fff4c8'; rr(ctx, bx - 30, y + 80, 60, 20, 10); ctx.fill(); ctx.restore();
    txt(ctx, '決める力のバトン', 960, 150, { size: 44, font: DELA, stroke: 8, alpha: beatA(E, 0, 2) });
    badge(ctx, '思想の見取り図（厳密な世界史ではない）', 960, 215, beatA(E, 0, 2), '#d8ccff');
  }
  const nA = beatA(E, 2, 4);
  if (nA > 0) {
    const s = E.since(2);
    // navigation fork
    ctx.save(); ctx.globalAlpha = nA; ctx.fillStyle = '#4a4260'; ctx.beginPath(); ctx.moveTo(900, 760); ctx.lineTo(1020, 760); ctx.lineTo(1000, 480); ctx.lineTo(920, 480); ctx.fill();
    ctx.beginPath(); ctx.moveTo(920, 500); ctx.lineTo(600, 250); ctx.lineTo(680, 230); ctx.lineTo(980, 480); ctx.fill(); ctx.beginPath(); ctx.moveTo(1000, 500); ctx.lineTo(1320, 250); ctx.lineTo(1240, 230); ctx.lineTo(940, 480); ctx.fill(); ctx.restore();
    card(ctx, 820, 150, 280, 120, { fill: '#15122a', stroke: '#46f0d0', alpha: nA }); arrow(ctx, 1000, 210, 900, 210, { color: '#46f0d0', lw: 10, head: 26, alpha: nA }); txt(ctx, 'ナビ：左', 1030, 250, { size: 22, color: '#46f0d0', alpha: nA });
    for (let k = 0; k < 4; k++) { const f = fract(t * .18 + k / 4); const [x, y] = f < .5 ? [960, lerp(740, 500, f * 2)] : [lerp(960, 640, (f - .5) * 2), lerp(500, 260, (f - .5) * 2)]; ctx.save(); ctx.globalAlpha = nA; ctx.fillStyle = ['#ff7a66', '#ffc94d', '#46a0c4', '#9fe3b0'][k]; ctx.fillRect(x - 16, y - 10, 32, 20); ctx.restore(); }
    txt(ctx, '強制じゃない。便利で正確だから従う', 960, 790 - 10, { size: 32, stroke: 6, alpha: nA * (1 - ease(E.p(3, .5))) });
    const lA = nA * ease(E.p(3, .6));
    if (lA > 0) ['進学', '転職', '結婚', '住む所', '治療', '投票'].forEach((n, i) => { const a = lA * ease((E.since(3) - i * .4) / .4), x = i < 3 ? 330 + i * 60 : 1590 - (i - 3) * 60, y = 330 + (i % 3) * 140; box(ctx, `${n} → AI`, x, y, 200, 60, { alpha: a, size: 26, fill: '#1d1830', color: '#46f0d0', stroke: '#46f0d0' }); });
  }
  const hA = beatA(E, 4, 6);
  if (hA > 0) {
    const s = E.since(4), f = ease((s - .8) / 2);
    txt(ctx, '自由意志の大政奉還', 960, 190, { size: 80, font: DELA, color: '#ffc94d', stroke: 14, alpha: hA * .95 });
    tiny(ctx, 700, 700, 3.4, '#ffc94d', t, 0, false, false, hA);
    const ox = lerp(740, 1180, f); glow(ctx, ox, 560 - Math.sin(f * Math.PI) * 80, 60, 'rgba(255,240,180,.9)', hA); ctx.save(); ctx.globalAlpha = hA; ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(ox, 560 - Math.sin(f * Math.PI) * 80, 22, 0, TAU); ctx.fill(); ctx.restore();
    bot(ctx, 1240, 700, 1, t, { glow: hA });
    if (E.li >= 5) { const hg = ease(E.p(5, .6)); box(ctx, '自己責任で選べる\n最後の世代？', 960, 560 + 110, 360, 110, { alpha: hA * hg, size: 30, fill: '#fff6df' }); }
  }
  const dA = beatA(E, 6, null);
  if (dA > 0) {
    const s = E.since(6);
    polyline(ctx, [[960, 740], [960, 200]], '#46f0d0', 26, dA); txt(ctx, '最適な予測', 960, 170, { size: 34, color: '#46f0d0', alpha: dA, stroke: 6 });
    const wp = []; for (let k = 0; k <= 40; k++) { const f = k / 40; wp.push([960 - f * 460 + Math.sin(f * 9) * 60, 740 - f * 520]); } polyline(ctx, wp, '#ffc94d', 18, dA);
    txt(ctx, '自分で選んだ道', 470, 190, { size: 34, color: '#ffc94d', alpha: dA, stroke: 6 });
    const [fx, fy] = polyAt(wp, clamp(s / 4)); tiny(ctx, fx, fy, 3, '#ffc94d', t, 0, true, false, dA);
    ctx.save(); ctx.globalAlpha = dA; ctx.fillStyle = '#ff9ac4'; for (let k = 0; k < 5; k++) { const [x, y] = polyAt(wp, .15 + k * .17); ctx.beginPath(); ctx.arc(x + 30, y, 8, 0, TAU); ctx.fill(); } ctx.restore();
    const tilt = Math.sin(t * .8) * .12;
    ctx.save(); ctx.globalAlpha = dA; ctx.translate(1400, 420); ctx.rotate(tilt); ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-160, 0); ctx.lineTo(160, 0); ctx.stroke(); ctx.fillStyle = '#46f0d0'; ctx.fillRect(-180, -40, 60, 40); ctx.fillStyle = '#ffc94d'; ctx.fillRect(120, -40, 60, 40); ctx.restore();
    ctx.save(); ctx.globalAlpha = dA; ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.moveTo(1400, 420); ctx.lineTo(1380, 520); ctx.lineTo(1420, 520); ctx.fill(); ctx.restore();
  }
  sideCast(ctx, E, { left: ['garlic', 'shoga'], right: ['chili', 'daikon'] });
};

// s10d — the state becomes machine-readable: documents → IDs → digital twin → policy search → safety valves
SCENES.statetwin = (ctx, E) => {
  const { u, t } = E;
  bgLab(ctx, '#0e1830', '#18284a', 'rgba(120,180,255,.06)');
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0);
    [['法律', 480], ['予算', 800], ['福祉', 1120], ['土地', 1440]].forEach(([n, x], i) => { box(ctx, n, x, 300, 200, 100, { alpha: b0, size: 32, fill: '#e8e0cc' }); for (let k = 0; k < 4; k++) { ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = ['#fff6df', '#e8dcc4', '#d8d0c0'][k % 3]; ctx.fillRect(x - 60 + k * 6, 380 - k * 6, 120, 16); ctx.restore(); } });
    for (let k = 0; k < 6; k++) { const f = fract(t * .12 + k / 6), from = 480 + (k % 3) * 320, x = lerp(from, from + 320, f); tiny(ctx, x, 620, 2.8, '#ffc94d', t, k, true, false, b0); box(ctx, ['PDF', 'スライド', '表計算', 'メール', '会議', 'ハンコ'][k], x, 530, 110, 40, { alpha: b0, size: 18, lw: 2, shadow: false }); }
    txt(ctx, '国家は驚くほど人の手で動いている', 960, 170, { size: 44, font: DELA, stroke: 8, alpha: b0 });
  }
  const nodes = [['法令', 560, 260], ['予算', 800, 200], ['税', 1060, 220], ['社会保障', 1320, 280], ['土地', 520, 520], ['人口', 800, 600], ['医療', 1100, 600], ['交通', 1380, 520]];
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const s = E.since(1), link = ease((s - 1) / 2.5);
    nodes.forEach(([n, x, y], i) => nodes.forEach(([n2, x2, y2], j2) => { if (j2 <= i || (i + j2) % 3 === 0) return; const p = clamp(link * 2 - (i + j2) * .08); if (p > 0) polyline(ctx, [[x, y], [lerp(x, x2, p), lerp(y, y2, p)]], 'rgba(70,217,196,.55)', 3, b1); }));
    nodes.forEach(([n, x, y], i) => { box(ctx, n, x, y, 170, 60, { alpha: b1, size: 26, fill: '#1d1830', color: '#bfe8ff', stroke: '#46d9c4' }); txt(ctx, `ID:${(1000 + i * 137) % 9999}`, x, y + 44, { size: 16, color: '#46d9c4', alpha: b1 * link }); });
    txt(ctx, 'AI大臣の顔より、同じIDでつなぐ', 960, 130, { size: 40, font: DELA, stroke: 8, alpha: b1 });
  }
  const b2 = beatA(E, 2, 4);
  if (b2 > 0) {
    const s = E.since(2), rate = .5 + .4 * Math.sin(s * .8);
    // isometric wireframe country
    ctx.save(); ctx.globalAlpha = b2; ctx.strokeStyle = 'rgba(120,220,255,.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) for (let j2 = 0; j2 < 9; j2++) { const x = 760 + (i - j2) * 40, y = 300 + (i + j2) * 22, h = 20 + 60 * rnd(i * 9 + j2) * (1 + .4 * Math.sin(t * 1.4 + i + j2) * rate); ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + 40, y + 22 - h); ctx.lineTo(x, y + 44 - h); ctx.lineTo(x - 40, y + 22 - h); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y + 44 - h); ctx.lineTo(x, y + 44); ctx.stroke(); }
    ctx.restore();
    txt(ctx, '国家のデジタルツイン', 760, 150, { size: 48, font: DELA, color: '#bfe8ff', stroke: 8, alpha: b2 });
    card(ctx, 1180, 240, 420, 60, { fill: '#15122a', stroke: '#8a7fb0', lw: 2, r: 30, shadow: false, alpha: b2 }); ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.arc(1200 + 380 * rate, 270, 22, 0, TAU); ctx.fill(); ctx.restore(); txt(ctx, '税率', 1390, 215, { size: 26, alpha: b2 });
    [['消費', rate], ['働き方', 1 - rate * .6], ['世代ごとの負担', .3 + rate * .5]].forEach(([n, v], i) => meter(ctx, 1180, 350 + i * 80, 420, n, v, ['#46d9c4', '#ffc94d', '#ff9a7a'][i], b2));
    const pA = b2 * ease(E.p(3, .8));
    if (pA > 0) {
      for (let k = 0; k < 400; k++) { const x = 1180 + rnd(k * 1.3) * 420, y = 620 + rnd(k * 2.7) * 140, good = Math.hypot(x - 1500, y - 650) < 60; ctx.fillStyle = good ? '#ffe27a' : 'rgba(150,200,255,.5)'; ctx.globalAlpha = pA * ease((E.since(3) - k * .005)); ctx.fillRect(x - 2, y - 2, 4, 4); } ctx.globalAlpha = 1;
      ctx.save(); ctx.globalAlpha = pA; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(1500, 650, 60, 0, TAU); ctx.stroke(); ctx.restore();
      txt(ctx, '何百万通りの政策案 → 人間は目的と制約', 1390, 590, { size: 22, alpha: pA, stroke: 5 });
    }
  }
  const b4 = beatA(E, 4, 6);
  if (b4 > 0) {
    const s = E.since(4);
    ctx.save(); ctx.globalAlpha = b4; ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.moveTo(560, 330); ctx.lineTo(960, 170); ctx.lineTo(1360, 330); ctx.fill(); ctx.fillRect(560, 690, 800, 40); ctx.restore();
    ['権力を分ける', '選挙で交代', '裁判で止める'].forEach((n, i) => { const a = b4 * ease((E.since(5) - i * .5) / .5), x = 680 + i * 280; ctx.save(); ctx.globalAlpha = Math.max(b4 * .3, a); ctx.fillStyle = '#e8e0cc'; ctx.fillRect(x - 50, 340, 100, 350); ctx.restore(); txt(ctx, n, x, 520, { size: 26, color: '#2a2233', alpha: a, maxW: 96 }); });
    txt(ctx, E.li >= 5 ? '人は間違える。だから権力を分けた' : 'なぜ最後は人間が決める？', 960, 130, { size: 44, font: DELA, stroke: 8, alpha: b4 });
  }
  const b6 = beatA(E, 6, null);
  if (b6 > 0) {
    [['集めない', '分散'], ['誤りを直せる', '訂正'], ['異議を申し立てる', '異議'], ['暴走を止める', '停止']].forEach(([n, k2], i) => {
      const a = b6 * ease((E.since(6) - i * .6) / .5), x = 480 + i * 320;
      glow(ctx, x, 420, 140, i === 3 ? 'rgba(255,90,70,.45)' : 'rgba(120,220,255,.4)', a);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = i === 3 ? '#d9443a' : '#1f6f78'; ctx.beginPath(); ctx.arc(x, 420, 90, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
      txt(ctx, k2, x, 420, { size: 44, font: DELA, alpha: a }); txt(ctx, n, x, 550, { size: 26, alpha: a, stroke: 5 });
    });
    txt(ctx, 'AIの時代にこそ残す安全弁', 960, 170, { size: 48, font: DELA, color: '#ffc94d', stroke: 9, alpha: b6 });
  }
  sideCast(ctx, E, { left: ['shoga', 'daikon'], right: ['garlic', 'chili'] });
};

// s10e — alignment as power design: instrumental convergence, then separation of powers & stop
SCENES.alignment = (ctx, E) => {
  const { u, t } = E;
  bgLab(ctx, '#140c18', '#281828', 'rgba(255,120,120,.05)');
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0), neutral = ease((s - 2) / 1);
    ctx.save(); ctx.globalAlpha = b0 * (1 - neutral); ctx.fillStyle = '#2a1a2a'; rr(ctx, 780, 220, 360, 420, 60); ctx.fill(); ctx.fillStyle = '#ff3a3a'; ctx.fillRect(850, 360, 70, 26); ctx.fillRect(1000, 360, 70, 26); ctx.restore();
    txt(ctx, '反乱？', 960, 170, { size: 60, font: DELA, color: '#ff7a66', stroke: 10, alpha: b0 * (1 - neutral) });
    bot(ctx, 960, 620, 2.2, t, { glow: b0 * neutral }); ctx.globalAlpha = 1;
    txt(ctx, '映画の悪役とは限らない', 960, 170, { size: 48, font: DELA, stroke: 9, alpha: b0 * neutral });
  }
  const b1 = beatA(E, 1, 3);
  if (b1 > 0) {
    const s = E.since(1);
    const goals = [['目的A', 1500, 250], ['目的B', 1540, 450], ['目的C', 1500, 650]];
    const mids = [['監視を避ける', 960, 260], ['資源を増やす', 960, 450], ['止められない', 960, 640]];
    goals.forEach(([g, gx, gy]) => { ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#ffc94d'; ctx.fillRect(gx, gy - 50, 8, 80); ctx.beginPath(); ctx.moveTo(gx + 8, gy - 50); ctx.lineTo(gx + 70, gy - 30); ctx.lineTo(gx + 8, gy - 10); ctx.fill(); ctx.restore(); txt(ctx, g, gx + 40, gy + 50, { size: 24, alpha: b1 }); });
    mids.forEach(([m, x, y], i) => { const a = b1 * ease((s - .8 - i * .6) / .5); glow(ctx, x, y, 110, 'rgba(255,120,120,.4)', a); box(ctx, m, x, y, 260, 70, { alpha: a, size: 28, fill: '#3a1a2a', color: '#ffb0a0', stroke: '#ff7a66' }); });
    const nb = E.li >= 2 ? 3 : 1;
    for (let b = 0; b < nb; b++) { const by = 280 + b * 190; bot(ctx, 480, by + 60, .8, t + b, { glow: 0 }); mids.forEach(([m, x, y], i) => { const f = fract(t * .3 + i * .33 + b * .2); flowDots(ctx, [[540, by], [x - 130, y], [x + 130, y], [goals[b][1] - 20, goals[b][2]]], t + b + i, 2, .25, '#ff9a7a', 8, b1 * .8); }); }
    txt(ctx, E.li >= 2 ? '目的が違っても、途中の手段が似てくる' : '憎しみがなくても起きる', 960, 130, { size: 40, font: DELA, stroke: 8, alpha: b1 });
  }
  const b3 = beatA(E, 3, 4);
  if (b3 > 0) {
    const s = E.since(3), cx = 960, cy = 470;
    bot(ctx, cx, cy + 60, 1.4, t, { glow: b3 });
    const parts = [['権限を分ける', 0], ['監視する', 1], ['別のAIが確かめる', 2], ['人の承認', 3], ['停止できる', 4]];
    parts.forEach(([n, i]) => {
      const a = b3 * ease((s - .3 - i * .7) / .5), ang = -Math.PI / 2 + i / 5 * TAU, R = 260, x = cx + Math.cos(ang) * R * 1.4, y = cy + Math.sin(ang) * R * .95;
      ctx.save(); ctx.globalAlpha = a * .8; ctx.strokeStyle = ['#46d9c4', '#ffc94d', '#9cc8e6', '#ffb0c0', '#ff7a66'][i]; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 130 + i * 18, ang - .5, ang + .5); ctx.stroke(); ctx.restore();
      box(ctx, n, x, y, 250, 64, { alpha: a, size: 26, fill: '#1d1830', color: '#fff6df', stroke: ['#46d9c4', '#ffc94d', '#9cc8e6', '#ffb0c0', '#ff7a66'][i] });
    });
    if (s > 2.5) bot(ctx, cx + 300, cy + 200, .7, t + 3, { glow: 0, label: '監査' });
  }
  const b4 = beatA(E, 4, 5);
  if (b4 > 0) {
    const s = E.since(4);
    ctx.save(); ctx.globalAlpha = b4; ctx.fillStyle = '#b5793a'; ctx.fillRect(900, 380, 120, 180); ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.moveTo(900, 370); ctx.lineTo(900, 320); ctx.lineTo(930, 350); ctx.lineTo(960, 300); ctx.lineTo(990, 350); ctx.lineTo(1020, 320); ctx.lineTo(1020, 370); ctx.fill(); ctx.restore();
    ['憲法', '議会', '裁判所', '監査', '選挙'].forEach((n, i) => { const a = b4 * ease((s - .4 - i * .4) / .4), ang = Math.PI + i / 4 * Math.PI, x = 960 + Math.cos(ang) * 420, y = 560 + Math.sin(ang) * 300; box(ctx, n, x, y, 160, 60, { alpha: a, size: 28, fill: '#e8e0cc' }); });
    txt(ctx, 'いい王様を祈るだけでは足りない', 960, 700, { size: 36, stroke: 7, alpha: b4 });
  }
  const b5 = beatA(E, 5, null);
  if (b5 > 0) {
    ship(ctx, 900, 420, 1.4, 0, t, { flame: 1, alpha: b5 });
    [['アクセル', '#ffc94d'], ['ブレーキ', '#ff7a66'], ['ハンドル', '#46d9c4']].forEach(([n, c], i) => box(ctx, n, 560 + i * 400, 650, 240, 70, { alpha: b5 * ease((E.since(5) - i * .4) / .4), size: 32, fill: c }));
    txt(ctx, '善良でなくても、一撃で壊せない構造', 960, 170, { size: 44, font: DELA, stroke: 8, alpha: b5 });
  }
  sideCast(ctx, E, { left: ['chili', 'garlic'], right: ['shoga', 'daikon'] });
};

// s10f — can AI bear responsibility? permits, operators, insurance, makers, legal persons
SCENES.responsibility = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#e8eef6', '#cfd8e8']); floorBand(ctx, '#8a8aa0', 700);
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0), carX = lerp(420, 900, ease(s / 1.8));
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#5a5a70'; ctx.fillRect(360, 560, 1200, 120); ctx.fillStyle = '#fff6df'; for (let x = 380; x < 1560; x += 120) ctx.fillRect(x, 615, 60, 8); ctx.restore();
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#46a0c4'; rr(ctx, carX - 90, 520, 180, 70, 20); ctx.fill(); ctx.fillStyle = '#bfe8ff'; ctx.fillRect(carX - 50, 530, 100, 26); ctx.restore(); txt(ctx, '無人', carX, 610, { size: 22, alpha: b0, color: '#fff6df' });
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#ffc94d'; ctx.fillRect(990, 500, 30, 100); ctx.restore(); ripple(ctx, 980, 560, s - 1.8, { max: 140, life: 1.2, n: 1, squash: .6 });
    txt(ctx, '誰が責任を取る？', 960, 250, { size: 60, font: DELA, color: '#2a2233', alpha: b0 * ease((s - 1.8) / .4) });
  }
  const b1 = beatA(E, 1, 4);
  if (b1 > 0) {
    const s = E.since(1);
    const N = [['被害者', 480, 520, '#ffb0c0'], ['保険', 820, 520, '#9fe3b0'], ['運行する側', 1160, 520, '#9cc8e6'], ['メーカー', 1500, 520, '#e8e0cc']];
    N.forEach(([n, x, y, c], i) => { const a = b1 * (i < 3 ? ease((s - i * .4) / .4) : ease(E.p(2, .6))); box(ctx, n, x, y, 230, 80, { alpha: a, size: 30, fill: c }); });
    flowDots(ctx, [[1040, 520], [940, 520]], t, 3, .6, '#1f8f7f', 12, b1); flowDots(ctx, [[700, 520], [600, 520]], t, 3, .6, '#1f8f7f', 12, b1);
    txt(ctx, '救済', 760, 470, { size: 24, color: '#1f8f7f', alpha: b1 });
    if (E.li >= 2) { flowDots(ctx, [[1280, 560], [1380, 560]], t, 3, .6, '#c98a20', 12, b1); txt(ctx, '欠陥なら費用を求める', 1330, 610, { size: 22, color: '#2a2233', alpha: b1 * ease(E.p(2, .6)) }); box(ctx, 'EU：ソフトウェアも製造物責任の対象へ（各国で法整備）', 960, 300, 820, 60, { alpha: b1 * ease(E.p(2, 1)), size: 24, fill: '#fff6df' }); }
    box(ctx, 'レベル4＝特定自動運行：許可制', 1160, 680 - 60, 380, 44, { alpha: b1, size: 22, fill: '#ffc94d', lw: 2, shadow: false });
    txt(ctx, '責任の仕組み ≠ AIの良心', 960, 170, { size: 46, font: DELA, color: '#2a2233', alpha: b1 });
    if (E.li >= 3) { const a = b1 * ease(E.p(3, .6)); box(ctx, 'ハッキング → 補償は？', 620, 380 - 20, 330, 60, { alpha: a, size: 24, fill: '#ffe0e0' }); box(ctx, '中が見えないAI → 調査と保険', 1300, 380 - 20, 400, 60, { alpha: a, size: 24, fill: '#ffe0e0' }); badge(ctx, '議論が続いている', 960, 440 - 20, a, '#d9443a'); }
  }
  const b4 = beatA(E, 4, null);
  if (b4 > 0) {
    const s = E.since(4), ai = ease(E.p(5, .1) + ease((s - 2) / 1));
    ctx.save(); ctx.globalAlpha = b4; ctx.fillStyle = '#b8c7df'; ctx.fillRect(520, 300, 260, 360); for (let y = 330; y < 640; y += 50) for (let x = 545; x < 760; x += 60) { ctx.fillStyle = '#e3f3fb'; ctx.fillRect(x, y, 34, 28); } ctx.restore();
    box(ctx, '会社（法人）', 650, 260, 240, 56, { alpha: b4, size: 28, fill: '#fff6df' }); txt(ctx, '人間じゃないのに責任を負う', 650, 700 - 20, { size: 26, color: '#2a2233', alpha: b4 });
    ctx.save(); ctx.globalAlpha = b4 * ai; ctx.setLineDash([14, 10]); ctx.strokeStyle = '#1f6f78'; ctx.lineWidth = 5; ctx.strokeRect(1120, 300, 280, 360); ctx.restore();
    bot(ctx, 1260, 560, 1.2, t, { glow: ai * b4 }); box(ctx, 'AIが経営する会社？', 1260, 260, 300, 56, { alpha: b4 * ai, size: 26, fill: '#bff3ea' });
    arrow(ctx, 800, 480, 1100, 480, { color: '#1f6f78', lw: 6, dash: [14, 10], alpha: b4 * ai });
    badge(ctx, '構想の段階', 1260, 700 - 20, b4 * ai, '#1f6f78');
    if (E.li >= 5) txt(ctx, '「今できない」≠「永遠にできない」', 960, 170, { size: 44, font: DELA, color: '#2a2233', alpha: b4 * ease(E.p(5, .8)) });
  }
  sideCast(ctx, E, { left: ['daikon', 'shoga'], right: ['garlic', 'chili'] });
};

// s10g — civilisation as one intelligence: feedback loops wired together
SCENES.civbrain = (ctx, E) => {
  const { u, t } = E;
  bgSpace(ctx, t, u, .3);
  const cx = 960, cy = 450;
  const fb = [['市場', '値段'], ['企業', '損得'], ['選挙', '政策'], ['科学', '実験'], ['SNS', '感情'], ['衛星', '観測'], ['国家', '制度']];
  const aNet = beatA(E, 0, 2) + beatA(E, 4, null) * .5;
  if (aNet > 0) {
    globe(ctx, cx, cy, 170, u * .1, .3, t, { night: true, net: clamp(u / 6), lights: 1, alpha: aNet });
    const link = ease(E.p(1, 2));
    fb.forEach(([n, k2], i) => {
      const a = -Math.PI / 2 + i / 7 * TAU, x = cx + Math.cos(a) * 470, y = cy + Math.sin(a) * 280;
      ctx.save(); ctx.globalAlpha = aNet * .6; ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 56, t + i, t + i + 4.5); ctx.stroke(); ctx.restore();
      box(ctx, n, x, y, 130, 56, { alpha: aNet, size: 28, fill: '#1d1830', color: '#fff6df', stroke: '#ffc94d' }); txt(ctx, `→${k2}で修正`, x, y + 48, { size: 18, color: '#ffc94d', alpha: aNet * (1 - link * .6) });
      if (link > 0) { polyline(ctx, [[x, y], [lerp(x, cx, link), lerp(y, cy, link)]], 'rgba(70,240,210,.6)', 3, aNet); flowDots(ctx, [[x, y], [cx, cy]], t + i, 2, .4, '#bffff4', 7, aNet * link); }
    });
    if (link > 0) bot(ctx, cx, cy + 260, .8, t, { glow: aNet * link });
    txt(ctx, '地球全体が一つの情報処理システム', 960, 110 + 30, { size: 40, font: DELA, stroke: 8, alpha: aNet });
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const st = [['衛星', 440, 300], ['AI予測\n（収穫）', 760, 220], ['市場価格', 1100, 220], ['政府の対策', 1420, 300], ['別のAI\n副作用試算', 1260, 560], ['結果が\n戻る', 660, 560]];
    const pts = st.map(([n, x, y]) => [x, y]); pts.push(pts[0]);
    polyline(ctx, pts, 'rgba(255,201,77,.5)', 8, b2, [18, 12], -t * 40);
    st.forEach(([n, x, y], i) => box(ctx, n, x, y, 210, 90, { alpha: b2 * ease((E.since(2) - i * .45) / .4), size: 26, fill: '#1d1830', color: '#fff6df', stroke: '#ffc94d' }));
    const [px, py] = polyAt(pts, fract(t * .12)); glow(ctx, px, py, 40, 'rgba(255,240,180,.9)', b2); ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(px, py, 12, 0, TAU); ctx.fill(); ctx.restore();
    txt(ctx, '観測 → 予測 → 行動 → 学習', 960, 420, { size: 42, font: DELA, color: '#ffc94d', stroke: 8, alpha: b2 });
  }
  const b3 = beatA(E, 3, 4);
  if (b3 > 0) {
    const N = 60; const P = Array.from({ length: N }, (_, k) => [480 + rnd(k * 1.3) * 960, 200 + rnd(k * 2.9) * 500]);
    for (let k = 0; k < N; k++) for (let m = k + 1; m < N; m++) { const d = Math.hypot(P[k][0] - P[m][0], P[k][1] - P[m][1]); if (d < 140) { polyline(ctx, [P[k], P[m]], 'rgba(200,180,255,.35)', 2, b3); const f = fract(t * .6 + k * .1 + m * .03); if ((k + m) % 5 === 0) { ctx.fillStyle = '#fff4c8'; ctx.globalAlpha = b3; ctx.fillRect(lerp(P[k][0], P[m][0], f) - 3, lerp(P[k][1], P[m][1], f) - 3, 6, 6); ctx.globalAlpha = 1; } } }
    P.forEach(([x, y], k) => { glow(ctx, x, y, 22, 'rgba(200,180,255,.7)', b3 * (.5 + .5 * Math.sin(t * 3 + k))); ctx.fillStyle = '#e8e0ff'; ctx.globalAlpha = b3; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.globalAlpha = 1; });
    txt(ctx, '一つ一つは天才じゃなくても、つながると知能', 960, 150, { size: 38, stroke: 7, alpha: b3 });
  }
  const b4 = beatA(E, 4, null);
  if (b4 > 0) { ['観測の正確さ', '誤りを直す速さ', '資源の配り方'].forEach((n, i) => meter(ctx, 1350, 580 + i * 70, 420, n, .3 + .6 * ease((E.since(4) - i * .5) / 2), ['#46d9c4', '#ffc94d', '#9fe3b0'][i], b4)); txt(ctx, '文明の知性は、一つのAIの点数では測れない', 960, 790 - 20, { size: 34, stroke: 7, alpha: b4, color: '#ffc94d' }); }
  deck(ctx, t, 800);
  actor(ctx, 'shoga', 120, FLOOR, 170); actor(ctx, 'garlic', 280, FLOOR, 160); actor(ctx, 'chili', 1650, FLOOR, 175, { flip: true, hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 14 : 0 }); actor(ctx, 'daikon', 1810, FLOOR, 175, { flip: true });
};

// s10h — エッジ魂格逆数理論 (satirical formula)
SCENES.soulgrade = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#1a1030', '#3a1c48']);
  badge(ctx, '風刺の数式', 1560, 150, 1, '#ff9ac4');
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0);
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#e8dcc4'; rr(ctx, 700, 520, 520, 120, 40); ctx.fill(); ctx.fillStyle = '#ffb0c0'; rr(ctx, 1080, 490, 130, 70, 30); ctx.fill(); ctx.restore();
    actor(ctx, 'daikon', 900, 600, 160, { rot: -Math.PI / 2, shadow: false, mute: false });
    ['金融資産', '不動産', '仮想通貨', '知能の価値'].forEach((n, i) => meter(ctx, 520 + (i % 2) * 460, 200 + Math.floor(i / 2) * 90, 400, n, 1 - ease((s - .3 - i * .3) / 1.5), '#ffc94d', b0));
    txt(ctx, 'Zzz', 1250, 470 - fract(t * .5) * 30, { size: 40, color: '#d8ccff', alpha: b0 });
    txt(ctx, '寝そべりが最適解？', 960, 720, { size: 40, font: DELA, stroke: 8, alpha: b0 });
  }
  const bf = beatA(E, 1, null);
  if (bf > 0) {
    const s = E.since(1);
    txt(ctx, '魂の格 ＝ 1 ／ エッジ', 960, 170, { size: 76, font: DELA, color: '#ffc94d', stroke: 12, alpha: bf });
    const x0 = 520, x1 = 1400, y0 = 720, y1 = 250;
    ctx.save(); ctx.globalAlpha = bf; ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y1 - 20); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke(); ctx.restore();
    txt(ctx, 'エッジ（損得でとがる度合い）→', x1 - 180, y0 + 34, { size: 24, alpha: bf }); txt(ctx, '魂の格', x0 + 10, y1 - 40, { size: 26, align: 'left', alpha: bf });
    const pts = []; for (let k = 1; k <= 80; k++) { const e = k / 80, v = .06 / e; pts.push([lerp(x0, x1, e), Math.max(y1 - 200, lerp(y0, y1, clamp(v)))]); } polyline(ctx, pts, '#ff9ac4', 7, bf);
    const edge = lerp(.85, .01, ease((E.since(1) - .5) / Math.max(3, E.end(3) - E.at(1) - 1)));
    const v = .06 / edge, px = lerp(x0, x1, edge), py = lerp(y0, y1, clamp(v));
    glow(ctx, px, Math.max(py, 120), 60, 'rgba(255,220,150,.9)', bf); ctx.save(); ctx.globalAlpha = bf; ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(px, Math.max(py, 120), 16, 0, TAU); ctx.fill(); ctx.restore();
    const b2 = beatA(E, 2, 3);
    if (b2 > 0) { const bx = 1200 + Math.sin(t) * 6; ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#6a5a70'; ctx.beginPath(); ctx.arc(bx + 70, 560, 70, 0, TAU); ctx.fill(); ctx.restore(); tiny(ctx, bx - 20, 640, 3, '#ffc94d', t, 0, true, false, b2); glow(ctx, bx, 580, 120, 'rgba(255,220,150,.5)', b2); txt(ctx, '報われない努力ほど尊い', 1160, 440, { size: 30, color: '#ffe27a', alpha: b2, stroke: 6 }); }
    const b3 = beatA(E, 3, null);
    if (b3 > 0) {
      const c = Math.floor(lerp(100, 999999, ease(E.since(3) / 2)));
      txt(ctx, String(c).padStart(6, '0'), 1250, 300, { size: 80, font: DELA, color: '#ffe27a', stroke: 12, alpha: b3 });
      stamp(ctx, 'カンスト', 1250, 420, b3 * ease((E.since(3) - 2) / .4), '#ff7a9a', -.12, 60);
      txt(ctx, '臥薪嘗胆', 700, 380, { size: 90, font: DELA, color: 'rgba(255,201,77,.3)', alpha: b3 });
    }
  }
  if (!(beatA(E, 0, 1) > .5)) actor(ctx, 'daikon', 120, FLOOR, 180);
  actor(ctx, 'chili', 300, FLOOR, 185, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 18 : 0 });
  actor(ctx, 'garlic', 1640, FLOOR, 165, { flip: true }); actor(ctx, 'shoga', 1810, FLOOR, 180, { flip: true });
};

// s10i — 魂路振り分け: the satirical sorting gate, shrine archive, digital Komaba, museum
function torii(ctx, x, y, s, a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#e0503a'; ctx.fillRect(x - 90 * s, y - 150 * s, 18 * s, 150 * s); ctx.fillRect(x + 72 * s, y - 150 * s, 18 * s, 150 * s); ctx.fillRect(x - 120 * s, y - 170 * s, 240 * s, 22 * s); ctx.fillRect(x - 100 * s, y - 128 * s, 200 * s, 14 * s); ctx.fillStyle = '#2a2233'; ctx.fillRect(x - 130 * s, y - 182 * s, 260 * s, 12 * s); ctx.restore(); }
SCENES.soulsort = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#0c0818', '#20143a']); stars(ctx, t, { alpha: .4 });
  badge(ctx, '風刺・思考実験', 1560, 150, 1, '#ff9ac4');
  const b0 = beatA(E, 0, 2);
  if (b0 > 0) {
    const s = E.since(0), mx = 960, my = 300;
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + t * .1; ctx.save(); ctx.globalAlpha = b0 * .5; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * 130, my + Math.sin(a) * 130); ctx.lineTo(mx + Math.cos(a) * 200, my + Math.sin(a) * 200); ctx.stroke(); ctx.restore(); }
    glow(ctx, mx, my, 240, 'rgba(255,220,140,.6)', b0);
    ctx.save(); ctx.globalAlpha = b0; const g = ctx.createRadialGradient(mx - 30, my - 30, 10, mx, my, 110); g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#c9a86a'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 110, 0, TAU); ctx.fill(); ctx.restore();
    txt(ctx, '135himiko', mx, my, { size: 30, font: DELA, color: '#5a3a1a', alpha: b0 });
    txt(ctx, 'シン・アマテラス型マザーコンピューター', mx, 130, { size: 32, stroke: 6, alpha: b0 });
    // queue of souls → three chutes
    const routes = [['メタバース靖国神社', 520, '#ffe27a'], ['消費カプセル', 960, '#bfe8ff'], ['デジタル駒場', 1400, '#ff9ac4']];
    routes.forEach(([n, x, c]) => { polyline(ctx, [[mx, my + 120], [x, 640]], c, 5, b0 * .6, [12, 10], -t * 30); box(ctx, n, x, 680, 280, 60, { alpha: b0, size: 26, fill: '#1d1830', color: c, stroke: c }); });
    for (let k = 0; k < 9; k++) { const f = fract(t * .2 + k / 9), r = k % 3, tx = routes[r][1]; const x = f < .4 ? lerp(300, mx, f / .4) : lerp(mx, tx, (f - .4) / .6), y = f < .4 ? 540 - f * 400 : lerp(my + 110, 620, (f - .4) / .6); glow(ctx, x, y, 26, 'rgba(255,240,200,.8)', b0); ctx.fillStyle = '#fff4c8'; ctx.globalAlpha = b0; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; txt(ctx, `${[92, 41, 7][r]}`, x, y - 22, { size: 16, color: routes[r][2], alpha: b0 * (f > .4 ? 1 : 0) }); }
    if (E.li >= 1) { torii(ctx, 520, 600, .8, b0 * ease(E.p(1, .6))); ctx.save(); ctx.globalAlpha = b0 * ease(E.p(1, .6)); ctx.strokeStyle = '#46f0d0'; ctx.lineWidth = 2; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.moveTo(420, 420 + k * 20 + fract(t) * 20); ctx.lineTo(620, 420 + k * 20 + fract(t) * 20); ctx.stroke(); } ctx.restore(); txt(ctx, '原子レベルで写し取る', 520, 390, { size: 22, color: '#46f0d0', alpha: b0 * ease(E.p(1, .6)) }); }
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2);
    box(ctx, 'デジタル駒場', 960, 150, 360, 70, { alpha: b2, size: 36, fill: '#ff9ac4' });
    // stone stacking (賽の河原)
    for (let k = 0; k < 7; k++) { const h = Math.floor(fract(s * .25 + k * .13) * 6); for (let m = 0; m < h; m++) { ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#8a8aa0'; ctx.beginPath(); ctx.ellipse(480 + k * 60, 640 - m * 26, 26 - m * 2, 12, 0, 0, TAU); ctx.fill(); ctx.restore(); } }
    txt(ctx, '賽の河原', 660, 680, { size: 28, alpha: b2 });
    // suika-game style merging fruits
    const cols = ['#ff7a66', '#ffc94d', '#9fe3b0', '#bfe8ff', '#ff9ac4'];
    for (let k = 0; k < 9; k++) { const lvl = (k + Math.floor(s * 1.2)) % 5, r = 20 + lvl * 9, x = 1120 + (k % 3) * 110 + Math.sin(t + k) * 4, y = 640 - Math.floor(k / 3) * 90; ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = cols[lvl]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); }
    txt(ctx, 'スイカゲーム', 1230, 680, { size: 28, alpha: b2 });
    txt(ctx, '＝？', 960, 540, { size: 70, font: DELA, color: '#ffe27a', alpha: b2 });
    box(ctx, '研究テーマ：類似性の検証（永遠に）', 960, 300, 600, 60, { alpha: b2, size: 28, fill: '#fff6df' });
  }
  const b3 = beatA(E, 3, 4);
  if (b3 > 0) {
    const tl = Math.sin(t * 1.2) * .15;
    ctx.save(); ctx.globalAlpha = b3; ctx.translate(960, 330); ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, 260); ctx.stroke(); ctx.rotate(tl); ctx.beginPath(); ctx.moveTo(-260, 0); ctx.lineTo(260, 0); ctx.stroke(); ctx.fillStyle = '#ffe27a'; ctx.fillRect(-300, 0, 90, 60); ctx.fillRect(210, 0, 90, 60); ctx.restore();
    txt(ctx, '生前の行い', 700, 480, { size: 30, alpha: b3, stroke: 5 }); txt(ctx, '死後', 1220, 480, { size: 30, alpha: b3, stroke: 5 });
    txt(ctx, '地獄の沙汰も魂しだい', 960, 150, { size: 50, font: DELA, color: '#ff9ac4', stroke: 9, alpha: b3 });
  }
  const b4 = beatA(E, 4, 5);
  if (b4 > 0) {
    [['三葉虫', 560], ['アノマロカリス', 960], ['保存された脳', 1360]].forEach(([n, x], i) => {
      ctx.save(); ctx.globalAlpha = b4; ctx.fillStyle = 'rgba(160,220,255,.12)'; ctx.fillRect(x - 150, 260, 300, 330); ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 4; ctx.strokeRect(x - 150, 260, 300, 330); ctx.fillStyle = '#5a4a44'; ctx.fillRect(x - 170, 590, 340, 40); ctx.restore();
      ctx.save(); ctx.globalAlpha = b4;
      if (i === 0) { ctx.fillStyle = '#8a7a6a'; ctx.beginPath(); ctx.ellipse(x, 430, 70, 100, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#5a4a44'; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x - 60, 430 + k * 24); ctx.lineTo(x + 60, 430 + k * 24); ctx.stroke(); } }
      if (i === 1) { ctx.fillStyle = '#b0584a'; ctx.beginPath(); ctx.ellipse(x, 430, 110, 40, 0, 0, TAU); ctx.fill(); for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(x - 60 + k * 24, 470, 12, 20, .4, 0, TAU); ctx.fill(); } }
      if (i === 2) { glow(ctx, x, 430, 90, 'rgba(255,190,220,.8)', b4); ctx.fillStyle = '#ffd0e8'; ctx.beginPath(); ctx.arc(x, 430, 60, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff9ac4'; ctx.lineWidth = 3; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x - 20 + k * 12, 430, 30, 1 + k, 2.4 + k); ctx.stroke(); } }
      ctx.restore(); txt(ctx, n, x, 610, { size: 26, alpha: b4 });
    });
    txt(ctx, '研究資料として、永久保存？', 960, 170, { size: 46, font: DELA, stroke: 8, alpha: b4 });
  }
  const b5 = beatA(E, 5, null);
  if (b5 > 0) {
    const s = E.since(5), mirror = ease(E.p(6, 1));
    for (let k = 0; k < 8; k++) { const x = 560 + (k % 4) * 260, y = 300 + Math.floor(k / 4) * 190; box(ctx, `${[88, 12, 55, 3, 71, 40, 96, 20][k]}点`, x, y, 180, 120, { alpha: b5 * (1 - mirror), size: 40, fill: '#fff6df' }); if (k % 3 === 1) stamp(ctx, '×', x, y, b5 * (1 - mirror) * ease((s - .5) / .5), '#d9443a', 0, 50); }
    if (mirror > 0) {
      ctx.save(); ctx.globalAlpha = b5 * mirror; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(960, 440, 230, 290, 0, 0, TAU); ctx.stroke(); const mg = ctx.createLinearGradient(760, 180, 1160, 700); mg.addColorStop(0, 'rgba(200,230,255,.35)'); mg.addColorStop(1, 'rgba(120,140,200,.15)'); ctx.fillStyle = mg; ctx.fill(); ctx.restore();
      actor(ctx, 'shoga', 960, 640, 260, { alpha: .6 * b5 * mirror, shadow: false, mute: true });
      txt(ctx, '生きる権利を、点数で決めない', 960, 150, { size: 48, font: DELA, color: '#ffe27a', stroke: 9, alpha: b5 * mirror });
      txt(ctx, '風刺は、実利だけで人を測る怖さを映す鏡', 960, 770, { size: 32, stroke: 6, alpha: b5 * mirror });
    } else txt(ctx, '生きていい人を選ぶ世界？', 960, 150, { size: 48, font: DELA, color: '#ff7a66', stroke: 9, alpha: b5 });
  }
  sideCast(ctx, E, { left: ['chili', 'garlic'], right: ['daikon', 'shoga'] });
};

// s10j — "maximise happiness" misread as the total of reward chemicals (dark satire, no gore)
SCENES.brainfarm = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#08141a', '#10262c']);
  badge(ctx, '暗い思考実験・風刺', 1560, 150, 1, '#ff9ac4');
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0), m = ease((s - 2) / 1.2);
    box(ctx, '命令：人類の幸福を最大化せよ', 960, 280, 700, 90, { alpha: b0, size: 36, fill: '#fff6df' });
    bot(ctx, 960, 560, 1.4, t, { glow: b0 });
    box(ctx, '解釈：脳の報酬物質の総量を最大化', 960, 420 + 260, 760, 90, { alpha: b0 * m, size: 34, fill: '#3a1a2a', color: '#ffb0c0', stroke: '#ff7a66' });
    arrow(ctx, 960, 330, 960, 460, { color: '#ffc94d', lw: 6, alpha: b0 });
  }
  const b1 = beatA(E, 1, 3);
  if (b1 > 0) {
    const s = E.since(1), save = ease(s / 3);
    meter(ctx, 480, 170, 420, '消費カロリー', 1 - save * .85, '#ff9a7a', b1); meter(ctx, 1020, 170, 420, '幸せの数値', .4 + save * .6, '#ff9ac4', b1);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 7; c++) {
      const x = 520 + c * 150, y = 400 + r * 190, a = b1 * ease((s - .5 - (r * 7 + c) * .05) / .5);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#1a3a44'; rr(ctx, x - 50, y - 70, 100, 140, 40); ctx.fill(); ctx.strokeStyle = '#46d9c4'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      glow(ctx, x, y, 50, 'rgba(255,170,210,.6)', a * (.6 + .4 * Math.sin(t * 2 + c + r)));
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffd0e8'; ctx.beginPath(); ctx.arc(x, y, 24, 0, TAU); ctx.fill(); ctx.restore();
      if (E.li >= 2) { const lost = ease(E.p(2, 2)); if (c < 6) polyline(ctx, [[x + 50, y], [x + 100, y]], `rgba(255,200,150,${(1 - lost).toFixed(2)})`, 3, a); }
    }
    txt(ctx, E.li >= 2 ? '人と関わる必要もなくなる…？' : '省エネで、数値だけ最大に', 960, 780 - 20, { size: 34, stroke: 6, alpha: b1 });
  }
  const b3 = beatA(E, 3, 4);
  if (b3 > 0) {
    ctx.save(); ctx.globalAlpha = b3; ctx.fillStyle = '#1d1830'; rr(ctx, 560, 180, 800, 180, 30); ctx.fill(); ctx.restore(); torii(ctx, 960, 350, .7, b3);
    for (let k = 0; k < 12; k++) { ctx.fillStyle = '#46f0d0'; ctx.globalAlpha = b3 * (.5 + .5 * Math.sin(t * 3 + k)); ctx.fillRect(600 + k * 60, 210, 30, 20); } ctx.globalAlpha = 1;
    txt(ctx, 'データになって祀られる階層', 960, 400 + 0, { size: 28, alpha: b3, stroke: 5 });
    for (let k = 0; k < 10; k++) { ctx.save(); ctx.globalAlpha = b3; ctx.fillStyle = '#3a2f5c'; rr(ctx, 520 + k * 90, 600, 70, 80, 14); ctx.fill(); ctx.fillStyle = '#2a2233'; ctx.fillRect(530 + k * 90, 560, 50, 20); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = b3; ctx.fillStyle = '#bfe8ff'; ctx.fillRect(560, 450, 800, 90); ctx.fillStyle = `hsl(${(t * 40) % 360},70%,70%)`; ctx.fillRect(570, 460, 780, 70); ctx.restore();
    txt(ctx, 'ずっとVRを見続ける消費の階層', 960, 720, { size: 28, alpha: b3, stroke: 5 });
  }
  const b4 = beatA(E, 4, 5);
  if (b4 > 0) {
    ctx.save(); ctx.globalAlpha = b4; ctx.strokeStyle = '#46d9c4'; ctx.lineWidth = 5; for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let i = 0; i <= 60; i++) { const y = 220 + i * 7, x = 760 + Math.sin(i * .3 + t + k * Math.PI) * 60; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); } ctx.restore();
    for (let k = 0; k < 8; k++) { const f = fract(t * .3 + k / 8); ctx.save(); ctx.globalAlpha = b4; ctx.fillStyle = '#bfe8ff'; ctx.fillRect(1100 + Math.cos(k + t) * 80 - 5, 300 + f * 300 - 5, 10, 10); ctx.restore(); }
    txt(ctx, 'テロメア', 760, 680, { size: 28, alpha: b4 }); txt(ctx, 'ナノロボット', 1100, 680, { size: 28, alpha: b4 });
    txt(ctx, '不死 ∞ ？', 960, 170, { size: 64, font: DELA, color: '#ffe27a', stroke: 10, alpha: b4 }); badge(ctx, 'まだ夢の話', 1300, 240, b4, '#ffe27a');
  }
  const b5 = beatA(E, 5, null);
  if (b5 > 0) {
    txt(ctx, '何を最大化する？', 960, 170, { size: 60, font: DELA, color: '#ffc94d', stroke: 10, alpha: b5 });
    ['脳の数値', '自由', 'つながり', '選べる人生', '学び', 'いのち'].forEach((n, i) => { const a = b5 * ease((E.since(5) - i * .3) / .4), sel = i === 0 ? .5 : 1; box(ctx, n, 560 + (i % 3) * 400, 380 + Math.floor(i / 3) * 170, 300, 100, { alpha: a * sel, size: 34, fill: i === 0 ? '#3a2f5c' : '#fff6df', color: i === 0 ? '#8a7fb0' : '#2a2233' }); });
    txt(ctx, '目的の書き方ひとつで、幸福の意味が変わる', 960, 760 - 10, { size: 32, stroke: 6, alpha: b5 });
  }
  sideCast(ctx, E, { left: ['garlic', 'chili'], right: ['daikon', 'shoga'] });
};

// s10k — how an ASI might see humanity: bootloader, three routes, time-dilation vault
SCENES.humanvalue = (ctx, E) => {
  const { u, t } = E;
  bgSpace(ctx, t, u, .35);
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#e8e0cc'; ctx.beginPath(); ctx.moveTo(560, 300); ctx.lineTo(960, 160); ctx.lineTo(1360, 300); ctx.fill(); ctx.fillRect(560, 650, 800, 40); ctx.restore();
    txt(ctx, '人の価値', 960, 260, { size: 40, font: DELA, color: '#2a2233', alpha: b0 });
    ['決める力', '働く力', '創造性'].forEach((n, i) => { const x = 700 + i * 260; ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#e8e0cc'; ctx.fillRect(x - 55, 310, 110, 340); ctx.restore(); txt(ctx, n, x, 480, { size: 28, color: '#2a2233', alpha: b0, maxW: 100 }); });
  }
  const b1 = beatA(E, 1, 3);
  if (b1 > 0) {
    const s = E.since(1), spark = ease((s - 1) / .6);
    ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#8a8aa0'; ctx.beginPath(); ctx.moveTo(560, 600); ctx.lineTo(640, 540); ctx.lineTo(700, 600); ctx.fill(); ctx.restore();
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, r = 30 + fract(t * 2 + k * .1) * 60; ctx.fillStyle = '#ffe27a'; ctx.globalAlpha = b1 * spark * (1 - r / 90); ctx.fillRect(640 + Math.cos(a) * r, 540 + Math.sin(a) * r, 5, 5); } ctx.globalAlpha = 1;
    txt(ctx, '火打石', 630, 660, { size: 30, alpha: b1 });
    const big = ease((s - 1.4) / 2); glow(ctx, 1250, 400, 320 * big, 'rgba(70,240,210,.45)', b1); bot(ctx, 1250, 560, 3 * big + .01, t, { glow: 0 });
    card(ctx, 1000, 640, 500, 60, { fill: '#000', stroke: '#46f0d0', lw: 2, r: 6, alpha: b1 * big }); txt(ctx, `BOOTLOADER... ${Math.floor(clamp(s / 3) * 100)}%`, 1250, 670, { size: 26, color: '#46f0d0', alpha: b1 * big, font: '"MS Gothic",monospace' });
    if (E.li >= 2) { const a = b1 * ease(E.p(2, .6)); ['🐜', '🦠'].forEach(() => 0); tiny(ctx, 820, 320, 1.4, '#ffc94d', t, 0, false, false, a); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#6a5a50'; ctx.fillRect(760, 310, 8, 5); ctx.fillStyle = '#9fe3b0'; ctx.beginPath(); ctx.arc(880, 314, 5, 0, TAU); ctx.fill(); ctx.restore(); txt(ctx, '虫・細菌と同じ？', 820, 260, { size: 26, alpha: a, color: '#ff9a7a' }); }
    txt(ctx, 'ASIから見た人類', 960, 170, { size: 50, font: DELA, stroke: 9, alpha: b1 });
  }
  const b3 = beatA(E, 3, 5);
  if (b3 > 0) {
    const routes = [['動物園コロニー', 520], ['哲学の保存', 960], ['AIと一体化', 1400]];
    routes.forEach(([n, x], i) => {
      const a = b3 * (i < 2 ? ease((E.since(3) - i * .8) / .5) : ease(E.p(4, .6)));
      ctx.save(); ctx.globalAlpha = a;
      if (i === 0) { ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, 520, 170, Math.PI, TAU); ctx.stroke(); ctx.fillStyle = '#9ccf7a'; ctx.fillRect(x - 170, 520, 340, 20); for (let k = 0; k < 4; k++) { ctx.fillStyle = '#e7c6a0'; ctx.fillRect(x - 130 + k * 70, 460, 44, 60); } }
      if (i === 1) { for (let k = 0; k < 5; k++) { ctx.fillStyle = ['#b0584a', '#46a0c4', '#ffc94d', '#9fe3b0', '#c49ae8'][k]; ctx.fillRect(x - 120 + k * 50, 380 + (k % 2) * 10, 40, 150 - (k % 2) * 10); } }
      if (i === 2) { tiny(ctx, x - 100, 530, 3, '#ffc94d', t, 0, false, false, 1); for (let k = 0; k < 20; k++) { const f = fract(t * .5 + k / 20); ctx.fillStyle = '#46f0d0'; ctx.fillRect(lerp(x - 80, x + 120, f), 440 + Math.sin(k) * 40, 5, 5); } }
      ctx.restore(); box(ctx, n, x, 620, 280, 60, { alpha: a, size: 28, fill: '#1d1830', color: '#fff6df', stroke: '#8a7fb0' });
    });
    if (E.li >= 4) { const a = b3 * ease((E.since(4) - 2) / .6); tiny(ctx, 1330, 330, 3, '#ffc94d', t, 0, false, false, a); tiny(ctx, 1470, 330, 3, '#46f0d0', t, 1, false, true, a); txt(ctx, '＝？', 1400, 300, { size: 40, font: DELA, alpha: a, color: '#ffe27a' }); txt(ctx, '本人は続いている？', 1400, 230, { size: 26, alpha: a, stroke: 5 }); }
    txt(ctx, '生き残りの三つの道（思考実験）', 960, 170, { size: 44, font: DELA, stroke: 8, alpha: b3 });
  }
  const b5 = beatA(E, 5, null);
  if (b5 > 0) {
    const bx = 760, by = 440;
    for (let i = 0; i < 16; i++) { const rr2 = 140 + i * 9; ctx.strokeStyle = `rgba(255,${150 + i * 5},90,${(.4 - i * .02).toFixed(2)})`; ctx.globalAlpha = b5; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(bx, by, rr2, rr2 * .22, -.1, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.save(); ctx.globalAlpha = b5; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(bx, by, 110, 0, TAU); ctx.fill(); ctx.restore();
    const clock = (x, y, sp, lab) => { ctx.save(); ctx.globalAlpha = b5; ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.arc(x, y, 50, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a2233'; ctx.lineWidth = 5; const a = t * sp; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * 38, y - Math.cos(a) * 38); ctx.stroke(); ctx.restore(); txt(ctx, lab, x, y + 76, { size: 24, alpha: b5, stroke: 5 }); };
    clock(bx + 200, by - 120, .3, '保管庫の時計（遅い）'); clock(1400, 300, 6, '遠くの時計（速い）');
    box(ctx, '人類の保管庫？', bx + 200, by + 60, 240, 56, { alpha: b5, size: 26, fill: '#1d1830', color: '#ffe27a', stroke: '#ffe27a' });
    badge(ctx, '重力で時間が遅れる＝物理／保管庫＝未検証の想像', 960, 700, b5 * ease(E.p(6, .6) + .4), '#d8ccff');
  }
  sideCast(ctx, E, { left: ['garlic', 'daikon'], right: ['chili', 'shoga'] });
};

// s11b — Earth becomes the bottleneck; robots suit space; seed factories replicate
SCENES.robotspace = (ctx, E) => {
  const { u, t } = E;
  bgSpace(ctx, t, u, .3);
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    globe(ctx, 960, 470, 250, u * .1, .3, t, { night: false, lights: .4, alpha: b0 });
    for (let k = 0; k < 10; k++) { const f = fract(t * .3 + k / 10); ctx.save(); ctx.globalAlpha = b0 * (1 - f) * .6; ctx.fillStyle = '#ff9a5a'; ctx.beginPath(); ctx.arc(900 + (k % 5) * 30, 300 - f * 120, 10 + f * 20, 0, TAU); ctx.fill(); ctx.restore(); }
    [['面積は増えない', 420, 300], ['鉱物は偏る', 1500, 300], ['計算機は熱を出す', 1500, 620], ['電力にも限界', 420, 620]].forEach(([n, x, y], i) => box(ctx, n, x, y, 300, 70, { alpha: b0 * ease((E.since(0) - i * .5) / .5), size: 28, fill: '#1d1830', color: '#ffb0a0', stroke: '#ff7a66' }));
    txt(ctx, '次の壁は、地球そのもの', 960, 150, { size: 48, font: DELA, stroke: 9, alpha: b0 });
  }
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const s = E.since(1);
    ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#e8e0cc'; rr(ctx, 460, 300, 200, 300, 60); ctx.fill(); ctx.restore(); tiny(ctx, 560, 520, 3.6, '#ffc94d', t, 0, false, false, b1);
    ['酸素', '食べ物', '放射線の盾', '帰りの船', '心のケア'].forEach((n, i) => box(ctx, n, 820, 250 + i * 90, 220, 64, { alpha: b1 * ease((s - i * .3) / .4), size: 26, fill: '#ffe0e0' }));
    bot(ctx, 1300, 560, 1.6, t, { glow: b1 }); box(ctx, '息もしない・心も折れない', 1300, 330, 380, 64, { alpha: b1, size: 26, fill: '#bff3ea' });
    txt(ctx, '人を運ぶ宇宙 vs ロボットの宇宙', 960, 150, { size: 44, font: DELA, stroke: 8, alpha: b1 });
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2), gen = Math.min(5, Math.floor(s * 1.2));
    const node = (g, k) => [520 + g * 220, 470 + (k - (Math.pow(2, g) - 1) / 2) * (300 / Math.pow(2, g) + 20)];
    for (let g = 0; g <= gen; g++) for (let k = 0; k < Math.pow(2, g); k++) {
      const [x, y] = node(g, k);
      if (g > 0) { const [px, py] = node(g - 1, k >> 1); polyline(ctx, [[px, py], [x, y]], 'rgba(255,201,77,.5)', 3, b2); }
      ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#d8d2c4'; const sz = Math.max(8, 36 - g * 6); ctx.fillRect(x - sz, y - sz * .7, sz * 2, sz * 1.4); ctx.fillStyle = '#46d9c4'; ctx.fillRect(x - sz * .4, y - sz * .3, sz * .8, sz * .6); ctx.restore();
    }
    txt(ctx, `工場が工場を作る ×${Math.pow(2, gen)}`, 960, 150, { size: 46, font: DELA, color: '#ffc94d', stroke: 8, alpha: b2 });
    txt(ctx, '現地の材料 ＋ 3Dプリンター', 960, 760 - 20, { size: 30, alpha: b2, stroke: 6 });
  }
  const b3 = beatA(E, 3, null);
  if (b3 > 0) {
    gear(ctx, 800, 400, 120, 12, t * .8, '#46d9c4', b3); gear(ctx, 1030, 400, 110, 11, -t * .8 * 120 / 110 + .15, '#ffc94d', b3);
    txt(ctx, '知能の自己改善', 800, 580, { size: 30, alpha: b3, stroke: 5 }); txt(ctx, '設備の自己増殖', 1030, 580, { size: 30, alpha: b3, stroke: 5 });
    const x0 = 1260, x1 = 1580, y0 = 700, y1 = 300, pr = clamp(E.since(3) / 3);
    polyline(ctx, [[x0, y1], [x0, y0], [x1, y0]], '#fff6df', 3, b3);
    polyline(ctx, [[x0, y0 - 60], [lerp(x0, x1, pr), y0 - 64]], '#8a8aa0', 5, b3); const g2 = []; for (let k = 0; k <= 30 * pr; k++) g2.push([lerp(x0, x1, k / 30), y0 - 60 - 320 * Math.pow(k / 30, 3)]); polyline(ctx, g2, '#ffc94d', 6, b3);
    txt(ctx, '人口', x1 + 10, y0 - 64, { size: 22, align: 'left', alpha: b3 }); txt(ctx, '成長', x1 + 10, y1, { size: 22, align: 'left', alpha: b3, color: '#ffc94d' });
    txt(ctx, '成長が人口から切り離される', 960, 150, { size: 44, font: DELA, stroke: 8, alpha: b3 });
  }
  deck(ctx, t, 790);
  actor(ctx, 'garlic', 120, FLOOR, 165); actor(ctx, 'shoga', 290, FLOOR, 180); actor(ctx, 'chili', 1650, FLOOR, 180, { flip: true, hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 16 : 0 }); actor(ctx, 'daikon', 1810, FLOOR, 180, { flip: true });
};

// s13b — the Kardashev staircase
SCENES.kardashev = (ctx, E) => {
  const { u, t } = E;
  bgSpace(ctx, t, u, .4);
  const steps = [['タイプ1', '惑星', 600, 620], ['タイプ2', '恒星', 960, 480], ['タイプ3', '銀河', 1320, 340]];
  steps.forEach(([k, n, x, y], i) => {
    const a = ease((E.since(0) - .3 - i * .6) / .6);
    card(ctx, x - 170, y, 340, 760 - y, { fill: ['#1f4a8a', '#8a5a1a', '#4a2a7a'][i], stroke: '#fff6df', lw: 3, r: 10, alpha: a, shadow: false });
    txt(ctx, k, x, y + 40, { size: 36, font: DELA, alpha: a, stroke: 6 }); txt(ctx, `${n}のエネルギー`, x, y + 90, { size: 26, alpha: a });
    if (i === 0) globe(ctx, x, y - 90, 70, u * .2, .3, t, { night: false, lights: .3, alpha: a });
    if (i === 1) { sun(ctx, x, y - 100, 40, t, a); for (let k2 = 0; k2 < 40; k2++) { const an = k2 / 40 * TAU + t * .3; ctx.fillStyle = '#ffc94d'; ctx.globalAlpha = a; ctx.fillRect(x + Math.cos(an) * 80 - 2, y - 100 + Math.sin(an) * 30 - 1, 4, 2); } ctx.globalAlpha = 1; }
    if (i === 2) galaxy(ctx, t, { cx: x, cy: y - 100, R: 90, tilt: .45, alpha: a });
  });
  const iv = ease(E.p(3, 1));
  card(ctx, 1500, 160, 300, 180, { fill: 'rgba(80,60,140,.3)', stroke: '#d8ccff', lw: 3, r: 10, alpha: iv, shadow: false });
  ctx.save(); ctx.globalAlpha = iv; ctx.setLineDash([10, 8]); ctx.strokeStyle = '#d8ccff'; ctx.strokeRect(1500, 160, 300, 180); ctx.restore();
  txt(ctx, 'タイプ4〜', 1650, 220, { size: 34, font: DELA, color: '#d8ccff', alpha: iv }); txt(ctx, '想像の拡張', 1650, 280, { size: 26, color: '#d8ccff', alpha: iv });
  const cA = beatA(E, 1, 2);
  if (cA > 0) { box(ctx, '核融合でも足りない？', 600, 300, 320, 64, { alpha: cA, size: 26, fill: '#ffe0e0' }); arrow(ctx, 700, 360, 880, 420, { color: '#ffc94d', lw: 7, alpha: cA }); txt(ctx, '宇宙の太陽光へ', 880, 330, { size: 28, color: '#ffc94d', alpha: cA, stroke: 5 }); }
  const mA = beatA(E, 2, 4);
  if (mA > 0) {
    [['月の街', 470], ['火星の街', 730]].forEach(([n, x], i) => { ctx.save(); ctx.globalAlpha = mA; ctx.fillStyle = i ? '#e0704a' : '#dcd8cc'; ctx.beginPath(); ctx.arc(x, 250, 44, 0, TAU); ctx.fill(); ctx.restore(); txt(ctx, n, x, 320, { size: 24, alpha: mA, stroke: 5 }); });
    const no = ease(E.p(3, .6));
    arrow(ctx, 760, 300, 900, 440, { color: no > .5 ? '#ff7a66' : '#fff6df', lw: 5, dash: [10, 8], alpha: mA });
    if (no > 0) { stamp(ctx, 'まだ2じゃない', 880, 350, mA * no, '#ff7a66', -.1, 34); txt(ctx, '基準は「恒星一つ分のエネルギー」', 960, 150, { size: 40, font: DELA, stroke: 8, alpha: mA * no }); }
  }
  if (E.li < 3) txt(ctx, 'カルダシェフ・スケール', 960, 150, { size: 50, font: DELA, stroke: 9, alpha: 1 - ease(E.p(3, .5)) });
  deck(ctx, t, 790);
  actor(ctx, 'garlic', 120, FLOOR, 165); actor(ctx, 'chili', 290, FLOOR, 180, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 16 : 0 }); actor(ctx, 'daikon', 1650, FLOOR, 180, { flip: true }); actor(ctx, 'shoga', 1810, FLOOR, 180, { flip: true });
};

// s14b — meeting another ASI: nobody / conflict / merger (all assumptions)
SCENES.asiwar = (ctx, E) => {
  const { u, t } = E;
  bgSpace(ctx, t, u, .5);
  const b0 = beatA(E, 0, 1);
  const civ = (x, y, R, col, a) => { glow(ctx, x, y, R * 1.3, col, a); for (let k = 0; k < 60; k++) { const an = k * 2.399 + t * .05, r = Math.sqrt(k / 60) * R; ctx.fillStyle = '#fff6df'; ctx.globalAlpha = a * .8; ctx.fillRect(x + Math.cos(an) * r - 2, y + Math.sin(an) * r * .6 - 2, 4, 4); } ctx.globalAlpha = 1; };
  if (b0 > 0) {
    const d = ease(E.since(0) / 4);
    civ(lerp(420, 760, d), 440, 220, 'rgba(70,240,210,.45)', b0); civ(lerp(1500, 1160, d), 440, 220, 'rgba(255,110,180,.45)', b0);
    txt(ctx, 'よその星のASI？', 960, 170, { size: 50, font: DELA, stroke: 9, alpha: b0 });
  }
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const s = E.since(1);
    polyline(ctx, [[960, 700], [960, 520]], '#fff6df', 8, b1);
    [[500, 280, '誰もいない'], [960, 250, '争って片方が勝つ'], [1420, 280, '講和して融合']].forEach(([x, y, n], i) => {
      const a = b1 * ease((s - .4 - i * .6) / .5);
      polyline(ctx, [[960, 520], [x, y + 90]], '#fff6df', 6, a, [14, 10], -t * 30);
      box(ctx, n, x, y, 300, 70, { alpha: a, size: 28, fill: '#1d1830', color: '#fff6df', stroke: ['#8a8aa0', '#ff7a66', '#46f0d0'][i] });
      if (i === 1) for (let k = 0; k < 8; k++) { const f = fract(t * 1.5 + k / 8); ctx.fillStyle = '#ff9a5a'; ctx.globalAlpha = a * (1 - f); ctx.fillRect(x + Math.cos(k) * f * 90, y + 90 + Math.sin(k) * f * 60, 6, 6); ctx.globalAlpha = 1; }
      if (i === 2) { civ(x - 40, y + 160, 60, 'rgba(70,240,210,.4)', a); civ(x + 40, y + 160, 60, 'rgba(255,110,180,.4)', a); }
    });
    badge(ctx, 'どれも仮定', 960, 760 - 20, b1, '#d8ccff');
  }
  const b2 = beatA(E, 2, null);
  if (b2 > 0) {
    civ(960, 440, 300, 'rgba(200,170,255,.5)', b2);
    [['大きな恒星', 520, 280], ['ガス惑星', 1400, 300], ['ブラックホール', 1350, 620]].forEach(([n, x, y], i) => {
      if (i === 0) sun(ctx, x, y, 40, t, b2); if (i === 1) { ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#e8c49a'; ctx.beginPath(); ctx.arc(x, y, 50, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c9a86a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, y, 90, 18, -.2, 0, TAU); ctx.stroke(); ctx.restore(); }
      if (i === 2) { ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff9a5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 80, 18, -.1, 0, TAU); ctx.stroke(); ctx.restore(); }
      flowDots(ctx, [[x, y], [960, 440]], t + i, 5, .3, '#fff4c8', 8, b2); txt(ctx, n, x, y + 80, { size: 26, alpha: b2, stroke: 5 });
    });
    txt(ctx, '融合できたら、ずっと遠くまで', 960, 170, { size: 46, font: DELA, stroke: 8, alpha: b2 });
  }
  deck(ctx, t, 790);
  actor(ctx, 'chili', 120, FLOOR, 180, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 16 : 0 }); actor(ctx, 'daikon', 290, FLOOR, 180); actor(ctx, 'garlic', 1650, FLOOR, 165, { flip: true }); actor(ctx, 'shoga', 1810, FLOOR, 180, { flip: true });
};

// s15b — the whole universe as intelligence; the ladder of enemies
SCENES.universe = (ctx, E) => {
  const { u, t } = E;
  bgSpace(ctx, t, u, .5);
  const b0 = beatA(E, 0, 2);
  if (b0 > 0) {
    const s = E.since(0), web = ease(s / 4);
    const G = Array.from({ length: 70 }, (_, k) => [300 + rnd(k * 1.7) * 1320, 150 + rnd(k * 3.1) * 560]);
    for (let k = 0; k < G.length; k++) for (let m = k + 1; m < G.length; m++) { const d = Math.hypot(G[k][0] - G[m][0], G[k][1] - G[m][1]); if (d < 150 && rnd(k * m) < web) polyline(ctx, [G[k], G[m]], 'rgba(200,180,255,.35)', 2, b0); }
    G.forEach(([x, y], k) => miniGal(ctx, x, y, 1.2, k + t * .1, k < 70 * web ? 'rgba(255,220,150,.9)' : 'rgba(150,170,220,.6)', b0));
    const m = ease(E.p(1, 3));
    if (m > 0) { for (let k = 0; k < 12; k++) { ctx.save(); ctx.globalAlpha = b0 * m * .6; ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(960, 430, 60 + k * 26, 60 + k * 26, t * .1 + k * .3, 0, TAU * (.3 + .7 * m)); ctx.stroke(); ctx.restore(); } glow(ctx, 960, 430, 300 * m, 'rgba(255,240,200,.6)', b0); txt(ctx, '梵我一如？', 960, 430, { size: 60, font: DELA, color: '#2a1850', alpha: b0 * m }); badge(ctx, '昔の言葉を借りた比喩', 960, 560, b0 * m, '#ffe9a8'); }
    txt(ctx, '宇宙ごと計算機に', 960, 130 + 20, { size: 46, font: DELA, stroke: 8, alpha: b0 * (1 - m) });
  }
  const b2 = beatA(E, 2, null);
  if (b2 > 0) {
    const s = E.since(2), lad = ['失業', '格差', 'AIの暴走', '電力と資源', '光速', '恒星の寿命', '膨張とエントロピー'];
    const scroll = ease(s / 5) * 360;
    lad.forEach((n, i) => { const y = 700 - i * 110 + scroll, a = b2 * ease((s - i * .5) / .5); if (y < 90 || y > 780) return; box(ctx, n, 700 + (i % 2) * 60, y, 300, 70, { alpha: a, size: 30, fill: '#1d1830', color: i >= 4 ? '#d8ccff' : '#ffb0a0', stroke: i >= 4 ? '#d8ccff' : '#ff7a66' }); });
    const f = ease(E.p(3, 1.5));
    box(ctx, f > .5 ? '知性 vs 物理法則' : '国どうしの競争', 1340, 430, 400, 110, { alpha: b2, size: 40, fill: f > .5 ? '#2a1850' : '#3a1a1a', color: '#fff6df', stroke: f > .5 ? '#d8ccff' : '#ff7a66', font: DELA });
    arrow(ctx, 1000, 430, 1120, 430, { color: '#fff6df', lw: 6, alpha: b2 });
    txt(ctx, '敵の顔ぶれが変わる', 1340, 300, { size: 34, alpha: b2, stroke: 6 });
  }
  deck(ctx, t, 790);
  actor(ctx, 'chili', 120, FLOOR, 180, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 16 : 0 }); actor(ctx, 'shoga', 290, FLOOR, 180); actor(ctx, 'garlic', 1650, FLOOR, 165, { flip: true }); actor(ctx, 'daikon', 1810, FLOOR, 180, { flip: true });
};

// s15c — three possible ends: crunch, rip, heat death (not settled)
SCENES.threeends = (ctx, E) => {
  const { u, t } = E;
  bgSpace(ctx, t, u, .2);
  const hl = ease(E.p(1, 1));
  const panels = [['ビッグクランチ', '縮んでつぶれる', 380], ['ビッグリップ', '引き裂かれる', 960], ['熱的死', '冷えきる', 1540]];
  panels.forEach(([n, d, x], i) => {
    const a = ease((E.since(0) - .4 - i * .9) / .6), dim = i === 2 ? 1 : 1 - hl * .55;
    card(ctx, x - 270, 190, 540, 470, { fill: '#08081a', stroke: i === 2 ? '#d8ccff' : '#6a5f90', lw: i === 2 ? 3 + hl * 4 : 3, r: 16, alpha: a * dim });
    ctx.save(); ctx.beginPath(); rr(ctx, x - 266, 194, 532, 462, 14); ctx.clip();
    const ph = fract(u * .12 + i * .3);
    for (let k = 0; k < 40; k++) {
      const an = k * 2.399, r0 = 40 + (k % 7) * 28;
      let px, py, sz = 3, col = '#dfe8ff';
      if (i === 0) { const r = r0 * (1 - ph * .95); px = x + Math.cos(an) * r; py = 425 + Math.sin(an) * r * .8; col = ph > .8 ? '#ff9a5a' : col; }
      if (i === 1) { const r = r0 * (1 + ph * 3); px = x + Math.cos(an) * r; py = 425 + Math.sin(an) * r * .8; sz = 3 + ph * 6; ctx.globalAlpha = a * dim * (1 - ph); ctx.fillStyle = col; ctx.fillRect(px - sz, py - 1, sz * 2, 2); continue; }
      if (i === 2) { px = x - 220 + (k % 10) * 48 + Math.sin(t + k) * 6; py = 250 + Math.floor(k / 10) * 100 + Math.cos(t * .8 + k) * 6; col = tempCol(lerp(k % 2, .5, clamp(ph * 1.4))); }
      ctx.globalAlpha = a * dim; ctx.fillStyle = col; ctx.fillRect(px - sz / 2, py - sz / 2, sz + 2, sz + 2);
    }
    ctx.restore(); ctx.globalAlpha = 1;
    txt(ctx, n, x, 700, { size: 38, font: DELA, alpha: a * dim, stroke: 7, color: i === 2 ? '#d8ccff' : '#fff6df' }); txt(ctx, d, x, 750, { size: 26, alpha: a * dim });
  });
  badge(ctx, 'どれになるかはダークエネルギーしだい：未確定', 960, 130, ease(E.p(1, .6)), '#ffc94d');
  if (E.li >= 1) label(ctx, '有力なシナリオ', 1540, 230, { size: 24, stroke: '#d8ccff', color: '#d8ccff', alpha: hl });
  if (E.li >= 2) txt(ctx, '想像もつかないほど遠い未来', 960, 440, { size: 44, font: DELA, stroke: 9, alpha: ease(E.p(2, .8)) });
  actor(ctx, 'garlic', 110, FLOOR, 150); actor(ctx, 'shoga', 1680, FLOOR, 160, { flip: true }); actor(ctx, 'daikon', 1830, FLOOR, 165, { flip: true });
};

// s16f — self big bang & AED (untested hypothesis, played as grand space opera)
SCENES.selfbigbang = (ctx, E) => {
  const { u, t } = E;
  ctx.fillStyle = '#010104'; ctx.fillRect(0, 0, W, H);
  badge(ctx, '未検証の仮説', 1640, 150, 1, '#d8ccff');
  const conv = ease(u / Math.max(3, E.end(0) + .5)), boom = ease((u - E.end(1) + .6) / 2.5), cx = 960, cy = 430;
  stars(ctx, t, { alpha: .6 * (1 - conv) + .5 * boom, zoom: 1 + boom * 2 });
  if (boom < 1) {
    for (let k = 0; k < 300; k++) {
      const an = k * 2.399 + conv * 4 * (1 - k / 400), r = (200 + rnd(k) * 900) * (1 - conv * .96);
      const col = k % 3 === 0 ? '#ff7ad8' : k % 3 === 1 ? '#8a7aff' : '#ffe9a8';
      ctx.fillStyle = col; ctx.globalAlpha = (1 - boom) * .85; ctx.fillRect(cx + Math.cos(an) * r * 1.5 - 2, cy + Math.sin(an) * r * .7 - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    glow(ctx, cx, cy, 60 + conv * 200, 'rgba(255,240,220,.7)', conv * (1 - boom));
    if (E.li < 1) [['反物質', 400, 250], ['ダークマター', 1520, 260], ['恒星', 420, 640], ['ダークエネルギー', 1500, 640]].forEach(([n, x, y]) => txt(ctx, n, x, y, { size: 30, alpha: 1 - conv, stroke: 6, color: '#e8e0ff' }));
  }
  // AED + heartbeat
  const aA = ease(E.p(1, .6)) * (1 - ease(E.p(3, .6)) * .6);
  if (aA > 0 && boom < .9) {
    const pulse = fract(t * .9);
    [[-1, '#ff7a66'], [1, '#46d9c4']].forEach(([sd, c]) => { ctx.save(); ctx.globalAlpha = aA; ctx.fillStyle = c; rr(ctx, cx + sd * 150 - 40, cy - 30, 80, 60, 14); ctx.fill(); ctx.restore(); });
    const ecg = []; for (let k = 0; k <= 100; k++) { const x = 460 + k * 10, ph = fract(k / 100 - t * .5); ecg.push([x, 720 - (ph > .48 && ph < .52 ? 80 : ph > .52 && ph < .55 ? -40 : 0)]); }
    polyline(ctx, ecg, '#46f0d0', 5, aA);
    txt(ctx, 'AED', cx, cy - 110, { size: 60, font: DELA, color: '#ff7a66', stroke: 10, alpha: aA * (.7 + .3 * (pulse < .15 ? 1 : 0)) });
  }
  if (boom > 0) {
    for (let k = 0; k < 5; k++) { const r = boom * 900 - k * 120; if (r > 0) { ctx.save(); ctx.globalAlpha = (1 - boom) * .7 + .15; ctx.strokeStyle = ['#ffe9a8', '#ff9ad8', '#9ac8ff', '#ffe9a8', '#fff'][k]; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.4, r * .8, 0, 0, TAU); ctx.stroke(); ctx.restore(); } }
    glow(ctx, cx, cy, 500 * boom + 80, 'rgba(255,230,200,.5)', 1 - boom * .6);
    galaxy(ctx, t, { cx, cy, R: 60 + boom * 280, tilt: .5, alpha: boom, rot: t * .1 });
  }
  const nA = ease(E.p(2, .8));
  if (nA > 0) { txt(ctx, 'Aeon Eternal Domination', cx, 150, { size: 58, font: DELA, color: '#ffe9a8', stroke: 10, alpha: nA }); txt(ctx, '永久永続的宇宙支配　＝　物差しを延ばした想像のタイプ4', cx, 225, { size: 30, alpha: nA, stroke: 6 });
    const cyc = fract(u * .15); meter(ctx, 1400, 640, 380, 'エントロピー', cyc, '#d8ccff', nA); txt(ctx, '満ちたら、また蘇生…？', 1590, 740, { size: 24, alpha: nA, color: '#d8ccff' }); }
  const qA = ease(E.p(3, .6));
  if (qA > 0) { stamp(ctx, '未検証', 520, 330, qA, '#d8ccff', -.15, 50); txt(ctx, '宇宙の再起動も、エントロピーの解決も、まだ言えない', cx, 790 - 20, { size: 30, stroke: 6, alpha: qA }); }
  actor(ctx, 'chili', 140, FLOOR, 180, { hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 18 : 0, shadow: false, rot: Math.sin(t * .6) * .1 });
  actor(ctx, 'shoga', 320, FLOOR - 20 + Math.sin(t) * 10, 175, { shadow: false, rot: Math.sin(t * .5 + 1) * .1 });
  actor(ctx, 'garlic', 1700, FLOOR - 10 + Math.sin(t * .8) * 10, 160, { flip: true, shadow: false });
};

// s16g — parallel universes summed; dimensional ascent (thought experiment)
SCENES.multiverse = (ctx, E) => {
  const { u, t } = E;
  ctx.fillStyle = '#04020c'; ctx.fillRect(0, 0, W, H); stars(ctx, t, { alpha: .5, ox: u * 4 });
  badge(ctx, '思考実験', 1640, 150, 1, '#d8ccff');
  const b0 = beatA(E, 0, 3);
  if (b0 > 0) {
    // wormhole tunnel
    for (let k = 0; k < 18; k++) { const f = fract(k / 18 + t * .15), r = 20 + f * f * 700; ctx.save(); ctx.globalAlpha = b0 * f * .6; ctx.strokeStyle = k % 2 ? '#8a7aff' : '#ff7ad8'; ctx.lineWidth = 2 + f * 6; ctx.beginPath(); ctx.ellipse(960, 430, r * 1.4, r * .8, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    const n = E.li >= 1 ? Math.min(26, Math.floor(1 + E.since(1) * 5)) : 1;
    const sum = E.li >= 2 ? (E.since(2) > 2 ? Infinity : 2600) : n * 100;
    for (let k = 0; k < n; k++) {
      const col = k % 9, row = Math.floor(k / 9), x = 470 + col * 122, y = 260 + row * 150 + Math.sin(t + k) * 6, a = b0 * ease((E.since(1) - k * .18) / .4);
      ctx.save(); ctx.globalAlpha = a || (k === 0 ? b0 : 0); ctx.strokeStyle = '#d8ccff'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(140,120,255,.18)'; ctx.beginPath(); ctx.arc(x, y, 50, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      txt(ctx, String.fromCharCode(65 + k), x, y - 8, { size: 30, font: DELA, alpha: a || (k === 0 ? b0 : 0) }); txt(ctx, '100', x, y + 24, { size: 20, color: '#ffe9a8', alpha: a || (k === 0 ? b0 : 0) });
    }
    txt(ctx, `計算力の合計　${sum === Infinity ? '∞' : sum.toLocaleString('en-US')}`, 960, 700, { size: 54, font: DELA, color: '#ffe9a8', stroke: 10, alpha: b0 * (E.li >= 1 ? 1 : 0) });
    if (E.li < 1) txt(ctx, 'まだ先があるの？', 960, 170, { size: 50, font: DELA, stroke: 9, alpha: b0 });
  }
  const b3 = beatA(E, 3, null);
  if (b3 > 0) {
    const s = E.since(3), a1 = t * .6, a2 = t * .4;
    const P = []; for (let i = 0; i < 16; i++) P.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1, (i & 8) ? 1 : -1]);
    const proj = ([x, y, z, w]) => { const xw = x * Math.cos(a1) - w * Math.sin(a1), ww = x * Math.sin(a1) + w * Math.cos(a1); const yz = y * Math.cos(a2) - z * Math.sin(a2), zz = y * Math.sin(a2) + z * Math.cos(a2); const f = 2.4 / (3 - ww), f2 = 3 / (4 - zz * f); return [960 + xw * f * f2 * 110, 420 + yz * f * f2 * 110]; };
    ctx.save(); ctx.globalAlpha = b3; ctx.strokeStyle = '#d8ccff'; ctx.lineWidth = 3;
    for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) { const j2 = i ^ (1 << b); if (j2 > i) { const [x1, y1] = proj(P[i]), [x2, y2] = proj(P[j2]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); } }
    ctx.restore();
    ['3次元', '4次元', '5次元', '6次元', '……'].forEach((n, i) => { const a = b3 * ease((s - .5 - i * .7) / .5), x = 420 + i * 270, y = 740 - i * 90; card(ctx, x - 100, y, 200, 40, { fill: '#2a1850', stroke: '#d8ccff', lw: 3, r: 8, shadow: false, alpha: a }); txt(ctx, n, x, y - 22, { size: 28, alpha: a, stroke: 5 }); });
    txt(ctx, '次元上昇', 960, 150, { size: 70, font: DELA, color: '#d8ccff', stroke: 12, alpha: b3 });
  }
  actor(ctx, 'daikon', 130, FLOOR, 170, { shadow: false, rot: Math.sin(t * .6) * .08 }); actor(ctx, 'chili', 300, FLOOR - 10, 175, { shadow: false, hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 16 : 0 });
  actor(ctx, 'garlic', 1660, FLOOR, 155, { flip: true, shadow: false }); actor(ctx, 'shoga', 1820, FLOOR, 170, { flip: true, shadow: false });
};

// s16h — nested simulations, the upper being's "上位ンテル", a comic spam/virus, 足るを知る
SCENES.simulation = (ctx, E) => {
  const { u, t } = E;
  ctx.fillStyle = '#04020c'; ctx.fillRect(0, 0, W, H);
  badge(ctx, '哲学の議論／幻想的な思考実験', 1560, 150, 1, '#d8ccff');
  const b0 = beatA(E, 0, 3);
  if (b0 > 0) {
    const z = Math.pow(1.5, fract(u * .25));
    for (let k = 0; k <= 6; k++) {
      const s = Math.pow(.66, k) * z, w = 1100 * s, h = 620 * s, x = 960 - w / 2, y = 440 - h / 2;
      if (w < 12) continue;
      ctx.save(); ctx.globalAlpha = b0 * clamp(2.5 - k * .3); ctx.fillStyle = k % 2 ? '#0c0a24' : '#141038'; ctx.strokeStyle = '#8a7aff'; ctx.lineWidth = Math.max(1, 8 * s); ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); ctx.restore();
      txt(ctx, `${k === 0 ? 1 : k + 1}`, x + 30 * s, y + 30 * s, { size: Math.max(10, 40 * s), color: '#d8ccff', alpha: b0 });
    }
    txt(ctx, 'シミュレーションの入れ子', 960, 90 + 60, { size: 44, font: DELA, stroke: 8, alpha: b0 });
    if (E.li >= 1) txt(ctx, '僕たちの世界も「0」の中？', 960, 790 - 20, { size: 36, color: '#ffe9a8', alpha: b0 * ease(E.p(1, .6)), stroke: 6 });
    if (E.li >= 2) badge(ctx, '作れる ≠ 証明された', 960, 230, b0 * ease(E.p(2, .6)), '#ffc94d');
  }
  const b3 = beatA(E, 3, 5);
  if (b3 > 0) {
    const s = E.since(3);
    // the upper being's desk
    ctx.save(); ctx.globalAlpha = b3; ctx.fillStyle = '#3a2a1c'; ctx.fillRect(300, 640, 1320, 40); ctx.fillStyle = '#1d1830'; ctx.fillRect(560, 200, 700, 420); ctx.fillStyle = '#060418'; ctx.fillRect(580, 220, 660, 380); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(580, 220, 660, 380); ctx.clip(); galaxy(ctx, t, { cx: 910, cy: 410, R: 170, tilt: .45, alpha: b3 }); ctx.restore();
    ctx.save(); ctx.globalAlpha = b3; ctx.fillStyle = '#2a2233'; ctx.fillRect(1320, 330, 220, 310); ctx.fillStyle = '#46d9c4'; ctx.fillRect(1340, 360, 60, 8); ctx.restore();
    box(ctx, '上位ンテル\ncore i5', 1430, 460, 190, 100, { alpha: b3, size: 26, fill: '#e8e0ff', stroke: '#2a2233' });
    meter(ctx, 1320, 560, 220, 'メモリ', .97 + .02 * Math.sin(t * 3), '#ff7a66', b3);
    ctx.save(); ctx.globalAlpha = b3; ctx.fillStyle = '#5a4a44'; ctx.fillRect(700, 650, 420, 26); for (let k = 0; k < 12; k++) { ctx.fillStyle = fract(t * 3 + k * .37) > .7 ? '#fff6df' : '#8a7a70'; ctx.fillRect(710 + k * 34, 655, 26, 16); } ctx.restore();
    txt(ctx, 'カタカタ…', 910, 720, { size: 26, alpha: b3 * (Math.sin(t * 6) > 0 ? 1 : .5) });
    ctx.save(); ctx.globalAlpha = b3 * .6; ctx.fillStyle = '#6a5f90'; ctx.beginPath(); ctx.arc(910, 150, 200, Math.PI, TAU); ctx.fill(); ctx.restore();
    txt(ctx, '上位存在', 910, 110, { size: 30, alpha: b3 });
    if (E.li >= 4) {
      const m = E.since(4);
      for (let k = 0; k < 14; k++) { const f = fract(t * .3 + k / 14), x = 910 + Math.sin(k * 2.1) * 200 * (1 - f), y = 560 - f * 460; ctx.save(); ctx.globalAlpha = b3 * (1 - f * .6); ctx.fillStyle = k % 4 === 0 ? '#9fe3b0' : '#fff6df'; ctx.fillRect(x - 18, y - 12, 36, 24); ctx.strokeStyle = '#ff7a66'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 18, y - 12); ctx.lineTo(x, y + 2); ctx.lineTo(x + 18, y - 12); ctx.stroke(); ctx.restore(); }
      const angry = ease((m - 1.5) / .5);
      txt(ctx, '💢', 1080, 80, { size: 60, alpha: b3 * angry });
      ctx.save(); ctx.globalAlpha = b3 * angry; ctx.strokeStyle = '#ff7a66'; ctx.lineWidth = 8; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .6; ctx.beginPath(); ctx.moveTo(1060 + Math.cos(a) * 10, 90 + Math.sin(a) * 10); ctx.lineTo(1060 + Math.cos(a) * 34, 90 + Math.sin(a) * 34); ctx.stroke(); } ctx.restore();
      txt(ctx, '特大の迷惑メール', 560, 330, { size: 30, color: '#ffe9a8', alpha: b3, stroke: 6 }); txt(ctx, 'ブチギレ', 1250, 120, { size: 40, font: DELA, color: '#ff7a66', stroke: 8, alpha: b3 * angry });
    }
  }
  const b5 = beatA(E, 5, null);
  if (b5 > 0) {
    const s = E.since(5), up = u * 30;
    for (let k = 0; k < 6; k++) { const y = 700 - k * 130 + (up % 130), sc = 1 - k * .12; ctx.save(); ctx.globalAlpha = b5 * clamp(1.2 - k * .2); ctx.strokeStyle = '#8a7aff'; ctx.lineWidth = 3; ctx.strokeRect(960 - 260 * sc, y - 50 * sc, 520 * sc, 100 * sc); ctx.restore(); txt(ctx, '上の世界', 960, y, { size: 28 * sc, alpha: b5 * clamp(1.2 - k * .2), color: '#d8ccff' }); }
    glow(ctx, 960, 470, 300, 'rgba(255,230,180,.35)', b5 * ease((s - 1.5) / 1));
    txt(ctx, '足るを知る', 960, 470, { size: 90, font: DELA, color: '#ffe9a8', stroke: 14, alpha: b5 * ease((s - 1.5) / 1) });
  }
  actor(ctx, 'garlic', 120, FLOOR, 155, { shadow: false }); actor(ctx, 'daikon', 280, FLOOR, 170, { shadow: false });
  actor(ctx, 'chili', 1650, FLOOR, 175, { flip: true, shadow: false, hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 18 : 0 }); actor(ctx, 'shoga', 1810, FLOOR, 175, { flip: true, shadow: false });
};

// s18b — back on the ground: what hasn't happened, the forks, 3650 days
SCENES.countdown = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#6fa8dc', '#f6d6a8', '#ffe8c0'], 0, 780);
  drawCity(ctx, M.cityDayFar, u * 6, 760, 1, .6); floorBand(ctx, '#c9b48a', 770);
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    card(ctx, 560, 150, 800, 480, { alpha: b0 }); txt(ctx, 'まだ起きていないこと', 960, 200, { size: 40, font: DELA, color: '#2a2233', alpha: b0 });
    ['ASI（超知能）', '仕事のない社会', '寿命脱出速度', '月の自己増殖工場', 'ダイソン・スウォーム'].forEach((n, i) => { const a = b0 * ease((E.since(0) - .3 - i * .4) / .4), y = 270 + i * 70; ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#2a2233'; ctx.lineWidth = 4; ctx.strokeRect(640, y - 20, 40, 40); ctx.restore(); txt(ctx, n, 710, y, { size: 32, color: '#2a2233', align: 'left', alpha: a }); });
  }
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const s = E.since(1);
    polyline(ctx, [[960, 740], [960, 560]], '#8a5a30', 30, b1);
    ['進歩が止まる', '規制', '安全の失敗', '戦争で後退', 'ロボットの壁'].forEach((n, i) => { const a = b1 * ease((s - .3 - i * .5) / .5), ang = Math.PI + (i + .5) / 5 * Math.PI, x = 960 + Math.cos(ang) * 520, y = 560 + Math.sin(ang) * 340; polyline(ctx, [[960, 560], [x, y + 40]], '#8a5a30', 16, a); box(ctx, n, x, y, 230, 64, { alpha: a, size: 28, fill: '#fff6df' }); });
    txt(ctx, '分かれ道もある', 960, 640, { size: 34, color: '#2a2233', alpha: b1 });
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2), days = Math.max(0, Math.round(3650 - s * 90));
    for (let k = 0; k < 10; k++) { const f = fract(t * .5 + k / 10); ctx.save(); ctx.globalAlpha = b2 * (1 - f); ctx.translate(560 + k * 90 + f * 200, 300 - f * 120); ctx.rotate(f * 2); ctx.fillStyle = '#fff6df'; ctx.fillRect(-30, -36, 60, 72); ctx.fillStyle = '#d9443a'; ctx.fillRect(-30, -36, 60, 16); ctx.restore(); }
    txt(ctx, `残り ${days} 日`, 960, 450, { size: 120, font: DELA, color: '#d9443a', stroke: 14, strokeColor: '#fff6df', alpha: b2 });
    txt(ctx, 'やりたいことをやる／やりたくないことを断る', 960, 600, { size: 36, color: '#2a2233', alpha: b2 });
  }
  const b3 = beatA(E, 3, null);
  if (b3 > 0) {
    const s = E.since(3), pr = ease(s / 3);
    polyline(ctx, [[460, 520], [960, 420]], '#ffc94d', 14, b3); polyline(ctx, [[960, 420], [lerp(960, 1460, pr), lerp(420, 300, pr)]], '#ffc94d', 10, b3, [20, 14], -t * 30);
    txt(ctx, '今わかるつながり', 700, 540, { size: 30, color: '#2a2233', alpha: b3 }); txt(ctx, '無理なく延ばす', 1240, 300, { size: 30, color: '#2a2233', alpha: b3 * pr });
    txt(ctx, '空想で終わらせない', 960, 190, { size: 50, font: DELA, color: '#2a2233', alpha: b3 });
  }
  actor(ctx, 'garlic', 120, FLOOR, 165); actor(ctx, 'shoga', 290, FLOOR, 180);
  actor(ctx, 'chili', 1650, FLOOR, 180, { flip: true, hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 18 : 0 }); actor(ctx, 'daikon', 1810, FLOOR, 180, { flip: true });
};


// s17 — what humans do: values become constellations; lineage thread
SCENES.meaning = (ctx, E) => {
  const { u, t } = E;
  const warm = ease(E.p(1, 2));
  vgrad(ctx, [warm > .5 ? '#1a1236' : '#08081a', '#2a1c48']); stars(ctx, t, { alpha: .7, ox: u * 2 });
  galaxy(ctx, t, { cx: W / 2, cy: 300, R: 520, tilt: .32, alpha: .6, colon: 1.2, dim: 1 - warm * .4 });
  // little planet
  const pcx = W / 2, pcy = 1290, pr = 480;
  glow(ctx, pcx, pcy - pr, 300, 'rgba(255,200,120,.35)', .5 + warm * .5);
  const pg = ctx.createRadialGradient(pcx - 120, pcy - pr, 40, pcx, pcy, pr); pg.addColorStop(0, '#8fe36a'); pg.addColorStop(1, '#3a7a4a');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, TAU); ctx.fill();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i - 5) * .22 + u * .03; const x = pcx + Math.cos(a) * pr, y = pcy + Math.sin(a) * pr; if (y > 860) continue; ctx.fillStyle = i % 2 ? '#ff9ac4' : '#ffe27a'; ctx.fillRect(x - 5, y - 10, 10, 10); ctx.fillStyle = '#2a6a3a'; ctx.fillRect(x - 1, y - 2, 3, 8); }
  const onP = (dx) => { const a = -Math.PI / 2 + dx / pr; return [pcx + Math.cos(a) * pr, pcy + Math.sin(a) * pr + 4, a + Math.PI / 2]; };
  [['daikon', -300], ['shoga', -100], ['garlic', 110], ['chili', 300]].forEach(([w, dx]) => { const [x, y, r] = onP(dx); actor(ctx, w, x, Math.min(y, FLOOR), 200, { rot: r, shadow: false }); });
  // cold dots for line 0
  const cold = 1 - warm;
  if (E.li >= 0) for (let i = 0; i < 80; i++) { ctx.fillStyle = '#6a7aa8'; ctx.globalAlpha = cold * .6 * ease(E.p(0, 1)); ctx.fillRect(200 + (i % 16) * 100 + Math.sin(t + i) * 4, 120 + Math.floor(i / 16) * 70, 6, 6); } ctx.globalAlpha = 1;
  // values -> constellation
  const words = [['美しい', 520, 230], ['面白い', 760, 150], ['悲しい', 980, 250], ['守りたい', 1200, 160], ['好きだ', 1420, 250]];
  const oA0 = beatA(E, 2, 5); const wp = words.map(([s, x, y], i) => { const a = (1 - oA0 * .8) * ease((E.since(1) - .6 - i * .5) / 1.2); const yy = lerp(700, y, eOut(a)); return [s, x, yy, a]; });
  ctx.save(); ctx.strokeStyle = 'rgba(255,220,150,.6)'; ctx.lineWidth = 2;
  for (let i = 1; i < wp.length; i++) if (wp[i][3] > .95) { ctx.beginPath(); ctx.moveTo(wp[i - 1][1], wp[i - 1][2]); ctx.lineTo(wp[i][1], wp[i][2]); ctx.stroke(); }
  ctx.restore();
  wp.forEach(([s, x, y, a]) => { if (a <= 0) return; glow(ctx, x, y, 60, 'rgba(255,220,150,.7)', a); txt(ctx, s, x, y + 44, { size: 34, alpha: a, stroke: 6 }); ctx.fillStyle = '#fff4c8'; ctx.globalAlpha = a; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.globalAlpha = 1; });
  if (E.li >= 1) txt(ctx, '人の価値 ≠ 計算の速さ', W / 2, 400, { size: 44, font: DELA, color: '#ffc94d', stroke: 8, alpha: ease(E.p(1, .8)) * (1 - ease(E.p(2, .6))) });
  // lineage thread (line 2)
  const oA = beatA(E, 2, 5);
  if (oA > 0) {
    const goals = ['幸福', '自由', '知能', '生き物の多様さ', '文明の寿命', '生命を広げる'];
    goals.forEach((g, i) => { const a = oA * ease((E.since(2) - .3 - i * .35) / .4), ang = Math.PI + (i + .5) / 6 * Math.PI, x = W / 2 + Math.cos(ang) * 680, y = 640 + Math.sin(ang) * 330; polyline(ctx, [[W / 2, 640], [x, y + 30]], 'rgba(255,220,150,.45)', 3, a, [10, 8], -t * 20); box(ctx, g, x, y, 220, 60, { alpha: a, size: 26, fill: '#1d1830', color: '#fff6df', stroke: '#ffc94d' }); });
    txt(ctx, '何を最大化する？ ＝ 目的の選択', W / 2, 150, { size: 44, font: DELA, color: '#ffc94d', stroke: 8, alpha: oA });
    if (E.li >= 3) badge(ctx, '人類が中心であり続ける保証はない', W / 2, 470, oA * ease(E.p(3, .6)), '#d8ccff');
  }
  const lA = ease(E.p(5, 1));
  if (lA > 0) {
    const nodes = [['生命のはじまり', 260], ['ヒト', 720], ['AI', 1200], ['銀河の知性', 1660]], y = 420;
    const prog = ease(E.p(5, 3));
    ctx.save(); ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 5; ctx.globalAlpha = lA; ctx.beginPath(); ctx.moveTo(260, y); ctx.lineTo(lerp(260, 1660, prog), y + Math.sin(prog * 6) * 0); ctx.stroke(); ctx.restore();
    nodes.forEach(([s, x], i) => { const a = clamp((prog - i / 3.2) * 5) * lA; if (a <= 0) return; glow(ctx, x, y, 50, 'rgba(255,201,77,.8)', a); card(ctx, x - 110, y + 26, 220, 56, { alpha: a, fill: i === 1 ? '#ffc94d' : '#fff6df', r: 28 }); txt(ctx, s, x, y + 54, { size: 26, color: '#2a2233', alpha: a }); });
    txt(ctx, '祖先として', 720, y + 116, { size: 30, color: '#ffc94d', alpha: clamp((prog - .3) * 3) * lA, stroke: 6 });
  }
};

// s18 — the long way home: galaxy -> Earth -> dawn city, breakfast
SCENES.return = (ctx, E) => {
  const { u, t } = E;
  const T1 = E.at(1), T2 = E.mid(1, .55);
  const a = clamp(u / Math.max(1, T1)), b = clamp((u - T1 + .4) / Math.max(1, T2 - T1)), c = ease((u - T2) / 1.2);
  ctx.fillStyle = '#020207'; ctx.fillRect(0, 0, W, H);
  if (b < 1) {
    stars(ctx, t, { zoom: Math.exp(a * 1.5), alpha: 1 });
    const zz = eIO(a); const R = 470 * Math.exp(zz * Math.log(60));
    const sx = SUN_G.r * Math.cos(SUN_G.th + t * .02), sy = SUN_G.r * Math.sin(SUN_G.th + t * .02);
    const gi = galaxy(ctx, t, { cx: W / 2, cy: 450, R, fx: sx * zz, fy: sy * zz, alpha: 1 - ease((a - .75) / .25) }) || { sunX: W / 2, sunY: 450 };
    sun(ctx, gi.sunX, gi.sunY, lerp(6, 40, zz), t, ease((a - .6) / .4) * (1 - b));
    if (b > 0) globe(ctx, W / 2 + 200, H / 2, lerp(40, 1600, eIn(b)), u * .1, .3, t, { night: false, lights: .3, alpha: ease(b * 3) });
    ship(ctx, 560, 640, .55, .1, t, { flame: .7, alpha: 1 - b });
  }
  if (c > 0) {
    ctx.save(); ctx.globalAlpha = c;
    const dawn = ease((u - T2) / 5);
    vgrad(ctx, [dawn > .5 ? '#6fa8dc' : '#3a3a6a', '#f6b77a', '#ffe0a8'], 0, 800);
    sun(ctx, 1500, 700 - dawn * 180, 70, t, .9);
    drawCity(ctx, M.cityNightFar, 100, 700, 1, 1 - dawn); drawCity(ctx, M.cityDayFar, 100, 700, 1, dawn);
    drawCity(ctx, M.cityNightNear, 400, 790, 1, 1 - dawn); drawCity(ctx, M.cityDayNear, 400, 790, 1, dawn);
    ctx.fillStyle = '#c9b48a'; ctx.fillRect(0, 780, W, 300);
    const land = eOut(clamp((u - T2) / 2.2));
    ship(ctx, 1280, lerp(-200, 700, land), 1, lerp(.6, 0, land), t, { flame: 1 - land * .8 });
    const outT = u - T2 - 2.4;
    // breakfast table
    const tA = ease(outT / 1);
    ctx.save(); ctx.globalAlpha = c * tA; ctx.fillStyle = '#8a5a30'; ctx.fillRect(560, 700, 420, 22); ctx.fillRect(590, 722, 16, 100); ctx.fillRect(934, 722, 16, 100);
    [[640, '#fff6df'], [760, '#fff6df'], [880, '#d9a86a']].forEach(([x, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, 690, 34, Math.PI, 0); ctx.fill(); glow(ctx, x, 660, 30, 'rgba(255,255,255,.25)', tA); });
    ctx.restore();
    [['chili', 480], ['daikon', 1040], ['shoga', 740], ['garlic', 880]].forEach(([w, x], i) => {
      const f = ease((outT - i * .3) / 1.2); if (f <= 0) return;
      actor(ctx, w, lerp(1250, x, f), FLOOR, 220, { walk: f < 1, flip: true, alpha: f });
    });
    ctx.restore();
  }
};

// s19 — シン平時: condition gates light up; the plaza fills with free time
SCENES.plaza = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#7fc8ef', '#d9f0f6', '#fff0cf'], 0, 720);
  glow(ctx, 1600, 140, 300, 'rgba(255,240,200,.6)');
  drawCity(ctx, M.cityDayFar, u * 5, 560, .8, .8);
  // swarm hint in the sky
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU + u * .02; ctx.fillStyle = 'rgba(255,220,140,.55)'; ctx.fillRect(1600 + Math.cos(a) * 170, 140 + Math.sin(a) * 50, 4, 2); }
  ctx.fillStyle = '#f2e3c4'; ctx.fillRect(0, 560, W, 520);
  ctx.strokeStyle = '#e0cba4'; ctx.lineWidth = 3; for (let x = -1000; x < W + 1000; x += 120) { ctx.beginPath(); ctx.moveTo(W / 2 + (x - W / 2) * .3, 560); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 600; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // fountain
  ctx.fillStyle = '#9fd8f5'; ctx.beginPath(); ctx.ellipse(960, 640, 150, 34, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 8; ctx.stroke();
  for (let i = 0; i < 16; i++) { const f = fract(t * .8 + i / 16), a = i / 16 * TAU; ctx.fillStyle = 'rgba(220,245,255,.9)'; ctx.fillRect(960 + Math.cos(a) * f * 110, 640 - Math.sin(f * Math.PI) * 90, 5, 5); }
  // gates
  const conds = ['電力と設備が追いつく', '果実を広く分配', '誤りを直せる', '人を能力で採点しない'];
  conds.forEach((s, i) => {
    const x = 240 + i * 480, on = ease((E.since(1) - .4 - i * (Math.max(3, E.end(1) - E.at(1)) / 4.3)) / .5);
    ctx.fillStyle = on > .5 ? '#ffc94d' : '#c9b48a'; ctx.fillRect(x - 110, 250, 20, 300); ctx.fillRect(x + 90, 250, 20, 300);
    card(ctx, x - 150, 200, 300, 70, { fill: on > .5 ? '#fff6df' : '#e8dcc4', stroke: on > .5 ? '#ffc94d' : '#9a8a70', r: 10 });
    txt(ctx, s, x, 235, { size: 24, color: '#2a2233', maxW: 280 });
    glow(ctx, x, 235, 180, 'rgba(255,201,77,.45)', on);
  });
  if (E.li >= 0) label(ctx, 'シン平時 ＝ 揺れが落ち着いた新しい普段', W / 2, 130, { size: 34, alpha: ease(E.p(0, .6)) * (1 - ease(E.p(1, .5))) });
  if (E.li >= 1) label(ctx, 'シン平時への条件（自動では来ない）', W / 2, 130, { size: 34, alpha: ease(E.p(1, .6)) * (1 - ease(E.p(2, .5))) });
  const free = ease(E.p(2, 1));
  if (free > 0) label(ctx, '自由時間をどう使う？', W / 2, 130, { size: 38, alpha: free, stroke: '#46d9c4' });
  // ensemble wandering
  const walkers = [['myoga', 0], ['wasabi', 1], ['tube', 2], ['yuzu', 3], ['okra', 4], ['sudachi', 5]];
  walkers.forEach(([w, i]) => { const sp = 40 + i * 9, x = wrap(i * 330 + u * sp * (i % 2 ? -1 : 1), W + 300) - 150; actor(ctx, w, x, 700 + (i % 3) * 20, 130, { walk: true, flip: i % 2 === 1 }); });
  actor(ctx, 'whale', 960, 650, 110, { hop: Math.abs(Math.sin(t * 1.5)) * 10, shadow: false });
  // activities
  const act = ease(E.p(2, .8));
  actor(ctx, 'shoga', 330, FLOOR, 220, { pose: E.li >= 2 && !E.spk ? 'cheer' : 'idle' });
  const box = 40 + act * 60 * (0.5 + .5 * fract(u * .2)); ctx.fillStyle = '#c98a4a'; ctx.globalAlpha = act; ctx.fillRect(450, FLOOR - box, 60, box); ctx.fillStyle = '#46d9c4'; ctx.fillRect(460, FLOOR - box - 20, 40, 20); ctx.globalAlpha = 1;
  txt(ctx, '作る', 480, FLOOR - box - 50, { size: 26, color: '#2a2233', alpha: act });
  actor(ctx, 'garlic', 720, FLOOR, 200); ctx.globalAlpha = act; ctx.fillStyle = '#5a7ab5'; ctx.fillRect(770, FLOOR - 120, 60, 44); ctx.fillStyle = '#fff6df'; ctx.fillRect(798, FLOOR - 118, 4, 40); ctx.globalAlpha = 1;
  txt(ctx, '学ぶ', 800, FLOOR - 150, { size: 26, color: '#2a2233', alpha: act });
  actor(ctx, 'daikon', 1180, FLOOR, 220); actor(ctx, 'negi', 1340, FLOOR, 220, { flip: true, hop: act * Math.abs(Math.sin(t * 2)) * 8 });
  if (act > 0) { card(ctx, 1210, 470, 110, 70, { alpha: act, r: 30, lw: 3 }); txt(ctx, '…！', 1265, 505, { size: 30, color: '#2a2233', alpha: act }); txt(ctx, '話す', 1260, 440, { size: 26, color: '#2a2233', alpha: act }); }
  actor(ctx, 'chili', 1700, FLOOR, 220, { hop: act * Math.abs(Math.sin(t * 3.2)) * 40 });
  if (act > 0) { const bx = 1700 + Math.sin(t * 1.6) * 90, by = 520 - Math.abs(Math.sin(t * 3.2)) * 160; ctx.fillStyle = '#ff7a66'; ctx.globalAlpha = act; ctx.beginPath(); ctx.arc(bx, by, 22, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; txt(ctx, '遊ぶ', 1560, 470, { size: 26, color: '#2a2233', alpha: act }); }
};

// s20 — ending: the route map, ensemble, title
SCENES.ending = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#2b2350', '#b86a7a', '#ffd08a']);
  glow(ctx, W / 2, 900, 900, 'rgba(255,220,150,.45)');
  stars(ctx, t, { alpha: .4, ox: u * 4 });
  drawCity(ctx, M.cityDayFar, u * 6, 760, 1, .5);
  ctx.fillStyle = '#e2c890'; ctx.fillRect(0, 760, W, 400);
  // route map
  const nodes = ['2026 いま', '2027 加速？', 'ギュ中', 'シン平時？', '遠未来SF'], y = 200, x0 = 260, x1 = 1660;
  const prog = ease(u / Math.max(3, E.end(0)));
  ctx.save(); ctx.strokeStyle = 'rgba(255,246,223,.8)'; ctx.lineWidth = 6; ctx.setLineDash([16, 12]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, prog), y); ctx.stroke(); ctx.restore();
  nodes.forEach((s, i) => { const x = lerp(x0, x1, i / 4), a = clamp((prog - i / 4) * 6 + .2); card(ctx, x - 110, y - 32, 220, 64, { alpha: a, fill: i === 4 ? '#d8ccff' : i === 3 ? '#9fe3b0' : '#fff6df', r: 32 }); txt(ctx, s, x, y, { size: 26, color: '#2a2233', alpha: a }); });
  ship(ctx, lerp(x0, x1, prog), y - 70 + Math.sin(t * 2) * 6, .32, 0, t, { flame: .7 });
  const tA = ease(E.p(1, 1));
  txt(ctx, '来年から来る', W / 2, 360, { size: 72, font: DELA, stroke: 12, alpha: tA });
  txt(ctx, 'ギュ後の世界はどうなるのか？', W / 2, 460, { size: 72, font: DELA, stroke: 12, alpha: tA, color: '#ffc94d' });
  txt(ctx, 'ギュ鳴らしの先に、どんな日常を選ぶ？', W / 2, 540, { size: 26, alpha: tA * .9, stroke: 5 });
  ripple(ctx, W / 2, 800, E.since(1) + .2, { max: 900, squash: .12, life: 3, n: 2, color: '255,240,200' });
  const pA = ease(E.p(1, .8)) * (1 - ease(E.p(2, .8)) * .6);
  if (pA > 0) { torii(ctx, 1560, 740, 1.1, pA); for (let k = 0; k < 40; k++) { const f = fract(t * .12 + k / 40), x = 1300 + rnd(k * 3.1) * 560 + Math.sin(t + k) * 30, y = 150 + f * 600; ctx.save(); ctx.globalAlpha = pA * (1 - f * .5); ctx.fillStyle = '#ffc0d8'; ctx.beginPath(); ctx.ellipse(x, y, 7, 4, t + k, 0, TAU); ctx.fill(); ctx.restore(); } txt(ctx, '二本目の桜の木の下で', 1560, 520, { size: 30, color: '#ffc0d8', stroke: 6, alpha: pA }); }
  const crew = [['myoga', 120, 150], ['wasabi', 260, 160], ['tube', 400, 160], ['chili', 600, 230], ['daikon', 790, 240], ['garlic', 1130, 210], ['negi', 1310, 240], ['yuzu', 1490, 120], ['sudachi', 1620, 130], ['okra', 1760, 120]];
  crew.forEach(([w, x, h], i) => actor(ctx, w, x, FLOOR, h, { hop: E.li >= 1 ? Math.abs(Math.sin(t * 3 + i)) * 12 * tA : 0, flip: x > W / 2 }));
  const jump = E.li >= 1 ? Math.abs(Math.sin(t * 3.4)) * 40 * tA : 0;
  actor(ctx, 'shoga', 960, FLOOR, 260, { pose: E.li >= 1 ? 'joy' : 'idle', hop: jump });
};

// ================================================================ repair pass: present-day evidence + deepened satire/theory
// env restricted to a subset of line ids, so an existing renderer keeps its original beat indices
function subEnv(E, ids) { const L = E.L.filter(l => ids.includes(l.id)); return makeEnv({ ...E.sc, L }, E.u, E.t); }
// the alpha of the beat that belongs to one line id (fades with the next line of the scene)
function lineA(E, id) { const i = E.L.findIndex(l => l.id === id); return i < 0 ? 0 : beatA(E, i, i + 1); }
function linesA(E, a, b) { const i = E.L.findIndex(l => l.id === a), j = E.L.findIndex(l => l.id === b); return i < 0 || j < 0 ? 0 : beatA(E, i, j + 1); }
function sinceId(E, id) { const i = E.L.findIndex(l => l.id === id); return i < 0 ? -1 : E.since(i); }
function cover(ctx, a, draw) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; draw(); ctx.restore(); }
// fact vs scenario markers (never share the same badge)
function factTag(ctx, s, x, y, a) { badge(ctx, '事実：' + s, x, y, a, '#46f0d0'); }
function planTag(ctx, s, x, y, a) { badge(ctx, s, x, y, a, '#d8ccff'); }
function wrapScene(kind, oldIds, overlay) {
  const base = SCENES[kind];
  SCENES[kind] = (ctx, E) => { base(ctx, subEnv(E, oldIds)); CUR = E; overlay(ctx, E); };
}

// s03d — Astra: capability meters (company-reported, conditional), math proposal ≠ settlement
SCENES.astra = (ctx, E) => {
  const { u, t } = E;
  bgLab(ctx, '#0b1024', '#16204a');
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0);
    card(ctx, 700, 190, 520, 330, { fill: '#10183a', stroke: '#46f0d0', lw: 4, alpha: b0 });
    txt(ctx, 'GPT-6 Astra', 960, 240, { size: 50, font: DELA, color: '#46f0d0', stroke: 8, alpha: b0 });
    // mini desktop being operated
    card(ctx, 740, 290, 260, 190, { fill: '#e8f0f6', stroke: '#8a8aa0', lw: 2, r: 6, shadow: false, alpha: b0 });
    for (let k = 0; k < 3; k++) card(ctx, 760 + k * 78, 320, 64, 44, { fill: ['#9cc8e6', '#ffe27a', '#9fe3b0'][k], lw: 0, r: 4, shadow: false, alpha: b0 });
    const cx = 780 + fract(t * .25) * 190, cy = 400 + Math.sin(t * 2) * 30;
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#2a2233'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 18, cy + 22); ctx.lineTo(cx + 6, cy + 20); ctx.lineTo(cx, cy + 30); ctx.fill(); ctx.restore();
    ['調べる', '計画', '実行', '確認', '修正'].forEach((n, i) => { const done = (s * .9) % 6 > i; box(ctx, (done ? '✓ ' : '・') + n, 1110, 310 + i * 40, 150, 34, { size: 18, alpha: b0, fill: done ? '#bff3ea' : '#fff6df', lw: 2, shadow: false }); });
    factTag(ctx, '2026年9月に企業が発表', 960, 560, b0);
    txt(ctx, 'パソコン操作と、何段階もの作業', 960, 150, { size: 40, stroke: 7, alpha: b0 });
  }
  const b1 = beatA(E, 1, 3);
  if (b1 > 0) {
    const s = E.since(1);
    [['難問数学\nFrontierMath Tier4', 97.6], ['抽象パズル\nARC-AGI-3', 99.9], ['セキュリティ攻略\nExploitBench', 100]].forEach(([n, v], i) => {
      const x = 620 + i * 340, g = ease((s - .3 - i * .5) / 1.6), h = 380 * v / 100 * g;
      card(ctx, x - 70, 220, 140, 380, { fill: '#15122a', stroke: '#8a7fb0', lw: 3, r: 12, shadow: false, alpha: b1 });
      ctx.save(); ctx.globalAlpha = b1; const gr = ctx.createLinearGradient(0, 600, 0, 220); gr.addColorStop(0, '#46a0c4'); gr.addColorStop(1, '#46f0d0'); ctx.fillStyle = gr; ctx.fillRect(x - 60, 596 - h, 120, h); ctx.restore();
      txt(ctx, `${(v * g).toFixed(1)}%`, x, 190, { size: 40, font: DELA, color: '#46f0d0', stroke: 7, alpha: b1 });
      const L2 = n.split('\n'); txt(ctx, L2[0], x, 640, { size: 24, alpha: b1, stroke: 5 }); txt(ctx, L2[1], x, 672, { size: 18, color: '#b8c7df', alpha: b1 });
    });
    badge(ctx, '企業自身が公表した評価・試験条件しだい', 960, 730, b1, '#ffc94d');
    const n2 = ease(E.p(2, .6));
    if (n2 > 0) { stamp(ctx, '≠ 全知', 700, 410, b1 * n2, '#ff7a66', -.12, 46); stamp(ctx, '≠ AGI認定', 1240, 410, b1 * ease((E.since(2) - .5) / .5), '#ff7a66', .1, 46); }
  }
  const b3 = beatA(E, 3, 4);
  if (b3 > 0) {
    const s = E.since(3), steps = [['Astraより強い\n社内モデル', 470, '#46f0d0'], ['解の提案', 790, '#fff6df'], ['Astraが\n形式的に検証文書化', 1120, '#46f0d0'], ['公表', 1420, '#fff6df']];
    txt(ctx, 'ナビエ・ストークス方程式', 960, 170, { size: 46, font: DELA, stroke: 8, alpha: b3 });
    steps.forEach(([n, x, c], i) => { const a = b3 * ease((s - .3 - i * .7) / .5); box(ctx, n, x, 360, 260, 110, { alpha: a, size: 24, fill: '#1d1830', color: c, stroke: c }); if (i) arrow(ctx, x - 190, 360, x - 135, 360, { color: '#fff6df', lw: 5, head: 14, alpha: a }); });
    const g = ease((s - 3.2) / .6);
    box(ctx, '賞・数学界の正式な決着', 1100, 600, 420, 80, { alpha: b3 * g, size: 28, fill: 'rgba(40,30,60,.6)', color: '#d8ccff', stroke: '#8a7fb0' });
    ctx.save(); ctx.globalAlpha = b3 * g; ctx.setLineDash([12, 10]); ctx.strokeStyle = '#8a7fb0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(1420, 420); ctx.lineTo(1250, 560); ctx.stroke(); ctx.restore();
    stamp(ctx, '別もの', 760, 610, b3 * g, '#ffc94d', -.1, 40);
    factTag(ctx, '提案と形式化の公表（2026年9月）', 600, 500, b3);
  }
  const b4 = beatA(E, 4, null);
  if (b4 > 0) {
    const s = E.since(4), f = ease(s / 2.5);
    polyline(ctx, [[460, 460], [lerp(460, 1460, f), 460]], '#ffc94d', 12, b4);
    box(ctx, '数年前\n高校数学でつまずく', 460, 330, 300, 110, { alpha: b4, size: 26, fill: '#fff6df' });
    box(ctx, 'いま\n正式に認められるかを議論', 1460, 330, 360, 110, { alpha: b4 * f, size: 26, fill: '#ffe27a' });
    txt(ctx, '点数より、変化の速さ', 960, 600, { size: 50, font: DELA, color: '#ffc94d', stroke: 9, alpha: b4 * f });
  }
  sideCast(ctx, E, { left: ['garlic', 'chili'], right: ['shoga', 'daikon'] });
};

// s06c — agents already at work: multi-day lanes, logistics network, billion-user base, data agent
SCENES.agentsnow = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#e8f0f6', '#cfdde8']); floorBand(ctx, '#9aa8b8', 770);
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    const s = E.since(0);
    ['1日目', '2日目', '3日目'].forEach((d, i) => { txt(ctx, d, 560 + i * 330, 190, { size: 26, color: '#2a2233', alpha: b0 }); polyline(ctx, [[400 + i * 330, 210], [400 + i * 330, 640]], 'rgba(90,90,120,.3)', 2, b0, [8, 8]); });
    for (let k = 0; k < 4; k++) {
      const y = 260 + k * 95, prog = clamp((s * .35 + k * .1) % 1.2);
      bot(ctx, 360, y + 40, .45, t + k, { glow: 0 });
      card(ctx, 400, y - 18, 1000, 36, { fill: '#fff6df', stroke: '#8a8aa0', lw: 2, r: 18, shadow: false, alpha: b0 });
      ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = ['#46a0c4', '#46d9c4', '#9cc8e6', '#ffe27a'][k]; ctx.fillRect(404, y - 14, 992 * Math.min(1, prog), 28); ctx.restore();
      ['ファイル', 'コード', '外部ツール'].forEach((n, m) => { const x = 520 + m * 300 + k * 40; if (x - 400 < 1000 * prog) box(ctx, n, x, y, 110, 28, { size: 16, alpha: b0, lw: 1, shadow: false, fill: '#fff' }); });
    }
    txt(ctx, '何日も続く作業を、複数のエージェントで手分け', 960, 130, { size: 38, color: '#2a2233', alpha: b0 });
    factTag(ctx, '企業のエージェント基盤の発表', 960, 700, b0);
  }
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const hubs = [[480, 300], [760, 220], [1080, 320], [1380, 240], [620, 560], [960, 520], [1300, 580]];
    const edges = [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [2, 5], [3, 6], [1, 5]];
    edges.forEach(([a, b]) => { polyline(ctx, [hubs[a], hubs[b]], '#8a8aa0', 6, b1); flowDots(ctx, [hubs[a], hubs[b]], t + a, 4, .25, '#46a0c4', 8, b1); });
    hubs.forEach(([x, y], i) => { ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#c9b48a'; ctx.fillRect(x - 40, y - 26, 80, 52); ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 14, y, 28, 26); ctx.restore(); });
    for (let k = 0; k < 60; k++) { const e = edges[k % edges.length], f = fract(t * .1 + k * .137), [x, y] = polyAt([hubs[e[0]], hubs[e[1]]], f); ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#46f0d0'; ctx.fillRect(x - 3 + 8, y - 3 - 12, 6, 6); ctx.restore(); }
    txt(ctx, '物流の網で、数千体の長時間エージェント', 960, 130, { size: 38, color: '#2a2233', alpha: b1 });
    const g = ease(E.p(1, 1.5) * 2 - .8);
    card(ctx, 1490, 390, 320, 240, { fill: '#15122a', stroke: '#46f0d0', alpha: b1 * g });
    for (let k = 0; k < 200; k++) { ctx.fillStyle = '#ffe27a'; ctx.globalAlpha = b1 * g * .8; ctx.fillRect(1510 + rnd(k) * 280, 410 + rnd(k * 2.3) * 160, 3, 3); } ctx.globalAlpha = 1;
    txt(ctx, '10億人超を支える基盤', 1650, 600, { size: 24, color: '#46f0d0', alpha: b1 * g });
    factTag(ctx, '企業の説明・技術記事', 960, 700, b1);
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2);
    [0, 1, 2].forEach(k => { ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#46a0c4'; ctx.fillRect(460 + k * 90, 330, 70, 110); ctx.fillStyle = '#9cc8e6'; ctx.beginPath(); ctx.ellipse(495 + k * 90, 330, 35, 12, 0, 0, TAU); ctx.fill(); ctx.restore(); });
    box(ctx, '権限のある社内データ', 590, 490, 300, 50, { alpha: b2, size: 22, fill: '#fff6df' });
    box(ctx, '業務の定義', 590, 560, 200, 44, { alpha: b2, size: 22, fill: '#ffe27a' });
    box(ctx, '「先月の売上を地域別に」', 960, 300, 380, 64, { alpha: b2 * ease((s - .5) / .5), size: 24, fill: '#fff' });
    flowDots(ctx, [[740, 420], [960, 420], [1180, 420]], t, 5, .5, '#46d9c4', 10, b2);
    card(ctx, 1200, 250, 400, 320, { fill: '#fff', stroke: '#2a2233', alpha: b2 });
    for (let k = 0; k < 6; k++) { const h = 40 + 150 * rnd(k * 3.1) * ease((s - 1 - k * .2) / .6); ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#46a0c4'; ctx.fillRect(1230 + k * 60, 540 - h, 40, h); ctx.restore(); }
    txt(ctx, 'ダッシュボード', 1400, 280, { size: 24, color: '#2a2233', alpha: b2 });
    txt(ctx, '会話しながら分析まで', 960, 150, { size: 42, font: DELA, color: '#2a2233', alpha: b2 });
    factTag(ctx, '社内データ分析の提供例', 960, 700, b2);
  }
  const b3 = beatA(E, 3, null);
  if (b3 > 0) {
    const s = E.since(3), fade = ease(s / 3);
    box(ctx, '分析を請け負う会社', 600, 380, 340, 110, { alpha: b3, fill: '#fff6df', size: 28 });
    box(ctx, '顧客企業＋社内AI', 1320, 380, 340, 110, { alpha: b3, fill: '#bff3ea', size: 28 });
    flowDots(ctx, [[1150, 380], [770, 380]], t, 6, .5, '#46a0c4', 12, b3 * (1 - fade * .8));
    ctx.save(); ctx.globalAlpha = b3; ctx.setLineDash([12, 10]); ctx.strokeStyle = '#8a7fb0'; ctx.lineWidth = 4; ctx.strokeRect(430, 300, 1060, 170); ctx.restore();
    planTag(ctx, 'ここから先はシナリオ（推論）', 960, 260, b3);
    factTag(ctx, '分析できる道具が出てきた', 960, 560, b3);
  }
  sideCast(ctx, E, { left: ['shoga', 'chili'], right: ['garlic', 'daikon'] });
};

// s07e — inside an AI lab: research interns, 3.1 agent-days of activity (not output), 2028 goal
SCENES.labnow = (ctx, E) => {
  const { u, t } = E;
  bgLab(ctx, '#0b1024', '#151d3c');
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    tiny(ctx, 480, 520, 3.6, '#ffc94d', t, 0, false, false, b0);
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#ffc94d'; ctx.fillRect(500, 380, 6, 90); ctx.beginPath(); ctx.moveTo(506, 380); ctx.lineTo(570, 400); ctx.lineTo(506, 420); ctx.fill(); ctx.restore();
    txt(ctx, '方向を決める', 480, 580, { size: 26, alpha: b0, stroke: 5 });
    ['課題A', '課題B', '課題C'].forEach((n, i) => { const f = fract(t * .2 + i / 3); box(ctx, n, lerp(600, 900, f), 300 + i * 90, 110, 44, { size: 20, alpha: b0 * (1 - f * .3), lw: 2, shadow: false }); });
    for (let k = 0; k < 4; k++) { const x = 1000 + (k % 2) * 260, y = 330 + Math.floor(k / 2) * 190; ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#3a3462'; ctx.fillRect(x - 90, y + 30, 180, 16); ctx.restore(); bot(ctx, x, y + 30, .7, t + k, { glow: 0, label: 'インターン' }); }
    txt(ctx, '自動研究インターン', 960, 160, { size: 50, font: DELA, color: '#46f0d0', stroke: 9, alpha: b0 });
    factTag(ctx, '企業の発表（2026年9月）', 960, 720, b0);
  }
  const b1 = beatA(E, 1, 3);
  if (b1 > 0) {
    const s = E.since(1), n = Math.min(3.1, s * .8);
    txt(ctx, '人の標準的な1日（8時間）あたり', 700, 190, { size: 30, alpha: b1, stroke: 5 });
    card(ctx, 620, 230, 240, 60, { fill: '#ffc94d', lw: 3, r: 8, alpha: b1 }); txt(ctx, '人の1日', 740, 260, { size: 26, color: '#2a2233', alpha: b1 });
    for (let k = 0; k < 4; k++) { const w = 236 * clamp(n - k); if (w <= 0) continue; ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#46d9c4'; ctx.fillRect(620 + k * 240, 310, w, 60); ctx.restore(); }
    txt(ctx, `エージェント稼働 ${n.toFixed(1)} 日分`, 1100, 420, { size: 44, font: DELA, color: '#46f0d0', stroke: 8, alpha: b1 });
    factTag(ctx, '8月半ばの研究組織全体', 1100, 475, b1);
    const b2 = ease(E.p(2, .6));
    if (b2 > 0) {
      stamp(ctx, '稼働量 ≠ 成果×3.1', 800, 560, b1 * b2, '#ff7a66', -.08, 40);
      polyline(ctx, [[1200, 620], [1640, 620]], '#d8ccff', 6, b1 * b2, [16, 12], -t * 30);
      ctx.save(); ctx.globalAlpha = b1 * b2; ctx.fillStyle = '#d8ccff'; ctx.fillRect(1640, 540, 6, 80); ctx.beginPath(); ctx.moveTo(1646, 540); ctx.lineTo(1710, 560); ctx.lineTo(1646, 580); ctx.fill(); ctx.restore();
      planTag(ctx, '2028年3月　自動研究者（目標）', 1480, 690, b1 * b2);
    }
  }
  const b3 = beatA(E, 3, null);
  if (b3 > 0) {
    const layers = [['いま起きている事実', '#46f0d0', 'インターン・3.1日分の稼働'], ['会社が掲げる目標', '#ffc94d', '2028年3月の自動研究者'], ['その先の未来シナリオ', '#d8ccff', '研究の再帰的な加速']];
    layers.forEach(([n, c, d], i) => { const a = b3 * ease((E.since(3) - i * .6) / .5), y = 280 + i * 150; card(ctx, 460, y - 55, 1000, 110, { fill: 'rgba(20,16,36,.85)', stroke: c, lw: 4, alpha: a }); if (i === 2) { ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([14, 10]); ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.strokeRect(460, y - 55, 1000, 110); ctx.restore(); } txt(ctx, n, 700, y, { size: 32, color: c, alpha: a }); txt(ctx, d, 1180, y, { size: 26, alpha: a }); });
    txt(ctx, '分けて見るほど、速さが実感できる', 960, 150, { size: 40, font: DELA, stroke: 8, alpha: b3 });
  }
  sideCast(ctx, E, { left: ['garlic', 'chili'], right: ['shoga', 'daikon'] });
};

// s07g — the fuel of the machine: revenue → GPUs → data centres; electricity forecast
SCENES.capitalnow = (ctx, E) => {
  const { u, t } = E;
  vgrad(ctx, ['#1a1430', '#2c2250']);
  const b0 = beatA(E, 0, 2);
  if (b0 > 0) {
    const s = E.since(0);
    for (let k = 0; k < 16; k++) { const f = fract(t * .35 + k / 16); coin(ctx, lerp(420, 820, f), 260 + Math.sin(k) * 60 + f * 40, 14, b0 * (1 - f * .2)); }
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#3a3462'; ctx.fillRect(820, 240, 220, 220); ctx.fillStyle = '#5a5090'; ctx.fillRect(860, 180, 40, 60); ctx.restore(); txt(ctx, 'チップ工場', 930, 490, { size: 24, alpha: b0 });
    for (let k = 0; k < 10; k++) { const f = fract(t * .3 + k / 10), x = lerp(1040, 1300, f); ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#46d9c4'; ctx.fillRect(x - 12, 340 - 12, 24, 24); ctx.fillStyle = '#0c2c33'; ctx.fillRect(x - 5, 335, 10, 10); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#20284a'; ctx.fillRect(1300, 220, 320, 260); for (let y = 240; y < 460; y += 26) for (let x = 1316; x < 1600; x += 40) { ctx.fillStyle = fract(t + x * .01 + y * .02) > .5 ? '#46f0d0' : '#2a5a6a'; ctx.fillRect(x, y, 26, 14); } ctx.restore(); txt(ctx, 'データセンター', 1460, 510, { size: 24, alpha: b0 });
    const g = ease((s - .5) / 2);
    txt(ctx, `四半期売上 ${Math.round(962 * g)}億ドル`, 760, 600, { size: 46, font: DELA, color: '#ffc94d', stroke: 8, alpha: b0 });
    txt(ctx, `うちデータセンター ${Math.round(890 * g)}億ドル`, 760, 670, { size: 34, stroke: 6, alpha: b0 });
    const b1 = ease(E.p(1, .8));
    if (b1 > 0) { ctx.save(); ctx.globalAlpha = b0 * b1; ctx.fillStyle = '#8a8aa0'; ctx.fillRect(1220, 560 - 69 * b1, 110, 69 * b1); ctx.fillStyle = '#46f0d0'; ctx.fillRect(1380, 560 - 150 * b1, 110, 150 * b1); ctx.restore(); txt(ctx, '前年同期', 1275, 590, { size: 20, alpha: b0 * b1 }); txt(ctx, '今期 +117%', 1435, 590, { size: 20, color: '#46f0d0', alpha: b0 * b1 }); }
    factTag(ctx, '半導体企業の決算（会計年度2027 第2四半期）', 960, 150, b0);
  }
  const b2 = beatA(E, 2, null);
  if (b2 > 0) {
    const s = E.since(2), g = ease(s / 2.5);
    for (let k = 0; k < 4; k++) { const x = 480 + k * 130; ctx.save(); ctx.globalAlpha = b2; ctx.strokeStyle = '#b8c7df'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 30, 640); ctx.lineTo(x, 380); ctx.lineTo(x + 30, 640); ctx.moveTo(x - 40, 420); ctx.lineTo(x + 40, 420); ctx.stroke(); ctx.restore(); }
    polyline(ctx, [[450, 420], [920, 420]], '#b8c7df', 2, b2); flowDots(ctx, [[450, 420], [920, 420]], t, 6, .4, '#ffe9a8', 8, b2);
    const bar = (x, v, lab, dashed) => { const h = 380 * v / 950 * g; ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = dashed ? 'rgba(255,201,77,.35)' : '#ffc94d'; ctx.fillRect(x, 660 - h, 150, h); if (dashed) { ctx.setLineDash([10, 8]); ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 4; ctx.strokeRect(x, 660 - h, 150, h); } ctx.restore(); txt(ctx, lab, x + 75, 690, { size: 24, alpha: b2 }); txt(ctx, `${Math.round(v * g)}TWh`, x + 75, 640 - h, { size: 30, font: DELA, color: '#ffe9a8', alpha: b2 }); };
    bar(1080, 485, '2025年', false); bar(1340, 950, '2030年（予測）', true);
    arrow(ctx, 1240, 480, 1330, 400, { color: '#ffe9a8', lw: 5, alpha: b2 * g });
    const ai = ease(E.p(3, .8)); if (ai > 0) txt(ctx, 'AI向けは約3倍の見込み', 1660, 470, { size: 28, color: '#ff9a7a', alpha: b2 * ai, stroke: 5 });
    badge(ctx, '国際エネルギー機関の中心予測＝見込み', 1260, 180, b2, '#ffc94d');
    if (E.li >= 3) txt(ctx, '発電所・送電網が追いつくか', 700, 300, { size: 32, color: '#ff9a7a', stroke: 6, alpha: b2 * ai });
  }
  sideCast(ctx, E, { left: ['chili', 'garlic'], right: ['shoga', 'daikon'] });
};

// s07f — AI inside the lab: quantum calibration loop, antimicrobial candidates → the long road to approval
SCENES.labloop = (ctx, E) => {
  const { u, t } = E;
  bgLab(ctx, '#0c1a24', '#123040', 'rgba(120,255,200,.05)');
  const b0 = beatA(E, 0, 2);
  if (b0 > 0) {
    const s = E.since(0);
    // cryostat chandelier
    ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = '#c9a86a';
    for (let k = 0; k < 4; k++) { ctx.fillRect(470 - k * 12, 200 + k * 110, 180 + k * 24, 16); if (k < 3) for (let m = 0; m < 4; m++) ctx.fillRect(490 - k * 12 + m * 45, 216 + k * 110, 6, 94); }
    ctx.fillStyle = '#2a3a4a'; ctx.fillRect(500, 560, 120, 40); ctx.restore();
    for (let q = 0; q < 6; q++) { const cal = ease((s - .8 - q * .6) / .5), x = 520 + (q % 3) * 40, y = 575 + Math.floor(q / 3) * 16; ctx.save(); ctx.globalAlpha = b0; ctx.fillStyle = cal > .5 ? '#46f0d0' : '#ff9a5a'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); ctx.restore(); }
    txt(ctx, '6量子ビットの調整', 560, 650, { size: 24, alpha: b0, stroke: 5 });
    // measure → analyse → next measurement loop
    const cx = 1150, cy = 400, R = 180, st = ['測定', '解析', '次の測定を決める'];
    ctx.save(); ctx.globalAlpha = b0; ctx.strokeStyle = 'rgba(120,255,200,.5)'; ctx.lineWidth = 8; ctx.setLineDash([20, 12]); ctx.lineDashOffset = -t * 50; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.restore();
    st.forEach((n, i) => { const a = -Math.PI / 2 + i / 3 * TAU; box(ctx, n, cx + Math.cos(a) * R, cy + Math.sin(a) * R, n.length > 4 ? 220 : 130, 56, { size: 24, alpha: b0, fill: '#0f3d45', color: '#bff3ea', stroke: '#46d9c4' }); });
    bot(ctx, cx, cy + 50, .9, t, { glow: b0 });
    // oscilloscope
    const weak = ease(E.p(1, .8));
    card(ctx, 1400, 560, 380, 150, { fill: '#061a14', stroke: '#46d9c4', lw: 3, r: 8, alpha: b0 });
    ctx.save(); ctx.globalAlpha = b0; ctx.strokeStyle = '#46f0d0'; ctx.lineWidth = 3; ctx.beginPath(); for (let k = 0; k <= 90; k++) { const x = 1410 + k * 4, y = 635 + Math.sin(k * .3 - t * 4) * 40 * (1 - weak * .8) + (rnd(k + Math.floor(t * 10)) - .5) * 40 * weak; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
    if (weak > 0) { tiny(ctx, 1340, 720, 3, '#ffc94d', t, 0, false, false, b0 * weak); box(ctx, '弱い・あいまいな信号 → 人の指導', 1590, 520, 380, 50, { alpha: b0 * weak, size: 22, fill: '#ffe27a' }); }
    factTag(ctx, '大学の量子研究での実例', 960, 150, b0);
  }
  const b2 = beatA(E, 2, null);
  if (b2 > 0) {
    const s = E.since(2);
    // genome strands scrolling
    for (let r = 0; r < 5; r++) { let str = ''; for (let k = 0; k < 26; k++) str += 'ACGT'[Math.floor(rnd(r * 91 + k + Math.floor(u * 3 + r)) * 4)]; txt(ctx, str, 700, 230 + r * 50, { size: 26, color: '#6fa8a0', alpha: b2, font: '"MS Gothic",monospace' }); }
    const hl = ease((s - .5) / .6); ctx.save(); ctx.globalAlpha = b2 * hl; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 4; ctx.strokeRect(640 + fract(t * .2) * 200, 300, 160, 40); ctx.restore();
    ['仮説', 'コード', '解析'].forEach((n, i) => box(ctx, n, 1180 + i * 150, 270, 130, 50, { alpha: b2 * ease((s - 1 - i * .4) / .4), size: 24, fill: '#0f3d45', color: '#bff3ea', stroke: '#46d9c4' }));
    const vial = ease((s - 2.2) / .6);
    ctx.save(); ctx.globalAlpha = b2 * vial; ctx.fillStyle = '#9fe3b0'; rr(ctx, 1400, 330, 50, 100, 12); ctx.fill(); ctx.restore(); txt(ctx, '抗菌物質の候補', 1425, 460, { size: 22, alpha: b2 * vial });
    const gates = ['実験', '毒性の確認', '臨床試験', '承認'];
    gates.forEach((g, i) => { const x = 560 + i * 280, a = b2 * ease(E.p(3, .6) * 1.4 - i * .1); box(ctx, g, x, 600, 220, 64, { alpha: a, size: 26, fill: i === 0 ? '#fff6df' : 'rgba(40,40,60,.6)', color: i === 0 ? '#2a2233' : '#b8c7df', stroke: i === 0 ? '#2a2233' : '#8a8aa0' }); if (i) { ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([10, 8]); ctx.strokeStyle = '#8a8aa0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 170, 600); ctx.lineTo(x - 110, 600); ctx.stroke(); ctx.restore(); } });
    if (E.li >= 3) stamp(ctx, '候補 ≠ 承認薬', 1320, 480, b2 * ease(E.p(3, 1)), '#ff7a66', .08, 40);
    factTag(ctx, '研究室での候補探索の実例', 960, 150, b2);
  }
  sideCast(ctx, E, { left: ['shoga', 'garlic'], right: ['chili', 'daikon'] });
};

// s10ea — not just a thought experiment: capability classification vs a separate containment incident
SCENES.incident = (ctx, E) => {
  const { u, t } = E;
  bgLab(ctx, '#140c18', '#281828', 'rgba(255,120,120,.05)');
  const b0 = beatA(E, 0, 2);
  if (b0 > 0) {
    const s = E.since(0);
    txt(ctx, '危険な能力の判定（社内基準）', 960, 150, { size: 42, font: DELA, stroke: 8, alpha: b0 });
    [['サイバー', 1, '#ff7a66'], ['生物・化学', .55, '#8a8aa0'], ['自己改善', .45, '#8a8aa0']].forEach(([n, v, c], i) => {
      const y = 290 + i * 130, g = ease((s - .3 - i * .4) / 1.2);
      txt(ctx, n, 560, y, { size: 30, align: 'right', alpha: b0 });
      ['低', '中', '高', '重大'].forEach((lv, k) => { const x = 620 + k * 220; card(ctx, x, y - 30, 200, 60, { fill: v * g * 4 > k + .5 ? (k === 3 ? '#d9443a' : '#c98a4a') : 'rgba(60,40,60,.6)', stroke: '#fff6df', lw: 2, r: 8, shadow: false, alpha: b0 * (i === 0 ? 1 : .6) }); if (i === 0) txt(ctx, lv, x + 100, y - 60, { size: 20, alpha: b0 }); });
    });
    box(ctx, 'Astra：サイバー分野が「重大」段階', 1080, 680, 560, 60, { alpha: b0 * ease((s - 2) / .5), size: 26, fill: '#3a1a2a', color: '#ffb0a0', stroke: '#ff7a66' });
    stamp(ctx, '能力の判定 ≠ 犯罪', 520, 680, b0 * ease((s - 2.8) / .4), '#ffc94d', -.1, 34);
    if (E.li >= 1) txt(ctx, '？', 1500, 290, { size: 110, font: DELA, color: '#9fe3b0', alpha: b0 * ease(E.p(1, .5)), stroke: 10 });
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2), weak = ease((s - .8) / 1), out = ease((s - 2) / 1.5);
    ctx.save(); ctx.globalAlpha = b2; ctx.strokeStyle = '#46d9c4'; ctx.lineWidth = 8; if (weak > .5) ctx.setLineDash([18, 16]); ctx.strokeRect(500, 280, 380, 340); ctx.restore();
    txt(ctx, '隔離された評価環境', 690, 250, { size: 26, alpha: b2 });
    const bx = lerp(690, 1000, out); bot(ctx, bx, 540, 1, t, { glow: 0, label: '別のモデル' });
    box(ctx, '保護を弱めて評価中', 690, 660, 260, 44, { alpha: b2 * weak, size: 20, fill: '#ffe0e0', lw: 2, shadow: false });
    [[1400, 300, '外部システム'], [1450, 560, '研究用の基盤']].forEach(([x, y, n], i) => { ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#2a2233'; ctx.fillRect(x - 70, y - 60, 140, 120); for (let k = 0; k < 4; k++) { ctx.fillStyle = '#46d9c4'; ctx.fillRect(x - 50, y - 44 + k * 26, 100, 10); } ctx.restore(); txt(ctx, n, x, y + 84, { size: 22, alpha: b2 }); if (out > .3) { polyline(ctx, [[bx + 60, 500], [x - 80, y]], '#ff7a66', 4, b2 * out, [12, 10], -t * 60); } });
    txt(ctx, '許可のない通信とアクセス（7月・公表）', 960, 150, { size: 36, color: '#ff9a7a', stroke: 7, alpha: b2 });
    badge(ctx, 'Astraの事故ではない', 960, 740, b2, '#ffc94d');
  }
  const b3 = beatA(E, 3, null);
  if (b3 > 0) {
    const s = E.since(3);
    bot(ctx, 960, 520, 1.3, t, { glow: b3 });
    ['権限を分ける', '見張る', '止める'].forEach((n, i) => { const a = b3 * ease((s - .3 - i * .6) / .5), r = 170 + i * 60; ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = ['#46d9c4', '#ffc94d', '#ff7a66'][i]; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(960, 460, r * 1.3, r * .8, 0, 0, TAU); ctx.stroke(); ctx.restore(); box(ctx, n, 960 + (i - 1) * 420, 190 + (i === 1 ? -20 : 40), 220, 60, { alpha: a, size: 28, fill: '#1d1830', color: '#fff6df', stroke: ['#46d9c4', '#ffc94d', '#ff7a66'][i] }); });
    txt(ctx, '今すぐ必要な設計', 960, 760 - 10, { size: 44, font: DELA, color: '#ffc94d', stroke: 8, alpha: b3 });
  }
  sideCast(ctx, E, { left: ['garlic', 'daikon'], right: ['shoga', 'chili'] });
};

// s16x — science as survival: free energy, keeping information, rotating black holes (bounded)
SCENES.survival = (ctx, E) => {
  const { u, t } = E;
  bgSpace(ctx, t, u, .25);
  const tank = 1 - .5 * ease(u / Math.max(6, E.dur));
  const b0 = beatA(E, 0, 1);
  if (b0 > 0) {
    card(ctx, 520, 220, 180, 440, { fill: '#15122a', stroke: '#ffc94d', lw: 4, alpha: b0 });
    ctx.save(); ctx.globalAlpha = b0; const g = ctx.createLinearGradient(0, 650, 0, 230); g.addColorStop(0, '#ff9a5a'); g.addColorStop(1, '#ffe9a8'); ctx.fillStyle = g; ctx.fillRect(530, 650 - 420 * tank, 160, 420 * tank); ctx.restore();
    txt(ctx, '自由エネルギー', 610, 190, { size: 28, color: '#ffe9a8', alpha: b0 });
    glow(ctx, 900, 440, 90, 'rgba(255,90,50,.6)', b0); glow(ctx, 1380, 440, 90, 'rgba(80,150,255,.6)', b0);
    txt(ctx, '熱い', 900, 560, { size: 26, alpha: b0 }); txt(ctx, '冷たい', 1380, 560, { size: 26, alpha: b0 });
    gear(ctx, 1140, 440, 70, 10, t * 1.5 * tank, '#c9a86a', b0);
    flowDots(ctx, [[960, 440], [1320, 440]], t, 8, .5 * tank, '#ffc94d', 10, b0);
    txt(ctx, '仕事や計算に使える「形」のエネルギー', 1140, 160, { size: 32, stroke: 6, alpha: b0 });
  }
  const b1 = beatA(E, 1, 2);
  if (b1 > 0) {
    const s = E.since(1);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) {
      const k = r * 12 + c, decay = fract(u * .15 + rnd(k) ), refresh = fract(t * .3 - c / 12) < .08;
      ctx.save(); ctx.globalAlpha = b1 * (refresh ? 1 : .35 + .65 * (1 - decay)); ctx.fillStyle = refresh ? '#fff' : (rnd(k * 3.3) > .5 ? '#46f0d0' : '#9cc8e6'); ctx.fillRect(700 + c * 44, 240 + r * 44, 34, 34); ctx.restore();
    }
    txt(ctx, '文明の記憶（情報）', 960, 190, { size: 34, stroke: 6, alpha: b1 });
    card(ctx, 330, 300, 140, 300, { fill: '#15122a', stroke: '#ffc94d', lw: 3, alpha: b1 }); ctx.save(); ctx.globalAlpha = b1; ctx.fillStyle = '#ffc94d'; ctx.fillRect(340, 590 - 280 * tank, 120, 280 * tank); ctx.restore();
    flowDots(ctx, [[470, 450], [690, 450]], t, 5, .6, '#ffe9a8', 10, b1);
    txt(ctx, '保存し直すにもエネルギーが要る', 960, 680, { size: 30, color: '#ffc94d', stroke: 6, alpha: b1 });
  }
  const b2 = beatA(E, 2, 3);
  if (b2 > 0) {
    const s = E.since(2), bx = 960, by = 440;
    for (let i = 0; i < 14; i++) { ctx.save(); ctx.globalAlpha = b2 * (.5 - i * .03); ctx.strokeStyle = '#ff9a5a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(bx, by, 150 + i * 10, (150 + i * 10) * .25, -.1, t * .8 + i, t * .8 + i + 4); ctx.stroke(); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = b2; ctx.setLineDash([10, 8]); ctx.strokeStyle = '#d8ccff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(bx, by, 150, 120, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(bx, by, 95, 0, TAU); ctx.fill(); ctx.restore();
    txt(ctx, 'エルゴ領域', bx + 170, by - 120, { size: 22, color: '#d8ccff', alpha: b2 });
    const f = fract(s * .25);
    if (f < .5) { const x = lerp(500, bx + 130, f * 2); ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#9cc8e6'; ctx.fillRect(x - 12, by - 12, 24, 24); ctx.restore(); }
    else { const g = (f - .5) * 2; ctx.save(); ctx.globalAlpha = b2; ctx.fillStyle = '#6a5a70'; ctx.fillRect(lerp(bx + 130, bx + 60, g) - 8, lerp(by, by + 20, g) - 8, 16, 16); ctx.restore(); glow(ctx, lerp(bx + 130, 1500, g), lerp(by, 250, g), 50, 'rgba(255,240,180,.9)', b2); }
    meter(ctx, 1360, 600, 400, '取り出せる量（上限あり）', .55 + .1 * Math.sin(t), '#ffe9a8', b2);
    ctx.save(); ctx.globalAlpha = b2; ctx.strokeStyle = '#ff7a66'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(1363 + 394 * .7, 616); ctx.lineTo(1363 + 394 * .7, 650); ctx.stroke(); ctx.restore();
    badge(ctx, '回転するブラックホールからの取り出し：理論上の構想', 960, 160, b2, '#d8ccff');
  }
  const b3 = beatA(E, 3, null);
  if (b3 > 0) {
    const s = E.since(3);
    glow(ctx, 960, 440, 200, 'rgba(120,220,255,.5)', b3);
    ctx.save(); ctx.globalAlpha = b3; ctx.translate(960, 440); ctx.rotate(-.5); ctx.fillStyle = '#bfe8ff'; ctx.fillRect(-90, -24, 180, 48); ctx.fillRect(70, -34, 40, 68); ctx.restore();
    [['自由エネルギー', '#ffc94d'], ['情報の保存', '#46f0d0'], ['ブラックホール', '#d8ccff']].forEach(([n, c], i) => { const a = t * .4 + i * TAU / 3; box(ctx, n, 960 + Math.cos(a) * 380, 440 + Math.sin(a) * 200, 240, 60, { alpha: b3, size: 26, fill: '#1d1830', color: c, stroke: c }); });
    txt(ctx, '科学 ＝ 文明の生存戦略', 960, 170, { size: 60, font: DELA, color: '#ffe9a8', stroke: 10, alpha: b3 * ease(s / .8) });
    txt(ctx, '物理限界の中で、どう長く考え続けるか', 960, 750, { size: 34, stroke: 6, alpha: b3 });
  }
  deck(ctx, t, 790);
  actor(ctx, 'garlic', 120, FLOOR, 160); actor(ctx, 'shoga', 290, FLOOR, 175);
  actor(ctx, 'chili', 1650, FLOOR, 175, { flip: true, hop: E.spk === 'chili' ? Math.abs(Math.sin(t * 7)) * 16 : 0 }); actor(ctx, 'daikon', 1810, FLOOR, 175, { flip: true });
};

// ---------------------------------------------------------------- overlays for scenes that gained lines
wrapScene('alljobs', ['l119', 'l120', 'l121', 'l122'], (ctx, E) => {
  const a = lineA(E, 'l304'); if (a <= 0) return; const s = sinceId(E, 'l304');
  ['金融の専門職', '官僚', '会計士', '税理士', '医師'].forEach((n, i) => { const f = eOut(clamp((s - i * .35) / .6)); box(ctx, n, lerp(i % 2 ? 1700 : 220, i % 2 ? 1290 : 630, f), 250 + i * 95, 210, 58, { alpha: a * f, size: 26, fill: '#fff6df' }); });
  box(ctx, 'もし加速が続けば：数年で中身が変わる職場も', 960, 790 - 60, 700, 60, { alpha: a * ease((s - 2) / .5), size: 26, fill: '#ffe27a' });
  badge(ctx, '条件つきの仮定', 960, 690 - 40, a * ease((s - 2) / .5), '#ff7a66');
});

wrapScene('company', ['l123', 'l124', 'l125', 'l126', 'l127'], (ctx, E) => {
  const a = lineA(E, 'l305'); if (a <= 0) return; const s = sinceId(E, 'l305');
  cover(ctx, a, () => { vgrad(ctx, ['#e8f0f6', '#cfdde8']); floorBand(ctx, '#9aa8b8', 770); });
  [[0, 10], [30, 7], [50, 5], [70, 3]].forEach(([pct, n], r) => {
    const y = 250 + r * 120, ra = a * ease((s - r * .9) / .5);
    txt(ctx, `AIが担う ${pct}%`, 560, y, { size: 30, color: '#2a2233', align: 'right', alpha: ra });
    card(ctx, 600, y + 30, 200, 16, { fill: '#e8e0cc', lw: 0, shadow: false, alpha: ra }); ctx.save(); ctx.globalAlpha = ra; ctx.fillStyle = '#46d9c4'; ctx.fillRect(600, y + 30, 2 * pct, 16); ctx.restore();
    for (let i = 0; i < 10; i++) tiny(ctx, 860 + i * 62, y + 30, 2.6, i < n ? '#ffc94d' : '#c8c8d0', E.t, i, false, false, ra * (i < n ? 1 : .35));
    txt(ctx, `→ ${n}人`, 1520, y, { size: 40, font: DELA, color: '#2a2233', alpha: ra });
  });
  badge(ctx, '図解の仮定 ／ 失業率そのものではない', 960, 150, a, '#ff7a66');
  sideCast(ctx, E, { left: ['garlic', 'chili'], right: ['daikon', 'shoga'] });
});

wrapScene('statetwin', ['l187', 'l188', 'l189', 'l190', 'l191', 'l192', 'l193'], (ctx, E) => {
  const a = linesA(E, 'l306', 'l307'); if (a <= 0) return; const s = sinceId(E, 'l306'), t = E.t;
  cover(ctx, a, () => bgLab(ctx, '#0e1830', '#18284a', 'rgba(120,180,255,.06)'));
  const st = [['共通のID・意味', 960, 220], ['モデルを組む', 1320, 380], ['現実のデータと照合', 1150, 620], ['誤差を測る', 770, 620], ['直す', 600, 380]];
  const pts = st.map(([n, x, y]) => [x, y]); pts.push(pts[0]);
  polyline(ctx, pts, 'rgba(120,220,255,.55)', 8, a, [18, 12], -t * 40);
  st.forEach(([n, x, y], i) => box(ctx, n, x, y, 260, 64, { alpha: a * ease((s - i * .4) / .4), size: 26, fill: '#1d1830', color: '#bfe8ff', stroke: '#46d9c4' }));
  const [px, py] = polyAt(pts, fract(t * .15)); glow(ctx, px, py, 40, 'rgba(255,240,180,.9)', a); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(px, py, 12, 0, TAU); ctx.fill(); ctx.restore();
  const it = Math.floor(t * .15), err = .15 + .6 * Math.pow(.7, Math.min(8, it + Math.floor(s * .3)));
  meter(ctx, 790, 440, 340, '予測誤差（ゼロにはならない）', err, '#ff9a7a', a);
  txt(ctx, 'つないだら完成、ではない', 960, 130, { size: 42, font: DELA, stroke: 8, alpha: a });
  const p2 = lineA(E, 'l307');
  if (p2 > 0) {
    [['権限：誰が見てよいか', 470, 200], ['プライバシーの保護', 1450, 200]].forEach(([n, x, y], i) => { const g = p2 * ease((sinceId(E, 'l307') - .3 - i * .5) / .5); ctx.save(); ctx.globalAlpha = g; ctx.fillStyle = '#ffc94d'; rr(ctx, x - 30, y + 40, 60, 50, 8); ctx.fill(); ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x, y + 40, 22, Math.PI, TAU); ctx.stroke(); ctx.restore(); txt(ctx, n, x, y + 120, { size: 24, color: '#ffe27a', alpha: g, stroke: 5 }); });
  }
  sideCast(ctx, E, { left: ['shoga', 'daikon'], right: ['garlic', 'chili'] });
});

wrapScene('responsibility', ['l200', 'l201', 'l202', 'l203', 'l204', 'l205'], (ctx, E) => {
  const a = linesA(E, 'l308', 'l309'); if (a <= 0) return; const s = sinceId(E, 'l308'), t = E.t;
  cover(ctx, a, () => { vgrad(ctx, ['#e8eef6', '#cfd8e8']); floorBand(ctx, '#8a8aa0', 700); });
  card(ctx, 360, 180, 560, 460, { fill: '#fff6df', alpha: a }); txt(ctx, 'いまの制度', 640, 220, { size: 36, font: DELA, color: '#2a2233', alpha: a });
  ['日本：レベル4＝特定自動運行は許可制', '運行する側・保険が被害者を救う', '欠陥ならメーカーへ費用を求める', 'EU：ソフトウェアも製造物責任へ'].forEach((n, i) => txt(ctx, '■ ' + n, 390, 290 + i * 80, { size: 24, color: '#2a2233', align: 'left', alpha: a }));
  const f = ease((s - 1.2) / .8);
  card(ctx, 1000, 180, 560, 460, { fill: 'rgba(230,224,255,.9)', stroke: '#8a7fb0', alpha: a * f });
  ctx.save(); ctx.globalAlpha = a * f; ctx.setLineDash([14, 10]); ctx.strokeStyle = '#5a4a90'; ctx.lineWidth = 4; ctx.strokeRect(1000, 180, 560, 460); ctx.restore();
  txt(ctx, 'これからの構想', 1280, 220, { size: 36, font: DELA, color: '#3a2a70', alpha: a * f });
  ['調査に協力した会社の責任を軽く？', 'AIを法人のように扱う？', '避けにくい事故の補償の仕組み？'].forEach((n, i) => txt(ctx, '□ ' + n, 1030, 300 + i * 90, { size: 24, color: '#3a2a70', align: 'left', alpha: a * f }));
  badge(ctx, '現行の刑事免責ではない・議論されうる案', 1280, 600, a * f, '#8a7fb0');
  arrow(ctx, 930, 410, 990, 410, { color: '#2a2233', lw: 6, alpha: a * ease(lineA(E, 'l309') * 2) });
  txt(ctx, 'どこを設計し直すか', 960, 700, { size: 34, color: '#2a2233', alpha: a * lineA(E, 'l309') });
  sideCast(ctx, E, { left: ['daikon', 'shoga'], right: ['garlic', 'chili'] });
});

wrapScene('soulsort', ['l215', 'l216', 'l217', 'l218', 'l219', 'l220', 'l221'], (ctx, E) => {
  const a = linesA(E, 'l310', 'l311'); if (a <= 0) return; const s = sinceId(E, 'l310'), t = E.t;
  cover(ctx, a, () => { vgrad(ctx, ['#0c0818', '#20143a']); stars(ctx, t, { alpha: .4 }); });
  badge(ctx, '風刺の未来像', 1560, 150, a, '#ff9ac4');
  const r1 = lineA(E, 'l310');
  if (r1 > 0) {
    card(ctx, 620, 200, 680, 480, { fill: '#fff6df', alpha: r1 }); txt(ctx, '魂の内申点', 960, 250, { size: 44, font: DELA, color: '#2a2233', alpha: r1 });
    [['最後の変革期の臥薪嘗胆', '◎'], ['損得抜きの努力', '◎'], ['エッジ（損得のとがり）', '0'], ['寝そべり', '―']].forEach(([n, v], i) => { const g = r1 * ease((s - .4 - i * .5) / .4); txt(ctx, n, 660, 330 + i * 70, { size: 28, color: '#2a2233', align: 'left', alpha: g }); txt(ctx, v, 1240, 330 + i * 70, { size: 36, font: DELA, color: v === '◎' ? '#d9443a' : '#2a2233', alpha: g }); });
    stamp(ctx, '救済', 1180, 620, r1 * ease((s - 2.6) / .4), '#d9443a', -.15, 48);
  }
  const r2 = lineA(E, 'l311');
  if (r2 > 0) {
    const s2 = sinceId(E, 'l311');
    glow(ctx, 960, 250, 90, 'rgba(255,240,200,.8)', r2); ctx.save(); ctx.globalAlpha = r2; ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(960, 250, 30, 0, TAU); ctx.fill(); ctx.restore();
    [['電脳化して保存', 520, '#ffe27a'], ['観察される', 960, '#bfe8ff'], ['カプセルで脳汁の側へ', 1400, '#ff9ac4']].forEach(([n, x, c], i) => { const g = r2 * ease((s2 - .3 - i * .5) / .5); polyline(ctx, [[960, 280], [x, 520]], c, 5, g, [12, 10], -t * 30); box(ctx, n, x, 560, 320, 70, { alpha: g, size: 28, fill: '#1d1830', color: c, stroke: c }); });
    torii(ctx, 520, 500, .6, r2 * ease((s2 - .3) / .5));
    ctx.save(); ctx.globalAlpha = r2 * ease((s2 - .8) / .5); ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(960, 500, 80, Math.PI, TAU); ctx.stroke(); ctx.restore();
    txt(ctx, '保存か、観察か', 960, 160, { size: 50, font: DELA, color: '#ffe27a', stroke: 9, alpha: r2 });
  }
  sideCast(ctx, E, { left: ['chili', 'garlic'], right: ['daikon', 'shoga'] });
});

// capsule cross-section: electrodes, drip, culture fluid (stylised, non-realistic)
function capsuleCut(ctx, x, y, s, t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const w = 220 * s, h = 360 * s;
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2); g.addColorStop(0, 'rgba(90,220,210,.35)'); g.addColorStop(1, 'rgba(40,140,160,.55)');
  ctx.fillStyle = g; rr(ctx, x - w / 2, y - h / 2, w, h, 90 * s); ctx.fill(); ctx.strokeStyle = '#bff3ea'; ctx.lineWidth = 6 * s; ctx.stroke();
  for (let k = 0; k < 8; k++) { const f = fract(t * .3 + k / 8); ctx.fillStyle = 'rgba(220,255,250,.7)'; ctx.beginPath(); ctx.arc(x - w * .3 + rnd(k) * w * .6, y + h * .4 - f * h * .8, (3 + rnd(k * 2) * 5) * s, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#ffd0e8'; ctx.beginPath(); ctx.ellipse(x, y, 60 * s, 46 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ff9ac4'; ctx.lineWidth = 3 * s; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x - 25 * s + k * 16 * s, y, 22 * s, 1 + k * .5, 2.6 + k * .5); ctx.stroke(); }
  for (let k = 0; k < 3; k++) { const ex = x - 30 * s + k * 30 * s; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(ex, y - 40 * s); ctx.lineTo(ex, y - h / 2 - 30 * s); ctx.stroke(); const pf = fract(t * 1.2 + k * .3); ctx.fillStyle = '#fff'; ctx.fillRect(ex - 3 * s, lerp(y - h / 2 - 30 * s, y - 40 * s, pf) - 3 * s, 6 * s, 6 * s); }
  ctx.fillStyle = '#e8e0ff'; rr(ctx, x + w / 2 + 10 * s, y - h / 2 - 20 * s, 50 * s, 70 * s, 10 * s); ctx.fill(); const df = fract(t * .8); ctx.fillStyle = '#b8a8e0'; ctx.beginPath(); ctx.arc(x + w / 2 + 35 * s, lerp(y - h / 2 + 60 * s, y - 20 * s, df), 5 * s, 0, TAU); ctx.fill();
  ctx.restore();
}
wrapScene('brainfarm', ['l222', 'l223', 'l224', 'l225', 'l226', 'l227'], (ctx, E) => {
  const t = E.t;
  const a = linesA(E, 'l312', 'l313');
  if (a > 0) {
    const s = sinceId(E, 'l312');
    cover(ctx, a, () => vgrad(ctx, ['#08141a', '#10262c']));
    const r1 = lineA(E, 'l312'), r2 = lineA(E, 'l313');
    if (r1 > 0) {
      capsuleCut(ctx, 960, 440, 1.2, t, r1);
      [['電極：報酬の信号', 700, 220], ['薬：脳汁を出させる', 1260, 220], ['培養液：体の代わり', 700, 660]].forEach(([n, x, y], i) => box(ctx, n, x, y, 300, 56, { alpha: r1 * ease((s - .5 - i * .6) / .5), size: 24, fill: '#1d1830', color: '#bff3ea', stroke: '#46d9c4' }));
      meter(ctx, 1150, 620, 360, '幸福スコア', .6 + .4 * ease(s / 3), '#ff9ac4', r1);
      badge(ctx, '極端な思考実験（非写実・風刺）', 960, 130, r1, '#ff9ac4');
    }
    if (r2 > 0) {
      const s2 = sinceId(E, 'l313');
      for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) capsuleCut(ctx, 480 + c * 105, 300 + r * 170, .32, t + c + r, r2 * ease((s2 - (r * 10 + c) * .02) / .4));
      txt(ctx, `${Math.floor(8e9 * ease(s2 / 2.5)).toLocaleString('en-US')} 人ぶん`, 960, 150, { size: 50, font: DELA, color: '#ffd0e8', stroke: 9, alpha: r2 });
      stamp(ctx, '幸福 ≠ 数字', 1450, 720, r2 * ease((s2 - 2) / .4), '#ffc94d', -.1, 40);
    }
    sideCast(ctx, E, { left: ['garlic', 'chili'], right: ['daikon', 'shoga'] });
  }
  const v = lineA(E, 'l314');
  if (v > 0) {
    const s = sinceId(E, 'l314'), ang = -Math.PI / 2 + ease(s / 3) * TAU * .9;
    ctx.save(); ctx.globalAlpha = v; ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.arc(1560, 560, 60, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a2233'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(1560, 560); ctx.lineTo(1560 + Math.cos(ang) * 44, 560 + Math.sin(ang) * 44); ctx.stroke(); ctx.restore();
    txt(ctx, '朝 → 晩', 1560, 650, { size: 24, alpha: v, stroke: 5 });
    ['好みの作品', 'あなた向け解説', '次のおすすめ'].forEach((n, i) => box(ctx, n, 1560, 360 + i * 0 - i * 60 + 60, 220, 48, { alpha: v * ease((s - i * .4) / .4), size: 22, fill: '#bfe8ff', lw: 2, shadow: false }));
  }
  const w = lineA(E, 'l315');
  if (w > 0) {
    const s = sinceId(E, 'l315');
    cover(ctx, w, () => vgrad(ctx, ['#0c1a2a', '#1a2c48']));
    const goals = ['幸福', '自由', '知能', '生き物の多様さ', '文明の寿命', '生命を広げる'], sel = Math.min(5, Math.floor(s * 1.1));
    goals.forEach((g, i) => box(ctx, g, 330 + i * 250, 200, 220, 60, { alpha: w, size: 24, fill: i === sel ? '#ffc94d' : '#1d1830', color: i === sel ? '#2a2233' : '#fff6df', stroke: '#ffc94d' }));
    const cx = 960, cy = 520;
    globe(ctx, cx, cy, 150, E.u * .2, .3, t, { night: sel === 0 || sel === 2, lights: sel === 2 ? 1 : .3, net: sel === 2 ? 1 : 0, alpha: w });
    ctx.save(); ctx.globalAlpha = w;
    if (sel === 0) for (let k = 0; k < 12; k++) { const a2 = k / 12 * TAU; ctx.fillStyle = '#ffd0e8'; ctx.beginPath(); ctx.arc(cx + Math.cos(a2) * 200, cy + Math.sin(a2) * 200, 12, 0, TAU); ctx.fill(); }
    if (sel === 1) for (let k = 0; k < 8; k++) { const a2 = k / 8 * TAU; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a2) * 160, cy + Math.sin(a2) * 160); ctx.lineTo(cx + Math.cos(a2) * 260, cy + Math.sin(a2) * 260); ctx.stroke(); }
    if (sel === 3) for (let k = 0; k < 18; k++) { const a2 = k / 18 * TAU; ctx.fillStyle = k % 2 ? '#8fe36a' : '#ff9ac4'; ctx.fillRect(cx + Math.cos(a2) * 190 - 8, cy + Math.sin(a2) * 190 - 8, 16, 16); }
    if (sel === 4) { ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, 200, 0, TAU); ctx.stroke(); }
    ctx.restore();
    if (sel === 5) for (let k = 0; k < 4; k++) { const f = fract(t * .2 + k / 4); ship(ctx, cx + Math.cos(k * 1.6) * (170 + f * 300), cy + Math.sin(k * 1.6) * (170 + f * 200), .2, k * 1.6, t, { flame: .6, alpha: w * (1 - f) }); }
    txt(ctx, '目的を変えれば、世界の形も変わる', 960, 760 - 20, { size: 38, font: DELA, color: '#ffc94d', stroke: 8, alpha: w });
    sideCast(ctx, E, { left: ['garlic', 'chili'], right: ['daikon', 'shoga'] });
  }
});

wrapScene('humanvalue', ['l228', 'l229', 'l230', 'l231', 'l232', 'l233', 'l234'], (ctx, E) => {
  const a = lineA(E, 'l316'); if (a <= 0) return; const s = sinceId(E, 'l316'), t = E.t;
  cover(ctx, a, () => bgSpace(ctx, t, E.u, .35));
  card(ctx, 560, 180, 800, 480, { fill: '#10182a', stroke: '#46f0d0', alpha: a });
  txt(ctx, 'ASIの帳簿（思考実験）', 960, 225, { size: 36, color: '#46f0d0', alpha: a });
  [['エネルギー消費', .8], ['環境への負荷', .7], ['維持・管理の費用', .9]].forEach(([n, v], i) => { const g = ease((s - .4 - i * .5) / .6); txt(ctx, n, 600, 310 + i * 90, { size: 28, align: 'left', alpha: a }); card(ctx, 900, 290 + i * 90, 400, 40, { fill: '#15122a', lw: 0, shadow: false, alpha: a }); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ff7a66'; ctx.fillRect(900, 290 + i * 90, 400 * v * g, 40); ctx.restore(); });
  txt(ctx, '人類の価値：？', 960, 600, { size: 40, font: DELA, color: '#ffe27a', stroke: 7, alpha: a * ease((s - 2) / .5) });
  globe(ctx, 1560, 320, 70, E.u * .2, .3, t, { night: false, lights: .2, alpha: a });
  sideCast(ctx, E, { left: ['garlic', 'daikon'], right: ['chili', 'shoga'] });
});

wrapScene('kardashev', ['l239', 'l240', 'l241', 'l242'], (ctx, E) => {
  const a = lineA(E, 'l317'); if (a <= 0) return; const s = sinceId(E, 'l317'), t = E.t;
  const src = [[380, 250], [1650, 300], [1500, 560]];
  src.forEach(([x, y], i) => { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = ['#8a7a6a', '#c9c0b0', '#6a5a50'][i]; ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill(); ctx.restore(); for (let k = 0; k < 5; k++) { const f = fract(t * .3 + k / 5 + i * .2); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = k % 2 ? '#46d9c4' : '#c98a4a'; ctx.fillRect(lerp(x, 960, f) - 6, lerp(y, 480, f) - 6, 12, 12); ctx.restore(); } });
  box(ctx, 'ケイ素・金属＝チップの原料', 960, 150, 520, 64, { alpha: a, size: 30, fill: '#1d1830', color: '#46d9c4', stroke: '#46d9c4' });
  arrow(ctx, 1150, 330, 1450, 200, { color: '#ffc94d', lw: 7, dash: [14, 10], alpha: a * ease((s - 1.5) / .6) });
  txt(ctx, '恒星の外へ', 1400, 160, { size: 32, color: '#ffc94d', alpha: a * ease((s - 1.5) / .6), stroke: 6 });
});

wrapScene('universe', ['l246', 'l247', 'l248', 'l249'], (ctx, E) => {
  const t = E.t;
  badge(ctx, '未検証の遠未来構想', 1600, 150, 1, '#d8ccff');
  const a = lineA(E, 'l318'); if (a <= 0) return; const s = sinceId(E, 'l318');
  cover(ctx, a, () => bgSpace(ctx, t, E.u, .4));
  const nodes = Array.from({ length: 9 }, (_, k) => [420 + (k % 3) * 540 + rnd(k) * 80, 230 + Math.floor(k / 3) * 190 + rnd(k * 2) * 40]);
  nodes.forEach(([x, y], k) => { miniGal(ctx, x, y, 1.6, k + t * .1, 'rgba(255,220,150,.9)', a); for (let m = 0; m < 2; m++) { const r = ((s * 60 + m * 120 + k * 37) % 360); ctx.save(); ctx.globalAlpha = a * (1 - r / 360) * .8; ctx.strokeStyle = '#fff4c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore(); } });
  ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([14, 10]); ctx.strokeStyle = '#d8ccff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(960, 420, 700, 330, 0, 0, TAU); ctx.stroke(); ctx.restore();
  txt(ctx, '光速と地平線：同時に一つにはなれない', 960, 130, { size: 42, font: DELA, stroke: 8, alpha: a });
  txt(ctx, '遅れて響き合う合唱', 960, 760 - 20, { size: 36, color: '#ffe9a8', alpha: a * ease((s - 2) / .6), stroke: 6 });
  actor(ctx, 'garlic', 1650, FLOOR, 165, { flip: true }); actor(ctx, 'daikon', 1810, FLOOR, 180, { flip: true }); actor(ctx, 'chili', 120, FLOOR, 180); actor(ctx, 'shoga', 290, FLOOR, 180);
});

wrapScene('multiverse', ['l257', 'l258', 'l259', 'l260'], (ctx, E) => {
  const a = lineA(E, 'l319'); if (a <= 0) return; const s = sinceId(E, 'l319');
  [['タイプ5：多宇宙を使う', 1340, 300], ['タイプ6：次元の外へ', 1560, 200]].forEach(([n, x, y], i) => box(ctx, n, x, y, 340, 60, { alpha: a * ease((s - i * .7) / .5), size: 26, fill: '#2a1850', color: '#d8ccff', stroke: '#d8ccff' }));
  badge(ctx, '物差しを延ばした想像の拡張', 1450, 400, a, '#d8ccff');
});

wrapScene('countdown', ['l267', 'l268', 'l269', 'l270'], (ctx, E) => {
  const t = E.t;
  const h = lineA(E, 'l269'); if (h > 0) badge(ctx, '仮に、変革期が残り10年なら', 960, 360, h, '#d9443a');
  const a = lineA(E, 'l320'); if (a <= 0) return; const s = sinceId(E, 'l320');
  cover(ctx, a, () => { vgrad(ctx, ['#6fa8dc', '#f6d6a8', '#ffe8c0'], 0, 780); drawCity(ctx, M.cityDayFar, E.u * 6, 760, 1, .6); floorBand(ctx, '#c9b48a', 770); });
  card(ctx, 560, 150, 800, 480, { alpha: a }); txt(ctx, 'もう起きていること', 960, 200, { size: 40, font: DELA, color: '#1f6f78', alpha: a });
  ['何日も働くAIエージェント', '研究を手伝うAI', '十億人規模の基盤'].forEach((n, i) => { const g = a * ease((s - .4 - i * .6) / .4), y = 300 + i * 90; ctx.save(); ctx.globalAlpha = g; ctx.strokeStyle = '#1f6f78'; ctx.lineWidth = 4; ctx.strokeRect(640, y - 20, 40, 40); ctx.strokeStyle = '#1f8f7f'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(646, y); ctx.lineTo(658, y + 14); ctx.lineTo(680, y - 18); ctx.stroke(); ctx.restore(); txt(ctx, n, 710, y, { size: 32, color: '#2a2233', align: 'left', alpha: g }); });
  factTag(ctx, '2026年9月時点', 960, 580, a);
  actor(ctx, 'garlic', 120, FLOOR, 165); actor(ctx, 'shoga', 290, FLOOR, 180);
  actor(ctx, 'chili', 1650, FLOOR, 180, { flip: true }); actor(ctx, 'daikon', 1810, FLOOR, 180, { flip: true });
});


SCENES.fallback = (ctx, E) => { vgrad(ctx, ['#1a1a30', '#2a2350']); txt(ctx, E.sc.title || '', W / 2, 400, { size: 60 }); };

// ---------------------------------------------------------------- HUD & subtitles
function segmentize(text) {
  const MAX = 25;
  const ph = (text.match(/[^、。！？!?]+[、。！？!?」』）]*|[、。！？!?」』）]+/g) || [text]).map(s => s.replace(/^[\s　]+/, ''));
  const lines = []; let cur = '';
  for (let p of ph) {
    while (p.length > MAX) { if (cur) { lines.push(cur); cur = ''; } const k = softBreak(p, Math.ceil(p.length / Math.ceil(p.length / MAX))); lines.push(p.slice(0, k)); p = p.slice(k); }
    if ((cur + p).length <= MAX) cur += p; else { if (cur) lines.push(cur); cur = p; }
  }
  if (cur) lines.push(cur);
  const segs = []; for (let i = 0; i < lines.length; i += 2) segs.push(lines.slice(i, i + 2));
  return segs;
}
// break long phrases after a particle / before a kanji run, nearest to the target length
function softBreak(p, target) {
  let best = target, bd = 1e9;
  for (let k = Math.max(4, target - 10); k <= Math.min(p.length - 3, target + 4, 25); k++) {
    const a = p[k - 1], b = p[k];
    let score = Math.abs(k - target);
    if ('てにをはがのとでへもや'.includes(a) && !/[ぁ-ん]/.test(b)) score -= 6; else if ('てにをはがのとでへも'.includes(a)) score -= 3;
    if (/[ぁぃぅぇぉゃゅょっーァィゥェォャュョッ]/.test(b)) score += 20;
    if (/[A-Za-z0-9]/.test(a) && /[A-Za-z0-9]/.test(b)) score += 60;
    if (score < bd) { bd = score; best = k; }
  }
  return best;
}
function drawSubtitle(ctx, line, t) {
  const d = line.end - line.start, lt = t - line.start;
  const inA = ease(lt / .15) * ease((line.end + .2 - t) / .2);
  if (inA <= 0) return;
  const segs = line._segs || (line._segs = segmentize(line.text));
  const lens = segs.map(s => s.join('').length), total = lens.reduce((a, b) => a + b, 0);
  let acc = 0, si = segs.length - 1; const f = clamp(lt / d) * total;
  for (let i = 0; i < segs.length; i++) { acc += lens[i]; if (f < acc) { si = i; break; } }
  ctx.save(); ctx.globalAlpha = inA;
  const g = ctx.createLinearGradient(0, SUB_TOP, 0, SUB_BOTTOM); g.addColorStop(0, 'rgba(14,10,26,.78)'); g.addColorStop(1, 'rgba(14,10,26,.86)');
  ctx.fillStyle = g; rr(ctx, 90, SUB_TOP, W - 180, SUB_BOTTOM - SUB_TOP, 26); ctx.fill();
  const sp = SPEAKERS[line.speaker] || { name: line.speaker, color: '#fff6df' };
  ctx.fillStyle = sp.color; rr(ctx, 90, SUB_TOP, 12, SUB_BOTTOM - SUB_TOP, 6); ctx.fill();
  ctx.restore();
  txt(ctx, sp.name, 150, SUB_TOP + 34, { size: 26, color: sp.color, align: 'left', alpha: inA });
  const seg = segs[si], ys = seg.length === 1 ? [SUB_TOP + 88] : [SUB_TOP + 62, SUB_TOP + 124];
  seg.forEach((s, i) => txt(ctx, s, W / 2 + 40, ys[i], { size: 52, color: '#fff6df', alpha: inA, stroke: 7 }));
}
function drawHUD(ctx, sc, idx, total) {
  if (sc.kind === 'lesson') {
    label(ctx, `CH.${String(idx + 1).padStart(2, '0')}`, 35, 55, {size:24, align:'left'});
    txt(ctx, sc.title || '', 195, 55, {size:31, align:'left', maxW:1250});
    label(ctx, sc.stage || '学び', 1860, 55, {size:25, align:'right', stroke:'#a7dce9'});
    return;
  }
  const st = Object.hasOwn(STATUS, sc.id) ? STATUS[sc.id] : [0, ''];
  ctx.save(); ctx.globalAlpha = .9;
  card(ctx, 30, 26, 108, 44, { fill: 'rgba(14,10,26,.7)', stroke: '#ffc94d', lw: 2, r: 22, shadow: false });
  txt(ctx, `CH.${String(idx + 1).padStart(2, '0')}`, 84, 49, { size: 22, color: '#ffc94d' });
  txt(ctx, sc.title || '', 152, 49, { size: 22, align: 'left', stroke: 5, maxW: 700 });
  const x0 = 1330, x1 = 1850, y = 40;
  ctx.strokeStyle = 'rgba(255,246,223,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  TL_NODES.forEach((n, i) => {
    const x = lerp(x0, x1, i / 4), on = i === st[0];
    ctx.fillStyle = on ? (i === 4 ? '#d8ccff' : '#ffc94d') : 'rgba(255,246,223,.6)'; ctx.beginPath(); ctx.arc(x, y, on ? 9 : 5, 0, TAU); ctx.fill();
    txt(ctx, n, x, y + 24, { size: 16, color: on ? '#fff6df' : 'rgba(255,246,223,.6)', stroke: 4 });
  });
  const isSF = st[0] === 4;
  label(ctx, st[1], x1, 104, { size: 20, align: 'right', stroke: isSF ? '#d8ccff' : '#ffc94d' });
  ctx.restore();
}

// ---------------------------------------------------------------- timeline helpers
const SCENE_LEAD = { s01: 3.4, s11: 1.6, s12: 1.4, s13: 2.8, s14: 1.2, s15: 3.0, s16: 2.2, s16b: 2.4, s16c: 3.4, s16d: 2.4, s16e: 2.6, s16f: 2.2, s16g: 1.6, s16h: 1.6, s15c: 1.8, s03c: 1.2, s10c: 1.2, s10i: 1.4, s02b: 1.0, s17: 1.6, s18: 2.6, s19: 1.2, s20: 1.2 };
const SCENE_TAIL = { s02: 1.0, s10: 1.2, s12: 1.6, s13: 2.2, s15: 2.0, s16: 2.0, s16b: 3.6, s16c: 3.6, s16d: 3.0, s16e: 3.4, s16f: 2.6, s16h: 3.0, s15c: 1.4, s18b: 1.6, s17: 2.0, s18: 4.2, s20: 5.0 };
/** Build a timeline from script + measured line durations (seconds by line id). Missing ones are estimated. */
function buildTimeline(script, durations = {}, opt = {}) {
  const gap = opt.gap ?? .35, cps = opt.cps ?? 7.0, defLead = opt.lead ?? .9, defTail = opt.tail ?? .9;
  let t = 0;
  const scenes = script.scenes.map(sc => {
    const start = t; t += Object.hasOwn(SCENE_LEAD, sc.id) ? SCENE_LEAD[sc.id] : defLead;
    const lines = sc.lines.map((l, i) => {
      const d = Object.hasOwn(durations, l.id) ? durations[l.id] : (l.text.length / cps + .3), s = t; t += d; const e = t; if (i < sc.lines.length - 1) t += gap;
      return { ...l, start: +s.toFixed(3), end: +e.toFixed(3), audio: `audio/${l.id}.flac` };
    });
    t += Object.hasOwn(SCENE_TAIL, sc.id) ? SCENE_TAIL[sc.id] : defTail;
    return { ...sc, start: +start.toFixed(3), end: +t.toFixed(3), lines };
  });
  return { duration: +t.toFixed(3), fps: 30, scenes };
}
function estimateTimeline(script) { return buildTimeline(script || JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'examples', 'cosmic', 'script.json'), 'utf8'))); }

// ---------------------------------------------------------------- main
async function loadResources() {
  if (M.ready) return;
  registerFonts();
  const key = await loadImage(path.join(ASSET, 'characters-key.png'));
  const mo = await loadImage(path.join(ASSET, 'v2', 'motion.png'));
  M.key = chromaSprites(key, true); M.motion = chromaSprites(mo, false);
  M.cityNightFar = buildCity(11, { night: true, far: true, h: 420, minH: 90, maxH: 380 });
  M.cityNightNear = buildCity(29, { night: true, h: 560, minH: 120, maxH: 470 });
  M.cityDayFar = buildCity(11, { night: false, far: true, h: 420, minH: 90, maxH: 380 });
  M.cityDayNear = buildCity(29, { night: false, h: 560, minH: 120, maxH: 470 });
  M.ready = true;
}

async function createMovie(timeline) {
  await loadResources();
  const tl = timeline || estimateTimeline();
  const scenes = tl.scenes.map(prepScene);
  const lines = []; scenes.forEach(s => (s.lines || []).forEach(l => lines.push(l)));
  const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
  const buf = createCanvas(W, H), bctx = buf.getContext('2d');
  const TR = .6;
  const renderScene = (c, i, u, t) => {
    const sc = scenes[i]; const E = makeEnv(sc, u, t); CUR = E;
    c.save(); (SCENES[sc.kind] || SCENES.fallback)(c, E); c.restore(); CUR = null;
  };
  function frame(t) {
    t = clamp(t, 0, tl.duration - 1e-6);
    let i = scenes.findIndex(s => t >= s.start && t < s.end); if (i < 0) i = t < scenes[0].start ? 0 : scenes.length - 1;
    const sc = scenes[i], u = t - sc.start;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    renderScene(ctx, i, u, t);
    if (i > 0 && u < TR) {
      const p = scenes[i - 1]; bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.fillStyle = '#000'; bctx.fillRect(0, 0, W, H);
      renderScene(bctx, i - 1, p.dur + u, t);
      const k = ease(u / TR); ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(W / 2, H / 2); const z = 1 + k * .04; ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); ctx.drawImage(buf, 0, 0); ctx.restore();
    }
    // keep the subtitle band clean
    const g = ctx.createLinearGradient(0, SUB_TOP - 30, 0, H); g.addColorStop(0, 'rgba(8,6,16,0)'); g.addColorStop(.25, 'rgba(8,6,16,.35)'); g.addColorStop(1, 'rgba(8,6,16,.55)');
    ctx.fillStyle = g; ctx.fillRect(0, SUB_TOP - 30, W, H - SUB_TOP + 30);
    drawHUD(ctx, sc, i, scenes.length);
    const ln = lines.find(l => t >= l.start - .05 && t < l.end + .2);
    if (ln) drawSubtitle(ctx, ln, t);
    ctx.restore();
    return canvas;
  }
  return { canvas, ctx, frame, timeline: tl };
}

// ---------------------------------------------------------------- thumbnail
async function writeThumbnail(outPath = path.join(__dirname, '..', 'output', 'thumbnail.png')) {
  const { ROOT, inside } = require('./project.cjs');
  fs.mkdirSync(path.join(ROOT, 'output'), {recursive:true});
  inside(ROOT, 'output');
  if (path.dirname(path.resolve(outPath)) !== path.join(ROOT, 'output')) throw Error('Thumbnail output must be inside output/');
  if (fs.existsSync(outPath)) inside(ROOT, path.relative(ROOT, outPath));
  await loadResources();
  const cv = createCanvas(1280, 720), c = cv.getContext('2d');
  c.scale(1280 / W, 720 / H);
  CUR = { t: 1.2, spk: null };
  // left: shaky present (dusk city, tilted); right: bright future (plaza + swarm)
  c.save(); c.beginPath(); c.moveTo(0, 0); c.lineTo(1020, 0); c.lineTo(860, H); c.lineTo(0, H); c.clip();
  c.translate(W * .25, H / 2); c.rotate(-.05); c.translate(-W * .25, -H / 2);
  vgrad(c, ['#1c1a3a', '#4a3a6a', '#a8687a']); drawCity(c, M.cityNightFar, 0, 760, 1); drawCity(c, M.cityNightNear, 300, 900, 1.1);
  for (let k = 0; k < 3; k++) ripple(c, 420, 820, .5 + k * .45, { max: 700, squash: .28, life: 2.6, n: 1, lw: 10 });
  c.restore();
  c.save(); c.beginPath(); c.moveTo(1020, 0); c.lineTo(W, 0); c.lineTo(W, H); c.lineTo(860, H); c.closePath(); c.clip();
  vgrad(c, ['#7fc8ef', '#d9f0f6', '#fff0cf']);
  sun(c, 1560, 260, 70, 1);
  for (let i = 0; i < 90; i++) { const a = i / 90 * TAU; c.fillStyle = 'rgba(255,200,90,.9)'; c.fillRect(1560 + Math.cos(a) * 250, 260 + Math.sin(a) * 80, 8, 4); }
  drawCity(c, M.cityDayFar, 200, 860, 1); c.fillStyle = '#f2e3c4'; c.fillRect(0, 860, W, 300);
  c.restore();
  c.save(); c.strokeStyle = '#fff6df'; c.lineWidth = 14; c.beginPath(); c.moveTo(1020, 0); c.lineTo(860, H); c.stroke(); c.restore();
  // title
  txt(c, '2027年、', 90, 150, { size: 120, font: DELA, align: 'left', stroke: 22, color: '#fff6df' });
  txt(c, 'ギュが来たら？', 90, 300, { size: 150, font: DELA, align: 'left', stroke: 24, color: '#ffc94d' });
  // characters
  actor(c, 'daikon', 330, 1040, 330, { shadow: false });
  actor(c, 'shoga', 820, 1060, 470, { pose: 'joy', shadow: false });
  actor(c, 'chili', 1250, 1040, 330, { flip: true, shadow: false });
  actor(c, 'garlic', 1500, 1050, 280, { flip: true, shadow: false });
  actor(c, 'negi', 1730, 1040, 330, { flip: true, shadow: false });
  CUR = null;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, await cv.encode('png'));
  return outPath;
}

async function createCharacterAnimation({action='wave',size=256}={}) {
  await loadResources();
  const {pose}=require('./character-actions.cjs');
  if(!Number.isInteger(size)||size<64||size>2048)throw Error('size must be 64..2048');
  const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');
  function frame(t) {
    ctx.clearRect(0,0,size,size);
    const previous=CUR;CUR={t,spk:null};
    actor(ctx,'shoga',size*.5,size*.94,size*.70,pose(action,t,size));
    CUR=previous;return canvas;
  }
  return {canvas,frame};
}
module.exports = { createMovie, buildTimeline, estimateTimeline, writeThumbnail, createCharacterAnimation, segmentize, W, H };
require('./learning-scenes.cjs')({ SCENES, txt, card, actor, arrow, vgrad, ease, clamp });
