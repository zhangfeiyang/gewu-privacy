// 格物实验 — 仿真注册表
// 仿真对象：{ id,title,sub,category,color,emoji,
//   params:[{key,label,min,max,step,value,fmt}],
//   actions:[{label, primary, on(state,params)}],   // label 可为 (state)=>string
//   init():state, step(state,params,dt), draw(ctx,W,H,state,params),
//   onTap?(state,params,x,y),
//   onDragStart?/onDragMove?/onDragEnd?(state,params,x,y) }

// ---------- 公共绘制助手 ----------
// 每个实验单独选择数据卡片锚点，避免统一放在左上角遮挡实验主体。
// tl/tr/bl/br = 四角，tc/bc = 顶/底居中，ml/mr = 左/右居中。
const READOUT_PLACEMENTS = {
  projectile: 'tl',
  pendulum: 'tl',
  springs: 'tl',
  coupled: 'br',
  skate: 'tl',
  collision: 'tl',
  forces: 'tl',
  friction2: 'br',
  impulse: 'tl',
  ramp: 'tl',
  hooke: 'tl',
  circular: 'tl',
  buoyancy: 'tr',
  density: 'tl',
  lever: 'tl',
  orbit: 'tl',
  kepler: 'tl',
  moonphase: 'tr',
  gravityforce: 'tl',
  pulley: 'bl',
  freefall: 'tl',
  elevator: 'tl',
  shmgraph: 'tl',
  fluidpressure: 'bl',
  bernoulli: 'tl',
  brachistochrone: 'tr',
  resonance: 'tl',
  cradle: 'tl',
  torque: 'br',
  hydraulic: 'tl',
  springcombo: 'bl',
  wave: 'tl',
  bending: 'bl',
  prism: 'tl',
  optics: 'tl',
  interference: 'tl',
  doppler: 'tl',
  sound: 'tl',
  mirror: 'tl',
  pinhole: 'tl',
  colormix: 'br',
  echo: 'tl',
  standingwave: 'tl',
  wavesuperpose: 'br',
  beats: 'tl',
  polarization: 'tl',
  diffraction: 'tl',
  fiber: 'tl',
  opticsbench: 'tc',
  circuitlab: 'tl',
  circuit: 'tl',
  charges: 'tl',
  coulomb: 'tl',
  faraday: 'tl',
  capacitor: 'tl',
  magnet: 'tl',
  resistivity: 'tl',
  oersted: 'tl',
  seriesparallel: 'tl',
  static: 'tl',
  generator: 'tl',
  emwave: 'tl',
  dcmotor: 'tl',
  transformer: 'bl',
  lenz: 'tl',
  potentiometer: 'tl',
  rccircuit: 'tr',
  lc: 'br',
  crt: 'tl',
  gas: 'tr',
  calorimetry: 'tl',
  brownian: 'tl',
  idealgas: 'mr',
  states: 'br',
  heatconduction: 'tl',
  maxwell: 'tl',
  heatengine: 'br',
  atom: 'tl',
  decay: 'tl',
  photoelectric: 'br',
  energylevels: 'tl',
  spectrum: 'tl',
  chain: 'br',
  massspec: 'tl',
  radiation: 'tl',
  ph: 'ml',
  concentration: 'br',
  stoichiometry: 'br',
  reactionrate: 'tl',
  chemmix: 'tl',
  electrolysis: 'tl',
  mlp: 'br',
  convnet: 'br',
  attention: 'br',
  gradientdescent: 'bc',
  linreg: 'bc',
  kmeans: 'tl',
  overfit: 'bc',
  embedding: 'bc',
  activation: 'ml'
};
let activeDrawMeta = { id: '', W: 0, H: 0 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function readout(ctx, lines) {
  // Android WebView 提供外部读数栏时，只传递数据，不在 Canvas 上覆盖实验。
  // 小程序未提供该接收器，仍使用下面的逐实验定位绘制逻辑。
  if (typeof ctx.__gwReadoutSink === 'function') {
    ctx.__gwReadoutSink(lines);
    return;
  }
  ctx.save();
  ctx.font = '12px sans-serif';
  const pad = 10, lh = 18, colGap = 14, margin = 10;
  // 每行的标签宽度可能不同（中文标签长短不一），值列需按最长标签动态右移，
  // 否则"感应电动势""向心加速度"这类 4-5 字标签会和数值重叠。
  let labelW = 0, valueW = 0;
  lines.forEach(l => {
    labelW = Math.max(labelW, ctx.measureText(l[0]).width);
    valueW = Math.max(valueW, ctx.measureText(l[1]).width);
  });
  const w = (labelW + colGap + valueW) + pad * 2, h = lines.length * lh + pad;
  const W = activeDrawMeta.W || (ctx.canvas && ctx.canvas.width) || 360;
  const H = activeDrawMeta.H || (ctx.canvas && ctx.canvas.height) || 500;
  const anchor = READOUT_PLACEMENTS[activeDrawMeta.id] || 'tl';
  let x = margin, y = margin;
  if (anchor === 'tr' || anchor === 'br' || anchor === 'mr') x = W - w - margin;
  else if (anchor === 'tc' || anchor === 'bc') x = (W - w) / 2;
  if (anchor === 'bl' || anchor === 'br' || anchor === 'bc') y = H - h - margin;
  else if (anchor === 'ml' || anchor === 'mr') y = (H - h) / 2;
  x = Math.max(margin, Math.min(W - w - margin, x));
  y = Math.max(margin, Math.min(H - h - margin, y));
  const labelX = x + pad, valueX = labelX + labelW + colGap;
  ctx.shadowColor = 'rgba(25,45,58,0.12)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = 'rgba(255,255,255,0.91)';
  roundRect(ctx, x, y, w, h, 8); ctx.fill();
  ctx.shadowColor = 'transparent';
  lines.forEach((l, i) => {
    const lineY = y + pad + i * lh + 11;
    ctx.fillStyle = '#607D8B'; ctx.fillText(l[0], labelX, lineY);
    ctx.fillStyle = '#222'; ctx.fillText(l[1], valueX, lineY);
  });
  ctx.restore();
}
function energyBars(ctx, W, H, bars) {
  const n = bars.length, maxE = Math.max.apply(null, bars.map(b => b[1]).concat(1));
  const barW = W * 0.05, gap = W * 0.014, totalW = n * barW + (n - 1) * gap;
  const bx = W - totalW - W * 0.05, base = H * 0.42, maxH = H * 0.3;
  ctx.font = '11px sans-serif';
  bars.forEach((b, i) => {
    const x = bx + i * (barW + gap), bh = (b[1] / maxE) * maxH;
    ctx.fillStyle = 'rgba(0,0,0,0.09)'; ctx.fillRect(x, base - maxH, barW, maxH);
    ctx.fillStyle = b[2]; ctx.fillRect(x, base - bh, barW, bh);
    ctx.fillStyle = '#333'; ctx.fillText(b[0], x - 2, base + 16);
  });
}
function arrowVLine(ctx, bx, by, tx, ty, col, dashed) {
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.setLineDash([]);
  const d = ty < by ? -1 : 1;
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - 6, ty + d * 9); ctx.moveTo(tx, ty); ctx.lineTo(tx + 6, ty + d * 9); ctx.stroke();
}
function drawZigzagH(ctx, xa, xb, y, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(xa, y);
  const n = 6, seg = (xb - xa) / n;
  for (let i = 1; i <= n; i++) { const x = xa + i * seg, yy = i === n ? y : (i % 2 ? y - 10 : y + 10); ctx.lineTo(i === n ? xb : x, yy); }
  ctx.stroke();
}
function drawZigzagV(ctx, x, ya, yb, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, ya);
  const n = 6, seg = (yb - ya) / n;
  for (let i = 1; i <= n; i++) { const y = ya + i * seg, xx = i === n ? x : (i % 2 ? x - 10 : x + 10); ctx.lineTo(xx, i === n ? yb : y); }
  ctx.stroke();
}
function drawBattery(ctx, cx, cy, vertical) {
  ctx.strokeStyle = '#263238'; ctx.lineCap = 'round';
  if (!vertical) {
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx - 10, cy - 20); ctx.lineTo(cx - 10, cy + 20); ctx.stroke();
    ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(cx + 10, cy - 11); ctx.lineTo(cx + 10, cy + 11); ctx.stroke();
  } else {
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx - 20, cy - 10); ctx.lineTo(cx + 20, cy - 10); ctx.stroke();
    ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(cx - 11, cy + 10); ctx.lineTo(cx + 11, cy + 10); ctx.stroke();
  }
}
function flowLoop(ctx, pts, phase, col) {
  const edges = []; for (let i = 0; i < pts.length; i++) edges.push([pts[i], pts[(i + 1) % pts.length]]);
  const lens = edges.map(e => Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]));
  const total = lens.reduce((a, b) => a + b, 0), count = Math.max(6, Math.round(total / 28));
  for (let j = 0; j < count; j++) {
    let sn = ((j / count) + phase) % 1; if (sn < 0) sn += 1;
    let d = sn * total;
    for (let k = 0; k < edges.length; k++) {
      if (d <= lens[k]) { const e = edges[k], f = lens[k] ? d / lens[k] : 0; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(e[0][0] + (e[1][0] - e[0][0]) * f, e[0][1] + (e[1][1] - e[0][1]) * f, 4, 0, 7); ctx.fill(); break; }
      d -= lens[k];
    }
  }
}
function arrowSeg(ctx, ax, ay, bx, by, col, lw) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy);
  if (l < 1) return;
  const ux = dx / l, uy = dy / l;
  ctx.strokeStyle = col; ctx.lineWidth = lw || 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  const s = 9;
  ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx - ux * s - uy * s * 0.6, by - uy * s + ux * s * 0.6);
  ctx.moveTo(bx, by); ctx.lineTo(bx - ux * s + uy * s * 0.6, by - uy * s - ux * s * 0.6);
  ctx.stroke();
}
// 向量助手（棱镜/光线追踪）
function vsub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function vadd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function vscale(a, s) { return { x: a.x * s, y: a.y * s }; }
function vdot(a, b) { return a.x * b.x + a.y * b.y; }
function vcross(ax, ay, bx, by) { return ax * by - ay * bx; }
function vnorm(a) { const l = Math.hypot(a.x, a.y); return l < 1e-6 ? a : { x: a.x / l, y: a.y / l }; }
function rayEdge(p, d, a, b) {
  const ex = b.x - a.x, ey = b.y - a.y, den = vcross(d.x, d.y, ex, ey);
  if (Math.abs(den) < 1e-6) return null;
  const apx = a.x - p.x, apy = a.y - p.y;
  const t = vcross(apx, apy, ex, ey) / den, s = vcross(apx, apy, d.x, d.y) / den;
  return (t > 1e-2 && s >= -1e-3 && s <= 1.0001) ? t : null;
}
function refractV(d, n, eta) {
  const cosi = -vdot(d, n), kk = 1 - eta * eta * (1 - cosi * cosi);
  if (kk < 0) return null;
  return vnorm(vadd(vscale(d, eta), vscale(n, eta * cosi - Math.sqrt(kk))));
}
function wlColor(l) {
  let r = 0, g = 0, b = 0;
  if (l < 440) { r = -(l - 440) / 60; b = 1; }
  else if (l < 490) { g = (l - 440) / 50; b = 1; }
  else if (l < 510) { g = 1; b = -(l - 510) / 20; }
  else if (l < 580) { r = (l - 510) / 70; g = 1; }
  else if (l < 645) { r = 1; g = -(l - 645) / 65; }
  else { r = 1; }
  const c = v => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
}
function lerpHex(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, t))));
  return 'rgb(' + m[0] + ',' + m[1] + ',' + m[2] + ')';
}

// ================= 力学 =================
const projectile = {
  id: 'projectile', title: '抛体运动', sub: '角度 / 初速 / 打靶计分', category: '力学', color: '#E53935', emoji: '🚀',
  params: [
    { key: 'angle', label: '发射角度', min: 5, max: 85, step: 1, value: 60, fmt: v => v.toFixed(0) + ' °' },
    { key: 'speed', label: '初速度', min: 2, max: 40, step: 1, value: 18, fmt: v => v.toFixed(0) + ' m/s' },
    { key: 'gravity', label: '重力', min: 1, max: 25, step: 0.1, value: 9.81, fmt: v => v.toFixed(2) },
    { key: 'height', label: '发射高度', min: 0, max: 12, step: 0.5, value: 0, fmt: v => v.toFixed(1) + ' m' }
  ],
  actions: [
    { label: '🚀 发射', primary: true, on(s, p) {
        const r = p.angle * Math.PI / 180;
        s.shots.push({ x: 0, y: p.height, vx: p.speed * Math.cos(r), vy: p.speed * Math.sin(r), g: p.gravity, path: [[0, p.height]], landed: false, maxH: p.height, t: 0, range: 0 });
        if (s.shots.length > 6) s.shots.shift();
      } },
    { label: '清除', on(s) { s.shots = []; s.wx = 28; s.wy = 18; } },
    { label: '换靶', on(s) { s.targetX = 8 + Math.random() * 20; } }
  ],
  init() { return { shots: [], wx: 28, wy: 18, targetX: 16, score: 0, attempts: 0, buzz: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const sub = 8, h = dt / sub;
    s.shots.forEach(o => {
      if (o.landed) return;
      for (let i = 0; i < sub; i++) {
        if (o.landed) break;
        o.vy += -o.g * h; o.x += o.vx * h; o.y += o.vy * h; o.t += h;
        if (o.y > o.maxH) o.maxH = o.y;
        if (o.y <= 0 && o.t > 0.01) {
          o.y = 0; o.landed = true; o.range = o.x;
          s.attempts++;
          if (Math.abs(o.x - s.targetX) <= 1.5) { s.score++; o.hit = true; s.targetX = 8 + Math.random() * 20; s.buzz = (s.buzz | 0) + 1; }
        }
      }
      o.path.push([o.x, o.y]);
      if (o.x + 3 > s.wx) s.wx = o.x + 3;
      if (o.maxH + 3 > s.wy) s.wy = o.maxH + 3;
    });
  },
  hint: '拖动炮管调角度 · 拖动靶子换位置',
  onDragStart(s, p, x, y) {
    const u = s._ui;
    if (!u) return false;
    if (Math.hypot(x - u.targetX, y - u.targetY) < u.targetR + 24) s.drag = 'target';
    else if (Math.hypot(x - u.muzzleX, y - u.muzzleY) < 46 ||
             Math.hypot(x - u.baseX, y - u.baseY) < 34) s.drag = 'cannon';
    else return false;
    return true;
  },
  onDragMove(s, p, x, y) {
    const u = s._ui;
    if (!u) return;
    if (s.drag === 'target') {
      s.targetX = Math.max(3, Math.min(s.wx - 2, (x - u.originX) / u.scale));
    } else if (s.drag === 'cannon') {
      const deg = Math.atan2(u.baseY - y, x - u.baseX) * 180 / Math.PI;
      p.angle = Math.max(5, Math.min(85, Math.round(deg)));
    }
  },
  onDragEnd(s) { s.drag = null; },
  draw(ctx, W, H, s, p) {
    const groundY = H * 0.8, originX = W * 0.08, topPad = H * 0.07;
    const scale = Math.min((W - originX - W * 0.04) / s.wx, (groundY - topPad) / s.wy);
    const sx = x => originX + x * scale, sy = y => groundY - y * scale;
    ctx.fillStyle = '#BFE3FF'; ctx.fillRect(0, 0, W, groundY);
    ctx.fillStyle = '#7CB342'; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.font = '11px sans-serif';
    const step = s.wx <= 24 ? 4 : s.wx <= 50 ? 10 : 20;
    for (let d = step; d <= s.wx; d += step) ctx.fillText(d + 'm', sx(d) - 8, groundY + 16);
    // 打靶目标（靶心 ±1.5m 命中）
    const txp = sx(s.targetX), tr = Math.min(1.5 * scale, 24), tcy = groundY - tr;
    ctx.fillStyle = '#6D4C41'; ctx.fillRect(txp - 3, tcy, 6, tr);
    ctx.fillStyle = '#D32F2F'; ctx.beginPath(); ctx.arc(txp, tcy, tr, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(txp, tcy, tr * 0.62, 0, 7); ctx.fill();
    ctx.fillStyle = '#D32F2F'; ctx.beginPath(); ctx.arc(txp, tcy, tr * 0.28, 0, 7); ctx.fill();
    s.shots.forEach((o, idx) => {
      const last = idx === s.shots.length - 1;
      ctx.strokeStyle = projectile.color; ctx.globalAlpha = last ? 1 : 0.35; ctx.lineWidth = last ? 3 : 2;
      ctx.beginPath();
      o.path.forEach((pt, i) => { const X = sx(pt[0]), Y = sy(pt[1]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
      const lp = o.path[o.path.length - 1];
      ctx.fillStyle = projectile.color; ctx.beginPath(); ctx.arc(sx(lp[0]), sy(lp[1]), last && !o.landed ? 7 : 5, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    });
    const bx = sx(0), by = sy(p.height), len = Math.max(50, 3 * scale), a = p.angle * Math.PI / 180;
    if (p.height > 0.05) {
      const half = Math.min(18, Math.max(10, scale * 0.65));
      const topY = by + 10;
      ctx.strokeStyle = '#546E7A'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx - half, topY); ctx.lineTo(bx - half * 1.45, groundY);
      ctx.moveTo(bx + half, topY); ctx.lineTo(bx + half * 1.45, groundY);
      ctx.moveTo(bx - half, topY); ctx.lineTo(bx + half * 1.45, groundY);
      ctx.moveTo(bx + half, topY); ctx.lineTo(bx - half * 1.45, groundY);
      ctx.stroke();
      ctx.fillStyle = '#37474F'; ctx.fillRect(bx - half - 6, by + 5, half * 2 + 12, 8);
      ctx.fillStyle = '#455A64';
      ctx.beginPath(); ctx.arc(bx - half * 1.45, groundY, 6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + half * 1.45, groundY, 6, 0, 7); ctx.fill();
    }
    ctx.save(); ctx.translate(bx, by); ctx.rotate(-a); ctx.fillStyle = '#455A64'; ctx.fillRect(0, -7, len, 14); ctx.restore();
    ctx.fillStyle = '#37474F'; ctx.beginPath(); ctx.arc(bx, by, 12, 0, 7); ctx.fill();
    s._ui = {
      baseX: bx, baseY: by,
      muzzleX: bx + Math.cos(a) * len, muzzleY: by - Math.sin(a) * len,
      targetX: txp, targetY: tcy, targetR: Math.max(tr, 16),
      originX, scale
    };
    const ls = s.shots[s.shots.length - 1];
    readout(ctx, [
      ['🎯 命中', s.score + ' / ' + s.attempts + (ls && ls.hit ? '  命中!' : '')],
      ['射程', ls ? ls.range.toFixed(1) + ' m' : '—'],
      ['最高', ls ? ls.maxH.toFixed(1) + ' m' : '—'],
      ['时间', ls ? ls.t.toFixed(2) + ' s' : '—'],
    ]);
  }
};

const pendulum = {
  id: 'pendulum', title: '单摆实验室', sub: '摆长 / 重力 / 阻尼', category: '力学', color: '#8E24AA', emoji: '🟢',
  params: [
    { key: 'length', label: '摆长', min: 0.3, max: 3, step: 0.05, value: 1.5, fmt: v => v.toFixed(2) + ' m' },
    { key: 'amp', label: '初始角度', min: 5, max: 80, step: 1, value: 35, fmt: v => v.toFixed(0) + ' °' },
    { key: 'damping', label: '阻尼', min: 0, max: 1.5, step: 0.05, value: 0.1, fmt: v => v.toFixed(2) },
    { key: 'gravity', label: '重力', min: 1, max: 25, step: 0.1, value: 9.81, fmt: v => v.toFixed(2) }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 释放', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s, p) { s.running = false; s.theta = p.amp * Math.PI / 180; s.omega = 0; } }
  ],
  init() { return { theta: 35 * Math.PI / 180, omega: 0, running: false }; },
  step(s, p, dt) {
    if (!s.running) {
      if (!s.dragging) s.theta = p.amp * Math.PI / 180;
      s.omega = 0; return;
    }
    const sub = 8, h = dt / sub;
    for (let i = 0; i < sub; i++) { const a = -(p.gravity / p.length) * Math.sin(s.theta) - p.damping * s.omega; s.omega += a * h; s.theta += s.omega * h; }
  },
  hint: '抓住摆球拖到任意角度，松手释放',
  onDragStart(s, p, x, y) {
    if (!s._ui || Math.hypot(x - s._ui.bx, y - s._ui.by) > 34) return false;
    s.running = false; s.dragging = true; s.omega = 0; return true;
  },
  onDragMove(s, p, x, y) {
    if (!s._ui) return;
    const theta = Math.atan2(x - s._ui.px, y - s._ui.py);
    s.theta = Math.max(-80, Math.min(80, theta * 180 / Math.PI)) * Math.PI / 180;
    p.amp = Math.max(5, Math.abs(s.theta * 180 / Math.PI));
  },
  onDragEnd(s) { s.dragging = false; s.running = true; s.omega = 0; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#EAF3FB'; ctx.fillRect(0, 0, W, H);
    const px = W / 2, py = H * 0.14, scale = (H * 0.72) / 3, lpx = p.length * scale;
    const bx = px + lpx * Math.sin(s.theta), by = py + lpx * Math.cos(s.theta);
    ctx.fillStyle = '#90A4AE'; ctx.fillRect(px - 50, py - 12, 100, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.setLineDash([8, 10]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + lpx + 30); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#455A64'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = '#8E24AA'; ctx.beginPath(); ctx.arc(bx, by, 14, 0, 7); ctx.fill();
    s._ui = { px, py, bx, by };
    const v = p.length * s.omega, ke = 0.5 * v * v, pe = p.gravity * p.length * (1 - Math.cos(s.theta));
    energyBars(ctx, W, H, [['动能', ke, '#43A047'], ['势能', pe, '#1E88E5'], ['总能', ke + pe, '#455A64']]);
    const T = 2 * Math.PI * Math.sqrt(p.length / p.gravity);
    readout(ctx, [['周期', T.toFixed(2) + ' s'], ['角度', (s.theta * 180 / Math.PI).toFixed(0) + ' °']]);
  }
};

const springs = {
  id: 'springs', title: '弹簧振子', sub: '劲度 / 质量 / 阻尼', category: '力学', color: '#00897B', emoji: '🔵',
  params: [
    { key: 'k', label: '劲度系数', min: 2, max: 40, step: 1, value: 12, fmt: v => v.toFixed(0) + ' N/m' },
    { key: 'mass', label: '质量', min: 0.1, max: 2, step: 0.05, value: 0.8, fmt: v => v.toFixed(2) + ' kg' },
    { key: 'damping', label: '阻尼', min: 0, max: 3, step: 0.1, value: 0.4, fmt: v => v.toFixed(2) },
    { key: 'u0', label: '初始位移', min: -1.5, max: 1.5, step: 0.1, value: 0.8, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' m' },
    { key: 'gravity', label: '重力', min: 1, max: 25, step: 0.1, value: 9.81, fmt: v => v.toFixed(2) }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 释放', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s, p) { s.running = false; s.u = p.u0; s.v = 0; } }
  ],
  init() { return { u: 0.8, v: 0, running: false }; },
  step(s, p, dt) {
    if (!s.running) {
      if (!s.dragging) s.u = p.u0;
      s.v = 0; return;
    }
    const sub = 8, h = dt / sub;
    for (let i = 0; i < sub; i++) { const a = -(p.k / p.mass) * s.u - p.damping * s.v; s.v += a * h; s.u += s.v * h; }
  },
  hint: '按住重物上下拉动，松手后观察振动',
  onDragStart(s, p, x, y) {
    const u = s._ui;
    if (!u || x < u.cx - 58 || x > u.cx + 58 || y < u.massTop - 20 || y > u.massTop + u.massH + 28) return false;
    s.running = false; s.dragging = true; s.v = 0; return true;
  },
  onDragMove(s, p, x, y) {
    const u = s._ui;
    if (!u) return;
    const next = (y - u.supportY) / u.scale - u.natural - u.stretch;
    s.u = Math.max(-1.5, Math.min(1.5, next));
    p.u0 = s.u; s.v = 0;
  },
  onDragEnd(s) { s.dragging = false; s.running = true; s.v = 0; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#EAF6F3'; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, supportY = H * 0.1, stretch = p.mass * p.gravity / p.k;
    const natural = 1.0, total = natural + stretch + s.u, extent = natural + stretch + Math.abs(s.u) + 0.4;
    const scale = Math.min((H * 0.8) / extent, (H * 0.8) / 1.4), springPx = Math.max(40, total * scale), massTop = supportY + springPx;
    ctx.fillStyle = '#607D8B'; ctx.fillRect(cx - 90, supportY - 14, 180, 14);
    ctx.strokeStyle = '#00897B'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, supportY);
    const coils = 16, seg = springPx / (coils * 2);
    for (let i = 1; i <= coils * 2; i++) { const y = supportY + i * seg, x = i === coils * 2 ? cx : (i % 2 ? cx + 26 : cx - 26); ctx.lineTo(x, y); }
    ctx.stroke();
    const bh = 26 + p.mass * 26; ctx.fillStyle = '#00695C'; ctx.fillRect(cx - 39, massTop, 78, bh);
    s._ui = { cx, supportY, massTop, massH: bh, scale, natural, stretch };
    const eqY = supportY + (natural + stretch) * scale;
    ctx.strokeStyle = 'rgba(229,57,53,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 78, eqY); ctx.lineTo(cx + 78, eqY); ctx.stroke();
    const ke = 0.5 * p.mass * s.v * s.v, pe = 0.5 * p.k * s.u * s.u;
    energyBars(ctx, W, H, [['动能', ke, '#43A047'], ['弹性', pe, '#1E88E5'], ['总能', ke + pe, '#455A64']]);
    const T = 2 * Math.PI * Math.sqrt(p.mass / p.k);
    readout(ctx, [['周期', T.toFixed(2) + ' s'], ['平衡伸长', stretch.toFixed(2) + ' m'], ['当前位移', (s.u >= 0 ? '+' : '') + s.u.toFixed(2) + ' m']]);
  }
};

const SKW = 20, SKH = 6;
const hM = xN => SKH * (2 * xN - 1) * (2 * xN - 1);
const slopeAt = xN => SKH * (8 * xN - 4) / SKW;
const skate = {
  id: 'skate', title: '能量滑板公园', sub: '动能 / 势能 / 热能', category: '力学', color: '#FF7043', emoji: '🛹',
  params: [
    { key: 'releaseH', label: '释放高度', min: 1, max: 6, step: 0.2, value: 5, fmt: v => v.toFixed(1) + ' m' },
    { key: 'friction', label: '摩擦', min: 0, max: 0.4, step: 0.02, value: 0, fmt: v => v.toFixed(2) },
    { key: 'mass', label: '质量', min: 20, max: 90, step: 1, value: 60, fmt: v => v.toFixed(0) + ' kg' },
    { key: 'gravity', label: '重力', min: 1, max: 25, step: 0.1, value: 9.81, fmt: v => v.toFixed(2) }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 释放', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s, p) { s.running = false; const hN = Math.min(Math.max(p.releaseH / SKH, 0), 1); s.xN = 0.5 - Math.sqrt(hN) / 2; s.u = 0; s.thermal = 0; } }
  ],
  init() { return { xN: 0.5 - Math.sqrt(5 / SKH) / 2, u: 0, thermal: 0, running: false }; },
  step(s, p, dt) {
    if (!s.running) {
      if (!s.dragging) {
        const hN = Math.min(Math.max(p.releaseH / SKH, 0), 1);
        s.xN = 0.5 - Math.sqrt(hN) / 2;
      }
      s.u = 0; s.thermal = 0; return;
    }
    const sub = 8, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const m = slopeAt(s.xN), inv = 1 / Math.sqrt(1 + m * m), aT = -p.gravity * m * inv;
      const fr = s.u !== 0 ? -Math.sign(s.u) * p.friction * p.gravity * inv : 0;
      s.u += (aT + fr) * h;
      let nx = s.xN + s.u * inv * h / SKW;
      if (nx < 0.03) { nx = 0.03; s.u = -s.u * 0.6; }
      if (nx > 0.97) { nx = 0.97; s.u = -s.u * 0.6; }
      s.thermal += p.friction * p.mass * p.gravity * inv * Math.abs(s.u) * h;
      s.xN = nx;
    }
  },
  hint: '抓住滑板手沿轨道拖动，松手滑行',
  onDragStart(s, p, x, y) {
    if (!s._ui || Math.hypot(x - s._ui.X, y - s._ui.Y) > 42) return false;
    s.running = false; s.dragging = true; s.u = 0; return true;
  },
  onDragMove(s, p, x) {
    const u = s._ui;
    if (!u) return;
    s.xN = Math.max(0.03, Math.min(0.97, (x - u.left) / u.trackW));
    p.releaseH = Math.max(1, Math.min(6, hM(s.xN)));
    s.u = 0; s.thermal = 0;
  },
  onDragEnd(s) { s.dragging = false; s.running = true; s.u = 0; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#DBEEFB'; ctx.fillRect(0, 0, W, H * 0.86);
    ctx.fillStyle = '#9CCC65'; ctx.fillRect(0, H * 0.86, W, H * 0.14);
    const left = W * 0.06, trackW = W * 0.6, baseY = H * 0.8, scaleY = (H * 0.62) / SKH;
    const sx = xn => left + xn * trackW, sy = hm => baseY - hm * scaleY;
    ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 7; ctx.beginPath();
    for (let i = 0; i <= 100; i++) { const xn = i / 100, X = sx(xn), Y = sy(hM(xn)); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();
    const X = sx(s.xN), Y = sy(hM(s.xN)), ang = Math.atan(slopeAt(s.xN));
    ctx.save(); ctx.translate(X, Y); ctx.rotate(ang);
    ctx.fillStyle = '#263238'; ctx.fillRect(-18, -4, 36, 6);
    ctx.fillStyle = '#FF7043'; ctx.beginPath(); ctx.arc(0, -18, 11, 0, 7); ctx.fill();
    ctx.restore();
    s._ui = { X, Y, left, trackW };
    const ke = 0.5 * p.mass * s.u * s.u, pe = p.mass * p.gravity * hM(s.xN);
    energyBars(ctx, W, H, [['动能', ke, '#43A047'], ['势能', pe, '#1E88E5'], ['热能', s.thermal, '#E53935'], ['总能', ke + pe + s.thermal, '#455A64']]);
    readout(ctx, [['速率', Math.abs(s.u).toFixed(1) + ' m/s'], ['高度', hM(s.xN).toFixed(1) + ' m']]);
  }
};

const collision = {
  id: 'collision', title: '碰撞实验室', sub: '动量守恒 / 弹性系数', category: '力学', color: '#5E35B1', emoji: '💥',
  params: [
    { key: 'm1', label: '球1 质量', min: 0.5, max: 5, step: 0.1, value: 2, fmt: v => v.toFixed(1) },
    { key: 'm2', label: '球2 质量', min: 0.5, max: 5, step: 0.1, value: 1, fmt: v => v.toFixed(1) },
    { key: 'v1i', label: '球1 初速', min: -6, max: 6, step: 0.2, value: 4, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) },
    { key: 'v2i', label: '球2 初速', min: -6, max: 6, step: 0.2, value: -2, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) },
    { key: 'e', label: '弹性系数', min: 0, max: 1, step: 0.05, value: 1, fmt: v => v.toFixed(2) }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 开始', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s, p) { s.running = false; s.x1 = 5; s.x2 = 15; s.v1 = p.v1i; s.v2 = p.v2i; } }
  ],
  init() { return { x1: 5, x2: 15, v1: 4, v2: -2, running: false, buzz: 0 }; },
  step(s, p, dt) {
    const r1 = 0.5 + Math.pow(p.m1, 1 / 3) * 0.6, r2 = 0.5 + Math.pow(p.m2, 1 / 3) * 0.6;
    if (!s.running) { s.v1 = p.v1i; s.v2 = p.v2i; return; }
    const sub = 6, h = dt / sub, T = 20;
    for (let i = 0; i < sub; i++) {
      s.x1 += s.v1 * h; s.x2 += s.v2 * h;
      if (s.x1 < r1) { s.x1 = r1; s.v1 = -s.v1; }
      if (s.x2 > T - r2) { s.x2 = T - r2; s.v2 = -s.v2; }
      if (s.x1 > T - r1) { s.x1 = T - r1; s.v1 = -s.v1; }
      if (s.x2 < r2) { s.x2 = r2; s.v2 = -s.v2; }
      if (s.x2 - s.x1 <= r1 + r2 && (s.v1 - s.v2) > 0) {
        const e = p.e, sum = p.m1 + p.m2;
        const nv1 = (p.m1 * s.v1 + p.m2 * s.v2 + p.m2 * e * (s.v2 - s.v1)) / sum;
        const nv2 = (p.m1 * s.v1 + p.m2 * s.v2 + p.m1 * e * (s.v1 - s.v2)) / sum;
        s.v1 = nv1; s.v2 = nv2; s.buzz = (s.buzz | 0) + 1;
        const ov = (r1 + r2) - (s.x2 - s.x1); s.x1 -= ov / 2; s.x2 += ov / 2;
      }
    }
  },
  hint: '拖动两个小球设置碰撞起点，再点开始',
  onDragStart(s, p, x, y) {
    const u = s._ui;
    if (!u) return false;
    if (Math.hypot(x - u.x1, y - u.cy) < u.r1 + 22) s.dragBall = 1;
    else if (Math.hypot(x - u.x2, y - u.cy) < u.r2 + 22) s.dragBall = 2;
    else return false;
    s.running = false; return true;
  },
  onDragMove(s, p, x) {
    const u = s._ui;
    if (!u) return;
    const wx = (x - u.left) / u.scale;
    if (s.dragBall === 1) s.x1 = Math.max(u.r1m, Math.min(s.x2 - u.r1m - u.r2m, wx));
    else if (s.dragBall === 2) s.x2 = Math.min(20 - u.r2m, Math.max(s.x1 + u.r1m + u.r2m, wx));
  },
  onDragEnd(s) { s.dragBall = 0; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#F3F1FA'; ctx.fillRect(0, 0, W, H);
    const left = W * 0.06, trackW = W * 0.88, cy = H * 0.5, scale = trackW / 20;
    const r1 = 0.5 + Math.pow(p.m1, 1 / 3) * 0.6, r2 = 0.5 + Math.pow(p.m2, 1 / 3) * 0.6;
    ctx.fillStyle = '#CAC4E0'; ctx.fillRect(left, cy + 22, trackW, 6);
    ctx.fillStyle = '#5E35B1'; ctx.fillRect(left - 8, cy - 60, 8, 90); ctx.fillRect(left + trackW, cy - 60, 8, 90);
    const ball = (x, r, col, v, ar) => {
      const X = left + x * scale; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X, cy, r * scale, 0, 7); ctx.fill();
      if (Math.abs(v) > 0.05) { const tip = X + v * scale * 0.5; ctx.strokeStyle = ar; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X, cy); ctx.lineTo(tip, cy); ctx.stroke(); const d = v > 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(tip, cy); ctx.lineTo(tip - d * 9, cy - 6); ctx.moveTo(tip, cy); ctx.lineTo(tip - d * 9, cy + 6); ctx.stroke(); }
    };
    ball(s.x1, r1, '#E53935', s.v1, '#B71C1C');
    ball(s.x2, r2, '#1E88E5', s.v2, '#0D47A1');
    s._ui = {
      x1: left + s.x1 * scale, x2: left + s.x2 * scale, cy,
      r1: r1 * scale, r2: r2 * scale, r1m: r1, r2m: r2, left, scale
    };
    const pp = p.m1 * s.v1 + p.m2 * s.v2, ke = 0.5 * p.m1 * s.v1 * s.v1 + 0.5 * p.m2 * s.v2 * s.v2;
    readout(ctx, [['总动量', pp.toFixed(1)], ['总动能', ke.toFixed(1)], ['v1', s.v1.toFixed(1)], ['v2', s.v2.toFixed(1)]]);
  }
};

// ================= 波动与光 =================
const N = 100;
const wave = {
  id: 'wave', title: '波在绳上', sub: '振幅 / 频率 / 端点', category: '波动与光', color: '#3949AB', emoji: '〰️',
  params: [
    { key: 'amp', label: '振幅', min: 0.1, max: 1, step: 0.05, value: 0.6, fmt: v => (v * 100).toFixed(0) + ' %' },
    { key: 'freq', label: '频率', min: 0.4, max: 3, step: 0.1, value: 1.4, fmt: v => v.toFixed(1) + ' Hz' },
    { key: 'tension', label: '波速', min: 0.3, max: 1, step: 0.05, value: 0.85, fmt: v => v.toFixed(2) },
    { key: 'damping', label: '阻尼', min: 0, max: 0.12, step: 0.005, value: 0.02, fmt: v => v.toFixed(3) }
  ],
  actions: [
    { label: s => s.osc ? '■ 停止波源' : '▶ 连续波', primary: true, on(s) { s.osc = !s.osc; } },
    { label: '脉冲', on(s) { s.pulse = true; s.pphase = 0; s.osc = false; } },
    { label: '重置', on(s) { s.y.fill(0); s.yOld.fill(0); s.t = 0; s.pulse = false; } }
  ],
  init() { return { y: new Array(N).fill(0), yOld: new Array(N).fill(0), t: 0, osc: true, pulse: false, pphase: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const sub = 3, h = dt / sub, c2 = p.tension * p.tension, yNew = new Array(N);
    for (let it = 0; it < sub; it++) {
      s.t += h; let drive = 0;
      if (s.osc) drive = p.amp * Math.sin(2 * Math.PI * p.freq * s.t);
      if (s.pulse) { drive = p.amp * Math.sin(s.pphase); s.pphase += 2 * Math.PI * p.freq * h; if (s.pphase >= Math.PI) s.pulse = false; }
      for (let i = 1; i < N - 1; i++) yNew[i] = 2 * s.y[i] - s.yOld[i] + c2 * (s.y[i + 1] - 2 * s.y[i] + s.y[i - 1]) - p.damping * (s.y[i] - s.yOld[i]);
      yNew[0] = drive; yNew[N - 1] = 0;
      for (let i = 0; i < N; i++) { s.yOld[i] = s.y[i]; s.y[i] = yNew[i]; }
    }
  },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#EDEFFB'; ctx.fillRect(0, 0, W, H);
    const left = W * 0.07, right = W * 0.95, midY = H * 0.46, dx = (right - left) / (N - 1), ampPx = H * 0.3;
    ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left, midY); ctx.lineTo(right, midY); ctx.stroke();
    ctx.strokeStyle = '#3949AB'; ctx.lineWidth = 4; ctx.beginPath();
    for (let i = 0; i < N; i++) { const Xx = left + i * dx, Yy = midY - s.y[i] * ampPx; i ? ctx.lineTo(Xx, Yy) : ctx.moveTo(Xx, Yy); }
    ctx.stroke();
    ctx.fillStyle = '#1A237E';
    for (let i = 0; i < N; i += 8) { ctx.beginPath(); ctx.arc(left + i * dx, midY - s.y[i] * ampPx, 3, 0, 7); ctx.fill(); }
    const dy = midY - s.y[0] * ampPx; ctx.fillStyle = '#455A64'; ctx.fillRect(left - 26, dy - 16, 24, 32);
    ctx.fillStyle = '#37474F'; ctx.fillRect(right + 2, midY - ampPx, 10, ampPx * 2);
  }
};

const bending = {
  id: 'bending', title: '光的折射', sub: '斯涅尔定律 / 全反射', category: '波动与光', color: '#00ACC1', emoji: '🔦',
  params: [
    { key: 'incidence', label: '入射角', min: 0, max: 89, step: 1, value: 45, fmt: v => v.toFixed(0) + ' °' },
    { key: 'n1', label: '上方 n₁', min: 1, max: 2.5, step: 0.01, value: 1.0, fmt: v => v.toFixed(2) },
    { key: 'n2', label: '下方 n₂', min: 1, max: 2.5, step: 0.01, value: 1.33, fmt: v => v.toFixed(2) }
  ],
  actions: [],
  init() { return {}; },
  step() {},
  draw(ctx, W, H, s, p) {
    const th1 = p.incidence * Math.PI / 180, sinT2 = p.n1 / p.n2 * Math.sin(th1);
    const tir = sinT2 > 1, th2 = tir ? 0 : Math.asin(Math.min(Math.max(sinT2, -1), 1));
    const interfaceY = H * 0.5, ox = W * 0.5, L = Math.min(W, H) * 0.42;
    ctx.fillStyle = lerpHex('#F2F8FE', '#7EB6DA', (p.n1 - 1) / 1.5); ctx.fillRect(0, 0, W, interfaceY);
    ctx.fillStyle = lerpHex('#CDE8F5', '#0D2E66', (p.n2 - 1) / 1.5); ctx.fillRect(0, interfaceY, W, H - interfaceY);
    ctx.strokeStyle = 'rgba(0,0,0,0.33)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, interfaceY); ctx.lineTo(W, interfaceY); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.setLineDash([12, 12]); ctx.beginPath(); ctx.moveTo(ox, interfaceY - L); ctx.lineTo(ox, interfaceY + L); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineCap = 'round';
    const incX = ox - L * Math.sin(th1), incY = interfaceY - L * Math.cos(th1);
    ctx.strokeStyle = '#FFEB3B'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(incX, incY); ctx.lineTo(ox, interfaceY); ctx.stroke();
    const reflX = ox + L * Math.sin(th1), reflY = interfaceY - L * Math.cos(th1);
    ctx.globalAlpha = tir ? 1 : 0.4; ctx.lineWidth = tir ? 5 : 3; ctx.beginPath(); ctx.moveTo(ox, interfaceY); ctx.lineTo(reflX, reflY); ctx.stroke(); ctx.globalAlpha = 1;
    if (!tir) { ctx.strokeStyle = '#FFC107'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ox, interfaceY); ctx.lineTo(ox + L * Math.sin(th2), interfaceY + L * Math.cos(th2)); ctx.stroke(); }
    ctx.fillStyle = '#FF7043'; ctx.beginPath(); ctx.arc(incX, incY, 9, 0, 7); ctx.fill();
    const crit = p.n1 > p.n2 ? Math.asin(p.n2 / p.n1) * 180 / Math.PI : null;
    readout(ctx, [['入射角', p.incidence.toFixed(0) + ' °'], ['折射角', tir ? '—' : (th2 * 180 / Math.PI).toFixed(0) + ' °'], ['临界角', crit ? crit.toFixed(0) + ' °' : '无'], ['状态', tir ? '全反射' : '折射+反射']]);
  }
};

const prism = {
  id: 'prism', title: '棱镜色散', sub: '白光分解 / 折射率与波长', category: '波动与光', color: '#AB47BC', emoji: '🌈',
  params: [
    { key: 'tilt', label: '入射倾角', min: -25, max: 25, step: 1, value: 8, fmt: v => v.toFixed(0) + ' °' },
    { key: 'dispersion', label: '色散强度', min: 0, max: 0.12, step: 0.01, value: 0.05, fmt: v => v.toFixed(2) },
    { key: 'nBase', label: '基准折射率', min: 1.4, max: 1.7, step: 0.01, value: 1.52, fmt: v => v.toFixed(2) }
  ],
  actions: [],
  init() { return {}; },
  step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.54, cy = H * 0.5, sz = Math.min(W, H) * 0.34;
    const A = { x: cx, y: cy - sz * 0.62 }, B = { x: cx - sz * 0.58, y: cy + sz * 0.5 }, C = { x: cx + sz * 0.58, y: cy + sz * 0.5 };
    const cen = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    const edges = [[A, B], [B, C], [C, A]];
    const outN = edges.map(e => { let n = vnorm({ x: e[1].y - e[0].y, y: -(e[1].x - e[0].x) }); const mid = { x: (e[0].x + e[1].x) / 2, y: (e[0].y + e[1].y) / 2 }; if (vdot(n, vsub(mid, cen)) < 0) n = vscale(n, -1); return n; });
    ctx.fillStyle = 'rgba(179,229,252,0.2)'; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(179,229,252,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    const tilt = p.tilt * Math.PI / 180, d0 = vnorm({ x: Math.cos(tilt), y: Math.sin(tilt) });
    const leftMid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, source = vsub(leftMid, vscale(d0, sz * 1.4));
    let entryT = 1e9, ei = -1;
    for (let i = 0; i < 3; i++) { if (vdot(d0, outN[i]) >= 0) continue; const t = rayEdge(source, d0, edges[i][0], edges[i][1]); if (t != null && t < entryT) { entryT = t; ei = i; } }
    ctx.lineCap = 'round';
    if (ei < 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(source.x + d0.x * sz * 3, source.y + d0.y * sz * 3); ctx.stroke(); return; }
    const entry = vadd(source, vscale(d0, entryT));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(entry.x, entry.y); ctx.stroke();
    for (let lambda = 400; lambda <= 680; lambda += 20) {
      const nl = p.nBase + p.dispersion * (560 - lambda) / 160, col = wlColor(lambda);
      const d1 = refractV(d0, outN[ei], 1 / nl);
      if (!d1) continue;
      const p1 = vadd(entry, vscale(d1, 0.5));
      let exT = 1e9, xi = -1;
      for (let i = 0; i < 3; i++) { if (i === ei) continue; const t = rayEdge(p1, d1, edges[i][0], edges[i][1]); if (t != null && t < exT) { exT = t; xi = i; } }
      if (xi < 0) continue;
      const exit = vadd(p1, vscale(d1, exT));
      ctx.strokeStyle = col; ctx.globalAlpha = 0.85; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(entry.x, entry.y); ctx.lineTo(exit.x, exit.y); ctx.stroke();
      const d2 = refractV(d1, vscale(outN[xi], -1), nl);
      ctx.globalAlpha = 1;
      if (d2) { ctx.beginPath(); ctx.moveTo(exit.x, exit.y); ctx.lineTo(exit.x + d2.x * sz * 2.6, exit.y + d2.y * sz * 2.6); ctx.stroke(); }
    }
  }
};

const optics = {
  id: 'optics', title: '透镜成像', sub: '薄透镜 / 实像虚像', category: '波动与光', color: '#26C6DA', emoji: '🔍',
  params: [
    { key: 'f', label: '焦距 f', min: 6, max: 30, step: 1, value: 14, fmt: v => v.toFixed(0) },
    { key: 'objectDist', label: '物距', min: 8, max: 70, step: 1, value: 34, fmt: v => v.toFixed(0) },
    { key: 'objectH', label: '物高', min: 3, max: 14, step: 1, value: 8, fmt: v => v.toFixed(0) }
  ],
  actions: [{ label: s => s.convex ? '凸透镜' : '凹透镜', primary: true, on(s) { s.convex = !s.convex; } }],
  init() { return { convex: true }; },
  step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#F7FAFC'; ctx.fillRect(0, 0, W, H);
    const f = s.convex ? p.f : -p.f, invDi = 1 / f - 1 / p.objectDist, atInf = Math.abs(invDi) < 1e-3;
    const di = atInf ? 0 : 1 / invDi, m = atInf ? 0 : -di / p.objectDist;
    const cy = H * 0.46, lensX = W * 0.52, scale = W * 0.011, fpx = Math.abs(f) * scale;
    ctx.strokeStyle = 'rgba(0,0,0,0.33)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    const lh = H * 0.34, ah = 16; ctx.strokeStyle = '#1565C0'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(lensX, cy - lh); ctx.lineTo(lensX, cy + lh); ctx.stroke();
    const head = (yy, dir) => { ctx.beginPath(); ctx.moveTo(lensX, yy); ctx.lineTo(lensX - ah, yy + dir); ctx.moveTo(lensX, yy); ctx.lineTo(lensX + ah, yy + dir); ctx.stroke(); };
    if (s.convex) { head(cy - lh, ah); head(cy + lh, -ah); } else { head(cy - lh, -ah); head(cy + lh, ah); }
    ctx.fillStyle = '#9C27B0'; [-1, 1].forEach(sgn => { ctx.beginPath(); ctx.arc(lensX + sgn * fpx, cy, 5, 0, 7); ctx.fill(); });
    const objX = lensX - p.objectDist * scale, objTopY = cy - p.objectH * scale;
    const arrow = (bx, by, tx, ty, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = dash ? 3 : 4; ctx.lineCap = 'round'; if (dash) ctx.setLineDash([9, 9]); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]); const d = ty < by ? -1 : 1; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - 7, ty + d * 10); ctx.moveTo(tx, ty); ctx.lineTo(tx + 7, ty + d * 10); ctx.stroke(); };
    arrow(objX, cy, objX, objTopY, '#2E7D32', false);
    const imageX = lensX + di * scale, imageTopY = cy - m * p.objectH * scale;
    const rayThrough = (ax, ay, bx, by) => { if (Math.abs(bx - ax) < 0.5) return; const sl = (by - ay) / (bx - ax); ctx.strokeStyle = '#F9A825'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(W, ay + sl * (W - ax)); ctx.stroke(); if (bx < ax) { ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; } };
    const pPar = { x: lensX, y: objTopY };
    ctx.strokeStyle = '#F9A825'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(objX, objTopY); ctx.lineTo(pPar.x, pPar.y); ctx.stroke();
    if (!atInf) rayThrough(pPar.x, pPar.y, imageX, imageTopY);
    ctx.strokeStyle = '#F9A825'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(objX, objTopY); ctx.lineTo(lensX, cy); ctx.stroke();
    if (!atInf) rayThrough(lensX, cy, imageX, imageTopY);
    if (!atInf) arrow(imageX, cy, imageX, imageTopY, '#D32F2F', di < 0);
    readout(ctx, [['像距', atInf ? '∞' : di.toFixed(1)], ['放大率', atInf ? '∞' : Math.abs(m).toFixed(2) + '×'], ['像', atInf ? '平行出射' : (di > 0 ? '实像·倒立' : '虚像·正立')], ['大小', atInf ? '—' : (Math.abs(m) > 1 ? '放大' : '缩小')]]);
  }
};

// ================= 电磁 =================
const circuit = {
  id: 'circuit', title: '电路搭建', sub: '欧姆定律 / 电流 / 灯泡亮度', category: '电磁', color: '#EF6C00', emoji: '⚡',
  params: [
    { key: 'emf', label: '电源电压', min: 1, max: 12, step: 0.5, value: 9, fmt: v => v.toFixed(1) + ' V' },
    { key: 'resistance', label: '电阻', min: 0, max: 20, step: 0.5, value: 6, fmt: v => v.toFixed(1) + ' Ω' },
    { key: 'bulbR', label: '灯泡电阻', min: 2, max: 20, step: 0.5, value: 8, fmt: v => v.toFixed(1) + ' Ω' },
    { key: 'internalR', label: '电池内阻', min: 0, max: 3, step: 0.1, value: 0.5, fmt: v => v.toFixed(1) + ' Ω' }
  ],
  actions: [{ label: s => s.switchOn ? '断开开关' : '闭合开关', primary: true, on(s) { s.switchOn = !s.switchOn; } }],
  init() { return { switchOn: true, phase: 0 }; },
  step(s, p, dt) {
    const totalR = p.resistance + p.bulbR + p.internalR, cur = s.switchOn ? p.emf / totalR : 0;
    s.phase = (s.phase + cur * 0.05 * Math.min(dt, 0.05) * 60) % 1; if (s.phase < 0) s.phase += 1;
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#F4F6F8'; ctx.fillRect(0, 0, W, H);
    const x0 = W * 0.16, x1 = W * 0.84, y0 = H * 0.18, y1 = H * 0.74;
    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.stroke();
    const totalR = p.resistance + p.bulbR + p.internalR, cur = s.switchOn ? p.emf / totalR : 0, br = Math.min(cur * cur * p.bulbR / 8, 1);
    if (s.switchOn && Math.abs(cur) > 0.001) {
      const cn = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], eg = [[cn[0], cn[1]], [cn[1], cn[2]], [cn[2], cn[3]], [cn[3], cn[0]]];
      const ln = eg.map(e => Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1])), tot = ln.reduce((a, b) => a + b, 0);
      for (let j = 0; j < 26; j++) { let sn = ((j / 26) + s.phase) % 1; if (sn < 0) sn += 1; let d = sn * tot; for (let k = 0; k < 4; k++) { if (d <= ln[k]) { const e = eg[k], f = ln[k] ? d / ln[k] : 0; ctx.fillStyle = '#1565C0'; ctx.beginPath(); ctx.arc(e[0][0] + (e[1][0] - e[0][0]) * f, e[0][1] + (e[1][1] - e[0][1]) * f, 5, 0, 7); ctx.fill(); break; } d -= ln[k]; } }
    }
    const bcx = (x0 + x1) / 2; ctx.fillStyle = '#F4F6F8'; ctx.fillRect(bcx - 34, y1 - 16, 68, 32);
    ctx.strokeStyle = '#263238'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bcx - 10, y1 - 20); ctx.lineTo(bcx - 10, y1 + 20); ctx.stroke();
    ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(bcx + 10, y1 - 11); ctx.lineTo(bcx + 10, y1 + 11); ctx.stroke();
    const rcy = (y0 + y1) / 2; ctx.fillStyle = '#F4F6F8'; ctx.fillRect(x1 - 14, rcy - 36, 28, 72);
    ctx.strokeStyle = '#EF6C00'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x1, rcy - 36);
    for (let i = 1; i <= 6; i++) { const yy = rcy - 36 + i * 12, xx = i % 2 ? x1 + 13 : x1 - 13; ctx.lineTo(i === 6 ? x1 : xx, yy); } ctx.stroke();
    const scy = (y0 + y1) / 2; ctx.fillStyle = '#F4F6F8'; ctx.fillRect(x0 - 16, scy - 30, 32, 60);
    ctx.fillStyle = '#37474F'; ctx.beginPath(); ctx.arc(x0, scy + 24, 5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x0, scy - 24, 5, 0, 7); ctx.fill();
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    if (s.switchOn) { ctx.strokeStyle = '#2E7D32'; ctx.beginPath(); ctx.moveTo(x0, scy + 24); ctx.lineTo(x0, scy - 24); ctx.stroke(); }
    else { ctx.strokeStyle = '#C62828'; ctx.beginPath(); ctx.moveTo(x0, scy + 24); ctx.lineTo(x0 + 22, scy - 14); ctx.stroke(); }
    const lcx = (x0 + x1) / 2; ctx.fillStyle = '#F4F6F8'; ctx.fillRect(lcx - 26, y0 - 26, 52, 52);
    if (br > 0.01) { ctx.fillStyle = 'rgba(255,238,88,' + (br * 0.6) + ')'; ctx.beginPath(); ctx.arc(lcx, y0, 34, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lcx, y0, 20, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,179,0,' + (0.35 + br * 0.65) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lcx, y0, 20, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lcx - 9, y0 + 6); ctx.lineTo(lcx, y0 - 8); ctx.lineTo(lcx + 9, y0 + 6); ctx.stroke();
    readout(ctx, [['电流', cur.toFixed(2) + ' A'], ['功率', (cur * cur * p.bulbR).toFixed(2) + ' W'], ['总电阻', totalR.toFixed(1) + ' Ω']]);
  }
};

const charges = {
  id: 'charges', title: '电荷与电场', sub: '点击放置 / 矢量场叠加', category: '电磁', color: '#6D4C41', emoji: '🧲',
  params: [],
  actions: [
    { label: s => s.sign > 0 ? '放置：正 +' : '放置：负 −', primary: true, on(s) { s.sign = -s.sign; } },
    { label: '撤销', on(s) { s.charges.pop(); } },
    { label: '清除', on(s) { s.charges = []; } }
  ],
  init() { return { charges: [], sign: 1 }; },
  step() {},
  onTap(s, p, x, y) { s.charges.push({ x: x, y: y, q: s.sign }); },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#F7F8FA'; ctx.fillRect(0, 0, W, H);
    const k = 4200, sp = 40;
    for (let gy = sp * 0.6; gy < H; gy += sp) for (let gx = sp * 0.6; gx < W; gx += sp) {
      let ex = 0, ey = 0;
      for (const c of s.charges) { const dx = gx - c.x, dy = gy - c.y, r2 = dx * dx + dy * dy + 36, r = Math.sqrt(r2), e = k * c.q / r2; ex += e * dx / r; ey += e * dy / r; }
      const mm = Math.hypot(ex, ey);
      if (mm > 0.04) { const len = 17 * mm / (mm + 2.5), ux = ex / mm, uy = ey / mm, hx = gx + ux * len, hy = gy + uy * len; const shade = Math.min(0.25 + 0.6 * (mm / (mm + 2.5)), 1); ctx.strokeStyle = 'rgba(0,0,0,' + shade + ')'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(gx - ux * len, gy - uy * len); ctx.lineTo(hx, hy); ctx.stroke(); const sa = 5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - ux * sa - uy * sa * 0.6, hy - uy * sa + ux * sa * 0.6); ctx.moveTo(hx, hy); ctx.lineTo(hx - ux * sa + uy * sa * 0.6, hy - uy * sa - ux * sa * 0.6); ctx.stroke(); }
    }
    for (const c of s.charges) { ctx.fillStyle = c.q > 0 ? '#E53935' : '#1E88E5'; ctx.beginPath(); ctx.arc(c.x, c.y, 18, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x - 8, c.y); ctx.lineTo(c.x + 8, c.y); ctx.stroke(); if (c.q > 0) { ctx.beginPath(); ctx.moveTo(c.x, c.y - 8); ctx.lineTo(c.x, c.y + 8); ctx.stroke(); } }
    readout(ctx, [['电荷数', s.charges.length + ''], ['待放置', s.sign > 0 ? '正 +' : '负 −'], ['提示', '点击画布放置']]);
  }
};

// ================= 热学 =================
const GBH = 10;
const gas = {
  id: 'gas', title: '气体性质', sub: '分子运动 / 温度 / 压强', category: '热学', color: '#26A69A', emoji: '🌡️',
  params: [
    { key: 'count', label: '粒子数', min: 10, max: 150, step: 1, value: 60, fmt: v => v.toFixed(0) },
    { key: 'temperature', label: '温度', min: 5, max: 100, step: 1, value: 40, fmt: v => v.toFixed(0) },
    { key: 'volumeW', label: '容器体积', min: 5, max: 16, step: 1, value: 12, fmt: v => (v * GBH).toFixed(0) }
  ],
  actions: [],
  init() { return { parts: [], pressure: 0 }; },
  step(s, p, dt) {
    const n = Math.round(p.count);
    while (s.parts.length < n) { const sp = p.temperature / 14, ang = Math.random() * 6.2832; s.parts.push({ x: Math.random() * p.volumeW, y: Math.random() * GBH, vx: sp * Math.cos(ang), vy: sp * Math.sin(ang) }); }
    while (s.parts.length > n) s.parts.pop();
    if (dt <= 0 || s.parts.length === 0) return;
    const target = p.temperature / 14; let sumSp = 0; s.parts.forEach(q => sumSp += Math.hypot(q.vx, q.vy));
    const avg = sumSp / s.parts.length, factor = avg > 1e-3 ? 1 + (target / avg - 1) * 0.06 : 1;
    let sumKE = 0;
    s.parts.forEach(q => {
      q.vx *= factor; q.vy *= factor; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.x < 0) { q.x = 0; q.vx = -q.vx; } if (q.x > p.volumeW) { q.x = p.volumeW; q.vx = -q.vx; }
      if (q.y < 0) { q.y = 0; q.vy = -q.vy; } if (q.y > GBH) { q.y = GBH; q.vy = -q.vy; }
      sumKE += 0.5 * (q.vx * q.vx + q.vy * q.vy);
    });
    const pInst = sumKE / (p.volumeW * GBH) * 10; s.pressure += (pInst - s.pressure) * 0.06;
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#EFF3F6'; ctx.fillRect(0, 0, W, H);
    const maxW = 16, availW = W * 0.86, availH = H * 0.78, scale = Math.min(availW / maxW, availH / GBH);
    const boxW = p.volumeW * scale, boxH = GBH * scale, left = W * 0.5 - (maxW * scale) / 2, top = (H - boxH) / 2;
    ctx.fillStyle = '#fff'; ctx.fillRect(left, top, boxW, boxH);
    ctx.fillStyle = '#455A64'; ctx.fillRect(left - 6, top - 6, 6, boxH + 12); ctx.fillRect(left, top - 6, boxW + 6, 6); ctx.fillRect(left, top + boxH, boxW + 6, 6);
    ctx.fillStyle = '#8D6E63'; ctx.fillRect(left + boxW, top - 10, 12, boxH + 20);
    let sumKE = 0;
    s.parts.forEach(q => { const sp = Math.hypot(q.vx, q.vy), t = Math.min(sp / 9, 1); ctx.fillStyle = 'rgb(' + Math.round((0.2 + 0.7 * t) * 255) + ',' + Math.round((0.35 * (1 - t) + 0.1) * 255) + ',' + Math.round((0.85 * (1 - t) + 0.1) * 255) + ')'; ctx.beginPath(); ctx.arc(left + q.x * scale, top + q.y * scale, 5, 0, 7); ctx.fill(); sumKE += 0.5 * sp * sp; });
    const avgKE = s.parts.length ? sumKE / s.parts.length : 0;
    readout(ctx, [['粒子数', s.parts.length + ''], ['温度', (avgKE * 28).toFixed(0)], ['压强', s.pressure.toFixed(1)], ['体积', (p.volumeW * GBH).toFixed(0)]]);
  }
};

// ================= 原子 =================
const ELEMENTS = ['—', '氢 H', '氦 He', '锂 Li', '铍 Be', '硼 B', '碳 C', '氮 N', '氧 O', '氟 F', '氖 Ne', '钠 Na', '镁 Mg', '铝 Al', '硅 Si', '磷 P', '硫 S', '氯 Cl', '氩 Ar', '钾 K', '钙 Ca', '钪 Sc', '钛 Ti', '钒 V', '铬 Cr', '锰 Mn', '铁 Fe', '钴 Co', '镍 Ni', '铜 Cu', '锌 Zn'];
const ASHELLS = [2, 8, 18, 8];
const atom = {
  id: 'atom', title: '原子搭建', sub: '质子 / 中子 / 电子', category: '原子', color: '#5C6BC0', emoji: '⚛️',
  params: [],
  // steppers：紧凑的单行计数器控件（标签 [−] 数值 [+]），
  // 用于整数型、需要持久状态的量，取代一堆散乱的 ± 按钮。
  steppers: [
    { key: 'protons', label: '质子', color: '#E53935', min: 0, max: 30, get: s => s.protons, set: (s, v) => { s.protons = v; } },
    { key: 'neutrons', label: '中子', color: '#90A4AE', min: 0, max: 40, get: s => s.neutrons, set: (s, v) => { s.neutrons = v; } },
    { key: 'electrons', label: '电子', color: '#42A5F5', min: 0, max: 36, get: s => s.electrons, set: (s, v) => { s.electrons = v; } }
  ],
  actions: [
    { label: '清空', on(s) { s.protons = 0; s.neutrons = 0; s.electrons = 0; } }
  ],
  init() { return { protons: 6, neutrons: 6, electrons: 6, phase: 0 }; },
  step(s, p, dt) { s.phase += dt * 0.6; },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#0E1726'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.5, maxR = Math.min(W, H) * 0.44;
    let remaining = s.electrons;
    for (let si = 0; si < ASHELLS.length; si++) {
      if (remaining <= 0) break;
      const onShell = Math.min(remaining, ASHELLS[si]); remaining -= onShell;
      const rr = maxR * (0.45 + 0.18 * si);
      ctx.strokeStyle = 'rgba(176,190,197,0.2)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.stroke();
      for (let i = 0; i < onShell; i++) { const ang = s.phase * (1 - si * 0.12) + i * (6.2832 / onShell); ctx.fillStyle = '#42A5F5'; ctx.beginPath(); ctx.arc(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang), 7, 0, 7); ctx.fill(); }
    }
    const total = s.protons + s.neutrons, nucR = Math.min(8 + Math.sqrt(total) * 7, maxR * 0.4);
    for (let i = 0; i < total; i++) { const ang = i * 2.39996, r = total <= 1 ? 0 : nucR * Math.sqrt(i / total); ctx.fillStyle = i < s.protons ? '#E53935' : '#90A4AE'; ctx.beginPath(); ctx.arc(cx + r * Math.cos(ang), cy + r * Math.sin(ang), 9, 0, 7); ctx.fill(); }
    const mass = s.protons + s.neutrons, charge = s.protons - s.electrons;
    const type = s.protons === 0 ? '—' : charge === 0 ? '中性原子' : charge > 0 ? '阳离子 +' + charge : '阴离子 ' + charge;
    readout(ctx, [
      ['质子/中子/电子', s.protons + ' / ' + s.neutrons + ' / ' + s.electrons],
      ['元素', s.protons === 0 ? '—' : ELEMENTS[s.protons]],
      ['质量数', mass + ''],
      ['电荷', charge === 0 ? '0' : (charge > 0 ? '+' + charge : '' + charge)],
      ['类型', type],
    ]);
  }
};

// ===== 第 1 批新增 =====
const coulomb = {
  id: 'coulomb', title: '库仑定律', sub: '两电荷作用力 F=kq₁q₂/r²', category: '电磁', color: '#D81B60', emoji: '➕',
  params: [
    { key: 'q1', label: '电荷 q₁', min: -5, max: 5, step: 0.5, value: 3, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) },
    { key: 'q2', label: '电荷 q₂', min: -5, max: 5, step: 0.5, value: -3, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) },
    { key: 'r', label: '间距', min: 1, max: 10, step: 0.5, value: 5, fmt: v => v.toFixed(1) + ' m' }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 释放', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s) { s.running = false; s.stuck = false; s.v1 = 0; s.v2 = 0; } }
  ],
  init() { return { x1: -2.5, x2: 2.5, v1: 0, v2: 0, running: false, stuck: false, buzz: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    if (!s.running) { s.x1 = -p.r / 2; s.x2 = p.r / 2; s.v1 = 0; s.v2 = 0; s.stuck = false; return; }
    if (s.stuck) return;
    const sub = 4, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const r = Math.max(s.x2 - s.x1, 0.4), F = 8.99 * p.q1 * p.q2 / (r * r), m = 3;
      s.v1 += (-F / m) * h; s.v2 += (F / m) * h;
      s.x1 += s.v1 * h; s.x2 += s.v2 * h;
      const lim = 5.6;
      if (s.x1 < -lim) { s.x1 = -lim; s.v1 = 0; }
      if (s.x2 > lim) { s.x2 = lim; s.v2 = 0; }
      if (s.x2 - s.x1 <= 0.8) {
        const mid = (s.x1 + s.x2) / 2; s.x1 = mid - 0.4; s.x2 = mid + 0.4;
        s.v1 = 0; s.v2 = 0; s.stuck = true; s.buzz = (s.buzz | 0) + 1; break;
      }
    }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#F7F8FA'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.5, scale = W * 0.07, cx = W * 0.5;
    const X1 = cx + s.x1 * scale, X2 = cx + s.x2 * scale;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    const r = Math.max(s.x2 - s.x1, 0.4), F = 8.99 * p.q1 * p.q2 / (r * r), repulsive = F > 0, mag = Math.abs(F), alen = Math.min(16 + mag * 3, 110);
    const dc = (x, q) => { const rad = 12 + Math.abs(q) * 3; ctx.fillStyle = q >= 0 ? '#E53935' : '#1E88E5'; ctx.beginPath(); ctx.arc(x, cy, rad, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 7, cy); ctx.lineTo(x + 7, cy); ctx.stroke(); if (q >= 0) { ctx.beginPath(); ctx.moveTo(x, cy - 7); ctx.lineTo(x, cy + 7); ctx.stroke(); } };
    dc(X1, p.q1); dc(X2, p.q2);
    if (mag > 0.001 && !s.stuck) {
      arrowSeg(ctx, X1, cy - 46, X1 + (repulsive ? -1 : 1) * alen, cy - 46, '#37474F', 5);
      arrowSeg(ctx, X2, cy - 46, X2 + (repulsive ? 1 : -1) * alen, cy - 46, '#37474F', 5);
    }
    if (s.stuck) { ctx.fillStyle = '#D81B60'; ctx.font = '15px sans-serif'; ctx.fillText('啪！吸在一起了', cx - 55, cy - 60); }
    readout(ctx, [['距离 r', r.toFixed(2) + ' m'], ['作用力', mag.toFixed(2) + ' N'], ['类型', F === 0 ? '无' : (repulsive ? '斥力 ←→' : '引力 →←')], ['状态', s.stuck ? '吸附' : (s.running ? '运动中' : '待释放')]]);
  }
};

const forces = {
  id: 'forces', title: '力与运动', sub: '牛顿第二定律 / 摩擦', category: '力学', color: '#43A047', emoji: '📦',
  params: [
    { key: 'force', label: '施加力', min: -60, max: 60, step: 1, value: 20, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(0) + ' N' },
    { key: 'friction', label: '摩擦系数', min: 0, max: 0.8, step: 0.05, value: 0.2, fmt: v => v.toFixed(2) },
    { key: 'mass', label: '质量', min: 1, max: 20, step: 1, value: 5, fmt: v => v.toFixed(0) + ' kg' }
  ],
  actions: [{ label: '重置', on(s) { s.x = 10; s.v = 0; s.a = 0; } }],
  init() { return { x: 10, v: 0, a: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const fricMax = p.friction * p.mass * 9.8;
    let net;
    if (Math.abs(s.v) < 0.02) { net = Math.abs(p.force) <= fricMax ? 0 : p.force - Math.sign(p.force) * fricMax; if (net === 0) s.v = 0; }
    else net = p.force - Math.sign(s.v) * fricMax;
    s.a = net / p.mass; s.v += s.a * dt; s.x += s.v * dt;
    if (s.x < 1) { s.x = 1; s.v = Math.abs(s.v) * 0.3; }
    if (s.x > 19) { s.x = 19; s.v = -Math.abs(s.v) * 0.3; }
  },
  hint: '按住木箱向左或向右推，松手停止施力',
  onDragStart(s, p, x, y) {
    const u = s._ui;
    if (!u || x < u.X - 38 || x > u.X + 38 || y < u.groundY - 70 || y > u.groundY + 16) return false;
    s.dragging = true; s.dragStartX = x; p.force = 0; return true;
  },
  onDragMove(s, p, x) {
    p.force = Math.max(-60, Math.min(60, (x - s.dragStartX) * 1.2));
  },
  onDragEnd(s, p) { s.dragging = false; p.force = 0; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#EAF3FB'; ctx.fillRect(0, 0, W, H * 0.7);
    ctx.fillStyle = '#A5D6A7'; ctx.fillRect(0, H * 0.7, W, H * 0.3);
    const left = W * 0.04, trackW = W * 0.92, scale = trackW / 20, groundY = H * 0.7, X = left + s.x * scale, size = 46;
    s._ui = { X, groundY };
    ctx.fillStyle = '#43A047'; ctx.fillRect(X - size / 2, groundY - size, size, size);
    if (Math.abs(p.force) > 0.5) { const len = Math.min(Math.abs(p.force) * 1.2, 90) * Math.sign(p.force); arrowSeg(ctx, X, groundY - size - 16, X + len, groundY - size - 16, '#1E88E5', 5); }
    readout(ctx, [['加速度', s.a.toFixed(2) + ' m/s²'], ['速度', s.v.toFixed(2) + ' m/s'], ['净力', (s.a * p.mass).toFixed(1) + ' N']]);
  }
};

const ramp = {
  id: 'ramp', title: '斜面滑块', sub: '分力 / 摩擦 / 加速度', category: '力学', color: '#FB8C00', emoji: '📐',
  params: [
    { key: 'angle', label: '倾角', min: 0, max: 60, step: 1, value: 25, fmt: v => v.toFixed(0) + ' °' },
    { key: 'friction', label: '摩擦系数', min: 0, max: 1, step: 0.05, value: 0.3, fmt: v => v.toFixed(2) },
    { key: 'mass', label: '质量', min: 1, max: 10, step: 0.5, value: 3, fmt: v => v.toFixed(1) + ' kg' }
  ],
  actions: [{ label: '重置', on(s) { s.d = 0; s.v = 0; s.a = 0; } }],
  init() { return { d: 0, v: 0, a: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const th = p.angle * Math.PI / 180, along = 9.8 * Math.sin(th), fric = p.friction * 9.8 * Math.cos(th);
    let a = (s.v <= 0.001 && along <= fric) ? 0 : along - fric;
    if (a < 0 && s.v <= 0) a = 0;
    s.a = a; s.v += a * dt; if (s.v < 0) s.v = 0; s.d += s.v * dt * 0.06;
    if (s.d > 1) { s.d = 1; s.v = 0; }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FFF3E0'; ctx.fillRect(0, 0, W, H);
    const th = p.angle * Math.PI / 180, x0 = W * 0.12, by = H * 0.78, x1 = W * 0.9;
    const tr = { x: x1, y: by - (x1 - x0) * Math.tan(th) }, bl = { x: x0, y: by };
    ctx.fillStyle = '#FFE0B2'; ctx.strokeStyle = '#FB8C00'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(x1, by); ctx.lineTo(tr.x, tr.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    const bx = tr.x + (bl.x - tr.x) * s.d, byp = tr.y + (bl.y - tr.y) * s.d;
    ctx.save(); ctx.translate(bx, byp); ctx.rotate(-th); ctx.fillStyle = '#E65100'; ctx.fillRect(-20, -34, 40, 34); ctx.restore();
    readout(ctx, [['加速度', s.a.toFixed(2) + ' m/s²'], ['速度', s.v.toFixed(2) + ' m/s'], ['状态', s.a > 0 ? '下滑' : '静止']]);
  }
};

const hooke = {
  id: 'hooke', title: '胡克定律', sub: 'F = k·x / 弹性势能', category: '力学', color: '#7E57C2', emoji: '🪝',
  params: [
    { key: 'k', label: '劲度系数', min: 50, max: 500, step: 10, value: 200, fmt: v => v.toFixed(0) + ' N/m' },
    { key: 'force', label: '拉力', min: -100, max: 100, step: 5, value: 50, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(0) + ' N' }
  ],
  actions: [],
  init() { return { x: 0.25, v: 0 }; },
  step(s, p, dt) {
    // 二阶弹簧动力学：拖动拉力滑块时方块会真实地弹跳到新位置
    if (dt <= 0 || s.dragging) return;
    const xT = p.force / p.k, om = 9, sub = 3, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const a = om * om * (xT - s.x) - 2 * 0.28 * om * s.v;
      s.v += a * h; s.x += s.v * h;
    }
  },
  hint: '按住方块压缩或拉伸弹簧，松手回弹',
  onDragStart(s, p, x, y) {
    const u = s._ui;
    if (!u || x < u.blockX - 18 || x > u.blockX + 78 || y < u.cy - 52 || y > u.cy + 52) return false;
    s.dragging = true; s.v = 0; return true;
  },
  onDragMove(s, p, x) {
    const u = s._ui;
    if (!u) return;
    const desired = (x - u.wallX - u.natural - 26) / u.scale;
    p.force = Math.max(-100, Math.min(100, desired * p.k));
    s.x = p.force / p.k; s.v = 0;
  },
  onDragEnd(s, p) { s.dragging = false; p.force = 0; s.v = 0; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#F3F0FB'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.42, wallX = W * 0.1, natural = W * 0.3, scale = W * 0.4;
    const xT = p.force / p.k;
    let blockX = wallX + natural + s.x * scale; if (blockX < wallX + 40) blockX = wallX + 40;
    // 自然长度（灰虚线）与平衡目标（紫虚线）参考线
    ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.moveTo(wallX + natural, cy - 60); ctx.lineTo(wallX + natural, cy + 84); ctx.stroke();
    ctx.strokeStyle = 'rgba(126,87,194,0.5)';
    ctx.beginPath(); ctx.moveTo(wallX + natural + xT * scale, cy - 60); ctx.lineTo(wallX + natural + xT * scale, cy + 84); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#607D8B'; ctx.fillRect(wallX - 14, cy - 50, 14, 100);
    ctx.strokeStyle = '#7E57C2'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(wallX, cy);
    const coils = 14, span = blockX - wallX, seg = span / (coils * 2);
    for (let i = 1; i <= coils * 2; i++) { const xx = wallX + i * seg, yy = i === coils * 2 ? cy : (i % 2 ? cy - 14 : cy + 14); ctx.lineTo(i === coils * 2 ? blockX : xx, yy); }
    ctx.stroke();
    ctx.fillStyle = '#5E35B1'; ctx.fillRect(blockX, cy - 26, 52, 52);
    s._ui = { blockX, cy, wallX, natural, scale };
    if (Math.abs(p.force) > 1) arrowSeg(ctx, blockX + 26, cy - 44, blockX + 26 + Math.sign(p.force) * Math.min(Math.abs(p.force), 90), cy - 44, '#1E88E5', 5);
    // 弹性势能条
    const PE = 0.5 * p.k * s.x * s.x, peMax = 0.5 * 500 * 0.25;
    ctx.fillStyle = '#455A64'; ctx.font = '11px sans-serif'; ctx.fillText('弹性势能', W * 0.08, H * 0.8 - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(W * 0.08, H * 0.8, W * 0.6, 10);
    ctx.fillStyle = '#7E57C2'; ctx.fillRect(W * 0.08, H * 0.8, W * 0.6 * Math.min(PE / peMax, 1), 10);
    readout(ctx, [['形变 x', (s.x * 100).toFixed(1) + ' cm'], ['弹力', (p.k * Math.abs(s.x)).toFixed(0) + ' N'], ['势能', PE.toFixed(1) + ' J']]);
  }
};

const circular = {
  id: 'circular', title: '圆周运动', sub: '向心力 / 线速度', category: '力学', color: '#EC407A', emoji: '🔄',
  params: [
    { key: 'radius', label: '半径', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) + ' m' },
    { key: 'omega', label: '角速度', min: 0.5, max: 4, step: 0.1, value: 2, fmt: v => v.toFixed(1) + ' rad/s' }
  ],
  actions: [], init() { return { ang: 0 }; }, step(s, p, dt) { s.ang += p.omega * dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FCE4EC'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.45, scale = Math.min(W, H) * 0.13, R = p.radius * scale;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    const ox = cx + R * Math.cos(s.ang), oy = cy + R * Math.sin(s.ang);
    ctx.strokeStyle = '#90A4AE'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox, oy); ctx.stroke();
    arrowSeg(ctx, ox, oy, ox - Math.sin(s.ang) * Math.min(p.omega * p.radius * scale * 0.4, 80), oy + Math.cos(s.ang) * Math.min(p.omega * p.radius * scale * 0.4, 80), '#1E88E5', 4);
    const clen = Math.min(p.omega * p.omega * p.radius * scale * 0.12, 80);
    arrowSeg(ctx, ox, oy, ox + (cx - ox) / R * clen, oy + (cy - oy) / R * clen, '#E53935', 4);
    ctx.fillStyle = '#EC407A'; ctx.beginPath(); ctx.arc(ox, oy, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#37474F'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
    readout(ctx, [['线速度', (p.omega * p.radius).toFixed(2) + ' m/s'], ['向心加速度', (p.omega * p.omega * p.radius).toFixed(2) + ' m/s²']]);
  }
};

// ===== 第 2 批新增 =====
const interference = {
  id: 'interference', title: '波的干涉', sub: '双源叠加 / 干涉条纹', category: '波动与光', color: '#00838F', emoji: '🌊',
  params: [
    { key: 'sep', label: '双源间距', min: 20, max: 180, step: 5, value: 90, fmt: v => v.toFixed(0) },
    { key: 'wavelength', label: '波长', min: 18, max: 80, step: 2, value: 38, fmt: v => v.toFixed(0) }
  ],
  actions: [], init() { return { t: 0 }; }, step(s, p, dt) { s.t += dt; },
  draw(ctx, W, H, s, p) {
    const k = 2 * Math.PI / p.wavelength, om = 2.2, cell = 8, sx = W * 0.16, s1y = H * 0.5 - p.sep / 2, s2y = H * 0.5 + p.sep / 2;
    for (let gy = 0; gy < H; gy += cell) for (let gx = 0; gx < W; gx += cell) {
      const r1 = Math.hypot(gx - sx, gy - s1y), r2 = Math.hypot(gx - sx, gy - s2y);
      const val = Math.cos(k * r1 - om * s.t) + Math.cos(k * r2 - om * s.t), b = Math.round((val + 2) / 4 * 255);
      ctx.fillStyle = 'rgb(' + Math.round(b * 0.2) + ',' + Math.round(b * 0.5) + ',' + b + ')';
      ctx.fillRect(gx, gy, cell, cell);
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, s1y, 5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(sx, s2y, 5, 0, 7); ctx.fill();
    readout(ctx, [['波长', p.wavelength.toFixed(0)], ['双源间距', p.sep.toFixed(0)]]);
  }
};

const faraday = {
  id: 'faraday', title: '电磁感应', sub: '法拉第定律 / 感应电动势', category: '电磁', color: '#00ACC1', emoji: '🧭',
  params: [
    { key: 'speed', label: '移动速度', min: 0, max: 3, step: 0.1, value: 1.2, fmt: v => v.toFixed(1) },
    { key: 'strength', label: '磁体强度', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return { t: 0, flux: 0, emf: 0, mx: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    s.t += p.speed * dt; const mx = Math.sin(s.t), flux = p.strength / (1 + (mx * 3) * (mx * 3));
    s.emf = -(flux - s.flux) / Math.max(dt, 1e-3); s.flux = flux; s.mx = mx;
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E0F7FA'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.4, coilX = W * 0.62;
    ctx.strokeStyle = '#B87333'; ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(coilX + i * 10, cy, 10, 40, 0, 0, 7); ctx.stroke(); }
    const magX = W * 0.3 + s.mx * W * 0.16;
    ctx.fillStyle = '#E53935'; ctx.fillRect(magX - 40, cy - 16, 40, 32);
    ctx.fillStyle = '#1E88E5'; ctx.fillRect(magX, cy - 16, 40, 32);
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText('N', magX - 26, cy + 5); ctx.fillText('S', magX + 14, cy + 5);
    const gx = W * 0.5, gy = H * 0.8, defl = Math.max(-1, Math.min(1, s.emf * 4));
    ctx.strokeStyle = '#455A64'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gx, gy, 40, Math.PI, 2 * Math.PI); ctx.stroke();
    arrowSeg(ctx, gx, gy, gx + Math.sin(defl * 1.2) * 36, gy - Math.cos(defl * 1.2) * 36, '#E53935', 3);
    readout(ctx, [['感应电动势', s.emf.toFixed(2) + ' V'], ['磁通量', s.flux.toFixed(2)]]);
  }
};

const decay = {
  id: 'decay', title: '放射性衰变', sub: '半衰期 / 指数衰减', category: '原子', color: '#7CB342', emoji: '☢️',
  params: [{ key: 'halfLife', label: '半衰期', min: 1, max: 10, step: 0.5, value: 3, fmt: v => v.toFixed(1) + ' s' }],
  actions: [{ label: '重置', on(s) { for (let i = 0; i < s.n.length; i++) s.n[i] = false; s.t = 0; } }],
  init() { return { n: new Array(120).fill(false), t: 0 }; },
  step(s, p, dt) { if (dt <= 0) return; s.t += dt; const prob = 1 - Math.pow(2, -dt / p.halfLife); for (let i = 0; i < s.n.length; i++) if (!s.n[i] && Math.random() < prob) s.n[i] = true; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#F1F8E9'; ctx.fillRect(0, 0, W, H);
    const cols = 12, total = s.n.length, cell = Math.min((W * 0.9) / cols, (H * 0.6) / Math.ceil(total / cols)), ox = (W - cols * cell) / 2, oy = H * 0.1;
    let remaining = 0;
    for (let i = 0; i < total; i++) { const r = Math.floor(i / cols), c = i % cols; if (!s.n[i]) remaining++; ctx.fillStyle = s.n[i] ? '#9E9E9E' : '#1E88E5'; ctx.beginPath(); ctx.arc(ox + c * cell + cell / 2, oy + r * cell + cell / 2, cell * 0.32, 0, 7); ctx.fill(); }
    const barY = H * 0.82, frac = remaining / total;
    ctx.fillStyle = '#C8E6C9'; ctx.fillRect(W * 0.1, barY, W * 0.8, 18);
    ctx.fillStyle = '#43A047'; ctx.fillRect(W * 0.1, barY, W * 0.8 * frac, 18);
    readout(ctx, [['剩余原子', remaining + ' / ' + total], ['时间', s.t.toFixed(1) + ' s'], ['半衰期', p.halfLife.toFixed(1) + ' s']]);
  }
};

const buoyancy = {
  id: 'buoyancy', title: '浮力与密度', sub: '阿基米德原理 / 浮沉', category: '力学', color: '#0288D1', emoji: '🛟',
  params: [
    { key: 'density', label: '物块密度', min: 200, max: 3000, step: 50, value: 600, fmt: v => v.toFixed(0) + ' kg/m³' },
    { key: 'size', label: '边长', min: 0.2, max: 1, step: 0.05, value: 0.5, fmt: v => v.toFixed(2) + ' m' }
  ],
  actions: [{ label: '重置', on(s) { s.y = -0.5; s.vy = 0; } }],
  init() { return { y: -0.5, vy: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const wr = 1000, L = p.size, half = L / 2, sub = Math.max(0, Math.min(L, s.y + half)), subFrac = sub / L;
    const a = 9.8 * (wr * subFrac / p.density - 1) - s.vy * 1.5;
    s.vy += a * dt; s.y += s.vy * dt;
    if (s.y > 4) { s.y = 4; s.vy = 0; } if (s.y < -1.5) s.y = -1.5;
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E1F5FE'; ctx.fillRect(0, 0, W, H);
    const surfaceY = H * 0.32, scale = H * 0.13;
    ctx.fillStyle = '#4FC3F7'; ctx.fillRect(0, surfaceY, W, H - surfaceY);
    const L = p.size * scale, cx = W * 0.5, cyB = surfaceY + s.y * scale;
    ctx.fillStyle = p.density < 1000 ? '#8D6E63' : '#4E342E'; ctx.fillRect(cx - L / 2, cyB - L / 2, L, L);
    readout(ctx, [['物块密度', p.density + ' kg/m³'], ['水密度', '1000 kg/m³'], ['结果', p.density < 1000 ? '漂浮' : '下沉']]);
  }
};

// ===== 第 3 批新增 =====
const photoelectric = {
  id: 'photoelectric', title: '光电效应', sub: '光子能量 / 逸出功', category: '原子', color: '#FFB300', emoji: '💡',
  params: [
    { key: 'wavelength', label: '波长', min: 200, max: 700, step: 10, value: 400, fmt: v => v.toFixed(0) + ' nm' },
    { key: 'intensity', label: '光强', min: 0, max: 100, step: 5, value: 60, fmt: v => v.toFixed(0) + ' %' },
    { key: 'work', label: '逸出功', min: 1, max: 5, step: 0.1, value: 2.3, fmt: v => v.toFixed(1) + ' eV' }
  ],
  actions: [], init() { return { el: [], acc: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const E = 1240 / p.wavelength, eject = E > p.work;
    s.acc += dt * (eject ? p.intensity / 20 : 0);
    while (s.acc > 1) { s.acc -= 1; s.el.push({ x: 0, y: (Math.random() - 0.5) * 60, ke: Math.max(0, E - p.work) }); }
    s.el.forEach(e => { e.x += (0.4 + e.ke * 0.3) * dt; });
    s.el = s.el.filter(e => e.x < 1);
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#263238'; ctx.fillRect(0, 0, W, H);
    const E = 1240 / p.wavelength, eject = E > p.work, plateX = W * 0.25, cy = H * 0.45, collX = W * 0.8;
    const col = wlColor(Math.max(380, Math.min(680, p.wavelength)));
    ctx.strokeStyle = col; ctx.globalAlpha = 0.5 + p.intensity / 200; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, H * 0.15); ctx.lineTo(plateX, cy); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#90A4AE'; ctx.fillRect(plateX - 10, cy - 70, 10, 140);
    ctx.fillStyle = '#607D8B'; ctx.fillRect(collX, cy - 70, 10, 140);
    s.el.forEach(e => { const X = plateX + e.x * (collX - plateX); ctx.fillStyle = '#42A5F5'; ctx.beginPath(); ctx.arc(X, cy + e.y, 4, 0, 7); ctx.fill(); });
    readout(ctx, [['光子能量', E.toFixed(2) + ' eV'], ['逸出功', p.work.toFixed(1) + ' eV'], ['最大动能', Math.max(0, E - p.work).toFixed(2) + ' eV'], ['电流', eject ? (p.intensity * 0.1).toFixed(1) + ' μA' : '0（无）']]);
  }
};

const doppler = {
  id: 'doppler', title: '多普勒效应', sub: '波源运动 / 频率变化', category: '波动与光', color: '#5C6BC0', emoji: '📣',
  params: [
    { key: 'speed', label: '波源速度', min: 0, max: 0.9, step: 0.05, value: 0.4, fmt: v => v.toFixed(2) + ' c' },
    { key: 'freq', label: '频率', min: 1, max: 4, step: 0.5, value: 2, fmt: v => v.toFixed(1) + ' Hz' }
  ],
  actions: [], init() { return { x: 0.1, t: 0, waves: [], acc: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    s.t += dt; s.x += p.speed * 0.18 * dt;
    if (s.x > 0.95) { s.x = 0.05; s.waves = []; }
    s.acc += dt;
    if (s.acc > 1 / p.freq) { s.acc = 0; s.waves.push({ x: s.x, t: s.t }); }
    s.waves = s.waves.filter(w => (s.t - w.t) < 3);
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E8EAF6'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.45, c = 0.18 * W;
    ctx.strokeStyle = 'rgba(63,81,181,0.6)'; ctx.lineWidth = 2;
    s.waves.forEach(w => { const r = (s.t - w.t) * c; ctx.beginPath(); ctx.arc(w.x * W, cy, r, 0, 7); ctx.stroke(); });
    ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(s.x * W, cy, 9, 0, 7); ctx.fill();
    readout(ctx, [['波源速度', p.speed.toFixed(2) + ' c'], ['前方', '频率升高 ↑'], ['后方', '频率降低 ↓']]);
  }
};

const lever = {
  id: 'lever', title: '杠杆平衡', sub: '力矩 τ = F·d', category: '力学', color: '#6D4C41', emoji: '⚖️',
  params: [
    { key: 'm1', label: '左重物', min: 1, max: 10, step: 1, value: 3, fmt: v => v.toFixed(0) + ' kg' },
    { key: 'd1', label: '左力臂', min: 1, max: 6, step: 0.5, value: 3, fmt: v => v.toFixed(1) + ' m' },
    { key: 'm2', label: '右重物', min: 1, max: 10, step: 1, value: 3, fmt: v => v.toFixed(0) + ' kg' },
    { key: 'd2', label: '右力臂', min: 1, max: 6, step: 0.5, value: 3, fmt: v => v.toFixed(1) + ' m' }
  ],
  actions: [], init() { return { tilt: 0 }; },
  step(s, p, dt) { const net = p.m2 * p.d2 - p.m1 * p.d1, target = Math.max(-0.35, Math.min(0.35, net * 0.03)); s.tilt += (target - s.tilt) * Math.min(1, dt * 3); },
  hint: '沿杠杆拖动左右重物，直接改变力臂',
  onDragStart(s, p, x, y) {
    const u = s._ui;
    if (!u) return false;
    if (Math.hypot(x - u.lx, y - u.ly) < 36) s.dragWeight = 'left';
    else if (Math.hypot(x - u.rx, y - u.ry) < 36) s.dragWeight = 'right';
    else return false;
    return true;
  },
  onDragMove(s, p, x) {
    const u = s._ui;
    if (!u) return;
    const d = Math.max(1, Math.min(6, Math.abs(x - u.fx) / u.beamLen * 6));
    if (s.dragWeight === 'left') p.d1 = Math.round(d * 2) / 2;
    else if (s.dragWeight === 'right') p.d2 = Math.round(d * 2) / 2;
  },
  onDragEnd(s) { s.dragWeight = null; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#EFEBE9'; ctx.fillRect(0, 0, W, H);
    const fx = W * 0.5, fy = H * 0.55, beamLen = W * 0.4;
    ctx.fillStyle = '#5D4037'; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - 20, fy + 50); ctx.lineTo(fx + 20, fy + 50); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(s.tilt);
    ctx.strokeStyle = '#8D6E63'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-beamLen, 0); ctx.lineTo(beamLen, 0); ctx.stroke();
    const lx = -p.d1 / 6 * beamLen, rx = p.d2 / 6 * beamLen;
    ctx.fillStyle = '#1E88E5'; ctx.fillRect(lx - 10 - p.m1, 0, 20 + p.m1 * 2, 14 + p.m1 * 4);
    ctx.fillStyle = '#E53935'; ctx.fillRect(rx - 10 - p.m2, 0, 20 + p.m2 * 2, 14 + p.m2 * 4);
    ctx.restore();
    const co = Math.cos(s.tilt), si = Math.sin(s.tilt);
    s._ui = {
      fx, beamLen,
      lx: fx + lx * co, ly: fy + lx * si + 10,
      rx: fx + rx * co, ry: fy + rx * si + 10
    };
    const tl = p.m1 * p.d1, tr = p.m2 * p.d2;
    readout(ctx, [['左力矩', tl.toFixed(1)], ['右力矩', tr.toFixed(1)], ['状态', Math.abs(tl - tr) < 0.05 ? '平衡' : (tl > tr ? '左倾' : '右倾')]]);
  }
};

const ph = {
  id: 'ph', title: '酸碱 pH', sub: 'pH / 氢离子浓度', category: '化学', color: '#43A047', emoji: '🧪',
  params: [{ key: 'pH', label: 'pH 值', min: 0, max: 14, step: 0.1, value: 7, fmt: v => v.toFixed(1) }],
  actions: [],
  init() { return { bubbles: [] }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    if (s.bubbles.length < 14 && Math.random() < dt * 5) s.bubbles.push({ x: 0.1 + Math.random() * 0.8, y: 1, r: 2 + Math.random() * 3, sp: 0.15 + Math.random() * 0.2 });
    s.bubbles.forEach(b => { b.y -= b.sp * dt; b.x += Math.sin(b.y * 20) * dt * 0.05; });
    s.bubbles = s.bubbles.filter(b => b.y > 0.03);
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, W, H);
    const v = p.pH, col = v < 3 ? '#E53935' : v < 6 ? '#FB8C00' : v < 7 ? '#FDD835' : v < 8 ? '#7CB342' : v < 11 ? '#00897B' : '#5E35B1';
    const bx = W * 0.28, bw = W * 0.44, by = H * 0.14, bh = H * 0.5;
    const liqY = by + bh * 0.25;
    ctx.fillStyle = col; ctx.fillRect(bx, liqY, bw, by + bh - liqY);
    // 上升的气泡
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    s.bubbles.forEach(b => { ctx.beginPath(); ctx.arc(bx + b.x * bw, liqY + b.y * (by + bh - liqY), b.r, 0, 7); ctx.fill(); });
    ctx.strokeStyle = '#90A4AE'; ctx.lineWidth = 4; ctx.strokeRect(bx, by, bw, bh);
    // 浸入的指示纸条（下端变色）
    ctx.fillStyle = '#FFF9C4'; ctx.fillRect(bx + bw - 26, by - 26, 16, bh * 0.4);
    ctx.fillStyle = col; ctx.fillRect(bx + bw - 26, by - 26 + bh * 0.24, 16, bh * 0.16);
    // pH 色阶尺 + 游标
    const scX = W * 0.08, scW = W * 0.84, scY = H * 0.78;
    const colors = ['#E53935', '#FB8C00', '#FDD835', '#7CB342', '#00897B', '#5E35B1'];
    for (let x = 0; x < scW; x++) { const f = x / scW * 14, c = f < 3 ? 0 : f < 6 ? 1 : f < 7 ? 2 : f < 8 ? 3 : f < 11 ? 4 : 5; ctx.fillStyle = colors[c]; ctx.fillRect(scX + x, scY, 1, 16); }
    const mx = scX + v / 14 * scW;
    ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.moveTo(mx, scY - 4); ctx.lineTo(mx - 7, scY - 14); ctx.lineTo(mx + 7, scY - 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#607D8B'; ctx.font = '11px sans-serif';
    ctx.fillText('0 酸', scX, scY + 30); ctx.fillText('7 中', scX + scW / 2 - 10, scY + 30); ctx.fillText('14 碱', scX + scW - 30, scY + 30);
    readout(ctx, [['pH', p.pH.toFixed(1)], ['[H⁺]', Math.pow(10, -p.pH).toExponential(1) + ' M'], ['性质', p.pH < 6.9 ? '酸性' : p.pH > 7.1 ? '碱性' : '中性']]);
  }
};

const concentration = {
  id: 'concentration', title: '溶液浓度', sub: '溶质 / 溶剂 / 浓度', category: '化学', color: '#8E24AA', emoji: '🥤',
  params: [
    { key: 'solute', label: '溶质量', min: 0, max: 100, step: 5, value: 40, fmt: v => v.toFixed(0) + ' g' },
    { key: 'volume', label: '溶液体积', min: 20, max: 100, step: 5, value: 60, fmt: v => v.toFixed(0) + ' mL' }
  ],
  actions: [],
  init() { return { dots: [] }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const target = Math.round(p.solute * 0.7);
    while (s.dots.length < target) s.dots.push({ x: Math.random(), y: Math.random(), a: Math.random() * 6.2832 });
    while (s.dots.length > target) s.dots.pop();
    s.dots.forEach(d => {
      d.a += (Math.random() - 0.5) * dt * 5;
      d.x += Math.cos(d.a) * dt * 0.12; d.y += Math.sin(d.a) * dt * 0.12;
      if (d.x < 0) { d.x = 0; d.a = Math.PI - d.a; }
      if (d.x > 1) { d.x = 1; d.a = Math.PI - d.a; }
      if (d.y < 0) { d.y = 0; d.a = -d.a; }
      if (d.y > 1) { d.y = 1; d.a = -d.a; }
    });
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, W, H);
    const conc = p.solute / p.volume, alpha = Math.min(conc / 1.5, 1);
    const bx = W * 0.28, bw = W * 0.44, by = H * 0.12, bh = H * 0.62, fillH = bh * Math.min(p.volume / 100, 1);
    const liqY = by + bh - fillH;
    ctx.fillStyle = 'rgba(142,36,170,' + (0.08 + alpha * 0.5) + ')'; ctx.fillRect(bx, liqY, bw, fillH);
    // 溶质粒子在液体中做无规则运动
    ctx.fillStyle = '#8E24AA';
    s.dots.forEach(d => { ctx.beginPath(); ctx.arc(bx + 4 + d.x * (bw - 8), liqY + 4 + d.y * Math.max(fillH - 8, 4), 3, 0, 7); ctx.fill(); });
    ctx.strokeStyle = '#90A4AE'; ctx.lineWidth = 4; ctx.strokeRect(bx, by, bw, bh);
    // 量筒刻度
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.font = '10px sans-serif'; ctx.fillStyle = '#78909C';
    for (let m = 25; m <= 100; m += 25) { const yy = by + bh - bh * m / 100; ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx + 10, yy); ctx.stroke(); ctx.fillText(m + '', bx - 22, yy + 4); }
    readout(ctx, [['溶质', p.solute + ' g（' + s.dots.length + ' 粒）'], ['体积', p.volume + ' mL'], ['浓度', (conc * 1000).toFixed(0) + ' g/L']]);
  }
};

// ===== 第 4 批新增 =====
const orbit = {
  id: 'orbit', title: '万有引力轨道', sub: '引力 / 轨道 / 开普勒', category: '力学', color: '#3949AB', emoji: '🪐',
  params: [
    { key: 'v0', label: '初速度', min: 0.4, max: 1.6, step: 0.05, value: 0.85, fmt: v => v.toFixed(2) },
    { key: 'mass', label: '中心质量', min: 0.5, max: 2, step: 0.1, value: 1, fmt: v => v.toFixed(1) }
  ],
  actions: [{ label: '重置', on(s, p) { s.x = 2; s.y = 0; s.vx = 0; s.vy = p.v0; s.trail = []; } }],
  init() { return { x: 2, y: 0, vx: 0, vy: 0.85, trail: [] }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const sub = 8, h = Math.min(dt, 0.05) / sub, GM = p.mass;
    for (let i = 0; i < sub; i++) { const r = Math.hypot(s.x, s.y) || 1e-3, a = -GM / (r * r * r); s.vx += a * s.x * h; s.vy += a * s.y * h; s.x += s.vx * h; s.y += s.vy * h; }
    s.trail.push([s.x, s.y]); if (s.trail.length > 240) s.trail.shift();
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#0D1030'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.45, scale = Math.min(W, H) * 0.16;
    ctx.strokeStyle = 'rgba(120,140,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath();
    s.trail.forEach((t, i) => { const X = cx + t[0] * scale, Y = cy + t[1] * scale; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke();
    ctx.fillStyle = '#FDD835'; ctx.beginPath(); ctx.arc(cx, cy, 10 + p.mass * 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#42A5F5'; ctx.beginPath(); ctx.arc(cx + s.x * scale, cy + s.y * scale, 7, 0, 7); ctx.fill();
    readout(ctx, [['距离', Math.hypot(s.x, s.y).toFixed(2)], ['速度', Math.hypot(s.vx, s.vy).toFixed(2)]]);
  }
};

const capacitor = {
  id: 'capacitor', title: '电容器', sub: 'C=εA/d / Q=CV', category: '电磁', color: '#0097A7', emoji: '🔋',
  params: [
    { key: 'voltage', label: '电压', min: 0, max: 12, step: 0.5, value: 6, fmt: v => v.toFixed(1) + ' V' },
    { key: 'area', label: '极板面积', min: 1, max: 10, step: 0.5, value: 5, fmt: v => v.toFixed(1) },
    { key: 'distance', label: '极板间距', min: 1, max: 10, step: 0.5, value: 3, fmt: v => v.toFixed(1) }
  ],
  actions: [],
  init() { return { q: 4, phase: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const Q = 2 * p.area / p.distance * p.voltage;
    s.q += (Q - s.q) * Math.min(1, dt * 2);   // 指数充/放电
    s.phase += dt;
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(0, 0, W, H);
    const C = 2 * p.area / p.distance, Q = C * p.voltage, E = p.voltage / p.distance;
    const cx = W * 0.56, topY = H * 0.28, gap = 46 + p.distance * 12, botY = topY + gap, pw = p.area * 13 + 66;
    const batX = W * 0.12, batY = (topY + botY) / 2;
    // 电路连线 + 电池
    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - pw / 2, topY); ctx.lineTo(batX, topY); ctx.lineTo(batX, batY - 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - pw / 2, botY); ctx.lineTo(batX, botY); ctx.lineTo(batX, batY + 24); ctx.stroke();
    drawBattery(ctx, batX, batY, true);
    // 极板
    ctx.fillStyle = '#E53935'; ctx.fillRect(cx - pw / 2, topY - 4, pw, 8);
    ctx.fillStyle = '#1E88E5'; ctx.fillRect(cx - pw / 2, botY - 4, pw, 8);
    // 板上电荷数随 s.q 渐增（充电过程可见）
    const nq = Math.max(0, Math.min(Math.round(s.q), 14));
    ctx.font = '15px sans-serif';
    for (let i = 0; i < nq; i++) {
      const x = cx - pw / 2 + 10 + i * (pw - 20) / Math.max(nq - 1, 1);
      ctx.fillStyle = '#E53935'; ctx.fillText('+', x - 4, topY - 10);
      ctx.fillStyle = '#1E88E5'; ctx.fillText('−', x - 4, botY + 22);
    }
    for (let i = 0; i < 5; i++) {
      const x = cx - pw / 2 + pw * (i + 0.5) / 5;
      arrowSeg(ctx, x, topY + 10, x, botY - 10, 'rgba(0,0,0,' + (0.12 + Math.min(E / 5, 0.55)) + ')', 1.5);
    }
    // 充电电流：导线上流动的黄点
    const charging = Math.abs(Q - s.q) > 0.12;
    if (charging) {
      const flowPath = pts => {
        const lens = []; let tot = 0;
        for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); tot += l; }
        for (let j = 0; j < 4; j++) {
          let d = (s.phase * 90 + j * tot / 4) % tot;
          for (let k = 0; k < lens.length; k++) {
            if (d <= lens[k]) { const f = d / lens[k], a = pts[k], b = pts[k + 1]; ctx.fillStyle = '#FFC107'; ctx.beginPath(); ctx.arc(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 4, 0, 7); ctx.fill(); break; }
            d -= lens[k];
          }
        }
      };
      flowPath([[batX, batY - 24], [batX, topY], [cx - pw / 2, topY]]);
      flowPath([[cx - pw / 2, botY], [batX, botY], [batX, batY + 24]]);
    }
    readout(ctx, [['电容 C', C.toFixed(2)], ['电荷 Q', s.q.toFixed(1) + (charging ? ' 充电中…' : '')], ['电场 E', E.toFixed(2)], ['储能', (0.5 * C * p.voltage * p.voltage).toFixed(1)]]);
  }
};

const calorimetry = {
  id: 'calorimetry', title: '热量混合', sub: '热平衡 / 末温', category: '热学', color: '#EF5350', emoji: '♨️',
  params: [
    { key: 'm1', label: '物体1 质量', min: 1, max: 5, step: 0.5, value: 2, fmt: v => v.toFixed(1) + ' kg' },
    { key: 'T1', label: '物体1 温度', min: 0, max: 100, step: 5, value: 80, fmt: v => v.toFixed(0) + '°C' },
    { key: 'm2', label: '物体2 质量', min: 1, max: 5, step: 0.5, value: 2, fmt: v => v.toFixed(1) + ' kg' },
    { key: 'T2', label: '物体2 温度', min: 0, max: 100, step: 5, value: 20, fmt: v => v.toFixed(0) + '°C' }
  ],
  actions: [
    { label: s => s.mix ? '⏸ 暂停' : '▶ 混合', primary: true, on(s) { s.mix = !s.mix; } },
    { label: '重置', on(s) { s.mix = false; s.pr = 0; } }
  ],
  init() { return { mix: false, pr: 0 }; },
  step(s, p, dt) { if (s.mix) s.pr = Math.min(1, s.pr + dt * 0.4); },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, W, H);
    const Tf = (p.m1 * p.T1 + p.m2 * p.T2) / (p.m1 + p.m2), t1 = p.T1 + (Tf - p.T1) * s.pr, t2 = p.T2 + (Tf - p.T2) * s.pr;
    const tcol = T => { const x = Math.max(0, Math.min(1, T / 100)); return 'rgb(' + Math.round(60 + x * 195) + ',' + Math.round(120 * (1 - x) + 40) + ',' + Math.round(220 * (1 - x) + 30) + ')'; };
    const bk = (cx, m, T) => { const bw = 40 + m * 14, bh = H * 0.4, bx = cx - bw / 2, by = H * 0.22; ctx.fillStyle = tcol(T); ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = '#90A4AE'; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh); ctx.fillStyle = '#222'; ctx.font = '14px sans-serif'; ctx.fillText(T.toFixed(0) + '°C', cx - 16, by + bh + 24); };
    bk(W * 0.3, p.m1, t1); bk(W * 0.7, p.m2, t2);
    readout(ctx, [['末温 Tf', Tf.toFixed(1) + '°C'], ['物体1', t1.toFixed(0) + '°C'], ['物体2', t2.toFixed(0) + '°C']]);
  }
};

const energylevels = {
  id: 'energylevels', title: '氢原子能级', sub: '能级跃迁 / 光谱', category: '原子', color: '#7B1FA2', emoji: '🔬',
  params: [
    { key: 'nf', label: '初能级 n₁', min: 1, max: 6, step: 1, value: 3, fmt: v => 'n=' + v.toFixed(0) },
    { key: 'nt', label: '末能级 n₂', min: 1, max: 6, step: 1, value: 2, fmt: v => 'n=' + v.toFixed(0) }
  ],
  actions: [], init() { return {}; }, step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#1A1030'; ctx.fillRect(0, 0, W, H);
    const top = H * 0.12, bot = H * 0.78, En = n => -13.6 / (n * n), yOf = n => bot + (En(n) + 13.6) / 13.6 * (top - bot);
    ctx.font = '12px sans-serif';
    for (let n = 1; n <= 6; n++) { const y = yOf(n); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.2, y); ctx.lineTo(W * 0.8, y); ctx.stroke(); ctx.fillStyle = '#B0BEC5'; ctx.fillText('n=' + n, W * 0.82, y + 4); }
    const nf = Math.round(p.nf), nt = Math.round(p.nt);
    if (nf !== nt) {
      const y1 = yOf(nf), y2 = yOf(nt), emit = nf > nt, dE = Math.abs(En(nf) - En(nt)), lam = 1240 / dE;
      const col = (lam >= 380 && lam <= 700) ? wlColor(lam) : '#888';
      arrowSeg(ctx, W * 0.45, y1, W * 0.45, y2, emit ? col : '#FFD54F', 3);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(W * 0.6, (y1 + y2) / 2, 6, 0, 7); ctx.fill();
      readout(ctx, [['ΔE', dE.toFixed(2) + ' eV'], ['波长', lam.toFixed(0) + ' nm'], ['类型', emit ? '发射' : '吸收'], ['谱系', nt === 1 ? '莱曼系' : nt === 2 ? '巴尔末系' : '帕邢系']]);
    } else readout(ctx, [['提示', '请选择不同能级']]);
  }
};

// ===== 第 5 批新增 =====
const magnet = {
  id: 'magnet', title: '磁场与指南针', sub: '条形磁体 / 磁感线方向', category: '电磁', color: '#C2185B', emoji: '🧭',
  params: [{ key: 'strength', label: '磁体强度', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) }],
  actions: [], init() { return {}; }, step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#F3F4F8'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.45, magL = W * 0.3, magX = W * 0.5, N = { x: magX + magL / 2, y: cy }, S = { x: magX - magL / 2, y: cy }, grid = 46;
    for (let gy = grid; gy < H - 20; gy += grid) for (let gx = grid; gx < W; gx += grid) {
      const dN = { x: gx - N.x, y: gy - N.y }, dS = { x: gx - S.x, y: gy - S.y }, rN = Math.hypot(dN.x, dN.y) + 6, rS = Math.hypot(dS.x, dS.y) + 6;
      let bx = p.strength * (dN.x / (rN * rN * rN) - dS.x / (rS * rS * rS)), by = p.strength * (dN.y / (rN * rN * rN) - dS.y / (rS * rS * rS));
      const m = Math.hypot(bx, by) || 1; bx /= m; by /= m;
      ctx.strokeStyle = '#E53935'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + bx * 12, gy + by * 12); ctx.stroke();
      ctx.strokeStyle = '#90A4AE'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - bx * 12, gy - by * 12); ctx.stroke();
    }
    ctx.fillStyle = '#1E88E5'; ctx.fillRect(magX - magL / 2, cy - 18, magL / 2, 36);
    ctx.fillStyle = '#E53935'; ctx.fillRect(magX, cy - 18, magL / 2, 36);
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.fillText('S', magX - magL / 2 + 12, cy + 6); ctx.fillText('N', magX + magL / 2 - 22, cy + 6);
    readout(ctx, [['磁体', '条形磁铁'], ['红针', '指向磁场方向']]);
  }
};

const sound = {
  id: 'sound', title: '声波与响度', sub: '频率→音调 / 振幅→响度', category: '波动与光', color: '#0097A7', emoji: '🔊',
  params: [
    { key: 'frequency', label: '频率', min: 100, max: 1000, step: 20, value: 440, fmt: v => v.toFixed(0) + ' Hz' },
    { key: 'amplitude', label: '振幅', min: 5, max: 100, step: 5, value: 60, fmt: v => v.toFixed(0) + ' %' }
  ],
  actions: [], init() { return { t: 0 }; }, step(s, p, dt) { s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E0F7FA'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.38, k = p.frequency / 1400, om = p.frequency * 0.06;
    for (let x = W * 0.18; x < W; x += 4) { const d = (1 + Math.sin(k * x - om * s.t)) / 2; ctx.fillStyle = 'rgba(0,131,143,' + (d * p.amplitude / 100) + ')'; ctx.fillRect(x, cy - 50, 4, 100); }
    ctx.fillStyle = '#37474F'; ctx.fillRect(W * 0.08, cy - 40, W * 0.06, 80); ctx.beginPath(); ctx.moveTo(W * 0.14, cy - 40); ctx.lineTo(W * 0.2, cy - 60); ctx.lineTo(W * 0.2, cy + 60); ctx.lineTo(W * 0.14, cy + 40); ctx.closePath(); ctx.fill();
    const wy = H * 0.78; ctx.strokeStyle = '#00838F'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x < W; x++) { const y = wy - Math.sin(k * x - om * s.t) * p.amplitude * 0.4; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    readout(ctx, [['频率', p.frequency + ' Hz'], ['响度', (20 * Math.log10(p.amplitude / 5) + 30).toFixed(0) + ' dB'], ['音调', p.frequency > 500 ? '高' : '低']]);
  }
};

const pulley = {
  id: 'pulley', title: '滑轮组', sub: '省力费距离 / 动态提升', category: '力学', color: '#795548', emoji: '⛓️',
  params: [
    { key: 'load', label: '重物', min: 10, max: 200, step: 10, value: 100, fmt: v => v.toFixed(0) + ' N' },
    { key: 'ropes', label: '承重绳数', min: 1, max: 4, step: 1, value: 2, fmt: v => v.toFixed(0) + ' 根' }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : (s.h >= 1 ? '↻ 再来一次' : '▶ 拉绳提升'), primary: true, on(s) { if (s.h >= 1) { s.h = 0; s.pulled = 0; s.phase = 0; s.running = true; } else { s.running = !s.running; } } },
    { label: '重置', on(s) { s.running = false; s.h = 0; s.pulled = 0; s.phase = 0; } }
  ],
  init() { return { h: 0, pulled: 0, phase: 0, running: false, buzz: 0 }; },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    const n = Math.round(p.ropes);
    s.h += 0.14 * dt;                 // 重物匀速上升
    s.pulled += 0.14 * dt * n;        // 绳端速度是重物的 n 倍
    s.phase += 0.14 * dt * n * 2.2;
    if (s.h >= 1) { s.h = 1; s.running = false; s.buzz = (s.buzz | 0) + 1; }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#EFEBE9'; ctx.fillRect(0, 0, W, H);
    const n = Math.round(p.ropes), effort = p.load / n;
    const ceilY = H * 0.1;
    ctx.fillStyle = '#5D4037'; ctx.fillRect(W * 0.06, ceilY - 12, W * 0.88, 12);
    ctx.strokeStyle = '#4E342E'; ctx.lineWidth = 2;
    for (let x = W * 0.08; x < W * 0.92; x += 26) { ctx.beginPath(); ctx.moveTo(x, ceilY - 12); ctx.lineTo(x + 10, ceilY - 24); ctx.stroke(); }
    const mpx = W * 0.34, mpr = 16, travel = H * 0.24;
    const mpY = H * 0.56 - travel * s.h;
    const fpx = W * 0.72, fpy = ceilY + 20, fpr = 14;
    // n 根承重绳
    ctx.strokeStyle = '#3E2723'; ctx.lineWidth = 3;
    const spread = 15;
    for (let i = 0; i < n; i++) {
      const rx = mpx - spread * (n - 1) / 2 + i * spread;
      ctx.beginPath(); ctx.moveTo(rx, ceilY); ctx.lineTo(rx, mpY); ctx.stroke();
    }
    // 拉绳：动滑轮 → 定滑轮 → 下垂到手
    ctx.beginPath(); ctx.moveTo(mpx + mpr, mpY); ctx.lineTo(fpx - fpr, fpy); ctx.stroke();
    const handY = Math.min(fpy + fpr + H * 0.18 + Math.min(s.pulled, 1.2) * H * 0.12, H * 0.72);
    ctx.beginPath(); ctx.moveTo(fpx + fpr, fpy); ctx.lineTo(fpx + fpr, handY); ctx.stroke();
    // 绳上流动的橙点：移动速度正比 n，直观展示"费距离"
    ctx.fillStyle = '#FF7043';
    const dgap = 26, off = (s.phase * dgap) % dgap;
    for (let y = fpy + fpr + off; y < handY - 8; y += dgap) { ctx.beginPath(); ctx.arc(fpx + fpr, y, 3.5, 0, 7); ctx.fill(); }
    // 滑轮（带旋转辐条）
    const wheel = (x, y, r, a) => {
      ctx.fillStyle = '#8D6E63'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#EFEBE9'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * r * 0.75, y - Math.sin(a) * r * 0.75); ctx.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - Math.sin(a) * r * 0.75, y + Math.cos(a) * r * 0.75); ctx.lineTo(x + Math.sin(a) * r * 0.75, y - Math.cos(a) * r * 0.75); ctx.stroke();
      ctx.fillStyle = '#4E342E'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    };
    ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(fpx, ceilY); ctx.lineTo(fpx, fpy); ctx.stroke();
    wheel(fpx, fpy, fpr, s.phase * 2);
    wheel(mpx, mpY, mpr, -s.phase * 2);
    // 重物
    const bw = 44 + p.load * 0.2;
    ctx.fillStyle = '#6D4C41'; ctx.fillRect(mpx - bw / 2, mpY + mpr + 2, bw, 42);
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText(p.load.toFixed(0) + ' N', mpx - 16, mpY + mpr + 28);
    // 手 + 拉力箭头
    ctx.fillStyle = '#FFB74D'; ctx.beginPath(); ctx.arc(fpx + fpr, handY + 8, 9, 0, 7); ctx.fill();
    arrowSeg(ctx, fpx + fpr + 30, handY - 16, fpx + fpr + 30, handY + 6 + Math.min(effort, 80) * 0.4, '#E53935', 4);
    ctx.fillStyle = '#E53935'; ctx.fillText('F=' + effort.toFixed(0) + 'N', fpx + fpr - 62, handY + 34);
    // 底部对比条：重物升高 vs 绳子拉出（同一比例，一眼看出 n 倍差距）
    const lift = 2, bY = H * 0.845, bWd = W * 0.64, bX = W * 0.06;
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#455A64'; ctx.fillText('重物升高 ' + (s.h * lift).toFixed(1) + ' m', bX, bY - 5);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(bX, bY, bWd, 9);
    ctx.fillStyle = '#43A047'; ctx.fillRect(bX, bY, bWd * (s.h * lift / 8), 9);
    ctx.fillStyle = '#455A64'; ctx.fillText('绳子拉出 ' + (s.pulled * lift).toFixed(1) + ' m', bX, bY + 26);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(bX, bY + 31, bWd, 9);
    ctx.fillStyle = '#FB8C00'; ctx.fillRect(bX, bY + 31, bWd * Math.min(s.pulled * lift / 8, 1), 9);
    readout(ctx, [['拉力 F', effort.toFixed(0) + ' N（省' + n + '倍力）'], ['绳端速度', n + '× 重物速度'], ['状态', s.h >= 1 ? '已到顶 🎉' : (s.running ? '提升中…' : '待提升')]]);
  }
};

const brownian = {
  id: 'brownian', title: '布朗运动', sub: '分子碰撞 / 随机游走', category: '热学', color: '#455A64', emoji: '🫧',
  params: [
    { key: 'temperature', label: '温度', min: 10, max: 100, step: 5, value: 50, fmt: v => v.toFixed(0) },
    { key: 'count', label: '分子数', min: 20, max: 120, step: 5, value: 60, fmt: v => v.toFixed(0) }
  ],
  actions: [{ label: '重置', on(s) { s.bx = 0.5; s.by = 0.5; s.bvx = 0; s.bvy = 0; s.trail = []; } }],
  init() { return { bx: 0.5, by: 0.5, bvx: 0, bvy: 0, small: [], trail: [] }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const n = Math.round(p.count), spd = p.temperature / 200;
    while (s.small.length < n) s.small.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * spd, vy: (Math.random() - 0.5) * spd });
    while (s.small.length > n) s.small.pop();
    s.small.forEach(q => { q.x += q.vx * dt * 8; q.y += q.vy * dt * 8; if (q.x < 0 || q.x > 1) q.vx = -q.vx; if (q.y < 0 || q.y > 1) q.vy = -q.vy; q.x = Math.max(0, Math.min(1, q.x)); q.y = Math.max(0, Math.min(1, q.y)); });
    s.bvx = s.bvx * 0.9 + (Math.random() - 0.5) * spd * 0.5; s.bvy = s.bvy * 0.9 + (Math.random() - 0.5) * spd * 0.5;
    s.bx += s.bvx * dt * 8; s.by += s.bvy * dt * 8;
    if (s.bx < 0.05 || s.bx > 0.95) s.bvx = -s.bvx; if (s.by < 0.05 || s.by > 0.95) s.bvy = -s.bvy;
    s.bx = Math.max(0.05, Math.min(0.95, s.bx)); s.by = Math.max(0.05, Math.min(0.95, s.by));
    s.trail.push([s.bx, s.by]); if (s.trail.length > 200) s.trail.shift();
  },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#B0BEC5'; s.small.forEach(q => { ctx.beginPath(); ctx.arc(q.x * W, q.y * H, 2.5, 0, 7); ctx.fill(); });
    ctx.strokeStyle = 'rgba(69,90,100,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); s.trail.forEach((t, i) => { i ? ctx.lineTo(t[0] * W, t[1] * H) : ctx.moveTo(t[0] * W, t[1] * H); }); ctx.stroke();
    ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(s.bx * W, s.by * H, 12, 0, 7); ctx.fill();
    readout(ctx, [['大颗粒', '红色'], ['现象', '受分子撞击随机游走']]);
  }
};

const resistivity = {
  id: 'resistivity', title: '电阻率', sub: 'R = ρL/A', category: '电磁', color: '#FF7043', emoji: '🪙',
  params: [
    { key: 'rho', label: '电阻率 ρ', min: 0.5, max: 5, step: 0.1, value: 1.7, fmt: v => v.toFixed(1) },
    { key: 'length', label: '长度 L', min: 1, max: 10, step: 0.5, value: 5, fmt: v => v.toFixed(1) },
    { key: 'area', label: '横截面 A', min: 1, max: 10, step: 0.5, value: 5, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return { phase: 0 }; },
  step(s, p, dt) { const R = p.rho * p.length / p.area, I = 12 / R; s.phase = (s.phase + I * 0.02 * Math.min(dt, 0.05) * 60) % 1; if (s.phase < 0) s.phase += 1; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FBE9E7'; ctx.fillRect(0, 0, W, H);
    const R = p.rho * p.length / p.area, I = 12 / R, wy = H * 0.45, wireW = W * 0.2 + p.length * W * 0.05, th = 8 + p.area * 5, wx = (W - wireW) / 2;
    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(20, wy); ctx.lineTo(wx, wy); ctx.moveTo(wx + wireW, wy); ctx.lineTo(W - 20, wy); ctx.stroke();
    ctx.fillStyle = '#FF8A65'; ctx.fillRect(wx, wy - th / 2, wireW, th);
    const ne = Math.max(2, Math.round(wireW / 24));
    for (let i = 0; i < ne; i++) { const f = ((i / ne) + s.phase) % 1; ctx.fillStyle = '#1565C0'; ctx.beginPath(); ctx.arc(wx + f * wireW, wy, 3.5, 0, 7); ctx.fill(); }
    readout(ctx, [['电阻 R', R.toFixed(2) + ' Ω'], ['电流(12V)', I.toFixed(2) + ' A'], ['公式', 'ρL/A']]);
  }
};

// ===== 第 6 批新增 =====
const freefall = {
  id: 'freefall', title: '自由落体', sub: '重力 / 空气阻力对比', category: '力学', color: '#1976D2', emoji: '🪂',
  params: [
    { key: 'drag', label: '空气阻力', min: 0, max: 0.5, step: 0.02, value: 0.1, fmt: v => v.toFixed(2) },
    { key: 'mass', label: '质量', min: 1, max: 10, step: 0.5, value: 2, fmt: v => v.toFixed(1) + ' kg' }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 释放', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s) { s.y1 = 0; s.v1 = 0; s.y2 = 0; s.v2 = 0; s.t = 0; s.running = false; } }
  ],
  init() { return { y1: 0, v1: 0, y2: 0, v2: 0, t: 0, running: false }; },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    s.t += dt;
    s.v1 += 9.8 * dt; s.y1 += s.v1 * dt; if (s.y1 > 12) { s.y1 = 12; s.v1 = 0; }
    const a2 = 9.8 - p.drag / p.mass * s.v2 * s.v2; s.v2 += a2 * dt; s.y2 += s.v2 * dt; if (s.y2 > 12) { s.y2 = 12; s.v2 = 0; }
  },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#E3F2FD'; ctx.fillRect(0, 0, W, H * 0.9); ctx.fillStyle = '#A5D6A7'; ctx.fillRect(0, H * 0.9, W, H * 0.1);
    const top = H * 0.1, span = H * 0.78;
    ctx.fillStyle = '#333'; ctx.font = '12px sans-serif';
    ctx.fillStyle = '#1976D2'; ctx.beginPath(); ctx.arc(W * 0.35, top + s.y1 / 12 * span, 16, 0, 7); ctx.fill(); ctx.fillStyle = '#333'; ctx.fillText('无阻力', W * 0.3, top - 6);
    ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(W * 0.65, top + s.y2 / 12 * span, 16, 0, 7); ctx.fill(); ctx.fillStyle = '#333'; ctx.fillText('有阻力', W * 0.6, top - 6);
    readout(ctx, [['时间', s.t.toFixed(2) + ' s'], ['无阻力 v', s.v1.toFixed(1) + ' m/s'], ['有阻力 v', s.v2.toFixed(1) + ' m/s']]);
  }
};

const oersted = {
  id: 'oersted', title: '电流的磁效应', sub: '安培定则 / 环形磁场', category: '电磁', color: '#039BE5', emoji: '🔌',
  params: [{ key: 'current', label: '电流', min: -10, max: 10, step: 1, value: 5, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(0) + ' A' }],
  actions: [], init() { return { phase: 0 }; }, step(s, p, dt) { s.phase += p.current * dt * 0.4; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E1F5FE'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.45, out = p.current >= 0;
    for (let r = 40; r < Math.min(W, H) * 0.5; r += 40) {
      ctx.strokeStyle = 'rgba(3,155,229,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      const ang = s.phase % 6.2832, ax = cx + r * Math.cos(ang), ay = cy + r * Math.sin(ang), dir = out ? 1 : -1, tx = -Math.sin(ang) * dir, ty = Math.cos(ang) * dir;
      arrowSeg(ctx, ax - tx * 8, ay - ty * 8, ax + tx * 8, ay + ty * 8, '#0277BD', 2);
    }
    ctx.fillStyle = '#37474F'; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill();
    if (out) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill(); }
    else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 7, cy - 7); ctx.lineTo(cx + 7, cy + 7); ctx.moveTo(cx + 7, cy - 7); ctx.lineTo(cx - 7, cy + 7); ctx.stroke(); }
    readout(ctx, [['电流', (p.current >= 0 ? '+' : '') + p.current + ' A'], ['方向', out ? '流出纸面 ⊙' : '流入纸面 ⊗'], ['磁场', out ? '逆时针' : '顺时针']]);
  }
};

const idealgas = {
  id: 'idealgas', title: '理想气体定律', sub: 'PV = nRT', category: '热学', color: '#00ACC1', emoji: '🎈',
  params: [
    { key: 'temperature', label: '温度 T', min: 100, max: 500, step: 10, value: 300, fmt: v => v.toFixed(0) + ' K' },
    { key: 'volume', label: '体积 V', min: 2, max: 10, step: 0.5, value: 5, fmt: v => v.toFixed(1) + ' L' },
    { key: 'moles', label: '物质量 n', min: 0.5, max: 2, step: 0.1, value: 1, fmt: v => v.toFixed(1) + ' mol' }
  ],
  actions: [],
  init() { return { parts: [] }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const target = Math.round(p.moles * 26);
    while (s.parts.length < target) s.parts.push({ x: Math.random(), y: Math.random(), a: Math.random() * 6.2832 });
    while (s.parts.length > target) s.parts.pop();
    const sp = 0.5 * Math.sqrt(p.temperature / 300);
    s.parts.forEach(q => {
      q.x += Math.cos(q.a) * sp * dt; q.y += Math.sin(q.a) * sp * dt;
      if (q.x < 0) { q.x = 0; q.a = Math.PI - q.a; }
      if (q.x > 1) { q.x = 1; q.a = Math.PI - q.a; }
      if (q.y < 0) { q.y = 0; q.a = -q.a; }
      if (q.y > 1) { q.y = 1; q.a = -q.a; }
    });
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E0F7FA'; ctx.fillRect(0, 0, W, H);
    const P = p.moles * 8.314 * p.temperature / p.volume;
    const cylX = W * 0.24, cylW = W * 0.44, cylTop = H * 0.12, cylH = H * 0.66;
    const frac = Math.min(p.volume / 10, 1), gasH = cylH * frac, gasTop = cylTop + cylH - gasH;
    const tx = Math.max(0, Math.min(1, (p.temperature - 100) / 400));
    ctx.fillStyle = 'rgba(' + Math.round(80 + tx * 175) + ',' + Math.round(140 * (1 - tx) + 40) + ',' + Math.round(230 * (1 - tx) + 20) + ',0.22)';
    ctx.fillRect(cylX, gasTop, cylW, gasH);
    // 运动的分子（速度∝√T，颜色随温度）
    ctx.fillStyle = 'rgb(' + Math.round(60 + tx * 195) + ',' + Math.round(120 * (1 - tx) + 40) + ',' + Math.round(220 * (1 - tx) + 30) + ')';
    s.parts.forEach(q => {
      ctx.beginPath(); ctx.arc(cylX + 5 + q.x * (cylW - 10), gasTop + 5 + q.y * (gasH - 10), 4, 0, 7); ctx.fill();
    });
    ctx.strokeStyle = '#455A64'; ctx.lineWidth = 4; ctx.strokeRect(cylX, cylTop, cylW, cylH);
    // 活塞（随体积上下移动）
    ctx.fillStyle = '#8D6E63'; ctx.fillRect(cylX - 5, gasTop - 14, cylW + 10, 14);
    ctx.fillStyle = '#5D4037'; ctx.fillRect(cylX + cylW / 2 - 5, cylTop - 26, 10, gasTop - cylTop + 14);
    // 压强表盘
    const gx2 = W * 0.85, gy2 = H * 0.3, gr = 34;
    ctx.strokeStyle = '#455A64'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(gx2, gy2, gr, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    const pfrac = Math.min(P / 4000, 1), ga = Math.PI * 0.75 + pfrac * Math.PI * 1.5;
    ctx.strokeStyle = '#E53935'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx2, gy2); ctx.lineTo(gx2 + Math.cos(ga) * gr * 0.8, gy2 + Math.sin(ga) * gr * 0.8); ctx.stroke();
    ctx.fillStyle = '#455A64'; ctx.font = '11px sans-serif'; ctx.fillText('压强表', gx2 - 18, gy2 + gr + 16);
    readout(ctx, [['压强 P', P.toFixed(0) + ' kPa'], ['体积 V', p.volume.toFixed(1) + ' L'], ['分子数', s.parts.length + ' 个'], ['PV/nT', (P * p.volume / (p.moles * p.temperature)).toFixed(2)]]);
  }
};

const spectrum = {
  id: 'spectrum', title: '氢原子光谱', sub: '巴尔末系 / 发射谱线', category: '原子', color: '#6A1B9A', emoji: '🌈',
  params: [{ key: 'nmax', label: '最高能级', min: 3, max: 6, step: 1, value: 6, fmt: v => 'n=' + v.toFixed(0) }],
  actions: [], init() { return {}; }, step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const x0 = W * 0.08, x1 = W * 0.92, barY = H * 0.35, barH = H * 0.25;
    for (let x = x0; x < x1; x++) { const lam = 380 + (x - x0) / (x1 - x0) * 320; ctx.fillStyle = wlColor(lam); ctx.fillRect(x, barY, 1, barH); }
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillRect(x0, barY, x1 - x0, barH); ctx.globalAlpha = 1;
    const nmax = Math.round(p.nmax);
    for (let n = 3; n <= nmax; n++) { const lam = 1 / (0.010973 * (0.25 - 1 / (n * n))); if (lam < 380 || lam > 700) continue; const x = x0 + (lam - 380) / 320 * (x1 - x0); ctx.fillStyle = wlColor(lam); ctx.fillRect(x - 1, barY, 3, barH); }
    ctx.fillStyle = '#aaa'; ctx.font = '11px sans-serif'; ctx.fillText('400nm', x0, barY + barH + 18); ctx.fillText('700nm', x1 - 36, barY + barH + 18);
    readout(ctx, [['谱系', '巴尔末系 →n=2'], ['Hα', '656 nm 红'], ['Hβ', '486 nm 青'], ['最高能级', 'n=' + nmax]]);
  }
};

const stoichiometry = {
  id: 'stoichiometry', title: '化学计量', sub: 'A + 2B → C / 分子反应动画', category: '化学', color: '#00897B', emoji: '⚗️',
  params: [
    { key: 'a', label: '反应物 A', min: 0, max: 10, step: 1, value: 6, fmt: v => v.toFixed(0) + ' mol' },
    { key: 'b', label: '反应物 B', min: 0, max: 10, step: 1, value: 8, fmt: v => v.toFixed(0) + ' mol' }
  ],
  actions: [
    { label: s => s.started ? '↻ 重新装料' : '▶ 开始反应', primary: true, on(s) { s.started = !s.started; if (!s.started) s.as = null; else s.timer = 0; } }
  ],
  init() { return { as: null, bs: [], cs: [], started: false, timer: 0, buzz: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const na = Math.round(p.a), nb = Math.round(p.b);
    // 未开始时分子数跟随滑块实时增减
    if (!s.started && (!s.as || s.as.length !== na || s.bs.length !== nb || s.cs.length)) {
      const mk = () => ({ x: Math.random(), y: Math.random(), a: Math.random() * 6.2832 });
      s.as = []; s.bs = []; s.cs = [];
      for (let i = 0; i < na; i++) s.as.push(mk());
      for (let i = 0; i < nb; i++) s.bs.push(mk());
    }
    if (!s.as) return;
    const drift = (m, sp) => {
      m.a += (Math.random() - 0.5) * dt * 4;
      m.x += Math.cos(m.a) * dt * sp; m.y += Math.sin(m.a) * dt * sp;
      if (m.x < 0) { m.x = 0; m.a = Math.PI - m.a; }
      if (m.x > 1) { m.x = 1; m.a = Math.PI - m.a; }
      if (m.y < 0) { m.y = 0; m.a = -m.a; }
      if (m.y > 1) { m.y = 1; m.a = -m.a; }
    };
    s.as.forEach(m => drift(m, 0.15)); s.bs.forEach(m => drift(m, 0.2)); s.cs.forEach(m => drift(m, 0.1));
    // 反应：每 0.45s 消耗 1A + 2B，在质心处生成 1C
    if (s.started) {
      s.timer += dt;
      if (s.timer > 0.45 && s.as.length >= 1 && s.bs.length >= 2) {
        s.timer = 0;
        const A = s.as.shift(), B1 = s.bs.shift(), B2 = s.bs.shift();
        s.cs.push({ x: (A.x + B1.x + B2.x) / 3, y: (A.y + B1.y + B2.y) / 3, a: Math.random() * 6.2832 });
        s.buzz = (s.buzz | 0) + 1;
      }
    }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E0F2F1'; ctx.fillRect(0, 0, W, H);
    const bx = W * 0.08, bw = W * 0.84, by = H * 0.08, bh = H * 0.6;
    ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#00897B'; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh);
    const dot = (m, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx + 8 + m.x * (bw - 16), by + 8 + m.y * (bh - 16), r, 0, 7); ctx.fill(); };
    (s.as || []).forEach(m => dot(m, '#1E88E5', 7));
    (s.bs || []).forEach(m => dot(m, '#E53935', 5));
    (s.cs || []).forEach(m => dot(m, '#00897B', 10));
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#1E88E5'; ctx.fillText('● A', bx + 8, by + bh + 22);
    ctx.fillStyle = '#E53935'; ctx.fillText('● B', bx + 62, by + bh + 22);
    ctx.fillStyle = '#00897B'; ctx.fillText('● C (产物)', bx + 116, by + bh + 22);
    const remA = (s.as || []).length, remB = (s.bs || []).length, prod = (s.cs || []).length;
    const done = s.started && (remA < 1 || remB < 2);
    const limiting = done && prod > 0 ? (remA < 1 ? 'A 用完（A 限量）' : 'B 不足（B 限量）') : (s.started ? '反应中…' : '—');
    readout(ctx, [['反应', 'A + 2B → C'], ['剩余 A / B', remA + ' / ' + remB], ['生成 C', prod + ' mol'], ['限量情况', limiting]]);
  }
};

// ===== 第 7 批新增 =====
const gravityForce = {
  id: 'gravityforce', title: '万有引力实验室', sub: 'F=Gm₁m₂/r² / 引力比较', category: '力学', color: '#3949AB', emoji: '🌌',
  params: [
    { key: 'm1', label: '质量 m₁', min: 10, max: 500, step: 10, value: 200, fmt: v => v.toFixed(0) + ' kg' },
    { key: 'm2', label: '质量 m₂', min: 10, max: 500, step: 10, value: 100, fmt: v => v.toFixed(0) + ' kg' },
    { key: 'r', label: '距离 r', min: 2, max: 10, step: 0.5, value: 5, fmt: v => v.toFixed(1) + ' m' }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 释放', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s) { s.running = false; s.stuck = false; } }
  ],
  init() { return { x1: -2.5, x2: 2.5, v1: 0, v2: 0, running: false, stuck: false, buzz: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    if (!s.running) { s.x1 = -p.r / 2; s.x2 = p.r / 2; s.v1 = 0; s.v2 = 0; s.stuck = false; return; }
    if (s.stuck) return;
    const G = 0.02, sub = 4, h = dt / sub;
    const r1 = 8 + Math.sqrt(p.m1) * 0.9, r2 = 8 + Math.sqrt(p.m2) * 0.9;
    const touch = (r1 + r2) / 25;
    for (let i = 0; i < sub; i++) {
      const r = Math.max(s.x2 - s.x1, 0.3);
      // a₁ = G·m₂/r²，a₂ = G·m₁/r² —— 轻的一方加速度更大
      s.v1 += G * p.m2 / (r * r) * h; s.v2 -= G * p.m1 / (r * r) * h;
      s.x1 += s.v1 * h; s.x2 += s.v2 * h;
      if (s.x2 - s.x1 <= touch) { s.stuck = true; s.v1 = 0; s.v2 = 0; s.buzz = (s.buzz | 0) + 1; break; }
    }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#0D1030'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 30; i++) { ctx.fillRect((i * 97) % W, (i * 53) % (H * 0.9), 2, 2); }
    const cy = H * 0.5, scale = W * 0.07, cx = W * 0.5;
    const X1 = cx + s.x1 * scale, X2 = cx + s.x2 * scale;
    const r = Math.max(s.x2 - s.x1, 0.3), F = 2.5 * p.m1 * p.m2 / (r * r);
    const r1 = 8 + Math.sqrt(p.m1) * 0.9, r2 = 8 + Math.sqrt(p.m2) * 0.9;
    ctx.fillStyle = '#5C6BC0'; ctx.beginPath(); ctx.arc(X1, cy, r1, 0, 7); ctx.fill();
    ctx.fillStyle = '#FF8A65'; ctx.beginPath(); ctx.arc(X2, cy, r2, 0, 7); ctx.fill();
    const alen = Math.min(10 + F / 40, 90);
    if (!s.stuck) {
      arrowSeg(ctx, X1 + r1 + 4, cy, X1 + r1 + 4 + alen, cy, '#43A047', 4);
      arrowSeg(ctx, X2 - r2 - 4, cy, X2 - r2 - 4 - alen, cy, '#43A047', 4);
    } else { ctx.fillStyle = '#FFD54F'; ctx.font = '15px sans-serif'; ctx.fillText('相撞！', cx - 22, cy - Math.max(r1, r2) - 14); }
    readout(ctx, [['距离 r', r.toFixed(2) + ' m'], ['引力 F', F.toFixed(1) + ' N'], ['a₁:a₂', (p.m2 / p.m1).toFixed(2) + '（轻者跑得快）'], ['状态', s.stuck ? '已相撞' : (s.running ? '相互吸引中' : '待释放')]]);
  }
};

const density = {
  id: 'density', title: '密度实验室', sub: '放入水中 / 浮沉动画', category: '力学', color: '#00838F', emoji: '🧱',
  params: [
    { key: 'rho', label: '物体密度', min: 100, max: 3000, step: 50, value: 600, fmt: v => v.toFixed(0) + ' kg/m³' },
    { key: 'volume', label: '体积', min: 1, max: 10, step: 0.5, value: 4, fmt: v => v.toFixed(1) + ' L' }
  ],
  actions: [
    { label: s => s.dropped ? '↻ 重新放入' : '▶ 放入水中', primary: true, on(s) { s.y = -1.4; s.v = 0; s.dropped = true; } },
    { label: '重置', on(s) { s.dropped = false; s.y = -1.4; s.v = 0; } }
  ],
  init() { return { y: -1.4, v: 0, dropped: false }; },
  step(s, p, dt) {
    if (!s.dropped || dt <= 0) return;
    const sub = 4, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const subFrac = Math.max(0, Math.min(1, s.y + 0.5));       // 浸没比例（块高=1）
      const a = 9.8 * (1 - 1000 * subFrac / p.rho) - s.v * 1.6;  // 向下为正
      s.v += a * h; s.y += s.v * h;
      if (s.y > 2.6) { s.y = 2.6; s.v = 0; }                     // 沉底
    }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(0, 0, W, H);
    const surfY = H * 0.34, botY = H * 0.88;
    ctx.fillStyle = '#4FC3F7'; ctx.fillRect(W * 0.08, surfY, W * 0.84, botY - surfY);
    ctx.strokeStyle = '#0288D1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.08, surfY); ctx.lineTo(W * 0.92, surfY); ctx.stroke();
    ctx.strokeStyle = '#455A64'; ctx.lineWidth = 4; ctx.strokeRect(W * 0.08, surfY, W * 0.84, botY - surfY);
    const side = 34 + Math.cbrt(p.volume) * 20, scale = (botY - surfY) / 3.1;
    const cx = W * 0.5, cy = surfY + s.y * scale;
    ctx.fillStyle = p.rho < 500 ? '#A1887F' : p.rho < 1000 ? '#8D6E63' : p.rho < 2000 ? '#607D8B' : '#37474F';
    ctx.fillRect(cx - side / 2, cy - side / 2, side, side);
    // 受力箭头：重力(红·向下) 浮力(蓝·向上)
    const subFrac = Math.max(0, Math.min(1, s.y + 0.5));
    const G = p.rho * p.volume * 9.8 / 1000, Fb = 1000 * subFrac * p.volume * 9.8 / 1000;
    arrowSeg(ctx, cx - side / 2 - 16, cy, cx - side / 2 - 16, cy + Math.min(G * 1.1, 70), '#E53935', 3);
    if (Fb > 0.5) arrowSeg(ctx, cx + side / 2 + 16, cy, cx + side / 2 + 16, cy - Math.min(Fb * 1.1, 70), '#1E88E5', 3);
    const state = !s.dropped ? '待放入' : (s.y >= 2.55 ? '沉底' : (Math.abs(s.v) < 0.03 ? '漂浮平衡' : '运动中'));
    readout(ctx, [['重力 G', G.toFixed(1) + ' N'], ['浮力 F浮', Fb.toFixed(1) + ' N'], ['密度比', (p.rho / 1000).toFixed(2)], ['状态', state]]);
  }
};

const statesOfMatter = {
  id: 'states', title: '物态变化', sub: '加热曲线 / 熔点沸点', category: '热学', color: '#42A5F5', emoji: '🧊',
  params: [{ key: 'rate', label: '加热速率', min: 0, max: 20, step: 1, value: 8, fmt: v => v.toFixed(0) }],
  actions: [{ label: '重置', on(s) { s.T = -20; s.phase = 'solid'; s.latent = 0; s.trail = [[0, -20]]; s.t = 0; } }],
  init() { return { T: -20, phase: 'solid', latent: 0, trail: [[0, -20]], t: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    s.t += dt;
    const e = p.rate * dt;
    if (e > 0) {
      if (s.phase === 'solid') { s.T += e / 2.1; if (s.T >= 0) { s.T = 0; s.phase = 'melting'; } }
      else if (s.phase === 'melting') { s.latent += e; if (s.latent >= 4) { s.phase = 'liquid'; s.latent = 0; } }
      else if (s.phase === 'liquid') { s.T += e / 4.2; if (s.T >= 100) { s.T = 100; s.phase = 'boiling'; } }
      else if (s.phase === 'boiling') { s.latent += e; if (s.latent >= 27) { s.phase = 'gas'; s.latent = 0; } }
      else { s.T += e / 2.0; if (s.T > 150) s.T = 150; }
    }
    s.trail.push([s.t, s.T]); if (s.trail.length > 400) s.trail.shift();
  },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#E3F2FD'; ctx.fillRect(0, 0, W, H);
    const gx = W * 0.1, gy = H * 0.08, gw = W * 0.6, gh = H * 0.56;
    ctx.strokeStyle = '#90A4AE'; ctx.lineWidth = 2; ctx.strokeRect(gx, gy, gw, gh);
    const tMax = Math.max(s.t, 10), Tmin = -30, Tmax = 150;
    const sx = t => gx + Math.min(t / tMax, 1) * gw, sy = T => gy + gh - (T - Tmin) / (Tmax - Tmin) * gh;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(gx, sy(0)); ctx.lineTo(gx + gw, sy(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, sy(100)); ctx.lineTo(gx + gw, sy(100)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#607D8B'; ctx.font = '10px sans-serif'; ctx.fillText('0°C 熔点', gx + 4, sy(0) - 4); ctx.fillText('100°C 沸点', gx + 4, sy(100) - 4);
    ctx.strokeStyle = '#E53935'; ctx.lineWidth = 2.5; ctx.beginPath();
    s.trail.forEach((pt, i) => { const X = sx(pt[0]), Y = sy(pt[1]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke();
    const cx = W * 0.82, cy = H * 0.35, cw = 70, ch = 90;
    ctx.strokeStyle = '#607D8B'; ctx.lineWidth = 3; ctx.strokeRect(cx - cw / 2, cy - ch / 2, cw, ch);
    if (s.phase === 'gas') { for (let i = 0; i < 10; i++) { const yy = cy + ch / 2 - ((s.t * 30 + i * 20) % ch); ctx.fillStyle = 'rgba(176,190,197,0.7)'; ctx.beginPath(); ctx.arc(cx - cw / 2 + 10 + (i % 4) * 15, yy, 3, 0, 7); ctx.fill(); } }
    else { ctx.fillStyle = s.phase === 'solid' ? '#90CAF9' : (s.phase === 'melting' ? '#64B5F6' : '#1E88E5'); ctx.fillRect(cx - cw / 2, cy, cw, ch / 2); }
    const phaseLabel = { solid: '固态', melting: '熔化中', liquid: '液态', boiling: '沸腾中', gas: '气态' }[s.phase];
    readout(ctx, [['温度', s.T.toFixed(0) + '°C'], ['状态', phaseLabel]]);
  }
};

const staticElectricity = {
  id: 'static', title: '气球起电', sub: '摩擦起电 / 静电吸引', category: '电磁', color: '#8E24AA', emoji: '🎈',
  params: [{ key: 'charge', label: '摩擦次数', min: 0, max: 40, step: 1, value: 15, fmt: v => v.toFixed(0) }],
  actions: [
    { label: s => s.released ? '⏸ 拉回' : '▶ 释放', primary: true, on(s) { s.released = !s.released; if (!s.released) { s.x = 0.15; s.v = 0; s.attached = false; } } },
    { label: '重置', on(s) { s.x = 0.15; s.v = 0; s.released = false; s.attached = false; } }
  ],
  init() { return { x: 0.15, v: 0, released: false, attached: false }; },
  step(s, p, dt) {
    if (dt <= 0 || !s.released || s.attached) return;
    const dist = Math.max(1 - s.x, 0.02), F = p.charge * p.charge * 0.0009 / (dist * dist), a = F - 0.15;
    s.v = Math.max(-0.6, Math.min(0.6, s.v + a * dt));
    s.x += s.v * dt;
    if (s.x >= 0.97) { s.x = 0.97; s.attached = F > 0.3; s.v = 0; }
    if (s.x < 0.05) { s.x = 0.05; s.v = 0; }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FFF8E1'; ctx.fillRect(0, 0, W, H);
    const groundY = H * 0.85; ctx.fillStyle = '#D7CCC8'; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#8D6E63'; ctx.fillRect(W * 0.04, H * 0.55, W * 0.14, H * 0.28);
    ctx.fillStyle = '#B0BEC5'; ctx.fillRect(W * 0.92, 0, W * 0.08, H);
    const bx = W * 0.15 + s.x * W * 0.75, by = H * 0.4;
    if (p.charge > 2) { ctx.fillStyle = 'rgba(30,136,229,0.7)'; ctx.font = '14px sans-serif'; for (let i = -1; i <= 1; i++) ctx.fillText('+', W * 0.9, by + i * 16); }
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, H * 0.15); ctx.lineTo(bx, by - 20); ctx.stroke();
    const r = 26;
    ctx.fillStyle = '#AB47BC'; ctx.beginPath(); ctx.ellipse(bx, by, r * 0.85, r, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(bx - 8, by - 10, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif';
    const n = Math.min(Math.round(p.charge / 4), 10);
    for (let i = 0; i < n; i++) { const ang = i * (6.2832 / Math.max(n, 1)); ctx.fillText('−', bx + Math.cos(ang) * 14 - 4, by + Math.sin(ang) * 16 + 4); }
    readout(ctx, [['电荷量(相对)', p.charge + ''], ['状态', s.attached ? '吸附在墙上' : (s.released ? '正在移动' : '待释放')]]);
  }
};

const seriesParallel = {
  id: 'seriesparallel', title: '串并联电路', sub: '总电阻 / 电流分配', category: '电磁', color: '#5E35B1', emoji: '🔗',
  params: [
    { key: 'emf', label: '电源电压', min: 1, max: 12, step: 0.5, value: 9, fmt: v => v.toFixed(1) + ' V' },
    { key: 'r1', label: '电阻 R₁', min: 1, max: 20, step: 1, value: 4, fmt: v => v.toFixed(0) + ' Ω' },
    { key: 'r2', label: '电阻 R₂', min: 1, max: 20, step: 1, value: 8, fmt: v => v.toFixed(0) + ' Ω' }
  ],
  actions: [{ label: s => s.mode === 'series' ? '切换为并联' : '切换为串联', primary: true, on(s) { s.mode = s.mode === 'series' ? 'parallel' : 'series'; } }],
  init() { return { mode: 'series', phase: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const R = s.mode === 'series' ? (p.r1 + p.r2) : (1 / (1 / p.r1 + 1 / p.r2)), speed = p.emf / R;
    s.phase = (s.phase + speed * 0.03 * dt * 60) % 1; if (s.phase < 0) s.phase += 1;
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#F4F6F8'; ctx.fillRect(0, 0, W, H);
    const x0 = W * 0.18, x1 = W * 0.82, y0 = H * 0.2, y1 = H * 0.72;
    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    if (s.mode === 'series') {
      const R = p.r1 + p.r2, I = p.emf / R;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.stroke();
      drawZigzagH(ctx, x0 + (x1 - x0) * 0.18, x0 + (x1 - x0) * 0.46, y0, '#EF6C00');
      drawZigzagH(ctx, x0 + (x1 - x0) * 0.54, x0 + (x1 - x0) * 0.82, y0, '#D81B60');
      drawBattery(ctx, (x0 + x1) / 2, y1, false);
      flowLoop(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], s.phase, '#1565C0');
      readout(ctx, [['总电阻', R.toFixed(1) + ' Ω'], ['电流(共同)', I.toFixed(2) + ' A']]);
    } else {
      const xm = (x0 + x1) / 2, R = 1 / (1 / p.r1 + 1 / p.r2), I1 = p.emf / p.r1, I2 = p.emf / p.r2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke();
      drawZigzagV(ctx, xm, y0, y1, '#EF6C00');
      drawZigzagV(ctx, x1, y0, y1, '#D81B60');
      drawBattery(ctx, x0, (y0 + y1) / 2, true);
      flowLoop(ctx, [[x0, y0], [xm, y0], [xm, y1], [x0, y1]], s.phase, '#1565C0');
      flowLoop(ctx, [[xm, y0], [x1, y0], [x1, y1], [xm, y1]], s.phase, '#43A047');
      readout(ctx, [['总电阻', R.toFixed(2) + ' Ω'], ['支路1电流', I1.toFixed(2) + ' A'], ['支路2电流', I2.toFixed(2) + ' A']]);
    }
  }
};

// ===== 第 8 批新增 =====
const shmgraph = {
  id: 'shmgraph', title: '简谐运动图像', sub: 'x-t / v-t / a-t 相位关系', category: '力学', color: '#7B1FA2', emoji: '📈',
  params: [
    { key: 'amplitude', label: '振幅 A', min: 10, max: 60, step: 5, value: 40, fmt: v => v.toFixed(0) },
    { key: 'omega', label: '角频率 ω', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return { t: 0, hist: [] }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    s.t += dt; const w = p.omega, A = p.amplitude;
    s.hist.push({ t: s.t, x: A * Math.cos(w * s.t), v: -A * w * Math.sin(w * s.t), a: -A * w * w * Math.cos(w * s.t) });
    while (s.hist.length && s.hist[0].t < s.t - 6) s.hist.shift();
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, W, H);
    const A = p.amplitude, w = p.omega, gx = W * 0.12, gw = W * 0.82, t0 = s.t - 6;
    const lanes = [['x', pt => pt.x, A, '#E53935'], ['v', pt => pt.v, A * w, '#1E88E5'], ['a', pt => pt.a, A * w * w, '#43A047']];
    lanes.forEach((ln, i) => {
      const laneY = H * (0.1 + i * 0.29), laneH = H * 0.24, midY = laneY + laneH / 2, sc = (laneH / 2) / (ln[2] || 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, midY); ctx.lineTo(gx + gw, midY); ctx.stroke();
      ctx.fillStyle = ln[3]; ctx.font = '13px sans-serif'; ctx.fillText(ln[0], gx - 12, midY + 5);
      ctx.strokeStyle = ln[3]; ctx.lineWidth = 2.5; ctx.beginPath();
      s.hist.forEach((pt, j) => { const X = gx + ((pt.t - t0) / 6) * gw, Y = midY - ln[1](pt) * sc; j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
    });
    readout(ctx, [['位移 x', (A * Math.cos(w * s.t)).toFixed(0)], ['相位', 'v 超前 x 90°，a 与 x 反相']]);
  }
};

const mirror = {
  id: 'mirror', title: '平面镜成像', sub: '虚像 / 等距对称', category: '波动与光', color: '#26C6DA', emoji: '🪞',
  params: [
    { key: 'distance', label: '物距', min: 2, max: 10, step: 0.5, value: 5, fmt: v => v.toFixed(1) },
    { key: 'height', label: '物高', min: 2, max: 8, step: 0.5, value: 5, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return {}; }, step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(0, 0, W, H);
    const mx = W * 0.5, scale = W * 0.06, baseY = H * 0.72;
    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(mx, H * 0.15); ctx.lineTo(mx, H * 0.85); ctx.stroke();
    ctx.strokeStyle = '#90A4AE'; ctx.lineWidth = 2; for (let y = H * 0.15; y < H * 0.85; y += 18) { ctx.beginPath(); ctx.moveTo(mx, y); ctx.lineTo(mx + 12, y + 12); ctx.stroke(); }
    const ox = mx - p.distance * scale, oh = p.height * scale, ix = mx + p.distance * scale, oty = baseY - oh;
    arrowVLine(ctx, ox, baseY, ox, oty, '#2E7D32', false);
    arrowVLine(ctx, ix, baseY, ix, oty, '#B0BEC5', true);
    const ex = mx - p.distance * scale * 0.4, ey = H * 0.3;
    ctx.fillStyle = '#455A64'; ctx.beginPath(); ctx.arc(ex, ey, 10, 0, 7); ctx.fill();
    const eImgX = mx + (mx - ex), t = (mx - ox) / (eImgX - ox), ry = oty + (ey - oty) * t;
    ctx.strokeStyle = '#FBC02D'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, oty); ctx.lineTo(mx, ry); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.moveTo(mx, ry); ctx.lineTo(ix, oty); ctx.stroke(); ctx.setLineDash([]);
    readout(ctx, [['物距', p.distance.toFixed(1)], ['像距', p.distance.toFixed(1)], ['像', '等大正立虚像']]);
  }
};

const generator = {
  id: 'generator', title: '交流发电机', sub: '线圈转动 / 正弦电动势', category: '电磁', color: '#00897B', emoji: '🔄',
  params: [
    { key: 'speed', label: '转速', min: 0.5, max: 4, step: 0.1, value: 2, fmt: v => v.toFixed(1) },
    { key: 'field', label: '磁场强度', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return { ang: 0, t: 0, emf: 0, hist: [] }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    s.ang += p.speed * dt; s.t += dt; s.emf = p.field * p.speed * Math.sin(s.ang);
    s.hist.push({ t: s.t, e: s.emf }); while (s.hist.length && s.hist[0].t < s.t - 4) s.hist.shift();
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E0F2F1'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.3, R = Math.min(W, H) * 0.15;
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#E53935'; ctx.fillRect(cx - R - 40, cy - 30, 30, 60); ctx.fillStyle = '#fff'; ctx.fillText('N', cx - R - 32, cy + 5);
    ctx.fillStyle = '#1E88E5'; ctx.fillRect(cx + R + 10, cy - 30, 30, 60); ctx.fillStyle = '#fff'; ctx.fillText('S', cx + R + 18, cy + 5);
    const w2 = R * Math.cos(s.ang), h2 = R * 0.7;
    ctx.strokeStyle = '#00897B'; ctx.lineWidth = 4; ctx.strokeRect(cx - w2, cy - h2, w2 * 2, h2 * 2);
    const br = Math.min(Math.abs(s.emf) / 3, 1), bx = W * 0.5, by = H * 0.58;
    if (br > 0.02) { ctx.fillStyle = 'rgba(255,238,88,' + (br * 0.6) + ')'; ctx.beginPath(); ctx.arc(bx, by, 26, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 16, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,179,0,' + (0.3 + br * 0.7) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, 16, 0, 7); ctx.stroke();
    const gy = H * 0.82, gx = W * 0.1, gw = W * 0.8, gh = H * 0.12, t0 = s.t - 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
    ctx.strokeStyle = '#00695C'; ctx.lineWidth = 2; ctx.beginPath();
    s.hist.forEach((pt, j) => { const X = gx + ((pt.t - t0) / 4) * gw, Y = gy - pt.e / 3 * gh; j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke();
    readout(ctx, [['电动势', s.emf.toFixed(2) + ' V'], ['波形', '正弦交流']]);
  }
};

const fluidpressure = {
  id: 'fluidpressure', title: '液体压强', sub: 'P = ρgh / 随深度增大', category: '力学', color: '#0277BD', emoji: '🌊',
  params: [
    { key: 'depth', label: '深度 h', min: 0.5, max: 10, step: 0.5, value: 5, fmt: v => v.toFixed(1) + ' m' },
    { key: 'density', label: '液体密度', min: 500, max: 2000, step: 50, value: 1000, fmt: v => v.toFixed(0) + ' kg/m³' }
  ],
  actions: [],
  init() { return { t: 0 }; },
  step(s, p, dt) { if (dt > 0) s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E1F5FE'; ctx.fillRect(0, 0, W, H);
    const top = H * 0.12, bot = H * 0.82, tankX = W * 0.14, tankW = W * 0.4;
    ctx.fillStyle = '#4FC3F7'; ctx.fillRect(tankX, top, tankW, bot - top);
    ctx.strokeStyle = '#455A64'; ctx.lineWidth = 4; ctx.strokeRect(tankX, top, tankW, bot - top);
    // 经典演示：右壁三个小孔，越深的孔水喷得越远
    [0.3, 0.6, 0.9].forEach(f => {
      const hy = top + f * (bot - top);
      const v0 = Math.sqrt(f) * Math.sqrt(p.density / 1000);
      ctx.fillStyle = '#29B6F6';
      for (let i = 0; i < 10; i++) {
        const tt = (s.t * 1.1 + i * 0.13) % 1.3;
        const jx = tankX + tankW + v0 * tt * W * 0.3;
        const jy = hy + 0.55 * tt * tt * H * 0.45;
        if (jy < H * 0.96 && jx < W) { ctx.beginPath(); ctx.arc(jx, jy, 3, 0, 7); ctx.fill(); }
      }
      ctx.fillStyle = '#01579B'; ctx.beginPath(); ctx.arc(tankX + tankW, hy, 4, 0, 7); ctx.fill();
    });
    // 深度标线 + 各向压强箭头
    const P = p.density * 9.8 * p.depth / 1000, dy = top + (p.depth / 10) * (bot - top);
    ctx.strokeStyle = '#D32F2F'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(tankX, dy); ctx.lineTo(tankX + tankW, dy); ctx.stroke(); ctx.setLineDash([]);
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832, len = 8 + Math.min(P, 60) / 3; arrowSeg(ctx, tankX + tankW * 0.5, dy, tankX + tankW * 0.5 + Math.cos(a) * len, dy + Math.sin(a) * len, '#01579B', 2); }
    ctx.fillStyle = '#455A64'; ctx.font = '12px sans-serif'; ctx.fillText('越深喷得越远 →', tankX + tankW + 10, top + 16);
    readout(ctx, [['深度', p.depth.toFixed(1) + ' m'], ['压强', P.toFixed(1) + ' kPa'], ['规律', 'P = ρgh 随深度增大']]);
  }
};

const chainreaction = {
  id: 'chain', title: '链式反应', sub: '中子 / 裂变 / 链式增殖', category: '原子', color: '#F4511E', emoji: '💥',
  params: [],
  actions: [
    { label: '发射中子', primary: true, on(s) { if (!s.started) { s.neutrons.push({ x: 0.02, y: 0.44, vx: 0.5, vy: 0 }); s.started = true; } } },
    { label: '重置', on(s) { s.nuclei.forEach(n => { n.f = false; }); s.neutrons = []; s.started = false; s.buzz = 0; } }
  ],
  init() {
    const nuclei = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) nuclei.push({ x: 0.2 + c * 0.1, y: 0.2 + r * 0.12, f: false });
    return { nuclei, neutrons: [], started: false, buzz: 0 };
  },
  step(s, p, dt) {
    if (dt <= 0) return;
    s.neutrons.forEach(n => { n.x += n.vx * dt; n.y += n.vy * dt; if (n.y < 0 || n.y > 1) n.vy = -n.vy; });
    for (const n of s.neutrons) {
      for (const nuc of s.nuclei) {
        if (nuc.f) continue;
        if (Math.abs(n.x - nuc.x) < 0.045 && Math.abs(n.y - nuc.y) < 0.055) {
          nuc.f = true; n.dead = true; s.buzz = (s.buzz | 0) + 1;
          const k = 2 + Math.floor(Math.random() * 2);
          if (s.neutrons.length < 80) for (let i = 0; i < k; i++) { const a = Math.random() * 6.2832; s.neutrons.push({ x: nuc.x, y: nuc.y, vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.5 }); }
          break;
        }
      }
    }
    s.neutrons = s.neutrons.filter(n => !n.dead && n.x < 1.02 && n.x > -0.02);
  },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#1A1010'; ctx.fillRect(0, 0, W, H);
    let fissioned = 0;
    s.nuclei.forEach(nuc => {
      if (nuc.f) fissioned++;
      ctx.fillStyle = nuc.f ? 'rgba(244,81,30,0.5)' : '#1E88E5'; ctx.beginPath(); ctx.arc(nuc.x * W, nuc.y * H, nuc.f ? 7 : 11, 0, 7); ctx.fill();
      if (nuc.f) { ctx.strokeStyle = 'rgba(255,152,0,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(nuc.x * W, nuc.y * H, 14, 0, 7); ctx.stroke(); }
    });
    ctx.fillStyle = '#FFEB3B'; s.neutrons.forEach(n => { ctx.beginPath(); ctx.arc(n.x * W, n.y * H, 3.5, 0, 7); ctx.fill(); });
    readout(ctx, [['已裂变', fissioned + ' / ' + s.nuclei.length], ['中子数', s.neutrons.length + ''], ['提示', '点"发射中子"引发链式反应']]);
  }
};

// ===== 第 9 批新增 =====
const brachistochrone = {
  id: 'brachistochrone', title: '最速降线', sub: '旋轮线 / 重力下滑竞速', category: '力学', color: '#00695C', emoji: '🏂',
  params: [],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 释放', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s) { s.running = false; s.t = 0; s.balls.forEach(b => { b.d = 0; b.v = 0; b.done = false; b.time = 0; }); } }
  ],
  init() {
    const r = 1, N = 60, Bx = Math.PI * r, By = 2 * r;
    const cyc = [], str = [], par = [];
    for (let i = 0; i <= N; i++) {
      const th = Math.PI * i / N, x = Bx * i / N;
      cyc.push([r * (th - Math.sin(th)), r * (1 - Math.cos(th))]);
      str.push([x, By * x / Bx]);
      par.push([x, By * x / Bx + 1.1 * (x / Bx) * (1 - x / Bx) * By]);
    }
    const mk = (pts, color, name) => {
      const cum = [0]; let tot = 0;
      for (let i = 1; i < pts.length; i++) { tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(tot); }
      return { pts, cum, tot, color, name };
    };
    const curves = [mk(str, '#E53935', '直线'), mk(par, '#1E88E5', '抛物线'), mk(cyc, '#43A047', '最速降线')];
    return { curves, balls: curves.map(() => ({ d: 0, v: 0, done: false, time: 0 })), running: false, t: 0, Bx, By, buzz: 0 };
  },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    const g = 9.8, sub = 4, h = dt / sub;
    for (let it = 0; it < sub; it++) {
      s.balls.forEach((b, ci) => {
        if (b.done) return;
        const cv = s.curves[ci];
        let seg = 0; while (seg < cv.cum.length - 2 && cv.cum[seg + 1] < b.d) seg++;
        const a = cv.pts[seg], bb = cv.pts[seg + 1] || a;
        const segLen = Math.hypot(bb[0] - a[0], bb[1] - a[1]) || 1e-6;
        b.v += g * ((bb[1] - a[1]) / segLen) * h;
        b.d += b.v * h;
        if (b.d >= cv.tot) { b.d = cv.tot; b.done = true; b.time = s.t; s.buzz = (s.buzz | 0) + 1; }
      });
      s.t += h;
    }
  },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#F1F8E9'; ctx.fillRect(0, 0, W, H);
    const pad = W * 0.12, drawW = W * 0.76, scale = Math.min(drawW / s.Bx, (H * 0.5) / s.By), ox = pad, oy = H * 0.16;
    const SX = x => ox + x * scale, SY = y => oy + y * scale;
    s.curves.forEach((cv, ci) => {
      ctx.strokeStyle = cv.color; ctx.lineWidth = 3; ctx.beginPath();
      cv.pts.forEach((pt, i) => { const X = SX(pt[0]), Y = SY(pt[1]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke();
      const b = s.balls[ci];
      let seg = 0; while (seg < cv.cum.length - 2 && cv.cum[seg + 1] < b.d) seg++;
      const a = cv.pts[seg], bb = cv.pts[seg + 1] || a, f = (b.d - cv.cum[seg]) / ((cv.cum[seg + 1] - cv.cum[seg]) || 1);
      ctx.fillStyle = cv.color; ctx.beginPath(); ctx.arc(SX(a[0] + (bb[0] - a[0]) * f), SY(a[1] + (bb[1] - a[1]) * f), 9, 0, 7); ctx.fill();
    });
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(SX(0), SY(0), 6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(SX(s.Bx), SY(s.By), 6, 0, 7); ctx.fill();
    readout(ctx, s.curves.map((cv, ci) => [cv.name, s.balls[ci].done ? s.balls[ci].time.toFixed(2) + ' s' : '滑行中…']));
  }
};

// ===== 第 10 批新增 =====
const resonance = {
  id: 'resonance', title: '受迫振动与共振', sub: '驱动频率 / 共振曲线', category: '力学', color: '#D84315', emoji: '📢',
  params: [
    { key: 'driveFreq', label: '驱动频率', min: 0.2, max: 3, step: 0.05, value: 1, fmt: v => v.toFixed(2) },
    { key: 'damping', label: '阻尼', min: 0.05, max: 1, step: 0.05, value: 0.2, fmt: v => v.toFixed(2) }
  ],
  actions: [], init() { return { t: 0 }; }, step(s, p, dt) { s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FFF3E0'; ctx.fillRect(0, 0, W, H);
    const w0 = 1.5, amp = wd => 1 / Math.sqrt(Math.pow(w0 * w0 - wd * wd, 2) + Math.pow(2 * p.damping * w0 * wd, 2));
    const A = amp(p.driveFreq), ox = W * 0.16, cy = H * 0.28, disp = Math.min(A * 18, 70) * Math.sin(p.driveFreq * s.t);
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ox, cy - 60); ctx.lineTo(ox, cy + disp - 14); ctx.stroke();
    ctx.fillStyle = '#D84315'; ctx.fillRect(ox - 20, cy + disp - 14, 40, 28);
    const gx = W * 0.1, gy = H * 0.86, gw = W * 0.82, gh = H * 0.42, amax = amp(w0);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
    ctx.strokeStyle = '#D84315'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 100; i++) { const wd = 0.2 + i / 100 * 2.8, X = gx + (wd - 0.2) / 2.8 * gw, Y = gy - Math.min(amp(wd) / amax, 1) * gh; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();
    const cx = gx + (p.driveFreq - 0.2) / 2.8 * gw;
    ctx.strokeStyle = '#1565C0'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(cx, gy); ctx.lineTo(cx, gy - gh); ctx.stroke(); ctx.setLineDash([]);
    readout(ctx, [['固有频率', w0.toFixed(2)], ['驱动频率', p.driveFreq.toFixed(2)], ['振幅(相对)', A.toFixed(2)], ['状态', Math.abs(p.driveFreq - w0) < 0.15 ? '接近共振!' : '—']]);
  }
};

const standingwave = {
  id: 'standingwave', title: '驻波', sub: '波腹波节 / 谐波', category: '波动与光', color: '#5E35B1', emoji: '🎵',
  params: [
    { key: 'harmonic', label: '谐波数 n', min: 1, max: 6, step: 1, value: 3, fmt: v => 'n=' + v.toFixed(0) },
    { key: 'amplitude', label: '振幅', min: 20, max: 80, step: 5, value: 50, fmt: v => v.toFixed(0) }
  ],
  actions: [], init() { return { t: 0 }; }, step(s, p, dt) { s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#EDE7F6'; ctx.fillRect(0, 0, W, H);
    const left = W * 0.08, right = W * 0.92, midY = H * 0.45, n = Math.round(p.harmonic), L = right - left, env = Math.cos(s.t * 3);
    ctx.strokeStyle = 'rgba(94,53,177,0.3)'; ctx.setLineDash([4, 4]);
    [1, -1].forEach(sg => { ctx.beginPath(); for (let i = 0; i <= 200; i++) { const x = i / 200, y = midY - sg * p.amplitude * Math.abs(Math.sin(n * Math.PI * x)), X = left + x * L; i ? ctx.lineTo(X, y) : ctx.moveTo(X, y); } ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.strokeStyle = '#5E35B1'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const x = i / 200, y = midY - p.amplitude * Math.sin(n * Math.PI * x) * env, X = left + x * L; i ? ctx.lineTo(X, y) : ctx.moveTo(X, y); }
    ctx.stroke();
    for (let k = 0; k <= n; k++) { const X = left + k / n * L; ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(X, midY, 4, 0, 7); ctx.fill(); }
    readout(ctx, [['谐波数', 'n = ' + n], ['波节数', (n + 1) + ''], ['波腹数', n + '']]);
  }
};

const newtoncradle = {
  id: 'cradle', title: '牛顿摆', sub: '动量守恒 / 弹性碰撞', category: '力学', color: '#455A64', emoji: '🪀',
  params: [
    { key: 'amp', label: '摆角', min: 10, max: 45, step: 5, value: 30, fmt: v => v.toFixed(0) + '°' },
    { key: 'speed', label: '速度', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return { t: 0 }; }, step(s, p, dt) { s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(0, 0, W, H);
    const pivY = H * 0.2, cx = W * 0.5, gap = 44, L = H * 0.5, r = 20, ampR = p.amp * Math.PI / 180;
    ctx.fillStyle = '#607D8B'; ctx.fillRect(cx - gap * 2.5, pivY - 8, gap * 5, 10);
    const theta = ampR * Math.sin(s.t * p.speed * 2), left = theta < 0 ? theta : 0, right = theta > 0 ? theta : 0;
    for (let i = -2; i <= 2; i++) {
      let a = 0; if (i === -2) a = left; if (i === 2) a = right;
      const px = cx + i * gap, bx = px + L * Math.sin(a), by = pivY + L * Math.cos(a);
      ctx.strokeStyle = '#90A4AE'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, pivY); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = '#546E7A'; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(bx - 6, by - 6, 5, 0, 7); ctx.fill();
    }
    readout(ctx, [['原理', '动量与动能守恒'], ['现象', '一端撞击→另一端弹出']]);
  }
};

const torque = {
  id: 'torque', title: '转动与力矩', sub: 'τ=Iα / 角加速度', category: '力学', color: '#00838F', emoji: '🎡',
  params: [
    { key: 'force', label: '切向力', min: 0, max: 20, step: 1, value: 8, fmt: v => v.toFixed(0) + ' N' },
    { key: 'radius', label: '半径', min: 0.5, max: 2, step: 0.1, value: 1, fmt: v => v.toFixed(1) + ' m' },
    { key: 'mass', label: '圆盘质量', min: 1, max: 10, step: 0.5, value: 4, fmt: v => v.toFixed(1) + ' kg' }
  ],
  actions: [
    { label: s => s.running ? '⏸ 停止' : '▶ 施加力矩', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s) { s.ang = 0; s.omega = 0; s.running = false; } }
  ],
  init() { return { ang: 0, omega: 0, alpha: 0, running: false }; },
  step(s, p, dt) { if (!s.running || dt <= 0) return; const I = 0.5 * p.mass * p.radius * p.radius; s.alpha = p.force * p.radius / I; s.omega += s.alpha * dt; s.ang += s.omega * dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E0F7FA'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.42, R = Math.min(W, H) * 0.22;
    ctx.fillStyle = '#B2EBF2'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = '#00838F'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#006064'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(s.ang), cy + R * Math.sin(s.ang)); ctx.stroke();
    ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(cx + R * Math.cos(s.ang), cy + R * Math.sin(s.ang), 8, 0, 7); ctx.fill();
    if (p.force > 0) arrowSeg(ctx, cx - R, cy, cx - R, cy - Math.min(p.force * 4, 60), '#FB8C00', 4);
    const I = 0.5 * p.mass * p.radius * p.radius;
    readout(ctx, [['力矩 τ', (p.force * p.radius).toFixed(1) + ' N·m'], ['转动惯量 I', I.toFixed(2)], ['角速度 ω', s.omega.toFixed(2)], ['角加速度 α', s.alpha.toFixed(2)]]);
  }
};

const beats = {
  id: 'beats', title: '声音的拍', sub: '两频率叠加 / 拍频', category: '波动与光', color: '#3949AB', emoji: '🔉',
  params: [
    { key: 'f1', label: '频率 f₁', min: 8, max: 14, step: 0.2, value: 10, fmt: v => v.toFixed(1) },
    { key: 'f2', label: '频率 f₂', min: 8, max: 14, step: 0.2, value: 11, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return { t: 0 }; }, step(s, p, dt) { s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E8EAF6'; ctx.fillRect(0, 0, W, H);
    const left = W * 0.06, right = W * 0.94, L = right - left, ph = s.t * 4;
    const wave = (y0, fn, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 300; i++) { const x = i / 300, X = left + x * L, Y = y0 - fn(x) * H * 0.09; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); };
    wave(H * 0.2, x => Math.sin(p.f1 * x * 6.283 - ph), '#E53935');
    wave(H * 0.42, x => Math.sin(p.f2 * x * 6.283 - ph), '#1E88E5');
    ctx.strokeStyle = '#3949AB'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 300; i++) { const x = i / 300, X = left + x * L, Y = H * 0.72 - (Math.sin(p.f1 * x * 6.283 - ph) + Math.sin(p.f2 * x * 6.283 - ph)) * H * 0.08; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();
    readout(ctx, [['f₁', p.f1.toFixed(1)], ['f₂', p.f2.toFixed(1)], ['拍频', Math.abs(p.f1 - p.f2).toFixed(1) + ' Hz']]);
  }
};

// ===== 第 11 批新增 =====
const emwave = {
  id: 'emwave', title: '电磁波', sub: '电场磁场 / 横波传播', category: '电磁', color: '#7B1FA2', emoji: '📡',
  params: [
    { key: 'frequency', label: '频率', min: 0.5, max: 3, step: 0.1, value: 1.2, fmt: v => v.toFixed(1) },
    { key: 'amplitude', label: '振幅', min: 20, max: 70, step: 5, value: 45, fmt: v => v.toFixed(0) }
  ],
  actions: [], init() { return { t: 0 }; }, step(s, p, dt) { s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#F3E5F5'; ctx.fillRect(0, 0, W, H);
    const left = W * 0.08, right = W * 0.94, axisY = H * 0.5, k = p.frequency * 0.04, om = p.frequency * 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left, axisY); ctx.lineTo(right, axisY); ctx.stroke();
    ctx.strokeStyle = '#E53935'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let x = left; x <= right; x += 3) { const y = axisY - Math.sin(k * (x - left) - om * s.t) * p.amplitude; x === left ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    for (let x = left; x < right; x += 30) { const y = axisY - Math.sin(k * (x - left) - om * s.t) * p.amplitude; ctx.strokeStyle = 'rgba(229,57,53,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, axisY); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.strokeStyle = '#1E88E5'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let x = left; x <= right; x += 3) { const ph = k * (x - left) - om * s.t, y = axisY + Math.sin(ph) * p.amplitude * 0.5, xo = Math.sin(ph) * 10; x === left ? ctx.moveTo(x + xo, y) : ctx.lineTo(x + xo, y); }
    ctx.stroke();
    ctx.fillStyle = '#E53935'; ctx.font = '14px sans-serif'; ctx.fillText('E 电场', left + 6, axisY - p.amplitude - 8);
    ctx.fillStyle = '#1E88E5'; ctx.fillText('B 磁场', left + 6, axisY + p.amplitude * 0.5 + 24);
    readout(ctx, [['频率', p.frequency.toFixed(1)], ['E⊥B⊥传播', '横波'], ['波速', 'c 真空光速']]);
  }
};

const dcmotor = {
  id: 'dcmotor', title: '直流电动机', sub: '通电线圈 / 磁场中转动', category: '电磁', color: '#EF6C00', emoji: '⚙️',
  params: [
    { key: 'current', label: '电流', min: 0, max: 10, step: 0.5, value: 5, fmt: v => v.toFixed(1) + ' A' },
    { key: 'field', label: '磁场', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return { ang: 0 }; }, step(s, p, dt) { s.ang += p.current * p.field * 0.15 * dt * 6; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FFF3E0'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.42, R = Math.min(W, H) * 0.2;
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#E53935'; ctx.fillRect(cx - R - 46, cy - 40, 30, 80); ctx.fillStyle = '#fff'; ctx.fillText('N', cx - R - 38, cy + 6);
    ctx.fillStyle = '#1E88E5'; ctx.fillRect(cx + R + 16, cy - 40, 30, 80); ctx.fillStyle = '#fff'; ctx.fillText('S', cx + R + 24, cy + 6);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.ang);
    ctx.strokeStyle = '#EF6C00'; ctx.lineWidth = 5; ctx.strokeRect(-R * 0.7, -R * 0.5, R * 1.4, R); ctx.restore();
    ctx.fillStyle = '#37474F'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
    readout(ctx, [['电流', p.current.toFixed(1) + ' A'], ['转速(相对)', (p.current * p.field).toFixed(1)], ['原理', 'F=BIL 产生力矩']]);
  }
};

const transformer = {
  id: 'transformer', title: '变压器', sub: 'Vs/Vp = Ns/Np', category: '电磁', color: '#455A64', emoji: '🔌',
  params: [
    { key: 'vp', label: '原线圈电压', min: 1, max: 20, step: 1, value: 10, fmt: v => v.toFixed(0) + ' V' },
    { key: 'np', label: '原线圈匝数', min: 1, max: 20, step: 1, value: 10, fmt: v => v.toFixed(0) },
    { key: 'ns', label: '副线圈匝数', min: 1, max: 20, step: 1, value: 20, fmt: v => v.toFixed(0) }
  ],
  actions: [],
  init() { return { t: 0 }; },
  step(s, p, dt) { if (dt > 0) s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.42, coreY = H * 0.16, coreH = H * 0.44, coreW = W * 0.14, np = Math.round(p.np), ns = Math.round(p.ns);
    const ac = Math.sin(s.t * 3);
    ctx.strokeStyle = '#78909C'; ctx.lineWidth = 14; ctx.strokeRect(cx - coreW, coreY, coreW * 2, coreH);
    // 铁芯中循环流动的磁通（透明度随交流强弱脉动）
    ctx.globalAlpha = 0.2 + Math.abs(ac) * 0.8;
    flowLoop(ctx, [[cx - coreW, coreY], [cx + coreW, coreY], [cx + coreW, coreY + coreH], [cx - coreW, coreY + coreH]], (s.t * 0.22) % 1, '#7E57C2');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#E53935'; ctx.lineWidth = 3;
    for (let i = 0; i < Math.min(np, 12); i++) { const y = coreY + 12 + i * (coreH - 24) / 12; ctx.beginPath(); ctx.ellipse(cx - coreW, y, 10, 7, 0, 0, 7); ctx.stroke(); }
    ctx.strokeStyle = '#1E88E5';
    for (let i = 0; i < Math.min(ns, 12); i++) { const y = coreY + 12 + i * (coreH - 24) / 12; ctx.beginPath(); ctx.ellipse(cx + coreW, y, 10, 7, 0, 0, 7); ctx.stroke(); }
    const vs = p.vp * p.ns / p.np;
    // 副边灯泡：亮度随瞬时电压脉动
    const br = Math.min(Math.abs(ac) * vs / 24, 1), bx = Math.min(cx + coreW + 66, W - 40), by = coreY + coreH / 2;
    ctx.strokeStyle = '#455A64'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + coreW + 12, by - 20); ctx.lineTo(bx, by - 20); ctx.moveTo(cx + coreW + 12, by + 20); ctx.lineTo(bx, by + 20); ctx.stroke();
    if (br > 0.02) { ctx.fillStyle = 'rgba(255,238,88,' + (br * 0.6) + ')'; ctx.beginPath(); ctx.arc(bx, by, 24, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,179,0,' + (0.3 + br * 0.7) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, 13, 0, 7); ctx.stroke();
    // 底部波形：原边(红)与副边(蓝)幅值对比
    const gy = H * 0.84, gx = W * 0.08, gw = W * 0.84;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
    const wf = (amp, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 100; i++) { const X = gx + i / 100 * gw, Y = gy - Math.sin(i / 100 * 12.56 - s.t * 3) * amp; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); };
    wf(Math.min(p.vp, 20) * 1.3, '#E53935');
    wf(Math.min(vs, 42) * 0.65, '#1E88E5');
    readout(ctx, [['匝数比', np + ' : ' + ns], ['原电压', p.vp.toFixed(0) + ' V'], ['副电压', vs.toFixed(1) + ' V'], ['类型', vs > p.vp ? '升压 ↑' : vs < p.vp ? '降压 ↓' : '1:1']]);
  }
};

const polarization = {
  id: 'polarization', title: '光的偏振', sub: '马吕斯定律 I=I₀cos²θ', category: '波动与光', color: '#00897B', emoji: '🕶️',
  params: [{ key: 'angle', label: '偏振片夹角', min: 0, max: 180, step: 5, value: 45, fmt: v => v.toFixed(0) + '°' }],
  actions: [], init() { return {}; }, step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E0F2F1'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.4, th = p.angle * Math.PI / 180, I = Math.cos(th) * Math.cos(th), p1x = W * 0.35, p2x = W * 0.65;
    ctx.fillStyle = 'rgba(255,235,59,0.5)'; ctx.fillRect(0, cy - 16, p2x, 32);
    ctx.fillStyle = 'rgba(255,235,59,' + (0.15 + I * 0.7) + ')'; ctx.fillRect(p2x, cy - 16, W - p2x, 32);
    const disc = (x, ang) => { ctx.strokeStyle = '#00695C'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, cy, 26, 44, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - Math.sin(ang) * 22, cy - Math.cos(ang) * 38); ctx.lineTo(x + Math.sin(ang) * 22, cy + Math.cos(ang) * 38); ctx.stroke(); };
    disc(p1x, 0); disc(p2x, th);
    readout(ctx, [['夹角 θ', p.angle.toFixed(0) + '°'], ['透射', 'I₀·cos²θ'], ['I/I₀', I.toFixed(2)]]);
  }
};

const diffraction = {
  id: 'diffraction', title: '单缝衍射', sub: '中央亮纹 / 光强分布', category: '波动与光', color: '#3949AB', emoji: '🌫️',
  params: [
    { key: 'width', label: '缝宽', min: 1, max: 8, step: 0.5, value: 3, fmt: v => v.toFixed(1) },
    { key: 'wavelength', label: '波长', min: 1, max: 6, step: 0.5, value: 3, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return {}; }, step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.45, screenY = H * 0.8;
    for (let x = 0; x < W; x += 2) { const pos = (x - cx) / W * 10, beta = Math.PI * p.width * pos / p.wavelength + 1e-6, I = Math.pow(Math.sin(beta) / beta, 2); ctx.fillStyle = 'rgba(120,140,255,' + I + ')'; ctx.fillRect(x, screenY, 2, H - screenY); }
    ctx.strokeStyle = '#7986CB'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x < W; x += 2) { const pos = (x - cx) / W * 10, beta = Math.PI * p.width * pos / p.wavelength + 1e-6, I = Math.pow(Math.sin(beta) / beta, 2), Y = cy + 40 - I * H * 0.3; x ? ctx.lineTo(x, Y) : ctx.moveTo(x, Y); }
    ctx.stroke();
    ctx.fillStyle = '#607D8B'; ctx.fillRect(0, cy - 70, cx - p.width * 2, 10); ctx.fillRect(cx + p.width * 2, cy - 70, W, 10);
    readout(ctx, [['缝宽', p.width.toFixed(1)], ['波长', p.wavelength.toFixed(1)], ['规律', '缝越窄中央纹越宽']]);
  }
};

// ===== 第 12 批新增 =====
const heatconduction = {
  id: 'heatconduction', title: '热传导', sub: '温度梯度 / 热流', category: '热学', color: '#E64A19', emoji: '🔥',
  params: [
    { key: 'hot', label: '热端温度', min: 50, max: 200, step: 10, value: 150, fmt: v => v.toFixed(0) + '°C' },
    { key: 'cold', label: '冷端温度', min: 0, max: 50, step: 5, value: 20, fmt: v => v.toFixed(0) + '°C' },
    { key: 'k', label: '导热系数', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return { t: 0 }; }, step(s, p, dt) { s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FBE9E7'; ctx.fillRect(0, 0, W, H);
    const rodX = W * 0.1, rodW = W * 0.8, rodY = H * 0.42, rodH = 60;
    for (let i = 0; i < rodW; i++) { const f = i / rodW, T = p.hot + (p.cold - p.hot) * f, x = Math.max(0, Math.min(1, T / 200)); ctx.fillStyle = 'rgb(' + Math.round(60 + x * 195) + ',' + Math.round(80 * (1 - x) + 30) + ',' + Math.round(200 * (1 - x) + 20) + ')'; ctx.fillRect(rodX + i, rodY, 1, rodH); }
    ctx.strokeStyle = '#455A64'; ctx.lineWidth = 3; ctx.strokeRect(rodX, rodY, rodW, rodH);
    const flow = p.k * (p.hot - p.cold) / 100;
    for (let a = 0; a < 5; a++) { const fx = rodX + ((s.t * flow * 40 + a * rodW / 5) % rodW); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(fx, rodY + rodH / 2, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#333'; ctx.font = '14px sans-serif'; ctx.fillText(p.hot + '°C', rodX - 4, rodY - 10); ctx.fillText(p.cold + '°C', rodX + rodW - 40, rodY - 10);
    readout(ctx, [['温差', (p.hot - p.cold) + '°C'], ['导热系数', p.k.toFixed(1)], ['热流(相对)', (p.k * (p.hot - p.cold) / 10).toFixed(1)]]);
  }
};

const maxwell = {
  id: 'maxwell', title: '分子速率分布', sub: '麦克斯韦分布 / 温度', category: '热学', color: '#00897B', emoji: '📊',
  params: [{ key: 'temperature', label: '温度', min: 100, max: 800, step: 20, value: 300, fmt: v => v.toFixed(0) + ' K' }],
  actions: [], init() { return {}; }, step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E0F2F1'; ctx.fillRect(0, 0, W, H);
    const gx = W * 0.12, gy = H * 0.8, gw = W * 0.78, gh = H * 0.55, a = p.temperature / 300;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - gh); ctx.stroke();
    let fmax = 0; const vals = [];
    for (let i = 0; i <= 100; i++) { const v = i / 100 * 8, f = v * v * Math.exp(-v * v / (2 * a)); vals.push(f); if (f > fmax) fmax = f; }
    ctx.strokeStyle = '#00897B'; ctx.lineWidth = 2.5; ctx.beginPath();
    vals.forEach((f, i) => { const X = gx + i / 100 * gw, Y = gy - f / fmax * gh; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke();
    const vp = Math.sqrt(2 * a), vx = gx + vp / 8 * gw;
    ctx.strokeStyle = '#E53935'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(vx, gy); ctx.lineTo(vx, gy - gh); ctx.stroke(); ctx.setLineDash([]);
    readout(ctx, [['温度', p.temperature + ' K'], ['最概然速率', '∝ √T'], ['规律', '温度↑ 分布变宽 峰右移']]);
  }
};

const massspec = {
  id: 'massspec', title: '质谱仪', sub: 'r=mv/qB / 磁偏转', category: '原子', color: '#5C6BC0', emoji: '🧲',
  params: [
    { key: 'mass', label: '离子质量', min: 1, max: 10, step: 0.5, value: 4, fmt: v => v.toFixed(1) },
    { key: 'charge', label: '电荷', min: 1, max: 3, step: 1, value: 1, fmt: v => v.toFixed(0) },
    { key: 'field', label: '磁场', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) }
  ],
  actions: [], init() { return { ang: 0 }; }, step(s, p, dt) { s.ang += dt * 1.5; if (s.ang > Math.PI) s.ang = 0; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E8EAF6'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(92,107,192,0.25)'; for (let y = H * 0.15; y < H * 0.9; y += 30) for (let x = W * 0.15; x < W * 0.9; x += 30) { ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
    const v = 4, r = Math.min(p.mass * v / (p.charge * p.field) * 8, W * 0.35), entryX = W * 0.2, entryY = H * 0.2, ccx = entryX + r, ccy = entryY;
    ctx.strokeStyle = '#5C6BC0'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(ccx, ccy, r, Math.PI, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const a = Math.PI + s.ang, ix = ccx + r * Math.cos(a), iy = ccy + r * Math.sin(a);
    ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(ix, iy, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#455A64'; ctx.fillRect(entryX + 2 * r - 6, entryY - 4, 12, 20);
    readout(ctx, [['半径 r', (p.mass * v / (p.charge * p.field)).toFixed(2)], ['规律', 'r ∝ m/(qB)'], ['应用', '分离不同质量离子']]);
  }
};

const radiation = {
  id: 'radiation', title: 'α β γ 射线', sub: '电场偏转 / 三种射线', category: '原子', color: '#7CB342', emoji: '☢️',
  params: [], actions: [], init() { return { t: 0 }; }, step(s, p, dt) { s.t += dt; },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#1A2027'; ctx.fillRect(0, 0, W, H);
    const srcX = W * 0.12, srcY = H * 0.5;
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#E53935'; ctx.fillRect(W * 0.4, H * 0.12, W * 0.35, 10); ctx.fillStyle = '#fff'; ctx.fillText('+', W * 0.57, H * 0.1);
    ctx.fillStyle = '#1E88E5'; ctx.fillRect(W * 0.4, H * 0.86, W * 0.35, 10); ctx.fillStyle = '#fff'; ctx.fillText('−', W * 0.57, H * 0.94);
    ctx.fillStyle = '#616161'; ctx.beginPath(); ctx.arc(srcX, srcY, 14, 0, 7); ctx.fill();
    const tracks = [['α', '#FF7043', 1, 0.5], ['γ', '#FFEB3B', 0, 0], ['β', '#42A5F5', -1, 2.5]];
    tracks.forEach(tr => {
      ctx.strokeStyle = tr[1]; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(srcX, srcY);
      for (let x = 0; x <= W * 0.8; x += 6) { const px = srcX + x, py = srcY + tr[2] * tr[3] * Math.pow(x / (W * 0.8), 2) * H * 0.28; ctx.lineTo(px, py); }
      ctx.stroke();
      ctx.fillStyle = tr[1]; ctx.font = '14px sans-serif'; ctx.fillText(tr[0], srcX + W * 0.72, srcY + tr[2] * tr[3] * H * 0.28 + 4);
    });
    readout(ctx, [['α 射线', '带正电，偏转小'], ['β 射线', '带负电，偏转大'], ['γ 射线', '不带电，不偏转']]);
  }
};

const reactionrate = {
  id: 'reactionrate', title: '化学反应速率', sub: '阿伦尼乌斯 / 温度依赖', category: '化学', color: '#F4511E', emoji: '📈',
  params: [
    { key: 'temperature', label: '温度', min: 250, max: 600, step: 10, value: 350, fmt: v => v.toFixed(0) + ' K' },
    { key: 'ea', label: '活化能', min: 10, max: 60, step: 5, value: 30, fmt: v => v.toFixed(0) + ' kJ' }
  ],
  actions: [], init() { return {}; }, step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FBE9E7'; ctx.fillRect(0, 0, W, H);
    const gx = W * 0.12, gy = H * 0.82, gw = W * 0.78, gh = H * 0.6;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - gh); ctx.stroke();
    const rate = T => Math.exp(-p.ea * 1000 / (8.314 * T)), rmax = rate(600);
    ctx.strokeStyle = '#F4511E'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 100; i++) { const T = 250 + i / 100 * 350, X = gx + i / 100 * gw, Y = gy - rate(T) / rmax * gh; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();
    const cx = gx + (p.temperature - 250) / 350 * gw;
    ctx.strokeStyle = '#1565C0'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(cx, gy); ctx.lineTo(cx, gy - gh); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#333'; ctx.font = '12px sans-serif'; ctx.fillText('温度→', gx + gw - 46, gy + 18); ctx.fillText('速率↑', gx - 8, gy - gh + 2);
    readout(ctx, [['温度', p.temperature + ' K'], ['活化能', p.ea + ' kJ'], ['规律', '温度↑ 速率指数增大']]);
  }
};

// ===== 第 13 批新增 =====
const fiberoptics = {
  id: 'fiber', title: '光纤全反射', sub: '全反射 / 光的传导', category: '波动与光', color: '#00ACC1', emoji: '🔦',
  params: [
    { key: 'angle', label: '入射角度', min: 10, max: 60, step: 2, value: 30, fmt: v => v.toFixed(0) + '°' },
    { key: 'index', label: '纤芯折射率', min: 1.2, max: 2, step: 0.05, value: 1.5, fmt: v => v.toFixed(2) }
  ],
  actions: [], init() { return {}; }, step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#0A1A2A'; ctx.fillRect(0, 0, W, H);
    const top = H * 0.38, bot = H * 0.62, left = W * 0.06, right = W * 0.94;
    ctx.fillStyle = 'rgba(0,172,193,0.15)'; ctx.fillRect(left, top, right - left, bot - top);
    ctx.strokeStyle = '#00ACC1'; ctx.lineWidth = 3; ctx.strokeRect(left, top, right - left, bot - top);
    const crit = Math.asin(1 / p.index) * 180 / Math.PI, wallAngle = 90 - p.angle, tir = wallAngle > crit, slope = Math.tan(p.angle * Math.PI / 180);
    ctx.strokeStyle = tir ? '#FFEB3B' : '#FF7043'; ctx.lineWidth = 2.5; ctx.beginPath();
    let x = left, y = (top + bot) / 2, dir = 1; ctx.moveTo(x, y);
    for (let step = 0; step < 40 && x < right; step++) {
      const dy = (dir > 0 ? bot - y : y - top), dx = dy / slope; x += dx; y += dir * dy;
      ctx.lineTo(Math.min(x, right), y); dir = -dir; if (!tir) break;
    }
    ctx.stroke();
    readout(ctx, [['临界角', crit.toFixed(0) + '°'], ['壁面入射角', wallAngle.toFixed(0) + '°'], ['状态', tir ? '全反射·光被导引' : '折射逸出']]);
  }
};

const hydraulic = {
  id: 'hydraulic', title: '液压机', sub: '帕斯卡原理 / 按压举升', category: '力学', color: '#0277BD', emoji: '🛢️',
  params: [
    { key: 'f1', label: '按压力', min: 10, max: 200, step: 10, value: 50, fmt: v => v.toFixed(0) + ' N' },
    { key: 'a1', label: '小活塞面积', min: 1, max: 5, step: 0.5, value: 1, fmt: v => v.toFixed(1) },
    { key: 'a2', label: '大活塞面积', min: 5, max: 30, step: 1, value: 15, fmt: v => v.toFixed(0) }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : (s.d >= 1 ? '↻ 复位再压' : '▶ 按压'), primary: true, on(s) { if (s.d >= 1) { s.d = 0; s.running = true; } else s.running = !s.running; } },
    { label: '复位', on(s) { s.running = false; s.d = 0; } }
  ],
  init() { return { d: 0, running: false, buzz: 0 }; },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    s.d += dt * 0.3;
    if (s.d >= 1) { s.d = 1; s.running = false; s.buzz = (s.buzz | 0) + 1; }
  },
  hint: '用手指向下按小活塞，观察大活塞举升',
  onDragStart(s, p, x, y) {
    const u = s._ui;
    if (!u || x < u.lx - u.lw / 2 - 24 || x > u.lx + u.lw / 2 + 24 ||
        y < u.lPy - 42 || y > u.lPy + 38) return false;
    s.running = false; s.dragging = true; return true;
  },
  onDragMove(s, p, x, y) {
    const u = s._ui;
    if (!u) return;
    s.d = Math.max(0, Math.min(1, (y - u.startY) / u.travel));
  },
  onDragEnd(s) {
    s.dragging = false;
    if (s.d >= 0.98) { s.d = 1; s.buzz = (s.buzz | 0) + 1; }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E1F5FE'; ctx.fillRect(0, 0, W, H);
    const ratio = p.a2 / p.a1, f2 = p.f1 * ratio;
    const baseY = H * 0.72, lx = W * 0.24, rx = W * 0.68;
    const lw = 26 + p.a1 * 8, rw = 26 + p.a2 * 4;
    // 体积守恒：小活塞下行多，大活塞上升少（行程反比于面积比）
    const smallTravel = H * 0.16, bigTravel = smallTravel / ratio;
    const lPy = H * 0.4 + s.d * smallTravel;
    const rPy = H * 0.5 - s.d * bigTravel;
    ctx.fillStyle = '#4FC3F7';
    ctx.fillRect(lx - lw / 2, lPy, lw, baseY - lPy);
    ctx.fillRect(rx - rw / 2, rPy, rw, baseY - rPy);
    ctx.fillRect(lx, baseY, rx - lx, 22);
    ctx.strokeStyle = '#455A64'; ctx.lineWidth = 3;
    ctx.strokeRect(lx - lw / 2, H * 0.3, lw, baseY - H * 0.3);
    ctx.strokeRect(rx - rw / 2, H * 0.28, rw, baseY - H * 0.28);
    ctx.fillStyle = '#546E7A'; ctx.fillRect(lx - lw / 2, lPy - 12, lw, 12); ctx.fillRect(rx - rw / 2, rPy - 12, rw, 12);
    s._ui = { lx, lw, lPy, startY: H * 0.4, travel: smallTravel };
    // 大活塞上被举起的小车
    ctx.fillStyle = '#E53935'; ctx.fillRect(rx - 34, rPy - 40, 68, 26);
    ctx.fillStyle = '#B71C1C'; ctx.beginPath(); ctx.arc(rx - 20, rPy - 12, 8, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(rx + 20, rPy - 12, 8, 0, 7); ctx.fill();
    arrowSeg(ctx, lx, lPy - 52, lx, lPy - 18, '#E53935', 4);
    ctx.fillStyle = '#E53935'; ctx.font = '12px sans-serif'; ctx.fillText('F₁=' + p.f1 + 'N', lx - 28, lPy - 58);
    arrowSeg(ctx, rx + rw / 2 + 16, rPy + 26, rx + rw / 2 + 16, rPy - 6, '#43A047', 5);
    ctx.fillStyle = '#43A047'; ctx.fillText('F₂=' + f2.toFixed(0) + 'N', rx + rw / 2 - 42, Math.max(rPy - 48, 14));
    readout(ctx, [['力放大', ratio.toFixed(1) + ' 倍'], ['小活塞下行', (s.d * 20).toFixed(1) + ' cm'], ['大活塞上升', (s.d * 20 / ratio).toFixed(1) + ' cm'], ['状态', s.d >= 1 ? '压到底 🎉' : s.running ? '按压中…' : '待按压']]);
  }
};

const springcombo = {
  id: 'springcombo', title: '弹簧组合', sub: '串联并联 / 等效劲度', category: '力学', color: '#00897B', emoji: '🧷',
  params: [
    { key: 'k1', label: '劲度 k₁', min: 5, max: 40, step: 1, value: 15, fmt: v => v.toFixed(0) },
    { key: 'k2', label: '劲度 k₂', min: 5, max: 40, step: 1, value: 25, fmt: v => v.toFixed(0) },
    { key: 'weight', label: '挂重', min: 1, max: 20, step: 1, value: 8, fmt: v => v.toFixed(0) + ' N' }
  ],
  actions: [{ label: s => s.mode === 'series' ? '切换并联' : '切换串联', primary: true, on(s) { s.mode = s.mode === 'series' ? 'parallel' : 'series'; } }],
  init() { return { mode: 'series', u: 1, v: 0 }; },
  step(s, p, dt) {
    // 弹跳动力学：切换组合或改参数时重物弹跳到新平衡位置
    if (dt <= 0) return;
    const keff = s.mode === 'series' ? 1 / (1 / p.k1 + 1 / p.k2) : p.k1 + p.k2;
    const target = p.weight / keff, om = 7, sub = 3, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const a = om * om * (target - s.u) - 2 * 0.25 * om * s.v;
      s.v += a * h; s.u += s.v * h;
    }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E0F2F1'; ctx.fillRect(0, 0, W, H);
    const keff = s.mode === 'series' ? 1 / (1 / p.k1 + 1 / p.k2) : p.k1 + p.k2, cx = W * 0.5;
    const topY = H * 0.12;
    ctx.fillStyle = '#607D8B'; ctx.fillRect(W * 0.2, topY - 14, W * 0.6, 14);
    const coil = (x, y0, y1, col) => { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y0); const n = 10, seg = (y1 - y0) / n; for (let i = 1; i <= n; i++) { const yy = y0 + i * seg, xx = i === n ? x : (i % 2 ? x - 16 : x + 16); ctx.lineTo(xx, yy); } ctx.stroke(); };
    const ext = Math.max(Math.min(s.u * H * 0.03, H * 0.3), -H * 0.06);
    if (s.mode === 'series') {
      // 串联：两根弹簧各自按劲度分担伸长（软的伸得多）
      const e1 = ext * (keff / p.k1), e2 = ext * (keff / p.k2);
      const L1 = H * 0.14 + e1, L2 = H * 0.14 + e2;
      coil(cx, topY, topY + L1, '#E53935');
      coil(cx, topY + L1, topY + L1 + L2, '#1E88E5');
      ctx.fillStyle = '#00695C'; ctx.fillRect(cx - 30, topY + L1 + L2, 60, 40);
      ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(p.weight + 'N', cx - 12, topY + L1 + L2 + 24);
    } else {
      const L = H * 0.2 + ext;
      coil(cx - 50, topY, topY + L, '#E53935');
      coil(cx + 50, topY, topY + L, '#1E88E5');
      ctx.fillStyle = '#00695C'; ctx.fillRect(cx - 70, topY + L, 140, 36);
      ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(p.weight + 'N', cx - 12, topY + L + 22);
    }
    readout(ctx, [['组合', s.mode === 'series' ? '串联（更软）' : '并联（更硬）'], ['等效劲度', keff.toFixed(1) + ' N/m'], ['当前伸长', s.u.toFixed(2) + ' m'], ['平衡伸长', (p.weight / keff).toFixed(2) + ' m']]);
  }
};

const lenz = {
  id: 'lenz', title: '楞次定律', sub: '感应电流方向 / 阻碍变化', category: '电磁', color: '#C2185B', emoji: '🧭',
  params: [{ key: 'speed', label: '磁体速度', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) }],
  actions: [], init() { return { t: 0, mx: 0, prev: 0, dir: 1 }; },
  step(s, p, dt) { s.prev = s.mx; s.t += p.speed * dt; s.mx = Math.sin(s.t); s.dir = (s.mx - s.prev) > 0 ? 1 : -1; },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#FCE4EC'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.4, coilX = W * 0.65;
    ctx.strokeStyle = '#B87333'; ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(coilX + i * 10, cy, 10, 42, 0, 0, 7); ctx.stroke(); }
    const magX = W * 0.3 + s.mx * W * 0.15;
    ctx.fillStyle = '#E53935'; ctx.fillRect(magX - 40, cy - 16, 40, 32); ctx.fillStyle = '#1E88E5'; ctx.fillRect(magX, cy - 16, 40, 32);
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText('N', magX - 26, cy + 5); ctx.fillText('S', magX + 14, cy + 5);
    const toward = s.dir > 0;
    readout(ctx, [['磁体运动', toward ? '靠近线圈' : '远离线圈'], ['感应电流', '阻碍磁通变化'], ['楞次定律', toward ? '产生斥力' : '产生引力']]);
  }
};

const potentiometer = {
  id: 'potentiometer', title: '分压器', sub: '滑动变阻器 / 分压', category: '电磁', color: '#EF6C00', emoji: '🎚️',
  params: [
    { key: 'vin', label: '输入电压', min: 1, max: 12, step: 0.5, value: 9, fmt: v => v.toFixed(1) + ' V' },
    { key: 'pos', label: '滑片位置', min: 0, max: 100, step: 5, value: 50, fmt: v => v.toFixed(0) + '%' }
  ],
  actions: [],
  init() { return { phase: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    const vout = p.vin * p.pos / 100;
    s.phase = (s.phase + vout * 0.014 * dt * 60) % 1; if (s.phase < 0) s.phase += 1;
  },
  hint: '直接拖动电阻条上的滑片调节输出电压',
  onDragStart(s, p, x, y) {
    const u = s._ui;
    if (!u || x < u.barX - 20 || x > u.barX + u.barW + 20 ||
        y < u.barY - 55 || y > u.barY + 55) return false;
    s.dragging = true;
    p.pos = Math.round(Math.max(0, Math.min(100, (x - u.barX) / u.barW * 100)) / 5) * 5;
    return true;
  },
  onDragMove(s, p, x) {
    const u = s._ui;
    if (!u) return;
    p.pos = Math.round(Math.max(0, Math.min(100, (x - u.barX) / u.barW * 100)) / 5) * 5;
  },
  onDragEnd(s) { s.dragging = false; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FFF3E0'; ctx.fillRect(0, 0, W, H);
    const barX = W * 0.1, barY = H * 0.34, barW = W * 0.8;
    s._ui = { barX, barY, barW };
    ctx.fillStyle = '#FFCC80'; ctx.fillRect(barX, barY, barW, 30);
    ctx.strokeStyle = '#E65100'; ctx.lineWidth = 2; ctx.strokeRect(barX, barY, barW, 30);
    const sx = barX + p.pos / 100 * barW;
    ctx.fillStyle = '#5D4037'; ctx.fillRect(sx - 4, barY - 24, 8, 24); ctx.beginPath(); ctx.moveTo(sx - 12, barY - 24); ctx.lineTo(sx + 12, barY - 24); ctx.lineTo(sx, barY - 4); ctx.closePath(); ctx.fill();
    const vout = p.vin * p.pos / 100, br = vout / 12, bx = W * 0.5, by = H * 0.72;
    // 输出回路导线：滑片 → 灯泡 → 电阻条左端
    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, barY - 24); ctx.lineTo(sx, barY - 44); ctx.lineTo(W * 0.88, barY - 44); ctx.lineTo(W * 0.88, by); ctx.lineTo(bx + 16, by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - 16, by); ctx.lineTo(barX, by); ctx.lineTo(barX, barY + 30); ctx.stroke();
    // 电流点沿回路流动，速度 ∝ 输出电压
    if (vout > 0.05) {
      const pts = [[sx, barY - 44], [W * 0.88, barY - 44], [W * 0.88, by], [bx + 16, by]];
      const lens = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); tot += l; }
      ctx.fillStyle = '#1565C0';
      for (let j = 0; j < 6; j++) {
        let d = ((s.phase + j / 6) % 1) * tot;
        for (let k = 0; k < lens.length; k++) {
          if (d <= lens[k]) { const f = d / lens[k], a = pts[k], b = pts[k + 1]; ctx.beginPath(); ctx.arc(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 4, 0, 7); ctx.fill(); break; }
          d -= lens[k];
        }
      }
    }
    if (br > 0.02) { ctx.fillStyle = 'rgba(255,238,88,' + (br * 0.6) + ')'; ctx.beginPath(); ctx.arc(bx, by, 26, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 16, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,179,0,' + (0.3 + br * 0.7) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, 16, 0, 7); ctx.stroke();
    readout(ctx, [['输入电压', p.vin.toFixed(1) + ' V'], ['滑片位置', p.pos.toFixed(0) + '%'], ['输出电压', vout.toFixed(2) + ' V']]);
  }
};

// ===== 人工智能：深度学习 =====
// 一个真实的 2-n1-n2-1 多层感知机：前向传播
function mlpForward(net, x0, x1) {
  const h1 = [], h2 = [];
  for (let i = 0; i < net.n1; i++) h1.push(Math.tanh(net.W1[i][0] * x0 + net.W1[i][1] * x1 + net.b1[i]));
  for (let j = 0; j < net.n2; j++) { let z = net.b2[j]; for (let i = 0; i < net.n1; i++) z += net.W2[j][i] * h1[i]; h2.push(Math.tanh(z)); }
  let z3 = net.b3; for (let j = 0; j < net.n2; j++) z3 += net.W3[j] * h2[j];
  return { h1, h2, y: 1 / (1 + Math.exp(-z3)) };
}
function mlpInit(n1, n2) {
  const r = () => (Math.random() - 0.5) * 1.6;
  const net = { n1, n2, W1: [], b1: [], W2: [], b2: [], W3: [], b3: r() };
  for (let i = 0; i < n1; i++) { net.W1.push([r(), r()]); net.b1.push(r()); }
  for (let j = 0; j < n2; j++) { const row = []; for (let i = 0; i < n1; i++) row.push(r()); net.W2.push(row); net.b2.push(r()); net.W3.push(r()); }
  return net;
}
function mlpData(kind) {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const x = Math.random(), y = Math.random();
    const t = kind === 'xor' ? (((x > 0.5) !== (y > 0.5)) ? 1 : 0) : (Math.hypot(x - 0.5, y - 0.5) < 0.25 ? 1 : 0);
    pts.push({ x, y, t });
  }
  if (kind === 'circle') for (let i = 0; i < 16; i++) { const a = Math.random() * 6.283, rr = Math.random() * 0.2; pts.push({ x: 0.5 + Math.cos(a) * rr, y: 0.5 + Math.sin(a) * rr, t: 1 }); }
  return pts;
}
// 真实反向传播（全批量 MSE 梯度下降），返回损失
function mlpTrainStep(net, data, lr) {
  const n1 = net.n1, n2 = net.n2;
  const gW1 = net.W1.map(() => [0, 0]), gb1 = new Array(n1).fill(0);
  const gW2 = net.W2.map(r => r.map(() => 0)), gb2 = new Array(n2).fill(0);
  const gW3 = new Array(n2).fill(0); let gb3 = 0, loss = 0;
  data.forEach(d => {
    const f = mlpForward(net, d.x, d.y);
    const err = f.y - d.t; loss += err * err;
    const dy = 2 * err * f.y * (1 - f.y);
    const dh2 = [];
    for (let j = 0; j < n2; j++) { gW3[j] += dy * f.h2[j]; dh2.push(dy * net.W3[j] * (1 - f.h2[j] * f.h2[j])); }
    gb3 += dy;
    const dh1 = new Array(n1).fill(0);
    for (let j = 0; j < n2; j++) { for (let i = 0; i < n1; i++) { gW2[j][i] += dh2[j] * f.h1[i]; dh1[i] += dh2[j] * net.W2[j][i]; } gb2[j] += dh2[j]; }
    for (let i = 0; i < n1; i++) { const dz = dh1[i] * (1 - f.h1[i] * f.h1[i]); gW1[i][0] += dz * d.x; gW1[i][1] += dz * d.y; gb1[i] += dz; }
  });
  const k = lr / data.length;
  for (let i = 0; i < n1; i++) { net.W1[i][0] -= k * gW1[i][0]; net.W1[i][1] -= k * gW1[i][1]; net.b1[i] -= k * gb1[i]; }
  for (let j = 0; j < n2; j++) { for (let i = 0; i < n1; i++) net.W2[j][i] -= k * gW2[j][i]; net.b2[j] -= k * gb2[j]; net.W3[j] -= k * gW3[j]; }
  net.b3 -= k * gb3;
  return loss / data.length;
}
const mlp = {
  id: 'mlp', title: '全连接神经网络', sub: '真实反向传播训练 / 决策边界', category: '人工智能', color: '#7C4DFF', emoji: '🧠',
  params: [{ key: 'lr', label: '学习率', min: 0.2, max: 5, step: 0.1, value: 2, fmt: v => v.toFixed(1) }],
  actions: [
    { label: s => s.training ? '⏸ 暂停训练' : '▶ 开始训练', primary: true, on(s) { s.training = !s.training; } },
    { label: s => s.kind === 'xor' ? '数据:XOR' : '数据:圆环', on(s) { s.kind = s.kind === 'xor' ? 'circle' : 'xor'; s.data = mlpData(s.kind); s.net = mlpInit(6, 5); s.loss = []; s.epoch = 0; } },
    { label: '重置网络', on(s) { s.net = mlpInit(6, 5); s.loss = []; s.epoch = 0; } }
  ],
  init() { return { net: mlpInit(6, 5), data: mlpData('xor'), kind: 'xor', training: false, loss: [], epoch: 0, test: null, W: 360, H: 500 }; },
  step(s, p, dt) {
    if (!s.training || dt <= 0) return;
    let L = 0;
    for (let k = 0; k < 6; k++) { L = mlpTrainStep(s.net, s.data, p.lr); s.epoch++; }
    s.loss.push(L); if (s.loss.length > 160) s.loss.shift();
  },
  onTap(s, p, x, y) {
    const W = s.W || 360, H = s.H || 500;
    const mx = W * 0.04, my = H * 0.04, mw = W * 0.55, mh = H * 0.5;
    if (x >= mx && x <= mx + mw && y >= my && y <= my + mh) s.test = { x: (x - mx) / mw, y: (y - my) / mh };
  },
  draw(ctx, W, H, s, p) {
    s.W = W; s.H = H;
    ctx.fillStyle = '#12121F'; ctx.fillRect(0, 0, W, H);
    const mx = W * 0.04, my = H * 0.04, mw = W * 0.55, mh = H * 0.5;
    // 决策边界热图（每格跑一次前向传播）
    const cell = 10;
    for (let gy = 0; gy < mh; gy += cell) for (let gx = 0; gx < mw; gx += cell) {
      const v = mlpForward(s.net, (gx + cell / 2) / mw, (gy + cell / 2) / mh).y;
      ctx.fillStyle = 'rgba(' + Math.round(255 * v) + ',' + Math.round(110 * (1 - Math.abs(v - 0.5) * 2)) + ',' + Math.round(255 * (1 - v)) + ',0.55)';
      ctx.fillRect(mx + gx, my + gy, cell, cell);
    }
    s.data.forEach(d => {
      ctx.fillStyle = d.t ? '#FF8A65' : '#4FC3F7';
      ctx.beginPath(); ctx.arc(mx + d.x * mw, my + d.y * mh, 4, 0, 7); ctx.fill();
    });
    let testOut = null;
    if (s.test) {
      testOut = mlpForward(s.net, s.test.x, s.test.y);
      const tx = mx + s.test.x * mw, ty = my + s.test.y * mh;
      ctx.strokeStyle = '#FFEB3B'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx - 8, ty); ctx.lineTo(tx + 8, ty); ctx.moveTo(tx, ty - 8); ctx.lineTo(tx, ty + 8); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(mx, my, mw, mh);
    // 网络结构：2-6-5-1，边=权重（红正蓝负粗细=大小），节点亮度=推理时激活值
    const nx0 = W * 0.66, nx3 = W * 0.96;
    const cols = [2, s.net.n1, s.net.n2, 1];
    const colX = [nx0, nx0 + (nx3 - nx0) / 3, nx0 + 2 * (nx3 - nx0) / 3, nx3];
    const nodeY = (ci, i) => my + (i + 0.5) * mh / cols[ci];
    const acts = testOut ? [[s.test.x, s.test.y], testOut.h1, testOut.h2, [testOut.y]] : null;
    const edge = (x1, y1, x2, y2, w) => {
      ctx.strokeStyle = w > 0 ? 'rgba(255,110,80,' + Math.min(Math.abs(w) / 2, 0.85) + ')' : 'rgba(80,160,255,' + Math.min(Math.abs(w) / 2, 0.85) + ')';
      ctx.lineWidth = Math.min(0.5 + Math.abs(w) * 0.7, 3);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    for (let i = 0; i < s.net.n1; i++) for (let k = 0; k < 2; k++) edge(colX[0], nodeY(0, k), colX[1], nodeY(1, i), s.net.W1[i][k]);
    for (let j = 0; j < s.net.n2; j++) for (let i = 0; i < s.net.n1; i++) edge(colX[1], nodeY(1, i), colX[2], nodeY(2, j), s.net.W2[j][i]);
    for (let j = 0; j < s.net.n2; j++) edge(colX[2], nodeY(2, j), colX[3], nodeY(3, 0), s.net.W3[j]);
    for (let ci = 0; ci < 4; ci++) for (let i = 0; i < cols[ci]; i++) {
      let a = acts ? acts[ci][i] : 0;
      if (ci > 0 && ci < 3) a = (a + 1) / 2;
      ctx.fillStyle = acts ? 'rgba(255,235,59,' + (0.15 + 0.85 * Math.max(0, Math.min(1, a))) + ')' : '#455A64';
      ctx.beginPath(); ctx.arc(colX[ci], nodeY(ci, i), 6, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    }
    // 损失曲线
    const ly = H * 0.62, lh2 = H * 0.14, lx = W * 0.06, lw2 = W * 0.88;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(lx, ly, lw2, lh2);
    if (s.loss.length > 1) {
      const maxL = Math.max.apply(null, s.loss);
      ctx.strokeStyle = '#69F0AE'; ctx.lineWidth = 2; ctx.beginPath();
      s.loss.forEach((L, i) => { const X = lx + i / 159 * lw2, Y = ly + lh2 - L / (maxL || 1) * lh2 * 0.9; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px sans-serif'; ctx.fillText('损失曲线', lx + 4, ly + 12);
    let acc = 0; s.data.forEach(d => { if ((mlpForward(s.net, d.x, d.y).y > 0.5 ? 1 : 0) === d.t) acc++; });
    readout(ctx, [['训练轮次', s.epoch + ''], ['损失', s.loss.length ? s.loss[s.loss.length - 1].toFixed(4) : '—'], ['准确率', (acc / s.data.length * 100).toFixed(0) + '%'], ['推理', testOut ? '输出 ' + testOut.y.toFixed(2) + ' → 类别 ' + (testOut.y > 0.5 ? '1' : '0') : '点击热图试推理']]);
  }
};

// 卷积神经网络：卷积核滑动 / 特征图 / 池化
function cnMakeImg(kind) {
  const img = Array.from({ length: 12 }, () => new Array(12).fill(0));
  if (kind === 0) {
    for (let c = 1; c < 11; c++) img[2][c] = 1;
    for (let r = 3; r < 11; r++) img[r][Math.max(2, 10 - (r - 2))] = 1;
  } else if (kind === 1) {
    for (let c = 1; c < 11; c++) img[6][c] = 1;
    for (let r = 1; r < 11; r++) img[r][6] = 1;
  } else {
    for (let c = 2; c < 10; c++) { img[2][c] = 1; img[9][c] = 1; }
    for (let r = 2; r < 10; r++) { img[r][2] = 1; img[r][9] = 1; }
  }
  return img;
}
const CN_KERNELS = [
  { name: '横向边缘', k: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]] },
  { name: '纵向边缘', k: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]] },
  { name: '锐化', k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
  { name: '模糊', k: [[0.11, 0.11, 0.11], [0.11, 0.11, 0.11], [0.11, 0.11, 0.11]] }
];
const convnet = {
  id: 'convnet', title: '卷积神经网络', sub: '卷积核滑动 / 特征图 / 池化', category: '人工智能', color: '#00B8D4', emoji: '🔬',
  kernels: CN_KERNELS, makeImg: cnMakeImg,
  params: [{ key: 'speed', label: '滑动速度', min: 2, max: 40, step: 1, value: 12, fmt: v => v.toFixed(0) + ' 步/秒' }],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : (s.pos >= 100 ? '↻ 重新卷积' : '▶ 开始卷积'), primary: true, on(s) { if (s.pos >= 100) { s.pos = 0; s.t = 0; s.running = true; } else s.running = !s.running; } },
    { label: s => '图像:' + ['数字7', '十字', '方框'][s.imgKind], on(s) { s.imgKind = (s.imgKind + 1) % 3; s.img = cnMakeImg(s.imgKind); s.pos = 0; s.t = 0; } },
    { label: s => '核:' + CN_KERNELS[s.kernel].name, on(s) { s.kernel = (s.kernel + 1) % CN_KERNELS.length; s.pos = 0; s.t = 0; } }
  ],
  init() { return { img: cnMakeImg(0), imgKind: 0, kernel: 0, pos: 0, t: 0, running: false, buzz: 0 }; },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    s.t += dt * p.speed;
    s.pos = Math.min(Math.floor(s.t), 100);
    if (s.pos >= 100) { s.running = false; s.buzz = (s.buzz | 0) + 1; }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#0D1B2A'; ctx.fillRect(0, 0, W, H);
    const K = CN_KERNELS[s.kernel].k;
    const fm = [];
    for (let r = 0; r < 10; r++) { const row = []; for (let c = 0; c < 10; c++) { let v = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += s.img[r + i][c + j] * K[i][j]; row.push(v); } fm.push(row); }
    const done = Math.min(s.pos, 100);
    // 输入图 + 滑动窗口
    const cs = Math.min(W * 0.36 / 12, H * 0.3 / 12), ix = W * 0.05, iy = H * 0.07;
    for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) {
      ctx.fillStyle = s.img[r][c] ? '#E0F7FA' : '#1B3A4B';
      ctx.fillRect(ix + c * cs, iy + r * cs, cs - 1, cs - 1);
    }
    const cur = Math.max(Math.min(done, 99), 0), curR = Math.floor(cur / 10), curC = cur % 10;
    if (done < 100) { ctx.strokeStyle = '#FF5252'; ctx.lineWidth = 2; ctx.strokeRect(ix + curC * cs, iy + curR * cs, cs * 3, cs * 3); }
    ctx.fillStyle = '#80DEEA'; ctx.font = '11px sans-serif'; ctx.fillText('输入 12×12', ix, iy - 6);
    // 卷积核数值面板
    const kx = ix, ky = iy + 12 * cs + 20;
    ctx.fillText('卷积核（共享参数仅9个）', kx, ky - 5);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const v = K[i][j];
      ctx.fillStyle = v > 0 ? 'rgba(255,110,80,0.8)' : v < 0 ? 'rgba(80,160,255,0.8)' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(kx + j * 27, ky + i * 22, 25, 20);
      ctx.fillStyle = '#fff'; ctx.fillText((v > 0 ? '+' : '') + (Math.abs(v) < 1 && v !== 0 ? v.toFixed(1) : v.toFixed(0)), kx + j * 27 + 3, ky + i * 22 + 14);
    }
    // 特征图逐格填充
    const fx = W * 0.52, fy = H * 0.07, fs = Math.min(W * 0.32 / 10, H * 0.26 / 10);
    let fmax = 0.001; fm.forEach(row => row.forEach(v => { fmax = Math.max(fmax, Math.abs(v)); }));
    for (let idx = 0; idx < done; idx++) {
      const r = Math.floor(idx / 10), c = idx % 10, v = fm[r][c], a = Math.abs(v) / fmax;
      ctx.fillStyle = v > 0 ? 'rgba(255,140,60,' + a + ')' : 'rgba(60,140,255,' + a + ')';
      ctx.fillRect(fx + c * fs, fy + r * fs, fs - 1, fs - 1);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(fx, fy, fs * 10, fs * 10);
    ctx.fillStyle = '#80DEEA'; ctx.fillText('特征图 ' + done + '/100', fx, fy - 6);
    // ReLU + 最大池化
    const px3 = W * 0.52, py3 = fy + fs * 10 + 26, ps = fs * 1.4;
    ctx.fillText('ReLU→2×2池化', px3, py3 - 6);
    if (done >= 100) {
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        let m = 0;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) m = Math.max(m, Math.max(0, fm[r * 2 + i][c * 2 + j]));
        ctx.fillStyle = 'rgba(255,140,60,' + Math.min(m / fmax, 1) + ')';
        ctx.fillRect(px3 + c * ps, py3 + r * ps, ps - 1, ps - 1);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(px3, py3, ps * 5, ps * 5);
    } else { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillText('（卷积完成后显示）', px3, py3 + 18); }
    const curV = done > 0 ? fm[Math.floor((done - 1) / 10)][(done - 1) % 10] : 0;
    readout(ctx, [['卷积核', CN_KERNELS[s.kernel].name], ['当前输出值', done ? curV.toFixed(1) : '—'], ['参数量', '卷积9 vs 全连接14400'], ['进度', done + ' / 100']]);
  }
};

// Transformer 自注意力
const AT_TOKENS = ['小猫', '追', '皮球', '因为', '它', '很', '好玩'];
const AT_EMB = [
  [1.0, 0.1, 0.2, 0.0], [0.0, 1.0, 0.1, 0.1], [0.9, 0.1, 0.9, 0.0],
  [0.0, 0.1, 0.0, 1.0], [0.95, 0.0, 0.75, 0.1], [0.1, 0.3, 0.0, 0.7], [0.2, 0.4, 0.8, 0.3]
];
function atWeights(qi, T, causal) {
  const q = AT_EMB[qi], out = [];
  let denom = 0;
  for (let j = 0; j < AT_TOKENS.length; j++) {
    if (causal && j > qi) { out.push(0); continue; }
    let dot = 0; for (let d = 0; d < 4; d++) dot += q[d] * AT_EMB[j][d];
    const e = Math.exp(dot / (2 * T));
    out.push(e); denom += e;
  }
  return out.map(v => v / (denom || 1));
}
const attention = {
  id: 'attention', title: 'Transformer 注意力', sub: '自注意力 / 因果遮罩 / 逐词生成', category: '人工智能', color: '#FF6D00', emoji: '🤖',
  weights: atWeights, tokens: AT_TOKENS,
  params: [{ key: 'temp', label: '温度 T', min: 0.2, max: 3, step: 0.1, value: 1, fmt: v => v.toFixed(1) }],
  actions: [
    { label: s => s.gen ? '⏸ 停止生成' : '▶ 逐词生成', primary: true, on(s) { if (!s.gen) { s.shown = 1; s.query = 0; s.t = 0; } s.gen = !s.gen; } },
    { label: s => s.causal ? '因果遮罩:开' : '因果遮罩:关', on(s) { s.causal = !s.causal; } },
    { label: '重置', on(s) { s.gen = false; s.shown = AT_TOKENS.length; s.query = 4; s.t = 0; } }
  ],
  init() { return { query: 4, causal: true, gen: false, shown: AT_TOKENS.length, t: 0, W: 360, H: 500, buzz: 0 }; },
  step(s, p, dt) {
    if (!s.gen || dt <= 0) return;
    s.t += dt;
    const target = Math.min(1 + Math.floor(s.t * 1.4), AT_TOKENS.length);
    if (target !== s.shown) { s.shown = target; s.query = target - 1; s.buzz = (s.buzz | 0) + 1; }
    if (s.shown >= AT_TOKENS.length) s.gen = false;
  },
  onTap(s, p, x, y) {
    const W = s.W || 360, H = s.H || 500;
    const n = AT_TOKENS.length, cw = W * 0.88 / n, x0 = W * 0.06, ty = H * 0.12;
    if (y > ty - 20 && y < ty + 26) {
      const i = Math.floor((x - x0) / cw);
      if (i >= 0 && i < s.shown) s.query = i;
    }
  },
  draw(ctx, W, H, s, p) {
    s.W = W; s.H = H;
    ctx.fillStyle = '#131020'; ctx.fillRect(0, 0, W, H);
    const n = AT_TOKENS.length, cw = W * 0.88 / n, x0 = W * 0.06, ty = H * 0.12;
    const wts = atWeights(s.query, p.temp, s.causal);
    for (let i = 0; i < n; i++) {
      const revealed = i < s.shown;
      ctx.fillStyle = !revealed ? 'rgba(255,255,255,0.06)' : (i === s.query ? '#FF6D00' : 'rgba(255,255,255,0.14)');
      roundRect(ctx, x0 + i * cw + 2, ty - 16, cw - 4, 32, 8); ctx.fill();
      ctx.fillStyle = revealed ? '#fff' : 'rgba(255,255,255,0.25)';
      ctx.font = '12px sans-serif';
      ctx.fillText(AT_TOKENS[i], x0 + i * cw + cw / 2 - AT_TOKENS[i].length * 6, ty + 4);
    }
    // 注意力弧线：查询词 → 各词，粗细=权重
    for (let j = 0; j < n; j++) {
      if (j === s.query || j >= s.shown || wts[j] < 0.01) continue;
      const xa = x0 + s.query * cw + cw / 2, xb = x0 + j * cw + cw / 2;
      const lift = Math.abs(xb - xa) * 0.35 + 20;
      ctx.strokeStyle = 'rgba(255,171,64,' + Math.min(wts[j] * 1.6, 0.95) + ')';
      ctx.lineWidth = 1 + wts[j] * 7;
      ctx.beginPath(); ctx.moveTo(xa, ty + 18);
      ctx.quadraticCurveTo((xa + xb) / 2, ty + 18 + lift, xb, ty + 18); ctx.stroke();
    }
    // 权重条形图
    const by = H * 0.46, bh2 = H * 0.15;
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px sans-serif';
    ctx.fillText('「' + AT_TOKENS[s.query] + '」的注意力分布 (T=' + p.temp.toFixed(1) + ')', x0, by - 8);
    for (let j = 0; j < n; j++) {
      const bx2 = x0 + j * cw + 4, bw2 = cw - 8, hh = wts[j] * bh2;
      ctx.fillStyle = j >= s.shown ? 'rgba(255,255,255,0.06)' : 'rgba(255,171,64,0.9)';
      ctx.fillRect(bx2, by + bh2 - hh, bw2, hh);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      if (j < s.shown && wts[j] > 0.005) ctx.fillText((wts[j] * 100).toFixed(0), bx2 + 4, by + bh2 - hh - 3);
      ctx.fillText(AT_TOKENS[j], bx2, by + bh2 + 14);
    }
    // 完整注意力矩阵热图（行=查询）
    const my2 = H * 0.72, ms = cw * 0.7, mrh = H * 0.028, mx2 = x0;
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('注意力矩阵（行=查询词）', mx2, my2 - 6);
    for (let i2 = 0; i2 < n; i2++) {
      const row = atWeights(i2, p.temp, s.causal);
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = 'rgba(255,140,60,' + row[j] + ')';
        ctx.fillRect(mx2 + j * (ms + 2), my2 + i2 * (mrh + 2), ms, mrh);
      }
    }
    const top = wts.indexOf(Math.max.apply(null, wts));
    readout(ctx, [['查询词', AT_TOKENS[s.query]], ['最关注', AT_TOKENS[top]], ['遮罩', s.causal ? '因果（只看前文）' : '无（全可见）'], ['提示', '点词块切换查询']]);
  }
};

// 梯度下降：多极小值损失地形
function gdLoss(x, y) { return 0.5 * (x * x + y * y) + 0.9 * Math.sin(2.2 * x) + 0.9 * Math.sin(2.2 * y) + 2; }
function gdGrad(x, y) { return [x + 1.98 * Math.cos(2.2 * x), y + 1.98 * Math.cos(2.2 * y)]; }
const gradientdescent = {
  id: 'gradientdescent', title: '梯度下降', sub: '损失地形 / 学习率与动量', category: '人工智能', color: '#26A69A', emoji: '⛳',
  params: [
    { key: 'lr', label: '学习率', min: 0.01, max: 0.5, step: 0.01, value: 0.1, fmt: v => v.toFixed(2) },
    { key: 'beta', label: '动量 β', min: 0, max: 0.95, step: 0.05, value: 0.6, fmt: v => v.toFixed(2) }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 下降', primary: true, on(s) { s.running = !s.running; } },
    { label: '随机起点', on(s) { s.x = (Math.random() - 0.5) * 4; s.y = (Math.random() - 0.5) * 4; s.vx = 0; s.vy = 0; s.trail = [[s.x, s.y]]; s.done = false; } },
    { label: '重置', on(s) { s.x = 1.7; s.y = -1.6; s.vx = 0; s.vy = 0; s.trail = [[s.x, s.y]]; s.running = false; s.done = false; } }
  ],
  init() { return { x: 1.7, y: -1.6, vx: 0, vy: 0, trail: [[1.7, -1.6]], running: false, done: false, W: 360, H: 500, buzz: 0 }; },
  step(s, p, dt) {
    if (!s.running || s.done || dt <= 0) return;
    for (let k = 0; k < 2; k++) {
      const g = gdGrad(s.x, s.y);
      s.vx = p.beta * s.vx - p.lr * g[0];
      s.vy = p.beta * s.vy - p.lr * g[1];
      s.x = Math.max(-2.4, Math.min(2.4, s.x + s.vx));
      s.y = Math.max(-2.4, Math.min(2.4, s.y + s.vy));
      if (Math.hypot(g[0], g[1]) < 0.02 && Math.hypot(s.vx, s.vy) < 0.005) { s.done = true; s.running = false; s.buzz = (s.buzz | 0) + 1; break; }
    }
    s.trail.push([s.x, s.y]); if (s.trail.length > 400) s.trail.shift();
  },
  onTap(s, p, x, y) {
    const W = s.W || 360, H = s.H || 500, mw = Math.min(W * 0.9, H * 0.62), mx = (W - mw) / 2, my = H * 0.05;
    if (x < mx || x > mx + mw || y < my || y > my + mw * 0.82) return;
    s.x = (x - mx) / mw * 4.8 - 2.4; s.y = (y - my) / (mw * 0.82) * 4.8 - 2.4;
    s.vx = 0; s.vy = 0; s.trail = [[s.x, s.y]]; s.done = false;
  },
  draw(ctx, W, H, s, p) {
    s.W = W; s.H = H;
    ctx.fillStyle = '#0A1516'; ctx.fillRect(0, 0, W, H);
    const mw = Math.min(W * 0.9, H * 0.62), mh = mw * 0.82, mx = (W - mw) / 2, my = H * 0.05, cell = 9;
    for (let gy = 0; gy < mh; gy += cell) for (let gx = 0; gx < mw; gx += cell) {
      const wx = gx / mw * 4.8 - 2.4, wy = gy / mh * 4.8 - 2.4;
      const L = gdLoss(wx, wy), t = Math.max(0, Math.min(1, (L - 0.2) / 6.5));
      const band = (L * 1.4) % 1 < 0.09 ? 0.75 : 1;   // 等高线带
      ctx.fillStyle = 'rgb(' + Math.round((30 + 215 * t) * band) + ',' + Math.round((70 + 130 * (1 - Math.abs(t - 0.45) * 2)) * band) + ',' + Math.round((110 * (1 - t) + 30) * band) + ')';
      ctx.fillRect(mx + gx, my + gy, cell, cell);
    }
    const SX = wx => mx + (wx + 2.4) / 4.8 * mw, SY = wy => my + (wy + 2.4) / 4.8 * mh;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.beginPath();
    s.trail.forEach((t2, i) => { i ? ctx.lineTo(SX(t2[0]), SY(t2[1])) : ctx.moveTo(SX(t2[0]), SY(t2[1])); });
    ctx.stroke();
    ctx.fillStyle = '#FFEB3B'; ctx.beginPath(); ctx.arc(SX(s.x), SY(s.y), 8, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(mx, my, mw, mh);
    readout(ctx, [['当前损失', gdLoss(s.x, s.y).toFixed(3)], ['步数', s.trail.length + ''], ['状态', s.done ? '已收敛（局部极小）🎉' : s.running ? '下降中…' : '点地形选起点'], ['提示', '大学习率会震荡越谷']]);
  }
};

// 过拟合与欠拟合：多项式最小二乘
function polyFit(xs, ys, deg) {
  const n = deg + 1;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) { let sum = 0; xs.forEach(x => { sum += Math.pow(x, i + j); }); A[i][j] = sum; }
    A[i][i] += 1e-7;
    let sb = 0; xs.forEach((x, k) => { sb += Math.pow(x, i) * ys[k]; }); b[i] = sb;
  }
  return gaussSolve(A, b);
}
function polyEval(c, x) { let v = 0, p2 = 1; for (let i = 0; i < c.length; i++) { v += c[i] * p2; p2 *= x; } return v; }
function ofData() {
  const f = x => Math.sin(x * 2.5) * 0.7, tr = [], te = [];
  for (let i = 0; i < 12; i++) { const x = -1 + 2 * i / 11; tr.push({ x, y: f(x) + (Math.random() - 0.5) * 0.35 }); }
  for (let i = 0; i < 12; i++) { const x = -0.93 + 1.86 * i / 11; te.push({ x, y: f(x) + (Math.random() - 0.5) * 0.35 }); }
  return { tr, te };
}
const overfit = {
  id: 'overfit', title: '过拟合与欠拟合', sub: '模型复杂度 / 泛化能力', category: '人工智能', color: '#EC407A', emoji: '📉',
  params: [{ key: 'deg', label: '多项式阶数', min: 1, max: 11, step: 1, value: 3, fmt: v => v.toFixed(0) + ' 阶' }],
  actions: [{ label: '重新采样数据', primary: true, on(s) { const d = ofData(); s.tr = d.tr; s.te = d.te; } }],
  init() { const d = ofData(); return { tr: d.tr, te: d.te }; },
  step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#1A1220'; ctx.fillRect(0, 0, W, H);
    const deg = Math.round(p.deg);
    const c = polyFit(s.tr.map(d => d.x), s.tr.map(d => d.y), deg);
    const mx = W * 0.07, my = H * 0.06, mw = W * 0.86, mh = H * 0.56;
    const SX = x => mx + (x + 1.1) / 2.2 * mw, SY = y => my + mh / 2 - y * mh * 0.38;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(mx, my, mw, mh);
    // 真实函数（虚线）
    ctx.strokeStyle = 'rgba(120,220,140,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const x = -1.05 + 2.1 * i / 80, Y = SY(Math.sin(x * 2.5) * 0.7); i ? ctx.lineTo(SX(x), Y) : ctx.moveTo(SX(x), Y); }
    ctx.stroke(); ctx.setLineDash([]);
    // 拟合曲线
    ctx.strokeStyle = '#FF4081'; ctx.lineWidth = 2.5; ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 120; i++) {
      const x = -1.05 + 2.1 * i / 120, y = polyEval(c, x);
      if (y < -3 || y > 3) { started = false; continue; }
      const X = SX(x), Y = SY(y);
      started ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); started = true;
    }
    ctx.stroke();
    s.tr.forEach(d => { ctx.fillStyle = '#4FC3F7'; ctx.beginPath(); ctx.arc(SX(d.x), SY(d.y), 4, 0, 7); ctx.fill(); });
    s.te.forEach(d => { ctx.fillStyle = 'rgba(255,183,77,0.9)'; ctx.beginPath(); ctx.arc(SX(d.x), SY(d.y), 3, 0, 7); ctx.fill(); });
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#4FC3F7'; ctx.fillText('● 训练点', mx + 6, my + mh + 18);
    ctx.fillStyle = '#FFB74D'; ctx.fillText('● 测试点', mx + 76, my + mh + 18);
    ctx.fillStyle = 'rgba(120,220,140,0.8)'; ctx.fillText('--- 真实规律', mx + 146, my + mh + 18);
    const mse = pts => pts.reduce((a, d) => a + Math.pow(polyEval(c, d.x) - d.y, 2), 0) / pts.length;
    const trE = mse(s.tr), teE = mse(s.te);
    const verdict = trE > 0.06 ? '欠拟合（太简单）' : (teE > trE * 3 && deg > 5 ? '过拟合（背答案）' : '拟合良好 ✓');
    // 误差条
    const by2 = H * 0.72, bw3 = W * 0.36;
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('训练误差 ' + trE.toFixed(3), mx, by2 - 4);
    ctx.fillStyle = '#4FC3F7'; ctx.fillRect(mx, by2, Math.min(trE * 3, 1) * bw3, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('测试误差 ' + teE.toFixed(3), mx + W * 0.46, by2 - 4);
    ctx.fillStyle = '#FFB74D'; ctx.fillRect(mx + W * 0.46, by2, Math.min(teE * 3, 1) * bw3, 10);
    readout(ctx, [['阶数', deg + ''], ['训练/测试误差', trE.toFixed(3) + ' / ' + teE.toFixed(3)], ['诊断', verdict]]);
  }
};

// K-means 聚类
const KM_COLORS = ['#EF5350', '#42A5F5', '#66BB6A', '#FFCA28', '#AB47BC'];
function kmData() {
  const pts = [];
  for (let b = 0; b < 3; b++) {
    const cx = 0.18 + Math.random() * 0.64, cy = 0.18 + Math.random() * 0.64;
    for (let i = 0; i < 16; i++) pts.push({ x: Math.min(Math.max(cx + (Math.random() - 0.5) * 0.24, 0.02), 0.98), y: Math.min(Math.max(cy + (Math.random() - 0.5) * 0.24, 0.02), 0.98), c: 0 });
  }
  return pts;
}
function kmInitCenters(s, k) {
  s.cent = [];
  for (let i = 0; i < k; i++) { const p2 = s.pts[Math.floor(Math.random() * s.pts.length)] || { x: Math.random(), y: Math.random() }; s.cent.push({ x: Math.min(p2.x + i * 0.013, 0.99), y: p2.y }); }
  s.moved = 1; s.iter = 0;
}
function kmIterate(s, k) {
  if (!s.cent || s.cent.length !== k) kmInitCenters(s, k);
  s.pts.forEach(pt => { let bi = 0, bd = 1e9; s.cent.forEach((c, i) => { const dx = pt.x - c.x, dy = pt.y - c.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; bi = i; } }); pt.c = bi; });
  let moved = 0;
  s.cent.forEach((c, i) => {
    const mine = s.pts.filter(pt => pt.c === i);
    if (!mine.length) return;
    const nx2 = mine.reduce((a, b2) => a + b2.x, 0) / mine.length, ny2 = mine.reduce((a, b2) => a + b2.y, 0) / mine.length;
    moved += Math.hypot(nx2 - c.x, ny2 - c.y);
    c.x = nx2; c.y = ny2;
  });
  s.moved = moved; s.iter++;
  return moved;
}
const kmeans = {
  id: 'kmeans', title: 'K-means 聚类', sub: '无监督学习 / 点击加点', category: '人工智能', color: '#5C6BC0', emoji: '🎯',
  params: [{ key: 'k', label: '簇数 K', min: 2, max: 5, step: 1, value: 3, fmt: v => v.toFixed(0) }],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 自动聚类', primary: true, on(s) { s.running = !s.running; s.timer = 9; } },
    { label: '迭代一步', on(s, p) { kmIterate(s, Math.round(p.k)); } },
    { label: '重置中心', on(s, p) { kmInitCenters(s, Math.round(p.k)); } },
    { label: '随机数据', on(s, p) { s.pts = kmData(); kmInitCenters(s, Math.round(p.k)); } }
  ],
  init() { const s = { pts: kmData(), running: false, timer: 0, W: 360, H: 500, buzz: 0 }; kmInitCenters(s, 3); return s; },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    s.timer += dt;
    if (s.timer > 0.7) {
      s.timer = 0;
      const moved = kmIterate(s, Math.round(p.k));
      if (moved < 1e-4 && s.iter > 1) { s.running = false; s.buzz = (s.buzz | 0) + 1; }
    }
  },
  onTap(s, p, x, y) {
    const W = s.W || 360, H = s.H || 500, mx = W * 0.05, my = H * 0.05, mw = W * 0.9, mh = H * 0.62;
    if (x < mx || x > mx + mw || y < my || y > my + mh) return;
    s.pts.push({ x: (x - mx) / mw, y: (y - my) / mh, c: 0 });
  },
  draw(ctx, W, H, s, p) {
    s.W = W; s.H = H;
    ctx.fillStyle = '#10131F'; ctx.fillRect(0, 0, W, H);
    const mx = W * 0.05, my = H * 0.05, mw = W * 0.9, mh = H * 0.62, k = Math.round(p.k);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(mx, my, mw, mh);
    const valid = s.cent && s.cent.length === k && s.iter > 0;
    s.pts.forEach(pt => {
      if (valid) {
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
        const c = s.cent[pt.c] || s.cent[0];
        ctx.beginPath(); ctx.moveTo(mx + pt.x * mw, my + pt.y * mh); ctx.lineTo(mx + c.x * mw, my + c.y * mh); ctx.stroke();
      }
      ctx.fillStyle = valid ? KM_COLORS[pt.c % 5] : 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(mx + pt.x * mw, my + pt.y * mh, 4, 0, 7); ctx.fill();
    });
    (s.cent || []).forEach((c, i) => {
      ctx.fillStyle = KM_COLORS[i % 5];
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath();
      const cx2 = mx + c.x * mw, cy2 = my + c.y * mh;
      for (let a2 = 0; a2 < 4; a2++) { const ang = a2 * Math.PI / 2 + Math.PI / 4; a2 ? ctx.lineTo(cx2 + Math.cos(ang) * 10, cy2 + Math.sin(ang) * 10) : ctx.moveTo(cx2 + Math.cos(ang) * 10, cy2 + Math.sin(ang) * 10); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    readout(ctx, [['数据点', s.pts.length + ''], ['迭代次数', (s.iter || 0) + ''], ['中心移动量', s.moved != null ? s.moved.toFixed(4) : '—'], ['状态', !s.running && s.moved < 1e-4 && s.iter > 1 ? '已收敛 🎉' : (s.running ? '聚类中…' : '点画布加点')]]);
  }
};

// 线性回归：梯度下降拟合直线
const linreg = {
  id: 'linreg', title: '线性回归', sub: '梯度下降拟合 / 残差', category: '人工智能', color: '#FFA000', emoji: '📐',
  params: [{ key: 'lr', label: '学习率', min: 0.05, max: 1.8, step: 0.05, value: 0.5, fmt: v => v.toFixed(2) }],
  actions: [
    { label: s => s.training ? '⏸ 暂停' : '▶ 拟合', primary: true, on(s) { s.training = !s.training; } },
    { label: '清空点', on(s) { s.pts = []; s.w = 0.2; s.b = 0.5; s.epoch = 0; } },
    { label: '示例数据', on(s) { s.pts = []; for (let i = 0; i < 14; i++) { const x = Math.random(); s.pts.push({ x, y: 0.25 + 0.55 * x + (Math.random() - 0.5) * 0.16 }); } s.w = 0.2; s.b = 0.5; s.epoch = 0; } }
  ],
  init() { const s = { pts: [], w: 0.2, b: 0.5, training: false, epoch: 0, W: 360, H: 500 }; for (let i = 0; i < 14; i++) { const x = Math.random(); s.pts.push({ x, y: 0.25 + 0.55 * x + (Math.random() - 0.5) * 0.16 }); } return s; },
  step(s, p, dt) {
    if (!s.training || dt <= 0 || !s.pts.length) return;
    for (let k = 0; k < 4; k++) {
      let gw = 0, gb = 0;
      s.pts.forEach(pt => { const e = s.w * pt.x + s.b - pt.y; gw += e * pt.x; gb += e; });
      s.w -= p.lr * gw / s.pts.length;
      s.b -= p.lr * gb / s.pts.length;
      s.epoch++;
    }
    // 发散保护：学习率过大时震荡放大，夹住数值并提示（教学上仍可见"发散"）
    if (!isFinite(s.w) || Math.abs(s.w) > 50 || Math.abs(s.b) > 50) { s.w = Math.max(-50, Math.min(50, s.w || 0)); s.b = Math.max(-50, Math.min(50, s.b || 0)); s.diverged = true; s.training = false; }
    else s.diverged = false;
  },
  onTap(s, p, x, y) {
    const W = s.W || 360, H = s.H || 500, mx = W * 0.07, my = H * 0.05, mw = W * 0.86, mh = H * 0.6;
    if (x < mx || x > mx + mw || y < my || y > my + mh) return;
    s.pts.push({ x: (x - mx) / mw, y: 1 - (y - my) / mh });
  },
  draw(ctx, W, H, s, p) {
    s.W = W; s.H = H;
    ctx.fillStyle = '#171310'; ctx.fillRect(0, 0, W, H);
    const mx = W * 0.07, my = H * 0.05, mw = W * 0.86, mh = H * 0.6;
    const SX = x => mx + x * mw, SY = y => my + (1 - y) * mh;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(mx, my, mw, mh);
    // 残差竖线
    s.pts.forEach(pt => {
      const yh = s.w * pt.x + s.b;
      ctx.strokeStyle = 'rgba(255,82,82,0.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(SX(pt.x), SY(pt.y)); ctx.lineTo(SX(pt.x), SY(Math.max(0, Math.min(1, yh)))); ctx.stroke();
      ctx.fillStyle = '#FFD54F'; ctx.beginPath(); ctx.arc(SX(pt.x), SY(pt.y), 4, 0, 7); ctx.fill();
    });
    // 拟合直线
    ctx.strokeStyle = '#FF6E40'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(SX(0), SY(Math.max(0, Math.min(1, s.b)))); ctx.lineTo(SX(1), SY(Math.max(0, Math.min(1, s.w + s.b)))); ctx.stroke();
    let mse = 0; s.pts.forEach(pt => { const e = s.w * pt.x + s.b - pt.y; mse += e * e; });
    mse = s.pts.length ? mse / s.pts.length : 0;
    readout(ctx, [['模型', 'y = ' + s.w.toFixed(2) + '·x + ' + s.b.toFixed(2)], ['均方误差', mse.toFixed(4)], ['迭代', s.epoch + ''], ['状态', s.diverged ? '发散！调小学习率' : '点画布加点，红线=残差']]);
  }
};

// 光的三原色
const colormix = {
  id: 'colormix', title: '光的三原色', sub: '红绿蓝加色混合', category: '波动与光', color: '#E91E63', emoji: '🔴',
  params: [
    { key: 'r', label: '红光', min: 0, max: 255, step: 5, value: 255, fmt: v => v.toFixed(0) },
    { key: 'g', label: '绿光', min: 0, max: 255, step: 5, value: 255, fmt: v => v.toFixed(0) },
    { key: 'b', label: '蓝光', min: 0, max: 255, step: 5, value: 255, fmt: v => v.toFixed(0) }
  ],
  actions: [],
  init() { return {}; },
  step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.36, R = Math.min(W, H) * 0.19, off = R * 0.55;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    const circle = (x, y, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill(); };
    circle(cx, cy - off, 'rgb(' + Math.round(p.r) + ',0,0)');
    circle(cx - off * 0.87, cy + off * 0.5, 'rgb(0,' + Math.round(p.g) + ',0)');
    circle(cx + off * 0.87, cy + off * 0.5, 'rgb(0,0,' + Math.round(p.b) + ')');
    ctx.globalCompositeOperation = prev || 'source-over';
    const sy2 = H * 0.72;
    ctx.fillStyle = 'rgb(' + Math.round(p.r) + ',' + Math.round(p.g) + ',' + Math.round(p.b) + ')';
    ctx.fillRect(W * 0.35, sy2, W * 0.3, 44);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(W * 0.35, sy2, W * 0.3, 44);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '11px sans-serif'; ctx.fillText('三色叠加结果', W * 0.37, sy2 + 60);
    const name = p.r > 200 && p.g > 200 && p.b > 200 ? '白光！' : p.r > 200 && p.g > 200 && p.b < 60 ? '黄色' : p.r > 200 && p.b > 200 && p.g < 60 ? '品红' : p.g > 200 && p.b > 200 && p.r < 60 ? '青色' : 'RGB(' + Math.round(p.r) + ',' + Math.round(p.g) + ',' + Math.round(p.b) + ')';
    readout(ctx, [['混合色', name], ['原理', '加色混合（光越加越亮）'], ['应用', '手机屏幕 / 舞台灯光']]);
  }
};

// 电解水
const electrolysis = {
  id: 'electrolysis', title: '电解水', sub: 'H₂:O₂ = 2:1', category: '化学', color: '#00B0FF', emoji: '⚗️',
  params: [{ key: 'current', label: '电流', min: 0.5, max: 3, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) + ' A' }],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 通电', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s) { s.h2 = 0; s.o2 = 0; s.bubbles = []; s.running = false; s.full = false; } }
  ],
  init() { return { h2: 0, o2: 0, bubbles: [], running: false, full: false, buzz: 0 }; },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    s.h2 = Math.min(s.h2 + p.current * dt * 0.035, 1);
    s.o2 = Math.min(s.o2 + p.current * dt * 0.0175, 1);
    if (Math.random() < dt * p.current * 6 && s.bubbles.length < 24) {
      const left = Math.random() < 0.67;
      s.bubbles.push({ x: left ? 0.26 : 0.74, y: 0.95, sp: 0.3 + Math.random() * 0.2 });
    }
    s.bubbles.forEach(b2 => { b2.y -= b2.sp * dt; });
    s.bubbles = s.bubbles.filter(b2 => b2.y > 0.15);
    if (s.h2 >= 1 && !s.full) { s.full = true; s.buzz = (s.buzz | 0) + 1; }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E1F5FE'; ctx.fillRect(0, 0, W, H);
    const top = H * 0.1, bot = H * 0.78, tankX = W * 0.12, tankW = W * 0.76;
    ctx.fillStyle = '#B3E5FC'; ctx.fillRect(tankX, top + 30, tankW, bot - top - 30);
    ctx.strokeStyle = '#0277BD'; ctx.lineWidth = 3; ctx.strokeRect(tankX, top + 30, tankW, bot - top - 30);
    const tube = (cx2, fill, label, col) => {
      const tw = 40, th = H * 0.42, ty = top + 14;
      ctx.fillStyle = '#B3E5FC'; ctx.fillRect(cx2 - tw / 2, ty, tw, th);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(cx2 - tw / 2, ty, tw, th * fill);
      ctx.strokeStyle = '#0277BD'; ctx.lineWidth = 2.5; ctx.strokeRect(cx2 - tw / 2, ty, tw, th);
      ctx.fillStyle = col; ctx.font = 'bold 13px sans-serif'; ctx.fillText(label, cx2 - 12, ty - 6);
    };
    tube(tankX + tankW * 0.26, s.h2, 'H₂', '#E53935');
    tube(tankX + tankW * 0.74, s.o2, 'O₂', '#1E88E5');
    ctx.fillStyle = '#37474F';
    ctx.fillRect(tankX + tankW * 0.26 - 4, bot - 50, 8, 44);
    ctx.fillRect(tankX + tankW * 0.74 - 4, bot - 50, 8, 44);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#E53935'; ctx.fillText('− 阴极', tankX + tankW * 0.26 - 22, bot + 18);
    ctx.fillStyle = '#1E88E5'; ctx.fillText('+ 阳极', tankX + tankW * 0.74 - 22, bot + 18);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    s.bubbles.forEach(b2 => { ctx.beginPath(); ctx.arc(tankX + b2.x * tankW, top + 30 + b2.y * (bot - top - 60), 3, 0, 7); ctx.fill(); });
    readout(ctx, [['氢气(阴极)', (s.h2 * 100).toFixed(0) + '%'], ['氧气(阳极)', (s.o2 * 100).toFixed(0) + '%'], ['体积比', s.o2 > 0.01 ? (s.h2 / s.o2).toFixed(1) + ' : 1（≈2:1）' : '—'], ['方程式', '2H₂O →通电→ 2H₂↑+O₂↑']]);
  }
};

// 月相
const MOON_NAMES = ['新月', '娥眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
const moonphase = {
  id: 'moonphase', title: '月相变化', sub: '月球公转 / 八种月相', category: '力学', color: '#5C6BC0', emoji: '🌙',
  params: [{ key: 'speed', label: '公转速度', min: 0.1, max: 2, step: 0.1, value: 0.5, fmt: v => v.toFixed(1) }],
  actions: [{ label: s => s.running ? '⏸ 暂停' : '▶ 公转', primary: true, on(s) { s.running = !s.running; } }],
  init() { return { ang: 0, running: true }; },
  step(s, p, dt) { if (s.running && dt > 0) s.ang = (s.ang + p.speed * dt * 0.8) % 6.2832; },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#0A0E24'; ctx.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.34, R = Math.min(W, H) * 0.24;
    for (let i = 0; i < 5; i++) {
      const y = cy - R + i * R / 2;
      arrowSeg(ctx, W * 0.02, y, W * 0.14, y, 'rgba(255,213,79,0.6)', 2);
    }
    ctx.fillStyle = '#FFD54F'; ctx.font = '12px sans-serif'; ctx.fillText('☀ 阳光', W * 0.02, cy - R - 12);
    ctx.fillStyle = '#1E88E5'; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#66BB6A'; ctx.beginPath(); ctx.arc(cx - 4, cy - 4, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    const mx2 = cx + R * Math.cos(s.ang), my2 = cy + R * Math.sin(s.ang);
    ctx.fillStyle = '#616161'; ctx.beginPath(); ctx.arc(mx2, my2, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#E0E0E0'; ctx.beginPath(); ctx.arc(mx2, my2, 9, Math.PI / 2, Math.PI * 1.5); ctx.fill();
    // 下方：从地球看到的月相
    const pv = H * 0.75, pr = H * 0.11;
    const phase = ((s.ang + Math.PI) % 6.2832) / 6.2832;
    const ill = (1 - Math.cos(phase * 6.2832)) / 2;
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx, pv, pr, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, pv, pr, 0, 7); ctx.clip();
    const waxing = phase < 0.5, term = pr * (2 * ill - 1);
    ctx.fillStyle = '#ECEFF1';
    ctx.beginPath();
    if (waxing) { ctx.arc(cx, pv, pr, -Math.PI / 2, Math.PI / 2); ctx.ellipse(cx, pv, Math.abs(term), pr, 0, Math.PI / 2, Math.PI * 1.5, term > 0); }
    else { ctx.arc(cx, pv, pr, Math.PI / 2, Math.PI * 1.5); ctx.ellipse(cx, pv, Math.abs(term), pr, 0, -Math.PI / 2, Math.PI / 2, term > 0); }
    ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, pv, pr, 0, 7); ctx.stroke();
    const idx = Math.round(phase * 8) % 8;
    ctx.fillStyle = '#B0BEC5'; ctx.font = '12px sans-serif'; ctx.fillText('地球上看到的月相', cx - 52, pv - pr - 10);
    readout(ctx, [['月相', MOON_NAMES[idx]], ['照亮比例', (ill * 100).toFixed(0) + '%'], ['周期', '农历一个月 ≈ 29.5 天']]);
  }
};

// 回声测距（声呐）
const echo = {
  id: 'echo', title: '回声测距', sub: '声呐 / s = v·t ÷ 2', category: '波动与光', color: '#0097A7', emoji: '📡',
  params: [{ key: 'depth', label: '海底深度', min: 150, max: 1500, step: 50, value: 600, fmt: v => v.toFixed(0) + ' m' }],
  actions: [{ label: s => s.pulse ? '脉冲飞行中…' : '▶ 发射声脉冲', primary: true, on(s) { if (!s.pulse) { s.pulse = { d: 0, dir: 1 }; s.t = 0; s.result = null; } } }],
  init() { return { pulse: null, t: 0, result: null, buzz: 0 }; },
  step(s, p, dt) {
    if (dt <= 0 || !s.pulse) return;
    s.t += dt;
    s.pulse.d += 1500 * dt * s.pulse.dir * 0.4;
    if (s.pulse.dir > 0 && s.pulse.d >= p.depth) { s.pulse.d = p.depth; s.pulse.dir = -1; }
    if (s.pulse.dir < 0 && s.pulse.d <= 0) {
      s.result = { t: s.t * 0.4 };
      s.pulse = null; s.buzz = (s.buzz | 0) + 1;
    }
  },
  draw(ctx, W, H, s, p) {
    const seaTop = H * 0.16, seaBot = H * 0.82;
    ctx.fillStyle = '#B3E5FC'; ctx.fillRect(0, 0, W, seaTop);
    for (let y = seaTop; y < seaBot; y += 4) {
      const f = (y - seaTop) / (seaBot - seaTop);
      ctx.fillStyle = 'rgb(' + Math.round(79 - 78 * f) + ',' + Math.round(195 - 108 * f) + ',' + Math.round(247 - 92 * f) + ')';
      ctx.fillRect(0, y, W, 4);
    }
    ctx.fillStyle = '#5D4037'; ctx.fillRect(0, seaBot, W, H - seaBot);
    ctx.fillStyle = '#37474F'; ctx.fillRect(W * 0.4, seaTop - 16, W * 0.2, 16);
    ctx.fillStyle = '#78909C'; ctx.fillRect(W * 0.46, seaTop - 30, W * 0.05, 14);
    if (s.pulse) {
      const py = seaTop + s.pulse.d / p.depth * (seaBot - seaTop);
      ctx.strokeStyle = s.pulse.dir > 0 ? '#FFEB3B' : '#00E676'; ctx.lineWidth = 2.5;
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = 1 - k * 0.3;
        ctx.beginPath(); ctx.arc(W * 0.5, py - s.pulse.dir * k * 10, 8 + k * 6, s.pulse.dir > 0 ? 0.3 : Math.PI + 0.3, s.pulse.dir > 0 ? Math.PI - 0.3 : 6.2832 - 0.3); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    readout(ctx, [['声速(水中)', '1500 m/s'], ['往返时间', s.result ? s.result.t.toFixed(2) + ' s' : (s.pulse ? (s.t * 0.4).toFixed(2) + ' s…' : '—')], ['测得深度', s.result ? 'v·t÷2 = ' + (1500 * s.result.t / 2).toFixed(0) + ' m' : '—'], ['实际深度', p.depth + ' m']]);
  }
};

// 波的叠加
const wavesuperpose = {
  id: 'wavesuperpose', title: '波的叠加', sub: '同相增强 / 反相抵消', category: '波动与光', color: '#3F51B5', emoji: '➿',
  params: [
    { key: 'freqRatio', label: '频率比 f₂/f₁', min: 0.5, max: 3, step: 0.1, value: 1, fmt: v => v.toFixed(1) },
    { key: 'phase', label: '相位差', min: 0, max: 360, step: 10, value: 0, fmt: v => v.toFixed(0) + '°' },
    { key: 'amp2', label: '波2振幅', min: 0.2, max: 1, step: 0.1, value: 1, fmt: v => v.toFixed(1) }
  ],
  actions: [],
  init() { return { t: 0 }; },
  step(s, p, dt) { if (dt > 0) s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E8EAF6'; ctx.fillRect(0, 0, W, H);
    const left = W * 0.05, right = W * 0.95, L = right - left;
    const ph = p.phase * Math.PI / 180, k1 = 0.05, om = 3;
    const w1 = x => Math.sin(k1 * x - om * s.t);
    const w2 = x => p.amp2 * Math.sin(k1 * p.freqRatio * x - om * p.freqRatio * s.t + ph);
    const lane = (y0, fn, col, amp, label) => {
      ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, y0); ctx.lineTo(right, y0); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const x = i / 200 * L, Y = y0 - fn(x) * amp; i ? ctx.lineTo(left + x, Y) : ctx.moveTo(left + x, Y); }
      ctx.stroke();
      ctx.fillStyle = col; ctx.font = '11px sans-serif'; ctx.fillText(label, left + 4, y0 - amp - 4);
    };
    lane(H * 0.15, w1, '#E53935', H * 0.07, '波 1');
    lane(H * 0.4, w2, '#1E88E5', H * 0.07, '波 2');
    lane(H * 0.72, x => w1(x) + w2(x), '#3F51B5', H * 0.09, '叠加 y₁+y₂');
    const tips = p.freqRatio === 1 ? (p.phase < 20 || p.phase > 340 ? '同相 → 振幅加倍（相长）' : Math.abs(p.phase - 180) < 20 ? '反相 → 相互抵消（相消）' : '部分叠加') : '不同频率 → 复杂波形/拍';
    readout(ctx, [['相位差', p.phase + '°'], ['现象', tips]]);
  }
};

// 小孔成像
const pinhole = {
  id: 'pinhole', title: '小孔成像', sub: '光沿直线传播 / 倒立实像', category: '波动与光', color: '#FF8F00', emoji: '🕯️',
  params: [
    { key: 'objDist', label: '蜡烛距离', min: 3, max: 10, step: 0.5, value: 6, fmt: v => v.toFixed(1) },
    { key: 'aperture', label: '孔径大小', min: 1, max: 10, step: 0.5, value: 2, fmt: v => v.toFixed(1) }
  ],
  actions: [],
  init() { return { t: 0 }; },
  step(s, p, dt) { if (dt > 0) s.t += dt; },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#1A1408'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.42, holeX = W * 0.52, screenX = W * 0.88;
    const candleX = holeX - p.objDist * W * 0.045;
    const hpx = H * 0.11, flick = 1 + Math.sin(s.t * 8) * 0.12;
    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(candleX - 6, cy - hpx * 0.3, 12, hpx * 1.3);
    ctx.fillStyle = '#FFB300'; ctx.beginPath(); ctx.ellipse(candleX, cy - hpx * 0.55, 6, 13 * flick, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#FFF176'; ctx.beginPath(); ctx.ellipse(candleX, cy - hpx * 0.5, 3, 7 * flick, 0, 0, 7); ctx.fill();
    const hole = p.aperture * 2.2;
    ctx.fillStyle = '#37474F';
    ctx.fillRect(holeX - 4, H * 0.06, 8, cy - hole / 2 - H * 0.06);
    ctx.fillRect(holeX - 4, cy + hole / 2, 8, H * 0.72 - cy - hole / 2);
    ctx.fillStyle = '#455A64'; ctx.fillRect(screenX, H * 0.06, 6, H * 0.66);
    const di = screenX - holeX, dof = holeX - candleX, mag = di / dof;
    const tipY = cy - hpx * 0.55, baseY = cy + hpx;
    [[tipY, '#FFB300'], [baseY, '#90A4AE']].forEach(src => {
      [-hole / 2, hole / 2].forEach(ho => {
        const slope = (cy + ho - src[0]) / dof;
        ctx.strokeStyle = src[1]; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(candleX, src[0]); ctx.lineTo(holeX, cy + ho); ctx.lineTo(screenX, cy + ho + slope * di); ctx.stroke();
        ctx.globalAlpha = 1;
      });
    });
    const imgTip = cy + (cy - tipY) * mag, imgBase = cy + (cy - baseY) * mag;
    const blur = hole * (1 + mag);
    ctx.fillStyle = 'rgba(236,239,241,0.8)'; ctx.fillRect(screenX - 5, Math.min(imgTip, imgBase), 5, Math.abs(imgBase - imgTip));
    ctx.fillStyle = 'rgba(255,179,0,' + Math.max(0.25, 0.9 - hole * 0.06) + ')';
    ctx.beginPath(); ctx.ellipse(screenX - 3, imgTip, Math.min(3 + blur * 0.25, 14), Math.min(8 + blur * 0.3, 20), 0, 0, 7); ctx.fill();
    readout(ctx, [['像的方向', '倒立（光沿直线传播）'], ['放大率', mag.toFixed(2) + '×'], ['清晰度', p.aperture < 2.5 ? '小孔 → 清晰但暗' : p.aperture > 6 ? '大孔 → 亮但模糊' : '适中'], ['出处', '《墨经》两千年前记载']]);
  }
};

// 摩擦力探究：静摩擦峰值 → 动摩擦平台
const friction2 = {
  id: 'friction2', title: '摩擦力探究', sub: '静摩擦峰值 / 动摩擦平台', category: '力学', color: '#8D6E63', emoji: '🧲',
  params: [
    { key: 'mus', label: '静摩擦系数', min: 0.2, max: 1, step: 0.05, value: 0.6, fmt: v => v.toFixed(2) },
    { key: 'muk', label: '动摩擦系数', min: 0.1, max: 0.8, step: 0.05, value: 0.4, fmt: v => v.toFixed(2) },
    { key: 'mass', label: '质量', min: 1, max: 10, step: 0.5, value: 4, fmt: v => v.toFixed(1) + ' kg' }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 逐渐加力', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s) { s.F = 0; s.x = 0.1; s.v = 0; s.moving = false; s.hist = []; s.t = 0; s.running = false; } }
  ],
  init() { return { F: 0, x: 0.1, v: 0, moving: false, hist: [], t: 0, running: false, buzz: 0 }; },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    s.t += dt;
    const N = p.mass * 9.8, fsMax = p.mus * N, fk = p.muk * N;
    if (!s.moving) {
      s.F += dt * 8;
      if (s.F > fsMax) { s.moving = true; s.buzz = (s.buzz | 0) + 1; }
      s.hist.push({ t: s.t, F: s.F, f: Math.min(s.F, fsMax) });
    } else {
      const a = (s.F - fk) / p.mass;
      s.v += a * dt; s.x += s.v * dt * 0.04;
      s.hist.push({ t: s.t, F: s.F, f: fk });
      if (s.x > 0.75) s.running = false;
    }
    while (s.hist.length > 500) s.hist.shift();
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#EFEBE9'; ctx.fillRect(0, 0, W, H);
    const groundY = H * 0.34;
    ctx.fillStyle = '#BCAAA4'; ctx.fillRect(0, groundY, W, 10);
    const bx = W * (0.08 + s.x * 0.7), bw2 = 60;
    ctx.fillStyle = '#6D4C41'; ctx.fillRect(bx, groundY - 44, bw2, 44);
    if (s.F > 0.5) arrowSeg(ctx, bx + bw2, groundY - 22, bx + bw2 + Math.min(s.F * 1.6, 80), groundY - 22, '#1E88E5', 4);
    const N = p.mass * 9.8, fNow = s.moving ? p.muk * N : Math.min(s.F, p.mus * N);
    if (fNow > 0.5) arrowSeg(ctx, bx, groundY - 8, bx - Math.min(fNow * 1.6, 80), groundY - 8, '#E53935', 4);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#1E88E5'; ctx.fillText('拉力F', bx + bw2 + 8, groundY - 32);
    ctx.fillStyle = '#E53935'; ctx.fillText('摩擦f', bx - 46, groundY - 16);
    const gx = W * 0.08, gy = H * 0.88, gw = W * 0.84, gh = H * 0.4;
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - gh); ctx.stroke();
    const fMax2 = p.mus * 10 * 9.8;
    if (s.hist.length > 1) {
      const t0 = Math.max(0, s.t - 10);
      const wf = (fn, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath(); let st2 = false; s.hist.forEach(h2 => { if (h2.t < t0) return; const X = gx + (h2.t - t0) / 10 * gw, Y = gy - fn(h2) / fMax2 * gh; st2 ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); st2 = true; }); ctx.stroke(); };
      wf(h2 => h2.F, '#1E88E5');
      wf(h2 => h2.f, '#E53935');
    }
    ctx.fillStyle = '#607D8B'; ctx.fillText('蓝=拉力 红=摩擦力（爬升→峰值→跌到平台）', gx + 4, gy - gh - 6);
    readout(ctx, [['拉力 F', s.F.toFixed(1) + ' N'], ['摩擦力 f', fNow.toFixed(1) + ' N'], ['最大静摩擦', (p.mus * N).toFixed(1) + ' N'], ['状态', s.moving ? '滑动中（f=μkN 恒定）' : '静止（f 随 F 增大）']]);
  }
};

// 冲量与缓冲
const impulse = {
  id: 'impulse', title: '冲量与缓冲', sub: 'FΔt=Δp / 缓冲减小峰值力', category: '力学', color: '#D84315', emoji: '🥚',
  params: [
    { key: 'cushion', label: '缓冲程度', min: 0.05, max: 1, step: 0.05, value: 0.3, fmt: v => v < 0.3 ? v.toFixed(2) + '（硬）' : v.toFixed(2) + '（软）' },
    { key: 'v0', label: '下落速度', min: 2, max: 8, step: 0.5, value: 5, fmt: v => v.toFixed(1) + ' m/s' }
  ],
  actions: [
    { label: s => s.phase === 'ready' ? '▶ 释放' : '↻ 再来一次', primary: true, on(s, p) { s.phase = 'fall'; s.dragging = false; s.y = 0.1; s.v = p.v0 * 0.25; s.hist = []; s.t = 0; s.maxF = 0; } }
  ],
  init() { return { phase: 'ready', y: 0.1, v: 0, hist: [], t: 0, maxF: 0, buzz: 0 }; },
  step(s, p, dt) {
    if (dt <= 0 || s.dragging || s.phase === 'ready' || s.phase === 'done') return;
    s.t += dt;
    const floorY = 0.72, k = 900 / p.cushion, m = 1;
    if (s.phase === 'fall') {
      s.y += s.v * dt;
      if (s.y >= floorY) s.phase = 'contact';
      s.hist.push({ t: s.t, F: 0 });
    } else {
      const pen = s.y - floorY;
      const F = Math.max(k * pen, 0);
      s.v -= (F / m - 2) * dt; s.y += s.v * dt;
      s.maxF = Math.max(s.maxF, F);
      s.hist.push({ t: s.t, F });
      if (s.y < floorY) { s.phase = 'done'; s.buzz = (s.buzz | 0) + 1; }
    }
    while (s.hist.length > 400) s.hist.shift();
  },
  hint: '抓住小球调整高度，松手落到缓冲垫',
  onDragStart(s, p, x, y) {
    if (!s._ui || Math.hypot(x - s._ui.ballX, y - s._ui.ballY) > 38) return false;
    s.dragging = true; s.phase = 'ready'; s.v = 0; return true;
  },
  onDragMove(s, p, x, y) {
    const u = s._ui;
    if (!u) return;
    s.y = Math.max(0.04, Math.min(0.66,
      (y - u.topY) * 0.72 / (u.floorY - u.mapTop)));
    s.v = 0; s.hist = []; s.t = 0; s.maxF = 0;
  },
  onDragEnd(s, p) {
    s.dragging = false; s.phase = 'fall'; s.v = p.v0 * 0.25;
    s.hist = []; s.t = 0; s.maxF = 0;
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FBE9E7'; ctx.fillRect(0, 0, W, H);
    const floorPy = H * 0.42;
    const pad = 8 + p.cushion * 28;
    const penetration = s.phase === 'contact' ? Math.max(0, s.y - 0.72) : 0;
    const compression = Math.min(pad * 0.68, penetration * H * 0.65);
    const cushionTop = floorPy + compression;
    const bulge = compression * 1.15;
    const padX = W * 0.24 - bulge / 2, padW = W * 0.28 + bulge;
    ctx.fillStyle = '#81C784';
    roundRect(ctx, padX, cushionTop, padW, Math.max(3, pad - compression), 6); ctx.fill();
    ctx.strokeStyle = '#43A047'; ctx.lineWidth = 2; ctx.stroke();
    if (compression > 1) {
      ctx.strokeStyle = 'rgba(46,125,50,0.55)'; ctx.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) {
        const yy = cushionTop + i * Math.max(3, pad - compression) / 4;
        ctx.beginPath(); ctx.moveTo(padX + 8, yy); ctx.lineTo(padX + padW - 8, yy); ctx.stroke();
      }
    }
    ctx.fillStyle = '#78909C'; ctx.fillRect(W * 0.24 - 4, floorPy + pad, W * 0.28 + 8, 8);
    const topY = H * 0.06, mapTop = H * 0.1;
    const rawBallY = topY + Math.min(s.y, 0.78) * (floorPy - mapTop) / 0.72;
    const by2 = Math.min(rawBallY, cushionTop - 15);
    ctx.fillStyle = '#FFCC80';
    ctx.beginPath(); ctx.arc(W * 0.38, by2, 15, 0, 7); ctx.fill();
    ctx.strokeStyle = '#E65100'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(W * 0.38 - 5, by2 - 5, 4, 0, 7); ctx.fill();
    s._ui = {
      ballX: W * 0.38, ballY: by2, ballRadius: 15,
      topY, mapTop, floorY: floorPy,
      cushionCompression: compression, cushionWidth: padW
    };
    const gx = W * 0.58, gy = H * 0.44, gw = W * 0.36, gh = H * 0.34;
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - gh); ctx.stroke();
    if (s.hist.length > 1) {
      const t0 = Math.max(0, s.t - 3);
      ctx.strokeStyle = '#D84315'; ctx.lineWidth = 2;
      ctx.beginPath(); let st2 = false;
      s.hist.forEach(h2 => { if (h2.t < t0) return; const X = gx + (h2.t - t0) / 3 * gw, Y = gy - Math.min(h2.F / 200, 1) * gh; st2 ? ctx.lineTo(X, Y) : ctx.moveTo(X, gy); st2 = true; });
      ctx.stroke();
    }
    ctx.fillStyle = '#607D8B'; ctx.font = '10px sans-serif'; ctx.fillText('F-t 曲线（面积=冲量）', gx, gy + 16);
    readout(ctx, [['峰值力', s.maxF > 0 ? s.maxF.toFixed(0) + ' N' : '—'], ['冲量 FΔt', '= Δp（不变）'], ['缓冲', p.cushion < 0.3 ? '硬着陆 → 峰值力大!' : '软着陆 → 时间长力小'], ['应用', '安全气囊 / 跳高垫']]);
  }
};

// 电梯超重失重
const elevator = {
  id: 'elevator', title: '电梯超重失重', sub: '视重 N=m(g+a)', category: '力学', color: '#455A64', emoji: '🛗',
  params: [
    { key: 'a', label: '电梯加速度', min: -9.8, max: 9.8, step: 0.2, value: 3, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' m/s²' },
    { key: 'mass', label: '人的质量', min: 30, max: 100, step: 5, value: 60, fmt: v => v.toFixed(0) + ' kg' }
  ],
  actions: [{ label: '自由落体!', on(s, p) { p.a = -9.8; s.buzz = (s.buzz | 0) + 1; } }],
  init() { return { y: 0.5, v: 0, buzz: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    s.v += p.a * dt * 0.06;
    s.v *= 0.995;
    s.y -= s.v * dt;
    if (s.y < 0.08) { s.y = 0.08; s.v = 0; }
    if (s.y > 0.92) { s.y = 0.92; s.v = 0; }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(0, 0, W, H);
    const shaftX = W * 0.3, shaftW = W * 0.4;
    ctx.fillStyle = '#CFD8DC'; ctx.fillRect(shaftX, H * 0.03, shaftW, H * 0.9);
    const cabH = H * 0.3, cabY = H * 0.05 + s.y * (H * 0.86 - cabH);
    ctx.fillStyle = '#78909C'; ctx.fillRect(shaftX + 6, cabY, shaftW - 12, cabH);
    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 3; ctx.strokeRect(shaftX + 6, cabY, shaftW - 12, cabH);
    ctx.strokeStyle = '#546E7A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.03); ctx.lineTo(W * 0.5, cabY); ctx.stroke();
    const px2 = W * 0.5, footY = cabY + cabH - 16;
    const N = Math.max(p.mass * (9.8 + p.a), 0);
    const squash = Math.min(N / (p.mass * 9.8), 2);
    ctx.fillStyle = '#FFB74D';
    ctx.beginPath(); ctx.arc(px2, footY - 52, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = '#FFB74D'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px2, footY - 42); ctx.lineTo(px2, footY - 18); ctx.stroke();
    const scaleH = 12 / Math.max(squash, 0.4);
    ctx.fillStyle = N < 1 ? '#B0BEC5' : '#E53935';
    ctx.fillRect(px2 - 26, footY - scaleH + 6, 52, scaleH);
    ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif';
    ctx.fillText((N / 9.8).toFixed(0) + 'kg', px2 - 14, footY + 3);
    const state = p.a > 0.3 ? '超重（读数变大）' : p.a < -9.5 ? '完全失重！读数=0' : p.a < -0.3 ? '失重（读数变小）' : '正常';
    readout(ctx, [['真实体重', p.mass + ' kg'], ['秤的读数', (N / 9.8).toFixed(1) + ' kg'], ['视重 N', N.toFixed(0) + ' N = m(g+a)'], ['状态', state]]);
  }
};

// 示波器：电场偏转电子束
const crt = {
  id: 'crt', title: '示波器原理', sub: '电子束 / 电场偏转', category: '电磁', color: '#00E676', emoji: '📺',
  params: [
    { key: 'vd', label: '偏转电压', min: -10, max: 10, step: 0.5, value: 4, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' V' },
    { key: 'freq', label: '交流频率', min: 0.5, max: 4, step: 0.1, value: 1.5, fmt: v => v.toFixed(1) + ' Hz' }
  ],
  actions: [{ label: s => s.ac ? '模式:交流扫描' : '模式:直流', primary: true, on(s) { s.ac = !s.ac; s.spots = []; } }],
  init() { return { t: 0, ac: false, spots: [] }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    s.t += dt;
    if (s.ac) {
      s.spots.push({ x: (s.t * 0.25) % 1, y: Math.sin(s.t * p.freq * 6.283) * Math.min(Math.abs(p.vd) / 10, 1), t: s.t });
      s.spots = s.spots.filter(sp2 => s.t - sp2.t < 4);
    }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.32, gunX = W * 0.06, plateX = W * 0.3, plateW = W * 0.16, screenX = W * 0.88;
    const v = s.ac ? p.vd * Math.sin(s.t * p.freq * 6.283) : p.vd;
    const defl = v / 10;
    ctx.fillStyle = '#546E7A'; ctx.fillRect(gunX, cy - 12, W * 0.12, 24);
    ctx.fillStyle = v >= 0 ? '#E53935' : '#1E88E5'; ctx.fillRect(plateX, cy - 34, plateW, 6);
    ctx.fillStyle = v >= 0 ? '#1E88E5' : '#E53935'; ctx.fillRect(plateX, cy + 28, plateW, 6);
    ctx.strokeStyle = '#00E676'; ctx.lineWidth = 2.5; ctx.beginPath();
    ctx.moveTo(gunX + W * 0.12, cy);
    ctx.lineTo(plateX, cy);
    const endDefl = -defl * 22, slope = endDefl * 2 / plateW;
    for (let i = 0; i <= 12; i++) { const f = i / 12, x = plateX + f * plateW, y = cy + endDefl * f * f; ctx.lineTo(x, y); }
    const exitY = cy + endDefl;
    const hitY = exitY + slope * (screenX - plateX - plateW);
    ctx.lineTo(screenX, hitY);
    ctx.stroke();
    ctx.fillStyle = '#263238'; ctx.fillRect(screenX, cy - 60, 8, 120);
    ctx.fillStyle = '#00E676'; ctx.beginPath(); ctx.arc(screenX + 4, Math.max(cy - 58, Math.min(cy + 58, hitY)), 5, 0, 7); ctx.fill();
    const sy2 = H * 0.62, sh2 = H * 0.3, sx2 = W * 0.1, sw2 = W * 0.8;
    ctx.fillStyle = '#0B2E13'; ctx.fillRect(sx2, sy2, sw2, sh2);
    ctx.strokeStyle = 'rgba(0,230,118,0.15)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(sx2 + i * sw2 / 6, sy2); ctx.lineTo(sx2 + i * sw2 / 6, sy2 + sh2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(sx2, sy2 + sh2 / 2); ctx.lineTo(sx2 + sw2, sy2 + sh2 / 2); ctx.stroke();
    if (s.ac) {
      ctx.fillStyle = '#00E676';
      s.spots.forEach(sp2 => { const age = (s.t - sp2.t) / 4; ctx.globalAlpha = 1 - age; ctx.fillRect(sx2 + sp2.x * sw2 - 1.5, sy2 + sh2 / 2 - sp2.y * sh2 * 0.42 - 1.5, 3, 3); });
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#00E676'; ctx.beginPath(); ctx.arc(sx2 + sw2 / 2, sy2 + sh2 / 2 - defl * sh2 * 0.42, 5, 0, 7); ctx.fill();
    }
    readout(ctx, [['偏转电压', v.toFixed(1) + ' V'], ['偏转量', '∝ 电压'], ['模式', s.ac ? '交流 → 扫出正弦波形' : '直流 → 光点偏移'], ['应用', '示波器 / 老式电视']]);
  }
};

// 词向量空间：语义聚类 + 向量类比
const EMB_WORDS = [
  { w: '国王', x: 0.78, y: 0.2, g: 0 }, { w: '王后', x: 0.88, y: 0.38, g: 0 },
  { w: '男人', x: 0.6, y: 0.24, g: 0 }, { w: '女人', x: 0.7, y: 0.42, g: 0 },
  { w: '猫', x: 0.18, y: 0.72, g: 1 }, { w: '狗', x: 0.3, y: 0.78, g: 1 },
  { w: '老虎', x: 0.12, y: 0.6, g: 1 }, { w: '狼', x: 0.34, y: 0.64, g: 1 },
  { w: '苹果', x: 0.6, y: 0.78, g: 2 }, { w: '香蕉', x: 0.72, y: 0.84, g: 2 }, { w: '葡萄', x: 0.66, y: 0.7, g: 2 },
  { w: '汽车', x: 0.16, y: 0.22, g: 3 }, { w: '火车', x: 0.28, y: 0.14, g: 3 }, { w: '飞机', x: 0.1, y: 0.34, g: 3 }
];
const embedding = {
  id: 'embedding', title: '词向量空间', sub: '语义聚类 / 向量类比', category: '人工智能', color: '#00BFA5', emoji: '🗺️',
  params: [],
  actions: [
    { label: s => s.analogy ? '隐藏类比' : '▶ 类比:国王-男人+女人', primary: true, on(s) { s.analogy = !s.analogy; s.ph = 0; } },
    { label: '清除选择', on(s) { s.sel = -1; } }
  ],
  init() { return { sel: -1, analogy: false, ph: 0, W: 360, H: 500 }; },
  step(s, p, dt) { if (dt > 0 && s.analogy && s.ph < 3) s.ph = Math.min(s.ph + dt * 1.2, 3); },
  onTap(s, p, x, y) {
    const W = s.W || 360, H = s.H || 500, mx = W * 0.05, my = H * 0.05, mw = W * 0.9, mh = H * 0.66;
    let best = -1, bd = 1e9;
    EMB_WORDS.forEach((w2, i) => {
      const d = Math.hypot(x - (mx + w2.x * mw), y - (my + w2.y * mh));
      if (d < bd) { bd = d; best = i; }
    });
    if (bd < 40) s.sel = best;
  },
  draw(ctx, W, H, s) {
    s.W = W; s.H = H;
    ctx.fillStyle = '#0D1F1C'; ctx.fillRect(0, 0, W, H);
    const mx = W * 0.05, my = H * 0.05, mw = W * 0.9, mh = H * 0.66;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(mx + i * mw / 6, my); ctx.lineTo(mx + i * mw / 6, my + mh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my + i * mh / 6); ctx.lineTo(mx + mw, my + i * mh / 6); ctx.stroke();
    }
    const cols = ['#FFAB40', '#4FC3F7', '#AED581', '#F48FB1'];
    const SX = w2 => mx + w2.x * mw, SY = w2 => my + w2.y * mh;
    if (s.sel >= 0) {
      const w0 = EMB_WORDS[s.sel];
      const dists = EMB_WORDS.map((w2, i) => ({ i, d: Math.hypot(w2.x - w0.x, w2.y - w0.y) })).filter(o => o.i !== s.sel).sort((a, b) => a.d - b.d);
      dists.slice(0, 3).forEach((o, rank) => {
        const w2 = EMB_WORDS[o.i];
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 - rank * 0.13) + ')'; ctx.lineWidth = 2 - rank * 0.5;
        ctx.beginPath(); ctx.moveTo(SX(w0), SY(w0)); ctx.lineTo(SX(w2), SY(w2)); ctx.stroke();
      });
    }
    if (s.analogy) {
      const king = EMB_WORDS[0], queen = EMB_WORDS[1], man = EMB_WORDS[2], woman = EMB_WORDS[3];
      const dx = king.x - man.x, dy2 = king.y - man.y;
      if (s.ph > 0.2) arrowSeg(ctx, SX(man), SY(man), SX(king), SY(king), '#FF5252', 2.5);
      if (s.ph > 1.2) {
        const f = Math.min((s.ph - 1.2) / 1, 1);
        arrowSeg(ctx, SX(woman), SY(woman), mx + (woman.x + dx * f) * mw, my + (woman.y + dy2 * f) * mh, '#FFD740', 2.5);
      }
      if (s.ph > 2.4) {
        ctx.strokeStyle = '#00E676'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(SX(queen), SY(queen), 22, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#00E676'; ctx.font = '11px sans-serif'; ctx.fillText('≈ 王后！', SX(queen) + 14, SY(queen) - 16);
      }
    }
    ctx.font = '12px sans-serif';
    EMB_WORDS.forEach((w2, i) => {
      ctx.fillStyle = cols[w2.g];
      ctx.beginPath(); ctx.arc(SX(w2), SY(w2), i === s.sel ? 8 : 5, 0, 7); ctx.fill();
      ctx.fillStyle = i === s.sel ? '#fff' : 'rgba(255,255,255,0.75)';
      ctx.fillText(w2.w, SX(w2) + 8, SY(w2) - 6);
    });
    const selW = s.sel >= 0 ? EMB_WORDS[s.sel] : null;
    let near = '—';
    if (selW) {
      const o = EMB_WORDS.map((w2, i) => ({ w: w2.w, d: Math.hypot(w2.x - selW.x, w2.y - selW.y), i })).filter(o2 => o2.i !== s.sel).sort((a, b) => a.d - b.d)[0];
      near = o.w;
    }
    readout(ctx, [['原理', '语义相近 → 向量相近'], ['选中', selW ? selW.w + '（最近邻:' + near + '）' : '点词语查看近邻'], ['类比', '向量运算 = 语义运算']]);
  }
};

// 激活函数与梯度消失
const ACT_FNS = [
  { name: 'Sigmoid', f: x => 1 / (1 + Math.exp(-x)), df: x => { const s2 = 1 / (1 + Math.exp(-x)); return s2 * (1 - s2); }, maxD: 0.25 },
  { name: 'Tanh', f: x => Math.tanh(x), df: x => 1 - Math.tanh(x) * Math.tanh(x), maxD: 1 },
  { name: 'ReLU', f: x => Math.max(0, x), df: x => x > 0 ? 1 : 0, maxD: 1 }
];
const activation = {
  id: 'activation', title: '激活函数与梯度', sub: '梯度消失 / Sigmoid vs ReLU', category: '人工智能', color: '#FF7043', emoji: '⚡',
  params: [
    { key: 'x', label: '输入 x', min: -5, max: 5, step: 0.1, value: 1, fmt: v => v.toFixed(1) },
    { key: 'layers', label: '网络层数', min: 1, max: 20, step: 1, value: 8, fmt: v => v.toFixed(0) + ' 层' }
  ],
  actions: [{ label: s => '函数:' + ACT_FNS[s.fn].name, primary: true, on(s) { s.fn = (s.fn + 1) % 3; } }],
  init() { return { fn: 0 }; },
  step() {},
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#1A1410'; ctx.fillRect(0, 0, W, H);
    const F = ACT_FNS[s.fn];
    const mx = W * 0.08, my = H * 0.05, mw = W * 0.84, mh = H * 0.36;
    const SX = x => mx + (x + 5) / 10 * mw, SY = y => my + mh / 2 - y * mh * 0.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx, my + mh / 2); ctx.lineTo(mx + mw, my + mh / 2); ctx.moveTo(SX(0), my); ctx.lineTo(SX(0), my + mh); ctx.stroke();
    const curve = (fn, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath(); for (let i = 0; i <= 120; i++) { const x = -5 + 10 * i / 120, Y = SY(Math.max(-1.2, Math.min(1.2, fn(x)))); i ? ctx.lineTo(SX(x), Y) : ctx.moveTo(SX(x), Y); } ctx.stroke(); };
    curve(F.f, '#FF7043');
    curve(F.df, '#4FC3F7');
    const gx2 = SX(p.x);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(gx2, my); ctx.lineTo(gx2, my + mh); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#FF7043'; ctx.beginPath(); ctx.arc(gx2, SY(Math.max(-1.2, Math.min(1.2, F.f(p.x)))), 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#4FC3F7'; ctx.beginPath(); ctx.arc(gx2, SY(F.df(p.x)), 5, 0, 7); ctx.fill();
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#FF7043'; ctx.fillText('— 函数值', mx + 4, my + 14);
    ctx.fillStyle = '#4FC3F7'; ctx.fillText('— 导数（梯度）', mx + 80, my + 14);
    const n = Math.round(p.layers), g0 = F.df(p.x);
    const by2 = H * 0.56, bh3 = H * 0.2;
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('反向传播经过 ' + n + ' 层后的梯度（链式连乘）', mx, by2 - 8);
    let grad = 1;
    for (let i = 0; i < n; i++) {
      grad *= g0;
      const bx3 = mx + i * (mw / 20), bw4 = mw / 20 - 3;
      const hh = Math.max(Math.min(Math.abs(grad), 1) * bh3, grad !== 0 ? 1 : 0);
      ctx.fillStyle = Math.abs(grad) < 0.01 ? '#E53935' : '#66BB6A';
      ctx.fillRect(bx3, by2 + bh3 - hh, bw4, hh);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(mx, by2, mw, bh3);
    const gN = Math.pow(g0, n);
    const verdict = Math.abs(gN) < 1e-4 ? '梯度消失！深层学不动' : Math.abs(gN) > 10 ? '梯度爆炸！' : '梯度健康 ✓';
    readout(ctx, [['函数', F.name], ['单层梯度', g0.toFixed(3) + '（≤' + F.maxD + '）'], [n + '层后梯度', gN.toExponential(2)], ['诊断', verdict]]);
  }
};

// 开普勒第二定律：椭圆轨道扫过相等面积
const kepler = {
  id: 'kepler', title: '开普勒定律', sub: '椭圆轨道 / 等面积扫过', category: '力学', color: '#283593', emoji: '☀️',
  params: [{ key: 'ecc', label: '离心率', min: 0, max: 0.7, step: 0.05, value: 0.5, fmt: v => v.toFixed(2) }],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 公转', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s) { s.x = 2.4; s.y = 0; s.vx = 0; s.vy = 0.72; s.trail = []; s.sweep = []; s.needInit = true; } }
  ],
  init() { return { x: 0, y: 0, vx: 0, vy: 0, trail: [], sweep: [], running: false, needInit: true, areaLog: [], areaAcc: 0, areaT: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    if (s.needInit) {
      // 由离心率设初始条件：远日点 r=a(1+e)，v=sqrt(GM(1-e)/(a(1+e)))
      const a = 1.8, e = p.ecc, GM = 1;
      s.x = a * (1 + e); s.y = 0; s.vx = 0; s.vy = Math.sqrt(GM * (1 - e) / (a * (1 + e)));
      s.trail = []; s.sweep = []; s.areaLog = []; s.areaAcc = 0; s.areaT = 0; s.needInit = false;
    }
    if (!s.running) return;
    const sub = 12, h = Math.min(dt, 0.04) / sub;
    for (let i = 0; i < sub; i++) {
      const r = Math.hypot(s.x, s.y) || 1e-4, acc = -1 / (r * r * r);
      s.vx += acc * s.x * h; s.vy += acc * s.y * h;
      const ox = s.x, oy = s.y;
      s.x += s.vx * h; s.y += s.vy * h;
      // 面积速度 dA = |r × dr|/2（应恒定 —— 开普勒第二定律）
      s.areaAcc += Math.abs(ox * (s.y - oy) - oy * (s.x - ox)) / 2;
      s.areaT += h;
      s.sweep.push([s.x, s.y]);
      if (s.sweep.length > 60) s.sweep.shift();
    }
    if (s.areaT > 0.5) { s.areaLog.push(s.areaAcc / s.areaT); if (s.areaLog.length > 6) s.areaLog.shift(); s.areaAcc = 0; s.areaT = 0; }
    s.trail.push([s.x, s.y]); if (s.trail.length > 500) s.trail.shift();
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#0A0E24'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 89) % W, (i * 61) % (H * 0.95), 1.6, 1.6);
    const cx = W * 0.44, cy = H * 0.42, scale = Math.min(W, H) * 0.12;
    const SX = x => cx + x * scale, SY = y => cy + y * scale;
    // 扫过的扇形（最近一段，黄色半透明）
    if (s.sweep.length > 2) {
      ctx.fillStyle = 'rgba(255,214,0,0.22)';
      ctx.beginPath(); ctx.moveTo(SX(0), SY(0));
      s.sweep.forEach(pt => ctx.lineTo(SX(pt[0]), SY(pt[1])));
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(130,150,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
    s.trail.forEach((pt, i) => { i ? ctx.lineTo(SX(pt[0]), SY(pt[1])) : ctx.moveTo(SX(pt[0]), SY(pt[1])); });
    ctx.stroke();
    ctx.fillStyle = '#FDD835'; ctx.beginPath(); ctx.arc(SX(0), SY(0), 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#42A5F5'; ctx.beginPath(); ctx.arc(SX(s.x), SY(s.y), 7, 0, 7); ctx.fill();
    const r = Math.hypot(s.x, s.y), v = Math.hypot(s.vx, s.vy);
    const areas = s.areaLog.length > 1 ? (Math.max.apply(null, s.areaLog) - Math.min.apply(null, s.areaLog)) / (s.areaLog[0] || 1) : 0;
    readout(ctx, [['距离 r', r.toFixed(2) + '（近快远慢）'], ['速度 v', v.toFixed(2)], ['面积速度', s.areaLog.length ? s.areaLog[s.areaLog.length - 1].toFixed(4) : '—'], ['等面积验证', s.areaLog.length > 1 ? '波动 ' + (areas * 100).toFixed(1) + '%（≈恒定）' : '运行后统计']]);
  }
};

// LC 振荡电路：电能↔磁能
const lc = {
  id: 'lc', title: 'LC 振荡', sub: '电场能↔磁场能 / 电磁振荡', category: '电磁', color: '#00897B', emoji: '🔄',
  params: [
    { key: 'L', label: '电感 L', min: 1, max: 10, step: 0.5, value: 4, fmt: v => v.toFixed(1) },
    { key: 'C', label: '电容 C', min: 1, max: 10, step: 0.5, value: 4, fmt: v => v.toFixed(1) },
    { key: 'damp', label: '电阻损耗', min: 0, max: 0.5, step: 0.02, value: 0, fmt: v => v.toFixed(2) }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 释放振荡', primary: true, on(s) { s.running = !s.running; } },
    { label: '重新充满', on(s) { s.q = 1; s.i = 0; s.hist = []; s.t = 0; } }
  ],
  init() { return { q: 1, i: 0, hist: [], t: 0, running: false }; },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    const w2 = 30 / (p.L * p.C), sub = 8, h = Math.min(dt, 0.04) / sub;
    for (let k = 0; k < sub; k++) {
      const didt = -w2 * s.q - p.damp * s.i;
      s.i += didt * h;
      s.q += s.i * h;
      s.t += h;
    }
    s.hist.push({ t: s.t, q: s.q, i: s.i });
    while (s.hist.length && s.hist[0].t < s.t - 10) s.hist.shift();
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E0F2F1'; ctx.fillRect(0, 0, W, H);
    const x0 = W * 0.2, x1 = W * 0.8, y0 = H * 0.08, y1 = H * 0.38;
    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.stroke();
    // 电容（左）
    const ccy = (y0 + y1) / 2;
    ctx.fillStyle = '#E0F2F1'; ctx.fillRect(x0 - 12, ccy - 20, 24, 40);
    ctx.strokeStyle = '#00897B'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x0 - 14, ccy - 7); ctx.lineTo(x0 + 14, ccy - 7); ctx.moveTo(x0 - 14, ccy + 7); ctx.lineTo(x0 + 14, ccy + 7); ctx.stroke();
    const nq = Math.round(Math.abs(s.q) * 5);
    ctx.font = '12px sans-serif';
    for (let i = 0; i < nq; i++) {
      ctx.fillStyle = s.q > 0 ? '#E53935' : '#1E88E5'; ctx.fillText(s.q > 0 ? '+' : '−', x0 - 12 + i * 6, ccy - 11);
      ctx.fillStyle = s.q > 0 ? '#1E88E5' : '#E53935'; ctx.fillText(s.q > 0 ? '−' : '+', x0 - 12 + i * 6, ccy + 20);
    }
    // 电感（右）：线圈 + 磁场强度光晕
    const icy = (y0 + y1) / 2;
    ctx.fillStyle = '#E0F2F1'; ctx.fillRect(x1 - 14, icy - 32, 28, 64);
    const mag = Math.min(Math.abs(s.i) * 1.2, 1);
    if (mag > 0.05) { ctx.fillStyle = 'rgba(0,137,123,' + mag * 0.3 + ')'; ctx.beginPath(); ctx.arc(x1, icy, 34 + mag * 10, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#00897B'; ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x1, icy - 21 + k * 14, 8, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
    // 电流流动
    if (Math.abs(s.i) > 0.03) {
      const dir = s.i > 0 ? 1 : -1;
      flowLoop(ctx, dir > 0 ? [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] : [[x0, y1], [x1, y1], [x1, y0], [x0, y0]], (s.t * Math.abs(s.i) * 0.35) % 1, '#00695C');
    }
    // 能量条 + 波形
    const eC = s.q * s.q, eL = s.i * s.i * p.L * p.C / 30, tot = eC + eL || 1;
    const by2 = H * 0.5;
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#455A64'; ctx.fillText('电场能', W * 0.08, by2 - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(W * 0.08, by2, W * 0.35, 10);
    ctx.fillStyle = '#E53935'; ctx.fillRect(W * 0.08, by2, W * 0.35 * eC / tot, 10);
    ctx.fillStyle = '#455A64'; ctx.fillText('磁场能', W * 0.56, by2 - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(W * 0.56, by2, W * 0.35, 10);
    ctx.fillStyle = '#1E88E5'; ctx.fillRect(W * 0.56, by2, W * 0.35 * eL / tot, 10);
    const gy = H * 0.9, gx = W * 0.08, gw = W * 0.84, gh = H * 0.26, t0 = Math.max(0, s.t - 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy - gh / 2); ctx.lineTo(gx + gw, gy - gh / 2); ctx.stroke();
    if (s.hist.length > 1) {
      const wf = (fn, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); s.hist.forEach((h2, i) => { const X = gx + (h2.t - t0) / 10 * gw, Y = gy - gh / 2 - fn(h2) * gh / 2 * 0.9; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); };
      wf(h2 => h2.q, '#E53935');
      wf(h2 => h2.i * Math.sqrt(p.L * p.C / 30), '#1E88E5');
    }
    const T = 2 * Math.PI * Math.sqrt(p.L * p.C / 30);
    readout(ctx, [['周期 T', T.toFixed(2) + ' s'], ['电荷 q', s.q.toFixed(2) + '（红）'], ['电流 i', s.i.toFixed(2) + '（蓝）'], ['能量', p.damp > 0 ? '损耗衰减中' : '来回转换，总量守恒']]);
  }
};

// 耦合摆：能量在两摆间传递（拍现象）
const coupled = {
  id: 'coupled', title: '耦合摆', sub: '弹簧耦合 / 能量传递与拍', category: '力学', color: '#6A1B9A', emoji: '🎎',
  params: [
    { key: 'coupling', label: '耦合强度', min: 0.02, max: 0.5, step: 0.02, value: 0.12, fmt: v => v.toFixed(2) },
    { key: 'length', label: '摆长', min: 0.8, max: 2, step: 0.1, value: 1.4, fmt: v => v.toFixed(1) + ' m' }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 释放左摆', primary: true, on(s) { if (!s.running) { s.th1 = 0.5; s.w1 = 0; s.th2 = 0; s.w2 = 0; } s.running = !s.running; } },
    { label: '重置', on(s) { s.running = false; s.th1 = 0.5; s.th2 = 0; s.w1 = 0; s.w2 = 0; s.hist = []; s.t = 0; } }
  ],
  init() { return { th1: 0.5, th2: 0, w1: 0, w2: 0, hist: [], t: 0, running: false }; },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    const g = 9.8, sub = 8, h = Math.min(dt, 0.04) / sub, k = p.coupling * 30;
    for (let i = 0; i < sub; i++) {
      const a1 = -(g / p.length) * Math.sin(s.th1) - k * (s.th1 - s.th2) / p.length;
      const a2 = -(g / p.length) * Math.sin(s.th2) - k * (s.th2 - s.th1) / p.length;
      s.w1 += a1 * h; s.w2 += a2 * h;
      s.th1 += s.w1 * h; s.th2 += s.w2 * h;
      s.t += h;
    }
    s.hist.push({ t: s.t, a: s.th1, b: s.th2 });
    while (s.hist.length && s.hist[0].t < s.t - 16) s.hist.shift();
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#F3E5F5'; ctx.fillRect(0, 0, W, H);
    const pivY = H * 0.1, L = H * 0.3, x1 = W * 0.32, x2 = W * 0.68;
    ctx.fillStyle = '#8D6E63'; ctx.fillRect(W * 0.18, pivY - 10, W * 0.64, 10);
    const b1x = x1 + L * Math.sin(s.th1), b1y = pivY + L * Math.cos(s.th1);
    const b2x = x2 + L * Math.sin(s.th2), b2y = pivY + L * Math.cos(s.th2);
    // 耦合弹簧
    ctx.strokeStyle = '#9575CD'; ctx.lineWidth = 2; ctx.beginPath();
    const my2 = pivY + L * 0.55;
    const s1x = x1 + L * 0.55 * Math.sin(s.th1), s2x = x2 + L * 0.55 * Math.sin(s.th2);
    ctx.moveTo(s1x, my2);
    const nseg = 8;
    for (let i = 1; i <= nseg; i++) { const f = i / nseg, xx = s1x + (s2x - s1x) * f, yy = my2 + (i % 2 && i !== nseg ? -7 : (i !== nseg ? 7 : 0)); ctx.lineTo(xx, yy); }
    ctx.stroke();
    // 两摆
    [[x1, b1x, b1y, '#7B1FA2'], [x2, b2x, b2y, '#3949AB']].forEach(arr => {
      ctx.strokeStyle = '#616161'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(arr[0], pivY); ctx.lineTo(arr[1], arr[2]); ctx.stroke();
      ctx.fillStyle = arr[3]; ctx.beginPath(); ctx.arc(arr[1], arr[2], 13, 0, 7); ctx.fill();
    });
    // 角度-时间曲线：能量来回传递（拍）
    const gy = H * 0.9, gx = W * 0.06, gw = W * 0.88, gh = H * 0.3, t0 = Math.max(0, s.t - 16);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy - gh / 2); ctx.lineTo(gx + gw, gy - gh / 2); ctx.stroke();
    if (s.hist.length > 1) {
      const wf = (fn, col) => { ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.beginPath(); s.hist.forEach((h2, i) => { const X = gx + (h2.t - t0) / 16 * gw, Y = gy - gh / 2 - fn(h2) / 0.6 * gh / 2 * 0.9; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); };
      wf(h2 => h2.a, '#7B1FA2');
      wf(h2 => h2.b, '#3949AB');
    }
    const e1 = s.w1 * s.w1 + 9.8 / p.length * s.th1 * s.th1, e2 = s.w2 * s.w2 + 9.8 / p.length * s.th2 * s.th2;
    readout(ctx, [['左摆能量占比', (e1 / (e1 + e2 + 1e-9) * 100).toFixed(0) + '%'], ['现象', '能量经弹簧来回传递'], ['拍周期', '耦合越弱传递越慢']]);
  }
};

// ===== 化学混合台（组件化）=====
const CM_REAGENTS = ['稀盐酸', '氢氧化钠', '硫酸铜液', '锌粒', '碳酸钙', '铁钉', '石蕊试液'];
const CM_RULES = {
  '氢氧化钠|稀盐酸': { desc: '中和反应，放热', color: '#E8F5E9', heat: 1, eq: 'HCl+NaOH→NaCl+H₂O' },
  '稀盐酸|锌粒': { desc: '锌溶解，冒氢气泡', color: '#ECEFF1', gas: 1, eq: 'Zn+2HCl→ZnCl₂+H₂↑' },
  '碳酸钙|稀盐酸': { desc: '剧烈冒二氧化碳气泡', color: '#ECEFF1', gas: 1, eq: 'CaCO₃+2HCl→CaCl₂+H₂O+CO₂↑' },
  '氢氧化钠|硫酸铜液': { desc: '生成蓝色絮状沉淀', color: '#BBDEFB', precip: '#1E88E5', eq: 'CuSO₄+2NaOH→Cu(OH)₂↓+Na₂SO₄' },
  '硫酸铜液|铁钉': { desc: '铁钉表面镀上红色铜', color: '#C8E6C9', precip: '#B71C1C', eq: 'Fe+CuSO₄→FeSO₄+Cu' },
  '石蕊试液|稀盐酸': { desc: '石蕊遇酸变红', color: '#FFCDD2', eq: '酸性 pH<7' },
  '氢氧化钠|石蕊试液': { desc: '石蕊遇碱变蓝', color: '#90CAF9', eq: '碱性 pH>7' },
  '稀盐酸|铁钉': { desc: '缓慢冒泡，溶液浅绿', color: '#DCEDC8', gas: 1, eq: 'Fe+2HCl→FeCl₂+H₂↑' }
};
const chemmix = {
  id: 'chemmix', title: '化学混合台', sub: '自选试剂 / 观察反应现象', category: '化学', color: '#00ACC1', emoji: '🧫',
  params: [],
  actions: [
    { label: s => 'A: ' + CM_REAGENTS[s.a], on(s) { s.a = (s.a + 1) % CM_REAGENTS.length; if (s.a === s.b) s.a = (s.a + 1) % CM_REAGENTS.length; s.mixed = false; s.t = 0; s.bubbles = []; } },
    { label: s => 'B: ' + CM_REAGENTS[s.b], on(s) { s.b = (s.b + 1) % CM_REAGENTS.length; if (s.b === s.a) s.b = (s.b + 1) % CM_REAGENTS.length; s.mixed = false; s.t = 0; s.bubbles = []; } },
    { label: s => s.mixed ? '↻ 重新混合' : '▶ 混合！', primary: true, on(s) { s.mixed = true; s.t = 0; s.bubbles = []; s.buzz = (s.buzz | 0) + 1; } }
  ],
  init() { return { a: 0, b: 3, mixed: false, t: 0, bubbles: [], buzz: 0 }; },
  step(s, p, dt) {
    if (dt <= 0 || !s.mixed) return;
    s.t += dt;
    const rule = CM_RULES[[CM_REAGENTS[s.a], CM_REAGENTS[s.b]].sort().join('|')];
    if (rule && rule.gas && s.bubbles.length < 20 && Math.random() < dt * 10) s.bubbles.push({ x: 0.15 + Math.random() * 0.7, y: 1, sp: 0.25 + Math.random() * 0.25, r: 2 + Math.random() * 3 });
    s.bubbles.forEach(b2 => { b2.y -= b2.sp * dt; });
    s.bubbles = s.bubbles.filter(b2 => b2.y > 0.02);
  },
  draw(ctx, W, H, s) {
    ctx.fillStyle = '#F5F7F8'; ctx.fillRect(0, 0, W, H);
    const rule = s.mixed ? CM_RULES[[CM_REAGENTS[s.a], CM_REAGENTS[s.b]].sort().join('|')] : null;
    // 两个试剂瓶
    const bottle = (x, label, col) => {
      ctx.fillStyle = col; ctx.fillRect(x - 22, H * 0.1, 44, 54);
      ctx.fillStyle = '#78909C'; ctx.fillRect(x - 8, H * 0.1 - 12, 16, 12);
      ctx.strokeStyle = '#546E7A'; ctx.lineWidth = 2; ctx.strokeRect(x - 22, H * 0.1, 44, 54);
      ctx.fillStyle = '#37474F'; ctx.font = '11px sans-serif'; ctx.fillText(label, x - label.length * 5.5, H * 0.1 + 74);
    };
    bottle(W * 0.3, CM_REAGENTS[s.a], '#B3E5FC');
    bottle(W * 0.7, CM_REAGENTS[s.b], '#FFE0B2');
    // 烧杯
    const bx = W * 0.3, bw = W * 0.4, by = H * 0.4, bh = H * 0.34, liqY = by + bh * 0.3;
    const mixColor = rule ? rule.color : (s.mixed ? '#ECEFF1' : '#E3F2FD');
    ctx.fillStyle = mixColor; ctx.fillRect(bx, liqY, bw, by + bh - liqY);
    // 沉淀
    if (rule && rule.precip) {
      const settle = Math.min(s.t / 2, 1);
      ctx.fillStyle = rule.precip; ctx.globalAlpha = 0.5 + settle * 0.4;
      ctx.fillRect(bx, by + bh - 14 * settle - 2, bw, 14 * settle + 2);
      ctx.globalAlpha = 1;
    }
    // 气泡
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    s.bubbles.forEach(b2 => { ctx.beginPath(); ctx.arc(bx + b2.x * bw, liqY + b2.y * (by + bh - liqY), b2.r, 0, 7); ctx.fill(); });
    ctx.strokeStyle = '#78909C'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by); ctx.stroke();
    // 温度计（放热反应升温）
    const tx2 = bx + bw + 30, tTop = by, tBot = by + bh;
    ctx.strokeStyle = '#90A4AE'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tx2, tTop); ctx.lineTo(tx2, tBot); ctx.stroke();
    const warm = rule && rule.heat ? Math.min(s.t / 2, 1) : 0;
    ctx.strokeStyle = '#E53935'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(tx2, tBot); ctx.lineTo(tx2, tBot - (0.25 + warm * 0.55) * bh); ctx.stroke();
    ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(tx2, tBot + 5, 7, 0, 7); ctx.fill();
    const phen = !s.mixed ? '选好试剂后点「混合」' : (rule ? rule.desc : '无明显现象');
    readout(ctx, [['组合', CM_REAGENTS[s.a] + ' + ' + CM_REAGENTS[s.b]], ['现象', phen], ['方程式', rule ? rule.eq : '—'], ['温度', rule && rule.heat && s.mixed ? '升高 ↑（放热）' : '不变']]);
  }
};

// RC 电路充放电
const rccircuit = {
  id: 'rccircuit', title: 'RC 充放电', sub: '指数曲线 / 时间常数 τ=RC', category: '电磁', color: '#5E35B1', emoji: '⏱️',
  params: [
    { key: 'R', label: '电阻 R', min: 1, max: 10, step: 0.5, value: 4, fmt: v => v.toFixed(1) },
    { key: 'C', label: '电容 C', min: 1, max: 10, step: 0.5, value: 4, fmt: v => v.toFixed(1) }
  ],
  actions: [
    { label: '▶ 充电', primary: true, on(s) { s.mode = 'charge'; } },
    { label: '▶ 放电', on(s) { s.mode = 'discharge'; } },
    { label: '重置', on(s) { s.q = 0; s.mode = 'idle'; s.hist = []; s.t = 0; s.phase = 0; } }
  ],
  init() { return { q: 0, mode: 'idle', hist: [], t: 0, phase: 0 }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    s.t += dt;
    const tau = p.R * p.C / 8;
    const target = s.mode === 'charge' ? 1 : (s.mode === 'discharge' ? 0 : s.q);
    const dq = (target - s.q) / tau * dt;
    s.q += dq;
    s.phase += Math.abs(dq) * 30;
    s.hist.push({ t: s.t, q: s.q });
    while (s.hist.length && s.hist[0].t < s.t - 8) s.hist.shift();
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#EDE7F6'; ctx.fillRect(0, 0, W, H);
    const x0 = W * 0.14, x1 = W * 0.62, y0 = H * 0.1, y1 = H * 0.42;
    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.stroke();
    drawBattery(ctx, x0, (y0 + y1) / 2, true);
    drawZigzagH(ctx, x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.7, y0, '#EF6C00');
    // 电容（右边）：极板电荷随 q
    const ccy = (y0 + y1) / 2;
    ctx.fillStyle = '#EDE7F6'; ctx.fillRect(x1 - 12, ccy - 22, 24, 44);
    ctx.strokeStyle = '#5E35B1'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x1 - 12, ccy - 8); ctx.lineTo(x1 + 12, ccy - 8); ctx.moveTo(x1 - 12, ccy + 8); ctx.lineTo(x1 + 12, ccy + 8); ctx.stroke();
    const nq = Math.round(s.q * 6);
    ctx.font = '12px sans-serif';
    for (let i = 0; i < nq; i++) {
      ctx.fillStyle = '#E53935'; ctx.fillText('+', x1 - 10 + i * 4.2, ccy - 12);
      ctx.fillStyle = '#1E88E5'; ctx.fillText('−', x1 - 10 + i * 4.2, ccy + 20);
    }
    if (s.mode !== 'idle' && Math.abs((s.mode === 'charge' ? 1 : 0) - s.q) > 0.02) {
      flowLoop(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], (s.phase * 0.05) % 1, '#7E57C2');
    }
    // 电压曲线
    const gy = H * 0.86, gx = W * 0.1, gw = W * 0.82, gh = H * 0.3, t0 = Math.max(0, s.t - 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(gx, gy - gh, gw, gh);
    ctx.strokeStyle = 'rgba(94,53,177,0.3)'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(gx, gy - gh * 0.632); ctx.lineTo(gx + gw, gy - gh * 0.632); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#7E57C2'; ctx.font = '10px sans-serif'; ctx.fillText('63.2% (t=τ)', gx + 4, gy - gh * 0.632 - 4);
    if (s.hist.length > 1) {
      ctx.strokeStyle = '#5E35B1'; ctx.lineWidth = 2.5; ctx.beginPath();
      s.hist.forEach((h2, i) => { const X = gx + (h2.t - t0) / 8 * gw, Y = gy - h2.q * gh * 0.94; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
    }
    readout(ctx, [['时间常数 τ', (p.R * p.C / 8).toFixed(2) + ' s'], ['电容电压', (s.q * 100).toFixed(0) + '%'], ['模式', s.mode === 'charge' ? '充电中' : s.mode === 'discharge' ? '放电中' : '待机'], ['规律', 'τ 越大充放电越慢']]);
  }
};

// 伯努利原理
const bernoulli = {
  id: 'bernoulli', title: '伯努利原理', sub: '流速与压强 / 文丘里管', category: '力学', color: '#0288D1', emoji: '💨',
  params: [
    { key: 'flow', label: '流量', min: 0.4, max: 2, step: 0.1, value: 1, fmt: v => v.toFixed(1) },
    { key: 'ratio', label: '收缩比', min: 1.5, max: 4, step: 0.1, value: 2.5, fmt: v => v.toFixed(1) + ':1' }
  ],
  actions: [],
  init() { const parts = []; for (let i = 0; i < 40; i++) parts.push({ x: Math.random(), y: Math.random() }); return { parts }; },
  step(s, p, dt) {
    if (dt <= 0) return;
    s.parts.forEach(q => {
      const narrow = q.x > 0.38 && q.x < 0.62;
      const v = p.flow * 0.12 * (narrow ? p.ratio : 1);
      q.x += v * dt;
      if (q.x > 1) { q.x = 0; q.y = Math.random(); }
    });
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#E1F5FE'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.42, wideH = H * 0.2, narrowH = wideH / p.ratio;
    const pipeY = x => {
      // 管道半高随 x：0.38 前宽，0.38-0.45 收缩，0.45-0.55 窄，0.55-0.62 扩张
      if (x < 0.38) return wideH / 2;
      if (x < 0.45) return wideH / 2 - (wideH - narrowH) / 2 * (x - 0.38) / 0.07;
      if (x < 0.55) return narrowH / 2;
      if (x < 0.62) return narrowH / 2 + (wideH - narrowH) / 2 * (x - 0.55) / 0.07;
      return wideH / 2;
    };
    // 管壁
    ctx.strokeStyle = '#0277BD'; ctx.lineWidth = 3;
    [[1, -1], [1, 1]].forEach(sgn => {
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) { const x = i / 100, Y = cy + sgn[1] * pipeY(x); i ? ctx.lineTo(x * W, Y) : ctx.moveTo(x * W, Y); }
      ctx.stroke();
    });
    // 流体粒子
    ctx.fillStyle = '#29B6F6';
    s.parts.forEach(q => {
      const hh = pipeY(q.x) * 0.85;
      ctx.beginPath(); ctx.arc(q.x * W, cy + (q.y - 0.5) * 2 * hh, 3, 0, 7); ctx.fill();
    });
    // 竖直测压管：液柱高度 ∝ 压强
    const v1 = p.flow, v2 = p.flow * p.ratio;
    const P1 = 1.2 - 0.5 * v1 * v1 * 0.08, P2 = 1.2 - 0.5 * v2 * v2 * 0.08;
    const tube = (x, P) => {
      const tx2 = x * W, top = cy - wideH / 2 - H * 0.22;
      ctx.strokeStyle = '#0277BD'; ctx.lineWidth = 2; ctx.strokeRect(tx2 - 6, top, 12, cy - pipeY(x) - top);
      const lh = Math.max(P, 0.05) * H * 0.16;
      ctx.fillStyle = '#4FC3F7'; ctx.fillRect(tx2 - 5, cy - pipeY(x) - lh, 10, lh);
    };
    tube(0.2, P1); tube(0.5, P2); tube(0.8, P1);
    ctx.fillStyle = '#01579B'; ctx.font = '11px sans-serif';
    ctx.fillText('压强高', W * 0.14, cy - wideH / 2 - H * 0.24);
    ctx.fillText('压强低!', W * 0.44, cy - wideH / 2 - H * 0.24);
    readout(ctx, [['宽处流速', v1.toFixed(1)], ['窄处流速', v2.toFixed(1) + '（快 ' + p.ratio.toFixed(1) + '×）'], ['压强', '流速快 → 压强低'], ['应用', '飞机机翼 / 喷雾器']]);
  }
};

// 卡诺热机循环
const heatengine = {
  id: 'heatengine', title: '卡诺热机', sub: 'PV 循环 / 热机效率', category: '热学', color: '#F4511E', emoji: '🏭',
  params: [
    { key: 'th', label: '高温热源', min: 400, max: 800, step: 20, value: 600, fmt: v => v.toFixed(0) + ' K' },
    { key: 'tc', label: '低温热源', min: 200, max: 380, step: 10, value: 300, fmt: v => v.toFixed(0) + ' K' }
  ],
  actions: [
    { label: s => s.running ? '⏸ 暂停' : '▶ 运转', primary: true, on(s) { s.running = !s.running; } },
    { label: '重置', on(s) { s.ph = 0; s.trace = []; s.running = false; s.cycles = 0; } }
  ],
  init() { return { ph: 0, trace: [], running: false, cycles: 0, buzz: 0 }; },
  step(s, p, dt) {
    if (!s.running || dt <= 0) return;
    const prev = s.ph;
    s.ph = (s.ph + dt * 0.55) % 4;
    if (s.ph < prev) { s.cycles++; s.buzz = (s.buzz | 0) + 1; }
  },
  draw(ctx, W, H, s, p) {
    ctx.fillStyle = '#FBE9E7'; ctx.fillRect(0, 0, W, H);
    // 循环参数：V1=1→V2=2 等温膨胀(Th)；V2→V3 绝热膨胀(T: Th→Tc, V3=V2·(Th/Tc))；
    // V3→V4 等温压缩(Tc)；V4→V1 绝热压缩。（教学简化 γ 指数）
    const r = p.th / p.tc, V1 = 1, V2 = 2, V3 = V2 * r, V4 = V1 * r;
    const state = ph => {
      if (ph < 1) { const f = ph, V = V1 + (V2 - V1) * f; return { V, T: p.th, name: '等温膨胀(吸热)' }; }
      if (ph < 2) { const f = ph - 1, V = V2 * Math.pow(r, f), T = p.th * Math.pow(p.tc / p.th, f); return { V, T, name: '绝热膨胀' }; }
      if (ph < 3) { const f = ph - 2, V = V3 + (V4 - V3) * f; return { V, T: p.tc, name: '等温压缩(放热)' }; }
      const f = ph - 3, V = V4 * Math.pow(1 / r, f), T = p.tc * Math.pow(p.th / p.tc, f);
      return { V, T, name: '绝热压缩' };
    };
    const cur = state(s.ph), P = cur.T / cur.V;
    // 左：活塞气缸
    const cylX = W * 0.08, cylW2 = W * 0.2, cylTop = H * 0.1, cylH2 = H * 0.42;
    const frac = Math.min(cur.V / V3, 1), gasH = cylH2 * (0.25 + 0.75 * frac), gasTop = cylTop + cylH2 - gasH;
    const tx3 = (cur.T - 200) / 600;
    ctx.fillStyle = 'rgba(' + Math.round(80 + tx3 * 175) + ',' + Math.round(120 * (1 - tx3) + 40) + ',' + Math.round(220 * (1 - tx3) + 20) + ',0.5)';
    ctx.fillRect(cylX, gasTop, cylW2, gasH);
    ctx.strokeStyle = '#455A64'; ctx.lineWidth = 3; ctx.strokeRect(cylX, cylTop, cylW2, cylH2);
    ctx.fillStyle = '#8D6E63'; ctx.fillRect(cylX - 4, gasTop - 10, cylW2 + 8, 10);
    // 右：PV 图
    const gx = W * 0.42, gy = H * 0.52, gw = W * 0.52, gh = H * 0.42;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - gh); ctx.stroke();
    ctx.fillStyle = '#607D8B'; ctx.font = '11px sans-serif'; ctx.fillText('V →', gx + gw - 24, gy + 14); ctx.fillText('P↑', gx - 18, gy - gh + 10);
    const Vmax = V3 * 1.1, Pmax = p.th / V1 * 1.1;
    const SX = V => gx + V / Vmax * gw, SY = P2 => gy - P2 / Pmax * gh;
    // 完整循环轨迹（细线）
    ctx.strokeStyle = 'rgba(244,81,30,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const st2 = state(i / 200 * 4), X = SX(st2.V), Y = SY(st2.T / st2.V); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.closePath(); ctx.stroke();
    // 当前点
    ctx.fillStyle = '#F4511E'; ctx.beginPath(); ctx.arc(SX(cur.V), SY(P), 6, 0, 7); ctx.fill();
    const eff = 1 - p.tc / p.th;
    readout(ctx, [['阶段', cur.name], ['温度', cur.T.toFixed(0) + ' K'], ['卡诺效率', (eff * 100).toFixed(1) + '%'], ['完成循环', s.cycles + ' 次']]);
  }
};

// ===== 光学实验台（组件化沙盒）=====
// 薄透镜级联成像：lenses=[{x,f}]（按 x 升序），返回最终像
function obCascade(lenses, xObj, h0) {
  let ox = xObj, h = h0, virtual = false;
  for (const L of lenses) {
    const dobj = L.x - ox;
    if (Math.abs(dobj) < 1e-6) return { ok: false };
    const inv = 1 / L.f - 1 / dobj;
    if (Math.abs(inv) < 1e-9) return { ok: false };
    const di = 1 / inv;
    h = h * (-di / dobj);
    ox = L.x + di;
    virtual = di < 0;
  }
  return { ok: true, x: ox, h, virtual };
}
// 近轴光线传播：经过每个透镜折射，直到 xEnd
function obTraceRay(x0, y0, u0, lenses, cy, xEnd) {
  const pts = [[x0, y0]];
  let x = x0, y = y0, u = u0;
  for (const L of lenses) {
    if (L.x <= x || L.x >= xEnd) continue;
    y += u * (L.x - x); x = L.x;
    pts.push([x, y]);
    u = u - (y - cy) / L.f;
  }
  y += u * (xEnd - x);
  pts.push([xEnd, y]);
  return pts;
}
const OB_SLOTS = 6;
const opticsbench = {
  id: 'opticsbench', title: '光学实验台', sub: '自由摆放透镜光屏 / 光线追迹', category: '波动与光', color: '#00838F', emoji: '🔭',
  params: [{ key: 'objH', label: '物高', min: 3, max: 10, step: 1, value: 6, fmt: v => v.toFixed(0) }],
  actions: [
    { label: s => (s.tool === 'convex' ? '✔ ' : '') + '🔍 凸透镜', on(s) { s.tool = 'convex'; } },
    { label: s => (s.tool === 'concave' ? '✔ ' : '') + '🥽 凹透镜', on(s) { s.tool = 'concave'; } },
    { label: s => (s.tool === 'screen' ? '✔ ' : '') + '📄 光屏', on(s) { s.tool = 'screen'; } },
    { label: s => (s.tool === 'delete' ? '✔ ' : '') + '🗑 删除', on(s) { s.tool = 'delete'; } },
    { label: '清空', on(s) { s.items = {}; } }
  ],
  cascade: obCascade,
  init() { return { items: { 1: 'convex', 4: 'screen' }, tool: 'convex', W: 360, H: 500 }; },
  step() {},
  onTap(s, p, x, y) {
    const W = s.W || 360;
    const bx = W * 0.3, ex = W * 0.92;
    let best = -1, bd = 1e9;
    for (let i = 0; i < OB_SLOTS; i++) {
      const sx = bx + i * (ex - bx) / (OB_SLOTS - 1);
      const d = Math.abs(x - sx);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0 || bd > 32) return;
    if (s.tool === 'delete') delete s.items[best];
    else s.items[best] = s.tool;
  },
  draw(ctx, W, H, s, p) {
    s.W = W; s.H = H;
    ctx.fillStyle = '#0E1B22'; ctx.fillRect(0, 0, W, H);
    const cy = H * 0.4, bx = W * 0.3, ex = W * 0.92;
    const slotX = i => bx + i * (ex - bx) / (OB_SLOTS - 1);
    // 光轴与光具座
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(W * 0.04, cy); ctx.lineTo(W * 0.98, cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#37474F'; ctx.fillRect(W * 0.06, H * 0.7, W * 0.88, 8);
    // 插槽标记
    for (let i = 0; i < OB_SLOTS; i++) {
      const sx = slotX(i);
      ctx.fillStyle = s.items[i] ? '#607D8B' : 'rgba(255,255,255,0.3)';
      ctx.fillRect(sx - 2, H * 0.7 - 8, 4, 16);
      if (!s.items[i]) {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(sx, cy - H * 0.15); ctx.lineTo(sx, cy + H * 0.15); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // 物体（蜡烛箭头）
    const xo = W * 0.1, hpx = p.objH * H * 0.028;
    arrowVLine(ctx, xo, cy, xo, cy - hpx, '#66BB6A', false);
    // 光学元件表
    const fC = W * 0.18;
    const lenses = [];
    let screenX = null;
    for (let i = 0; i < OB_SLOTS; i++) {
      const it = s.items[i];
      if (!it) continue;
      const sx = slotX(i);
      if (it === 'convex') lenses.push({ x: sx, f: fC });
      else if (it === 'concave') lenses.push({ x: sx, f: -fC * 1.2 });
      else if (it === 'screen' && screenX === null) screenX = sx;
      // 画元件
      const lh = H * 0.15, ah = 10;
      if (it === 'convex' || it === 'concave') {
        ctx.strokeStyle = '#4FC3F7'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx, cy - lh); ctx.lineTo(sx, cy + lh); ctx.stroke();
        const dir = it === 'convex' ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(sx - ah, cy - lh + dir * ah); ctx.lineTo(sx, cy - lh); ctx.lineTo(sx + ah, cy - lh + dir * ah);
        ctx.moveTo(sx - ah, cy + lh - dir * ah); ctx.lineTo(sx, cy + lh); ctx.lineTo(sx + ah, cy + lh - dir * ah);
        ctx.stroke();
      } else if (it === 'screen') {
        ctx.fillStyle = '#CFD8DC'; ctx.fillRect(sx - 3, cy - H * 0.17, 6, H * 0.34);
      }
    }
    const xEnd = screenX !== null ? screenX : W * 0.97;
    // 从物顶发出的光线扇（对准第一个透镜口径展开）
    const tipY = cy - hpx;
    const spreads = [-H * 0.1, -H * 0.04, 0.001, H * 0.05];
    const rayYs = [];
    spreads.forEach(sp2 => {
      const u0 = lenses.length ? ((cy + sp2) - tipY) / (lenses[0].x - xo) : sp2 / (W * 0.4);
      const pts = obTraceRay(xo, tipY, u0, lenses, cy, xEnd);
      ctx.strokeStyle = 'rgba(255,235,59,0.75)'; ctx.lineWidth = 1.8; ctx.beginPath();
      pts.forEach((pt, i) => { i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]); });
      ctx.stroke();
      rayYs.push(pts[pts.length - 1][1]);
    });
    // 光屏上的光斑：光线汇聚范围（聚焦=亮点，弥散=光带）
    let sharp = null;
    if (screenX !== null && lenses.length) {
      const ymin = Math.min.apply(null, rayYs), ymax = Math.max.apply(null, rayYs);
      const spread = ymax - ymin;
      sharp = spread < 9;
      ctx.fillStyle = sharp ? 'rgba(255,241,118,0.95)' : 'rgba(255,241,118,0.45)';
      ctx.fillRect(screenX - 3, Math.min(ymin, cy + H * 0.17) - 3, 6, Math.max(spread + 6, 6));
    }
    // 解析成像（级联薄透镜公式）
    const res = lenses.length ? obCascade(lenses, xo, hpx) : null;
    if (res && res.ok && res.x < W * 1.4 && res.x > 0) {
      arrowVLine(ctx, res.x, cy, res.x, cy - res.h, '#EF5350', res.virtual);
    }
    const imgDesc = !lenses.length ? '请放置透镜' : (!res.ok ? '平行光（不成像）' : (res.virtual ? '虚像·' : '实像·') + (res.h * hpx < 0 ? '倒立' : '正立') + ' ' + Math.abs(res.h / hpx).toFixed(2) + '×');
    readout(ctx, [['透镜数', lenses.length + ''], ['成像', imgDesc], ['光屏', screenX === null ? '未放置' : (sharp ? '清晰成像 🎉' : '模糊（移动光屏）')], ['提示', '点插槽放置/删除元件']]);
  }
};

// ===== 自由电路搭建（组件化沙盒）=====
// 高斯消元解线性方程组（节点电压法用）
function gaussSolve(A, b) {
  const n = b.length, M = A.map((row, i) => row.concat(b[i]));
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r2 = c + 1; r2 < n; r2++) if (Math.abs(M[r2][c]) > Math.abs(M[piv][c])) piv = r2;
    const t = M[c]; M[c] = M[piv]; M[piv] = t;
    if (Math.abs(M[c][c]) < 1e-12) continue;
    for (let r2 = 0; r2 < n; r2++) {
      if (r2 === c) continue;
      const f = M[r2][c] / M[c][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r2][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => Math.abs(row[i]) > 1e-12 ? row[n] / row[i] : 0);
}
const CL_COLS = 4, CL_ROWS = 3;
const CL_SPEC = { wire: { r: 0.02 }, battery: { r: 0.5, emf: 6 }, bulb: { r: 5 }, resistor: { r: 10 }, switch: { r: 0.02 } };
function clSlots() {
  const slots = [];
  for (let r = 0; r < CL_ROWS; r++) for (let c = 0; c < CL_COLS - 1; c++) slots.push({ id: 'h' + r + c, a: r * CL_COLS + c, b: r * CL_COLS + c + 1, r, c, horiz: true });
  for (let r = 0; r < CL_ROWS - 1; r++) for (let c = 0; c < CL_COLS; c++) slots.push({ id: 'v' + r + c, a: r * CL_COLS + c, b: (r + 1) * CL_COLS + c, r, c, horiz: false });
  return slots;
}
const circuitlab = {
  id: 'circuitlab', title: '自由电路搭建', sub: '自选元件 / 任意连接 / 实时求解', category: '电磁', color: '#F4511E', emoji: '🧰',
  hint: '选择元件后点按插槽，或按住拖动连续铺设',
  params: [],
  actions: [
    { label: s => (s.tool === 'wire' ? '✔ ' : '') + '➖ 导线', on(s) { s.tool = 'wire'; } },
    { label: s => (s.tool === 'battery' ? '✔ ' : '') + '🔋 电池', on(s) { s.tool = 'battery'; } },
    { label: s => (s.tool === 'bulb' ? '✔ ' : '') + '💡 灯泡', on(s) { s.tool = 'bulb'; } },
    { label: s => (s.tool === 'resistor' ? '✔ ' : '') + '〰 电阻', on(s) { s.tool = 'resistor'; } },
    { label: s => (s.tool === 'switch' ? '✔ ' : '') + '🔘 开关', on(s) { s.tool = 'switch'; } },
    { label: s => (s.tool === 'delete' ? '✔ ' : '') + '🗑 删除', on(s) { s.tool = 'delete'; } },
    { label: '清空', on(s) { s.comps = {}; s.dirty = true; } }
  ],
  init() {
    // 预置一个能亮的简单回路：电池 + 导线 + 灯泡
    return {
      comps: { v00: { type: 'battery' }, h00: { type: 'wire' }, v01: { type: 'bulb' }, h10: { type: 'wire' } },
      tool: 'wire', dirty: true, phase: 0, V: null, cur: {}, buzz: 0, W: 360, H: 500
    };
  },
  step(s, p, dt) {
    if (dt > 0) s.phase += dt;
    if (!s.dirty) return;
    s.dirty = false;
    // 节点电压法：G·V = I，接地取节点0，各节点加微小漏电导保证矩阵非奇异
    const n = CL_COLS * CL_ROWS;
    const G = Array.from({ length: n }, () => new Array(n).fill(0));
    const I = new Array(n).fill(0);
    for (let k = 0; k < n; k++) G[k][k] = 1e-9;
    const slots = clSlots();
    slots.forEach(sl => {
      const c = s.comps[sl.id];
      if (!c) return;
      if (c.type === 'switch' && c.open) return;
      const spec = CL_SPEC[c.type], g = 1 / spec.r;
      G[sl.a][sl.a] += g; G[sl.b][sl.b] += g; G[sl.a][sl.b] -= g; G[sl.b][sl.a] -= g;
      if (spec.emf) { I[sl.a] -= g * spec.emf; I[sl.b] += g * spec.emf; }
    });
    for (let j = 0; j < n; j++) G[0][j] = 0;
    G[0][0] = 1; I[0] = 0;
    const V = gaussSolve(G, I);
    s.V = V; s.cur = {};
    slots.forEach(sl => {
      const c = s.comps[sl.id];
      if (!c || (c.type === 'switch' && c.open)) { if (c) s.cur[sl.id] = 0; return; }
      const spec = CL_SPEC[c.type];
      s.cur[sl.id] = (V[sl.a] - V[sl.b] + (spec.emf || 0)) / spec.r;
    });
  },
  onTap(s, p, x, y) {
    const W = s.W || 360, H = s.H || 500;
    const gx = W * 0.12, gy = H * 0.1, gw = W * 0.76, gh = H * 0.6;
    const nx = c => gx + c * gw / (CL_COLS - 1), ny = r => gy + r * gh / (CL_ROWS - 1);
    let best = null, bd = 1e9;
    clSlots().forEach(sl => {
      const mx = sl.horiz ? (nx(sl.c) + nx(sl.c + 1)) / 2 : nx(sl.c);
      const my = sl.horiz ? ny(sl.r) : (ny(sl.r) + ny(sl.r + 1)) / 2;
      const d = Math.hypot(x - mx, y - my);
      if (d < bd) { bd = d; best = sl; }
    });
    if (!best || bd > 46) return;
    const existing = s.comps[best.id];
    if (s.tool === 'delete') { if (existing) { delete s.comps[best.id]; s.buzz = (s.buzz | 0) + 1; } }
    else if (existing && existing.type === 'switch' && s.tool !== 'switch') { existing.open = !existing.open; s.buzz = (s.buzz | 0) + 1; }
    else if (existing && existing.type === s.tool) return;
    else { s.comps[best.id] = { type: s.tool, open: false }; s.buzz = (s.buzz | 0) + 1; }
    s.dirty = true;
  },
  onDragStart(s, p, x, y) {
    circuitlab.onTap(s, p, x, y);
    s.dragBuild = true;
    return true;
  },
  onDragMove(s, p, x, y) {
    if (s.dragBuild) circuitlab.onTap(s, p, x, y);
  },
  onDragEnd(s) { s.dragBuild = false; },
  draw(ctx, W, H, s) {
    s.W = W; s.H = H;
    ctx.fillStyle = '#FFF8F3'; ctx.fillRect(0, 0, W, H);
    const gx = W * 0.12, gy = H * 0.1, gw = W * 0.76, gh = H * 0.6;
    const nx = c => gx + c * gw / (CL_COLS - 1), ny = r => gy + r * gh / (CL_ROWS - 1);
    // 空插槽（浅虚线，提示可放元件）
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
    clSlots().forEach(sl => {
      if (s.comps[sl.id]) return;
      ctx.beginPath();
      if (sl.horiz) { ctx.moveTo(nx(sl.c) + 8, ny(sl.r)); ctx.lineTo(nx(sl.c + 1) - 8, ny(sl.r)); }
      else { ctx.moveTo(nx(sl.c), ny(sl.r) + 8); ctx.lineTo(nx(sl.c), ny(sl.r + 1) - 8); }
      ctx.stroke();
    });
    ctx.setLineDash([]);
    // 元件
    let totalP = 0, batI = 0;
    clSlots().forEach(sl => {
      const c = s.comps[sl.id];
      if (!c) return;
      const x1 = nx(sl.c), y1 = ny(sl.r);
      const x2 = sl.horiz ? nx(sl.c + 1) : x1, y2 = sl.horiz ? y1 : ny(sl.r + 1);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const ux = (x2 - x1) / Math.hypot(x2 - x1, y2 - y1), uy = (y2 - y1) / Math.hypot(x2 - x1, y2 - y1);
      const px2 = -uy, py2 = ux;
      const Icur = s.cur[sl.id] || 0;
      ctx.strokeStyle = '#37474F'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      if (c.type === 'wire') {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      } else if (c.type === 'battery') {
        batI = Math.max(batI, Math.abs(Icur));
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(mx - ux * 8, my - uy * 8); ctx.moveTo(mx + ux * 8, my + uy * 8); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx - ux * 4 - px2 * 14, my - uy * 4 - py2 * 14); ctx.lineTo(mx - ux * 4 + px2 * 14, my - uy * 4 + py2 * 14); ctx.stroke();
        ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(mx + ux * 4 - px2 * 7, my + uy * 4 - py2 * 7); ctx.lineTo(mx + ux * 4 + px2 * 7, my + uy * 4 + py2 * 7); ctx.stroke();
      } else if (c.type === 'bulb') {
        const Pw = Icur * Icur * CL_SPEC.bulb.r; totalP += Pw;
        const br = Math.min(Pw / 6, 1);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(mx - ux * 12, my - uy * 12); ctx.moveTo(mx + ux * 12, my + uy * 12); ctx.lineTo(x2, y2); ctx.stroke();
        if (br > 0.02) { ctx.fillStyle = 'rgba(255,238,88,' + (br * 0.7) + ')'; ctx.beginPath(); ctx.arc(mx, my, 20, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx, my, 11, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,143,0,' + (0.4 + br * 0.6) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(mx, my, 11, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mx - 6, my + 5); ctx.lineTo(mx, my - 5); ctx.lineTo(mx + 6, my + 5); ctx.stroke();
      } else if (c.type === 'resistor') {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(mx - ux * 16, my - uy * 16); ctx.moveTo(mx + ux * 16, my + uy * 16); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = '#EF6C00'; ctx.beginPath(); ctx.moveTo(mx - ux * 16, my - uy * 16);
        for (let i = 1; i <= 6; i++) { const f = -16 + i * 32 / 6, side = (i % 2 ? 8 : -8), zz = i === 6 ? 0 : side; ctx.lineTo(mx + ux * f + px2 * zz, my + uy * f + py2 * zz); }
        ctx.stroke();
      } else if (c.type === 'switch') {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(mx - ux * 14, my - uy * 14); ctx.moveTo(mx + ux * 14, my + uy * 14); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.fillStyle = '#37474F';
        ctx.beginPath(); ctx.arc(mx - ux * 14, my - uy * 14, 4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + ux * 14, my + uy * 14, 4, 0, 7); ctx.fill();
        ctx.strokeStyle = c.open ? '#C62828' : '#2E7D32'; ctx.lineWidth = 3.5; ctx.beginPath();
        ctx.moveTo(mx - ux * 14, my - uy * 14);
        if (c.open) ctx.lineTo(mx + ux * 10 + px2 * 16, my + uy * 10 + py2 * 16);
        else ctx.lineTo(mx + ux * 14, my + uy * 14);
        ctx.stroke();
      }
      // 电流流动动画（方向和速度跟随求解结果）
      if (Math.abs(Icur) > 0.02 && c.type !== 'bulb') {
        ctx.fillStyle = '#1565C0';
        for (let j = 0; j < 2; j++) {
          let f = (s.phase * Icur * 0.35 + j / 2) % 1; f = (f % 1 + 1) % 1;
          ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, 3, 0, 7); ctx.fill();
        }
      }
    });
    // 节点
    for (let r = 0; r < CL_ROWS; r++) for (let c = 0; c < CL_COLS; c++) {
      ctx.fillStyle = '#8D6E63'; ctx.beginPath(); ctx.arc(nx(c), ny(r), 5, 0, 7); ctx.fill();
    }
    const toolName = { wire: '导线', battery: '电池(6V)', bulb: '灯泡', resistor: '电阻(10Ω)', switch: '开关', delete: '删除' }[s.tool];
    readout(ctx, [['当前元件', toolName], ['电池电流', batI.toFixed(2) + ' A'], ['灯泡总功率', totalP.toFixed(1) + ' W'], ['提示', '点击虚线插槽放置元件']]);
  }
};

const SIMS = [projectile, pendulum, springs, coupled, skate, collision, forces, friction2, impulse, ramp, hooke, circular, buoyancy, density, lever, orbit, kepler, moonphase, gravityForce, pulley, freefall, elevator, shmgraph, fluidpressure, bernoulli, brachistochrone, resonance, newtoncradle, torque, hydraulic, springcombo, wave, bending, prism, optics, interference, doppler, sound, mirror, pinhole, colormix, echo, standingwave, wavesuperpose, beats, polarization, diffraction, fiberoptics, opticsbench, circuitlab, circuit, charges, coulomb, faraday, capacitor, magnet, resistivity, oersted, seriesParallel, staticElectricity, generator, emwave, dcmotor, transformer, lenz, potentiometer, rccircuit, lc, crt, gas, calorimetry, brownian, idealgas, statesOfMatter, heatconduction, maxwell, heatengine, atom, decay, photoelectric, energylevels, spectrum, chainreaction, massspec, radiation, ph, concentration, stoichiometry, reactionrate, chemmix, electrolysis, mlp, convnet, attention, gradientdescent, linreg, kmeans, overfit, embedding, activation];
const CATEGORIES = ['力学', '波动与光', '电磁', '热学', '原子', '化学', '人工智能'];
function getSim(id) { return SIMS.find(s => s.id === id); }

// 自动标记「静态仿真」：step 为空实现 => 画面只在用户交互时才变化，
// 无需 60fps 持续重绘（对 prism 光线追踪、charges 场网格等重绘制尤其省电）。
SIMS.forEach(s => {
  const draw = s.draw;
  s.draw = function(ctx, W, H, state, params) {
    const previous = activeDrawMeta;
    activeDrawMeta = { id: s.id, W, H };
    try { return draw.call(s, ctx, W, H, state, params); }
    finally { activeDrawMeta = previous; }
  };
  const fn = s.step.toString().replace(/\s/g, '');
  s.static = /step\([^)]*\)\{\}/.test(fn);
});

module.exports = { SIMS, CATEGORIES, getSim, READOUT_PLACEMENTS };
