// Built from Matcha Lemonade/source/illustration/ by build.sh. Do not edit by hand.
"use strict";
// ===========================================================================
// Shared story engine: scroll -> progress -> scene state, captions, sound.
// The scene is a pure function of scroll progress, so nothing moves while the
// page is still and scrolling back plays the story in reverse.
// ===========================================================================
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

// World units: glass outer radius 1, y up, z toward the viewer.
const GLASS = { R: 1.0, RI: 0.93, H: 2.2, BASE: 0.18 };
const LEVEL = { lemonade: 1.12, perStar: 0.012, matcha: 0.62 };
const LEMON = { r: 0.4, rest: [-0.27, 0.64, 0.55], restRot: -0.38 };
const STARS = [
  { x: -0.42, z: -0.22, rot: 0.3, s: 0.28 },
  { x: 0.4, z: -0.36, rot: -0.5, s: 0.27 },
  { x: 0.04, z: 0.1, rot: 0.9, s: 0.3 },
  { x: -0.3, z: 0.46, rot: -0.2, s: 0.26 },
  { x: 0.5, z: 0.3, rot: 0.6, s: 0.27 },
];
// Progress windows for the five drink steps, one per portfolio section.
const STEPS = [
  { a: 0.05, b: 0.24 },  // 01 Lemonade
  { a: 0.24, b: 0.40 },  // 02 Lemon
  { a: 0.40, b: 0.60 },  // 03 Star ice
  { a: 0.60, b: 0.80 },  // 04 Matcha
  { a: 0.80, b: 0.96 },  // 05 From above
];
const local = (p, i) => clamp01((p - STEPS[i].a) / (STEPS[i].b - STEPS[i].a));
const STAR_WIN = (k) => ({ start: k * 0.16, len: 0.36 });
const IMPACT = { fall: 0.35 };

// Damped bob after an object lands: starts `lift` above rest, heading down.
function bob(u, lift, v0) { return Math.exp(-3 * u) * (lift * Math.cos(7 * u) - (v0 / 7) * Math.sin(7 * u)); }

function sceneState(p) {
  const S = { p, pour: null, ripples: [], stars: [], lemon: null, plume: null };
  // 01 Lemonade
  const t1 = local(p, 0);
  S.lemonadeLevel = lerp(GLASS.BASE, LEVEL.lemonade, smooth((t1 - 0.06) / 0.86));
  // 03 Star ice (computed before the surface so displacement is known)
  const t3 = local(p, 2);
  let landed = 0;
  const starT = STARS.map((st, k) => {
    const w = STAR_WIN(k), tau = (t3 - w.start) / w.len;
    if (tau > IMPACT.fall) landed += clamp01((tau - IMPACT.fall) / 0.2);
    return tau;
  });
  // 04 Matcha
  const t4 = local(p, 3);
  const pl = Math.sin(Math.PI * clamp01((t4 - 0.06) / 0.72));
  S.matchaThick = LEVEL.matcha * smooth((t4 - 0.1) / 0.75);
  S.boundary = S.lemonadeLevel + landed * LEVEL.perStar;
  S.surface = S.boundary + S.matchaThick;
  S.boundaryBlur = 0.03 + 0.16 * pl;
  S.matchaAmt = smooth((t4 - 0.04) / 0.2);
  if (pl > 0.001) S.plume = { x: 0.12, amount: pl, depth: 0.15 + 0.45 * pl, radius: 0.16 + 0.3 * pl };
  // Pour streams (head = lower end, tail = upper end, world y)
  const TOP = GLASS.H + 3.2;
  const stream = (t, kind, x, w) => {
    if (t <= 0 || t >= 1) return null;
    const head = lerp(TOP, S.surface, smooth(t / 0.08));
    const tail = lerp(TOP, S.surface, smooth((t - 0.86) / 0.12));
    if (tail <= S.surface + 0.01) return null;
    return { kind, x, w, head, tail, t };
  };
  S.pour = stream(t1, 'lemonade', 0.2, 0.085) || stream(t4, 'matcha', 0.14, 0.12);
  if (S.pour) for (let k = 0; k < 3; k++) {
    const ph = (S.pour.t * 14 + k / 3) % 1;
    S.ripples.push({ x: S.pour.x, z: 0.05, r: 0.08 + ph * 0.42, a: (1 - ph) * 0.6 });
  }
  // 02 Lemon: drops in, then sinks and settles against the front of the glass
  const t2 = local(p, 1);
  if (t2 > 0) {
    const start = [0.12, GLASS.H + 1.6, 0.05], entry = [0.1, S.lemonadeLevel + 0.12, 0.2];
    let pos, rot;
    if (t2 < 0.4) {
      const u = (t2 / 0.4) ** 2;
      pos = start.map((v, i) => lerp(v, entry[i], u)); rot = lerp(0.4, 0.1, u);
    } else {
      const u = smooth((t2 - 0.4) / 0.6);
      pos = entry.map((v, i) => lerp(v, LEMON.rest[i], u));
      pos[1] += bob((t2 - 0.4) * 5, 0, 1.2) * (1 - u);
      rot = lerp(0.1, LEMON.restRot, u);
    }
    S.lemon = { x: pos[0], y: pos[1], z: pos[2], rot };
    const ri = (t2 - 0.4) / 0.35;
    if (ri > 0 && ri < 1) S.ripples.push({ x: 0.1, z: 0.2, r: 0.1 + ri * 0.6, a: (1 - ri) * 0.7 });
  }
  // Stars: fall, dip, bob, then ride the surface
  STARS.forEach((st, k) => {
    const tau = starT[k];
    if (tau <= 0) return;
    const rest = S.surface - 0.07;
    let y, rot = st.rot;
    if (tau < IMPACT.fall) {
      const u = (tau / IMPACT.fall) ** 2;
      y = lerp(GLASS.H + 1.5, rest + 0.12, u); rot = st.rot + (1 - u) * 1.4;
    } else {
      const u = Math.min((tau - IMPACT.fall) / (1 - IMPACT.fall), 1) * 2.4;
      y = rest + bob(u, 0.12, 2.0); rot = st.rot + bob(u, 0, 0.8) * 0.5;
      const ri = (tau - IMPACT.fall) / 0.3;
      if (ri > 0 && ri < 1) S.ripples.push({ x: st.x, z: st.z, r: 0.08 + ri * 0.4, a: (1 - ri) * 0.6 });
    }
    S.stars.push({ x: st.x, y, z: st.z, rot, s: st.s, k });
  });
  // 05 From above
  S.view = smooth(local(p, 4));
  return S;
}
// Progress values where impacts happen (for sounds).
const EVENTS = [{ p: STEPS[1].a + (STEPS[1].b - STEPS[1].a) * 0.4, kind: 'plop' }]
  .concat(STARS.map((_, k) => ({ p: STEPS[2].a + (STEPS[2].b - STEPS[2].a) * (STAR_WIN(k).start + STAR_WIN(k).len * IMPACT.fall), kind: 'clink' })));

// ---------------------------------------------------------------------------
// Sound (off by default): pour noise follows scroll speed; plop; ice clinks.
// ---------------------------------------------------------------------------
const Sound = {
  on: false, ctx: null, pourGain: null, pourFilter: null,
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(ctx.destination); src.start();
    Object.assign(this, { ctx, pourGain: g, pourFilter: f, noise: buf });
  },
  pour(level, kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, on = this.on ? Math.min(level, 1) : 0;
    this.pourGain.gain.setTargetAtTime(on * 0.22, t, 0.06);
    this.pourFilter.frequency.setTargetAtTime((kind === 'matcha' ? 520 : 820) + Math.random() * 260, t, 0.05);
  },
  clink() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, j = 0.9 + Math.random() * 0.2;
    for (const [fq, a, d] of [[2250, 0.12, 0.35], [3480, 0.07, 0.22], [5100, 0.04, 0.12]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = fq * j; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02);
    }
  },
  plop() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.25);
  },
};

// ---------------------------------------------------------------------------
// Story loop: section positions -> progress, smoothed; render only on change.
// Each section plays its drink step while its top moves from 60% to 10% of
// the reading area (the window below the header, and below the glass strip
// on phones), then holds while the visitor reads, so a long section doesn't
// stretch its animation. Starting at 60% means the step and caption change
// only once the section has really taken over the screen.
// ---------------------------------------------------------------------------
const PLAY = { from: 0.6, to: 0.1 };
const Story = {
  shown: 0, target: 0, boil: 0, lastBoil: 0, dirty: true, idx: -2,
  init(opts) {
    this.render = opts.render;
    // Reduced motion: no pouring or dropping, each step appears finished.
    this.calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.boilMs = this.calm ? 0 : (opts.boilMs || 0);
    const $ = (id) => document.getElementById(id);
    this.secs = [...document.querySelectorAll('main .sec')];
    this.links = [...document.querySelectorAll('.steps a')];
    this.cap = { box: document.querySelector('#step .inner'), label: $('capLabel'), name: $('capName'), desc: $('capDesc') };
    this.heroCap = { text: this.cap.desc.textContent, draft: this.cap.desc.hasAttribute('data-draft') };
    $('bTop').onclick = () => {
      window.scrollTo({ top: 0, behavior: this.calm ? 'auto' : 'smooth' });
      setTimeout(() => { if (scrollY > 2) window.scrollTo(0, 0); }, 1400);
    };
    $('bSound').onclick = () => {
      Sound.on = !Sound.on; if (Sound.on) Sound.start();
      $('bSound').textContent = 'Sound: ' + (Sound.on ? 'On' : 'Off');
      $('bSound').setAttribute('aria-pressed', String(Sound.on));
      if (!Sound.on) Sound.pour(0);
    };
    addEventListener('resize', () => { this.dirty = true; });
    // A deep link (or a header step link) shows that step already finished.
    const snap = () => { this.readScroll(); this.shown = this.target; this.dirty = true; };
    addEventListener('load', snap); addEventListener('hashchange', snap);
    if (document.fonts) document.fonts.ready.then(snap);
    // Arriving without a deep link always starts at the intro, never at a restored scroll spot.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (!location.hash) { scrollTo(0, 0); addEventListener('load', () => { if (!location.hash) scrollTo(0, 0); }); }
    this.readScroll(); this.shown = this.target;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      this.readScroll();
      const prev = this.shown;
      this.shown += (this.target - this.shown) * (1 - Math.exp(-9 * dt));
      if (this.calm || Math.abs(this.target - this.shown) < 2e-5) this.shown = this.target;
      const moving = this.shown !== prev;
      if (moving && this.boilMs && now - this.lastBoil > this.boilMs) { this.boil++; this.lastBoil = now; }
      if (moving || this.dirty) {
        this.dirty = false;
        this.render(this.shown, this.boil);
      }
      this.sounds(prev, this.shown, dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
  readScroll() {
    // The reading area starts below the fixed header (and the phone's glass strip).
    const top0 = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const area = innerHeight - top0;
    const from = top0 + area * PLAY.from, to = top0 + area * PLAY.to;
    let p = 0, idx = -1;
    this.secs.forEach((el, i) => {
      const t = clamp01((from - el.getBoundingClientRect().top) / Math.max(from - to, 1));
      if (t > 0) { idx = i; p = this.calm ? STEPS[i].b : lerp(STEPS[i].a, STEPS[i].b, t); }
    });
    this.target = p;
    if (idx !== this.idx) this.setStep(idx);
  },
  // Caption and header highlight follow the section whose drink step is playing
  // (the first header link is Home, current while the intro shows).
  // The caption text is copied from the section itself (eyebrow, heading, intro).
  setStep(i) {
    const first = this.idx === -2;
    this.idx = i;
    this.links.forEach((a, k) => (k === i + 1 ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    const c = this.cap, sec = this.secs[i];
    const set = () => {
      const intro = sec && sec.querySelector('.sec-intro');
      c.label.textContent = sec ? sec.querySelector('.sec-eyebrow').textContent : '';
      c.name.textContent = sec ? sec.querySelector('h2').textContent : '';
      c.desc.textContent = intro ? intro.textContent : this.heroCap.text;
      c.desc.toggleAttribute('data-draft', intro ? intro.hasAttribute('data-draft') : this.heroCap.draft);
      c.box.classList.remove('out');
    };
    clearTimeout(this.capTimer);
    if (first || this.calm) { set(); return; }   // no fade on page load, only between steps
    c.box.classList.add('out');
    this.capTimer = setTimeout(set, 180);
  },
  sounds(prev, cur, dt) {
    const S = sceneState(cur);
    const speed = Math.abs(cur - prev) / Math.max(dt, 1e-3);
    Sound.pour(S.pour ? speed * 12 : 0, S.pour && S.pour.kind);
    if (cur > prev) for (const e of EVENTS) if (prev < e.p && cur >= e.p) (e.kind === 'plop' ? Sound.plop() : Sound.clink());
  },
};

// ===========================================================================
// Ink + watercolor toolkit (Canvas 2D, everything generated in code)
// ===========================================================================
const canvas = document.getElementById('art');
const ctx = canvas.getContext('2d');
let W = 1, Hpx = 1, DPR = 1, BOIL = 0;
const PAL = {
  paper: '#f4ecdb', wall: '#efe2c8', wallLight: '#f9f1e0',
  wood: '#d0a06c', woodDark: '#a9743f', woodEdge: '#8a5a31', shadow: '#6f604c',
  glass: '#c9d8d6', lemonade: '#f5d65a', lemonadeLight: '#fbe9a0',
  matcha: '#a9cd7d', matchaDeep: '#87b35f', matchaLight: '#c9e2a4',
  peel: '#efbf2c', pith: '#fbf4dc', pulp: '#f6d35a', pulpLight: '#fae59a',
  ice: '#eef8f1', iceEdge: '#a9ccb6', ink: '#2d3228',
};
function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Tileable value-noise texture used for paper grain and pigment granulation.
function noiseTile(size, cells, octaves, seed, colorFn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), r = mulberry(seed);
  const grids = [];
  for (let o = 0; o < octaves; o++) { const n = cells << o, a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = r(); grids.push({ n, a }); }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, amp = 0.5, tot = 0;
    for (const { n, a } of grids) {
      const fx = (x / size) * n, fy = (y / size) * n, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => a[((j % n) * n) + (i % n)];
      const v0 = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx, v1 = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
      v += (v0 + (v1 - v0) * sy) * amp; tot += amp; amp *= 0.5;
    }
    const [cr, cg, cb, ca] = colorFn(v / tot, r());
    const k = (y * size + x) * 4; img.data[k] = cr; img.data[k + 1] = cg; img.data[k + 2] = cb; img.data[k + 3] = ca;
  }
  g.putImageData(img, 0, 0);
  return c;
}
let paperPat = null, grainPat = null;
function makeTextures() {
  const paper = noiseTile(256, 6, 5, 11, (v, w) => {
    const fiber = w > 0.985 ? 60 : 0;
    return [120, 96, 70, Math.max(0, (v - 0.35) * 70 + fiber + (w - 0.5) * 22)];
  });
  const grain = noiseTile(256, 18, 3, 23, (v, w) => [90, 80, 60, Math.max(0, (v - 0.45) * 330 + (w - 0.5) * 40)]);
  paperPat = ctx.createPattern(paper, 'repeat');
  grainPat = ctx.createPattern(grain, 'repeat');
}

// A wash: a few slightly offset transparent layers (uneven, bleeding edges),
// pigment pooling along the edge, granulation, and a couple of soft blooms.
function pathFrom(pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
function bbox(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8];
}
function wash(pts, color, o = {}) {
  if (!pts || pts.length < 3) return;
  const r = mulberry(o.seed || 1), a = o.alpha ?? 0.85, jit = (o.jit ?? 2.2) * DPR;
  ctx.save();
  ctx.fillStyle = o.fill || color;
  const weights = [0.55, 0.3, 0.3];
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.translate((r() - 0.5) * jit, (r() - 0.5) * jit);
    ctx.globalAlpha = a * weights[i];
    ctx.beginPath(); pathFrom(pts); ctx.fill(); ctx.restore();
  }
  ctx.beginPath(); pathFrom(pts);
  ctx.globalAlpha = o.edge ?? 0.32; ctx.strokeStyle = o.edgeColor || color; ctx.lineWidth = (o.edgeW ?? 2.2) * DPR; ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.clip();
  const [bx, by, bw, bh] = bbox(pts);
  if ((o.grain ?? 0.22) > 0) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = o.grain ?? 0.22; ctx.fillStyle = grainPat; ctx.fillRect(bx, by, bw, bh); }
  ctx.globalCompositeOperation = 'source-over';
  const blooms = o.blooms ?? 2;
  for (let i = 0; i < blooms; i++) {
    const cx = bx + r() * bw, cy = by + r() * bh, rad = Math.max(bw, bh) * (0.15 + r() * 0.25);
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    gr.addColorStop(0, 'rgba(255,252,240,0.32)'); gr.addColorStop(0.7, 'rgba(255,252,240,0.08)'); gr.addColorStop(1, 'rgba(255,252,240,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}
// Wobbly ink line. The wobble is seeded by BOIL, which only advances while
// the user is scrolling, so the drawing freezes when the page is still.
function ink(pts, o = {}) {
  if (!pts || pts.length < 2) return;
  const closed = !!o.closed, n = pts.length;
  const base = (o.seed || 3) * 7919;
  const pass = (k, width, alpha) => {
    const r = mulberry(base + BOIL * 104729 + k * 31337);
    const amp = (o.amp ?? 1.0) * DPR, ph = r() * 6.28, fr = 0.25 + r() * 0.25;
    const q = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const off = amp * (Math.sin(i * fr + ph) * 0.8 + (r() - 0.5) * 0.7);
      return [p[0] + nx * off, p[1] + ny * off];
    });
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]);
    for (let i = 1; i < n - 1; i++) { const mx = (q[i][0] + q[i + 1][0]) / 2, my = (q[i][1] + q[i + 1][1]) / 2; ctx.quadraticCurveTo(q[i][0], q[i][1], mx, my); }
    ctx.lineTo(q[n - 1][0], q[n - 1][1]);
    if (closed) ctx.closePath();
    ctx.globalAlpha = alpha; ctx.lineWidth = width * DPR; ctx.stroke();
  };
  ctx.save();
  ctx.strokeStyle = o.color || PAL.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const w = o.w ?? 1.5, al = o.alpha ?? 0.88;
  pass(0, w, al);
  pass(1, w * 0.5, al * 0.4);
  ctx.restore();
}
// White gouache-like highlight stroke (slightly broken).
function highlight(pts, width, alpha, seed) {
  const r = mulberry(seed);
  ctx.save(); ctx.strokeStyle = '#fffdf6'; ctx.lineCap = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    if (r() < 0.12) continue;
    ctx.globalAlpha = alpha * (0.7 + r() * 0.3); ctx.lineWidth = width * DPR * (0.75 + r() * 0.4);
    ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 2.5D orthographic view: tilt phi from eye level (side) to straight down (top)
// ---------------------------------------------------------------------------
const VIEW = { phi: 0, c: 1, s: 0, S: 100, cx: 0, cy: 0, vT: 0 };
function setView(e) {
  // Laptop: tall panel on the left, glass centered above the caption.
  // Phone: short strip under the header, glass on the left, caption on the right.
  const strip = Hpx < W;
  const phi = lerp(10, 90, e) * Math.PI / 180;
  VIEW.phi = phi; VIEW.c = Math.cos(phi); VIEW.s = Math.sin(phi);
  const hh = Hpx, ww = W;
  const Sside = strip ? Math.min(hh * 0.29, ww * 0.16) : Math.min(hh * 0.2, ww * 0.3);
  const Stop = strip ? Math.min(hh * 0.34, ww * 0.18) : Math.min(hh * 0.23, ww * 0.33);
  VIEW.S = lerp(Sside, Stop, e);
  VIEW.cx = ww * (strip ? 0.21 : 0.5); VIEW.cy = hh * (strip ? 0.5 : 0.44);
  VIEW.vT = lerp(1.1, GLASS.H, e) * VIEW.c;
}
function P(x, y, z) { return [VIEW.cx + x * VIEW.S, VIEW.cy - (y * VIEW.c - z * VIEW.s - VIEW.vT) * VIEW.S]; }
// Circle of radius r at height y (world), from angle a0 to a1 (theta=pi/2 is the front).
function arc(y, r, a0, a1, n = 48, cx = 0, cz = 0) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = lerp(a0, a1, i / n); out.push(P(cx + r * Math.cos(t), y, cz + r * Math.sin(t))); }
  return out;
}
function seg(a, b, n = 12) { const out = []; for (let i = 0; i <= n; i++) out.push(P(lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n), lerp(a[2], b[2], i / n))); return out; }
// Silhouette of an upright cylinder slice (sides + front halves of both ends).
function cylinder(y0, y1, r) {
  return [...seg([-r, y1, 0], [-r, y0, 0], 10), ...arc(y0, r, Math.PI, 0, 48), ...seg([r, y0, 0], [r, y1, 0], 10), ...arc(y1, r, 0, Math.PI, 48)];
}

// ===========================================================================
// The illustrated scene
// ===========================================================================
const WALL_Z = -2.2, SHELF_FRONT = 1.8, SHELF_T = 0.42, SHELF_X = 14;
const TAU = Math.PI * 2;

function drawRoom(S) {
  const j = P(0, 0, WALL_Z)[1];
  if (j > 0) {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, PAL.wallLight); g.addColorStop(0.45, PAL.wall); g.addColorStop(1, '#e6d6b8');
    wash([[-20, -20], [W + 20, -20], [W + 20, j + 6], [-20, j + 6]], PAL.wall, { fill: g, alpha: 1.1, grain: 0.12, blooms: 3, seed: 2, edge: 0 });
  }
  const a = P(-SHELF_X, 0, WALL_Z), b = P(SHELF_X, 0, WALL_Z), c = P(SHELF_X, 0, SHELF_FRONT), d = P(-SHELF_X, 0, SHELF_FRONT);
  const e = P(-SHELF_X, -SHELF_T, SHELF_FRONT), f = P(SHELF_X, -SHELF_T, SHELF_FRONT);
  // Under the shelf: the wall continues in soft shade.
  wash([[-20, e[1] - 4], [W + 20, e[1] - 4], [W + 20, Hpx + 20], [-20, Hpx + 20]], '#dccaa6', { alpha: 1.1, grain: 0.12, blooms: 1, seed: 4, edge: 0 });
  wash([a, b, c, d], PAL.wood, { alpha: 1.05, grain: 0.3, blooms: 3, seed: 5, edge: 0.2, edgeColor: PAL.woodDark });
  for (let k = 0; k < 16; k++) {
    const z = lerp(WALL_Z, SHELF_FRONT, (k + 0.5) / 16);
    const pts = seg([-SHELF_X, 0, z], [SHELF_X, 0, z], 60).map((p, i) => [p[0], p[1] + Math.sin(i * 0.4 + k) * 1.5 * DPR * VIEW.s]);
    ink(pts, { color: PAL.woodDark, alpha: 0.22 * VIEW.s + 0.05, w: 1, amp: 0.6, seed: 200 + k });
  }
  wash([d, c, f, e], PAL.woodDark, { alpha: 1.05, grain: 0.25, blooms: 1, seed: 6, edge: 0 });
  ink([d, c], { color: PAL.woodEdge, alpha: 0.7, w: 1.4, seed: 7 });
  ink([e, f], { color: PAL.woodEdge, alpha: 0.5, w: 1.2, seed: 8 });
  if (j > 0) ink([a, b], { color: PAL.woodDark, alpha: 0.35, w: 1.1, seed: 9 });
  highlight(seg([-SHELF_X, 0.001, SHELF_FRONT - 0.03], [SHELF_X, 0.001, SHELF_FRONT - 0.03], 30), 1.6, 0.35, 10);
  // Soft shadow of the glass (light from the left) with a warm yellow glow.
  const side = 1 - S.view;
  wash(arc(0, 1.12, 0, TAU, 64, lerp(0.45, 0.22, S.view), lerp(-0.25, 0.02, S.view)), PAL.shadow, { alpha: lerp(0.22, 0.14, S.view), grain: 0.1, blooms: 0, edge: 0.05, seed: 11 });
  const lit = clamp01((S.lemonadeLevel - GLASS.BASE) / 0.4) * (0.35 + 0.65 * side);
  if (lit > 0) wash(arc(0, 0.55, 0, TAU, 48, lerp(0.9, 0.95, S.view), lerp(-0.1, 0.1, S.view)), PAL.lemonade, { alpha: 0.3 * lit, grain: 0.1, blooms: 1, edge: 0, seed: 12 });
}

function drawGlassBack() {
  wash([...cylinder(0, GLASS.H, GLASS.R), ...arc(GLASS.H, GLASS.R, Math.PI, TAU, 36)], PAL.glass, { alpha: 0.2, grain: 0.05, blooms: 0, edge: 0, seed: 20 });
}

function vGrad(yTop, yBot, stops) {
  const t = P(0, yTop, 0)[1], b = P(0, yBot, 0)[1];
  const g = ctx.createLinearGradient(0, t, 0, Math.max(b, t + 1));
  for (const [o, c] of stops) g.addColorStop(clamp01(o), c);
  return g;
}
function drawLiquid(S) {
  const RI = GLASS.RI;
  if (S.lemonadeLevel <= GLASS.BASE + 0.005) return;
  const blur = S.boundaryBlur, hasM = S.matchaThick > 0.004;
  const yTopL = hasM ? S.boundary + blur * 0.5 : S.surface;
  wash(cylinder(GLASS.BASE, yTopL, RI), PAL.lemonade, {
    fill: vGrad(yTopL, GLASS.BASE, [[0, PAL.lemonadeLight], [0.55, PAL.lemonade], [1, '#eec24a']]),
    alpha: 0.95, grain: 0.2, blooms: 2, seed: 30, edgeColor: '#e0b43a', edge: 0.3 });
  const body = cylinder(GLASS.BASE, S.surface, RI);
  if (S.plume) {
    const pl = S.plume, cy = S.boundary - pl.depth;
    ctx.save(); ctx.beginPath(); pathFrom(body); ctx.clip();
    const blobs = [[pl.x, cy, pl.radius, 1], [pl.x - 0.2, cy - pl.radius * 0.5, pl.radius * 0.6, 0.7], [pl.x + 0.22, cy - pl.radius * 0.3, pl.radius * 0.55, 0.6]];
    for (const [bx, by, br, k] of blobs) {
      const c = P(bx, by, 0.1), r = br * VIEW.S;
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
      g.addColorStop(0, `rgba(158,198,112,${0.85 * pl.amount * k})`); g.addColorStop(0.6, `rgba(158,198,112,${0.45 * pl.amount * k})`); g.addColorStop(1, 'rgba(158,198,112,0)');
      ctx.fillStyle = g; ctx.fillRect(c[0] - r, c[1] - r, r * 2, r * 2);
    }
    const t = P(pl.x, S.boundary, 0.1), bt = P(pl.x, cy, 0.1), cw = pl.radius * 0.7 * VIEW.S;
    const g2 = ctx.createLinearGradient(0, t[1], 0, bt[1]);
    g2.addColorStop(0, `rgba(158,198,112,${0.7 * pl.amount})`); g2.addColorStop(1, 'rgba(158,198,112,0)');
    ctx.fillStyle = g2; ctx.fillRect(t[0] - cw, t[1], cw * 2, bt[1] - t[1]);
    ctx.restore();
  }
  if (hasM) {
    const y0 = S.boundary - blur;
    // The lemonade's top face shows through the matcha's soft edge (side view and tilt): fill it with matcha.
    const tilt = S.matchaAmt;
    if (tilt > 0) wash(arc(S.boundary, RI, 0, TAU, 80), PAL.matcha, { alpha: 0.98 * tilt, grain: 0.2, blooms: 1, edge: 0, seed: 32 });
    wash(cylinder(y0, S.surface, RI), PAL.matcha, {
      fill: vGrad(S.surface, y0, [[0, PAL.matchaLight], [0.35, PAL.matcha], [1 - blur / (S.surface - y0 + 1e-3) * 1.2, PAL.matcha], [1, 'rgba(169,205,125,0)']]),
      alpha: 0.95, grain: 0.24, blooms: 2, seed: 31, edge: 0.18, edgeColor: PAL.matchaDeep });
  }
  // Rounded-cylinder shading: darker toward the sides, a glow on the lit left.
  ctx.save(); ctx.beginPath(); pathFrom(body); ctx.clip();
  const l = P(-RI, 0, 0)[0], r = P(RI, 0, 0)[0];
  const g = ctx.createLinearGradient(l, 0, r, 0);
  g.addColorStop(0, 'rgba(120,95,40,0.16)'); g.addColorStop(0.18, 'rgba(255,250,225,0.14)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(110,90,40,0.2)');
  ctx.fillStyle = g; ctx.fillRect(l, 0, r - l, Hpx);
  ctx.restore();
}

function drawLemon(S) {
  const L = S.lemon; if (!L) return;
  const r = LEMON.r;
  const disc = (rr, a0 = 0, a1 = TAU, n = 56) => {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = lerp(a0, a1, i / n) + L.rot; out.push(P(L.x + rr * Math.cos(t), L.y + rr * Math.sin(t), L.z)); }
    return out;
  };
  const at = (rr, t) => P(L.x + rr * Math.cos(t + L.rot), L.y + rr * Math.sin(t + L.rot), L.z);
  wash(disc(r), PAL.peel, { alpha: 1, grain: 0.25, blooms: 1, seed: 50, edgeColor: '#d49d18', edge: 0.4 });
  wash(disc(r * 0.9), PAL.pith, { alpha: 1, grain: 0.08, blooms: 0, seed: 51, edge: 0.1 });
  for (let k = 0; k < 10; k++) {
    const a = k * TAU / 10 + 0.07, b = (k + 1) * TAU / 10 - 0.07, m = (a + b) / 2;
    const wedge = [at(r * 0.11, m), ...disc(r * 0.82, a, b, 10)];
    wash(wedge, k % 2 ? PAL.pulp : '#f8d964', { alpha: 0.95, grain: 0.22, blooms: 1, seed: 60 + k, edge: 0.35, edgeColor: '#e9b737' });
    for (let v = 0; v < 3; v++) {
      const t = lerp(a + 0.12, b - 0.12, (v + 0.5) / 3);
      highlight([at(r * 0.3, t), at(r * 0.66, t)], 1.4, 0.35, 70 + k * 3 + v);
    }
  }
  wash(disc(r * 0.08), PAL.pith, { alpha: 1, grain: 0, blooms: 0, seed: 52, edge: 0 });
  ink(disc(r), { closed: true, w: 1.5, seed: 53 });
  ink(disc(r * 0.9), { closed: true, w: 0.8, alpha: 0.45, seed: 54 });
  for (let k = 0; k < 10; k++) ink([at(r * 0.1, k * TAU / 10), at(r * 0.84, k * TAU / 10)], { w: 0.7, alpha: 0.4, seed: 55 + k });
  if (L.y < S.surface) wash(disc(r * 1.01), PAL.lemonade, { alpha: 0.14, grain: 0, blooms: 0, edge: 0, seed: 56 });
}

function drawSurface(S) {
  if (S.surface <= GLASS.BASE + 0.005) return;
  const RI = GLASS.RI, pts = arc(S.surface, RI, 0, TAU, 80);
  wash(pts, PAL.lemonadeLight, { alpha: 0.95 * (1 - S.matchaAmt * 0.95), grain: 0.12, blooms: 1, seed: 80, edge: 0.2, edgeColor: '#e3bb45' });
  if (S.matchaAmt > 0) {
    wash(pts, PAL.matchaLight, { alpha: 0.98 * S.matchaAmt, grain: 0.26, blooms: 2, seed: 81, edge: 0.3, edgeColor: PAL.matchaDeep });
    const inner = arc(S.surface, RI * 0.9, 0, TAU, 72);
    wash(inner, PAL.matchaLight, { alpha: 0.35 * S.matchaAmt, grain: 0.1, blooms: 2, seed: 82, edge: 0 });
  }
  ctx.save(); ctx.beginPath(); pathFrom(pts); ctx.clip();
  for (const rp of S.ripples) ink(arc(S.surface, rp.r, 0, TAU, 40, rp.x, rp.z), { closed: true, w: 0.9, alpha: rp.a * 0.55, seed: 83 });
  ctx.restore();
  ink(arc(S.surface, RI, Math.PI, TAU, 40), { w: 1.0, alpha: 0.35, seed: 84 });
  ink(arc(S.surface, RI, 0, Math.PI, 40), { w: 1.3, alpha: 0.7, seed: 85 });
  highlight(arc(S.surface, RI * 0.78, Math.PI * 1.1, Math.PI * 1.42, 12), 2.2, 0.35 * VIEW.s + 0.1, 86);
}

function starPts(cx, cy, rad, rot, n = 70) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU, rr = rad * (0.6 + 0.4 * Math.pow(0.5 + 0.5 * Math.cos(5 * (t - rot)), 1.5));
    out.push([cx + rr * Math.sin(t), cy - rr * Math.cos(t)]);
  }
  return out;
}
function drawStars(S) {
  const topCol = S.matchaAmt > 0.5 ? PAL.matcha : PAL.lemonade;
  const stars = [...S.stars].sort((a, b) => a.z - b.z);
  for (const st of stars) {
    const [cx, cy] = P(st.x, st.y, st.z), rad = st.s * VIEW.S;
    const pts = starPts(cx, cy, rad, st.rot);
    wash(pts, PAL.ice, { alpha: lerp(0.92, 0.66, S.view), grain: 0.08, blooms: 1, seed: 100 + st.k, edge: 0.55, edgeColor: PAL.iceEdge });
    const sy = P(st.x, S.surface, st.z)[1];
    const under = (1 - S.view) * 0.5;
    if (under > 0.01 && st.y < S.surface + st.s) {
      ctx.save(); ctx.beginPath(); pathFrom(pts); ctx.clip();
      ctx.globalAlpha = under; ctx.fillStyle = topCol; ctx.fillRect(cx - rad * 1.2, sy, rad * 2.4, rad * 2.4);
      ctx.restore();
    }
    wash(starPts(cx - rad * 0.06, cy - rad * 0.06, rad * 0.42, st.rot, 50), '#ffffff', { alpha: 0.45, grain: 0, blooms: 0, edge: 0, seed: 110 + st.k });
    const hl = starPts(cx, cy, rad * 0.8, st.rot, 70).slice(52, 64);
    highlight(hl, 2, 0.85, 120 + st.k);
    ink(pts, { closed: true, w: 1.3, alpha: 0.8, seed: 130 + st.k });
  }
}

function drawStream(S) {
  const s = S.pour; if (!s) return;
  const col = s.kind === 'matcha' ? PAL.matcha : PAL.lemonade;
  const n = 40, left = [], right = [], mid = [];
  for (let i = 0; i <= n; i++) {
    const y = lerp(s.tail, s.head, i / n);
    const x = s.x + 0.014 * Math.sin(y * 6 + S.p * 140), w = s.w * (0.88 + 0.12 * Math.sin(y * 4.3 + S.p * 90)) * (1 - 0.25 * i / n);
    left.push(P(x - w / 2, y, 0)); right.push(P(x + w / 2, y, 0)); mid.push(P(x - w * 0.18, y, 0));
  }
  wash([...left, ...right.slice().reverse()], col, { alpha: 0.97, grain: 0.18, blooms: 1, seed: 140, edge: 0.4, edgeColor: s.kind === 'matcha' ? PAL.matchaDeep : '#e2b53c' });
  highlight(mid.slice(2, -3), 1.6, 0.55, 141);
  ink(left, { w: 1.2, alpha: 0.75, seed: 142 });
  ink(right, { w: 1.2, alpha: 0.75, seed: 143 });
}

function drawGlassFront(S) {
  const { R, RI, H, BASE } = GLASS, side = 1 - S.view;
  if (side > 0.01) {
    wash(cylinder(0, BASE, R), PAL.glass, { alpha: 0.3 * side, grain: 0.05, blooms: 0, edge: 0, seed: 150 });
    ink(arc(BASE, RI, 0, Math.PI, 40), { w: 0.9, alpha: 0.4 * side, seed: 151 });
    ink(seg([-RI, H, 0], [-RI, BASE, 0], 14), { w: 0.7, alpha: 0.22 * side, seed: 152 });
    ink(seg([RI, BASE, 0], [RI, H, 0], 14), { w: 0.7, alpha: 0.22 * side, seed: 153 });
    highlight(seg([-0.8, 0.3, 0.6], [-0.8, H - 0.22, 0.6], 22), 6, 0.42 * side, 154);
    highlight(seg([-0.63, 0.4, 0.77], [-0.63, H - 0.45, 0.77], 18), 2, 0.55 * side, 155);
    highlight(seg([0.83, 0.34, 0.56], [0.83, H - 0.3, 0.56], 18), 2.2, 0.4 * side, 156);
  }
  ink(seg([-R, H, 0], [-R, 0, 0], 18), { w: 1.6, seed: 157 });
  ink(seg([R, 0, 0], [R, H, 0], 18), { w: 1.6, seed: 158 });
  ink(arc(0, R, Math.PI, 0, 48), { w: 1.6, seed: 159 });
  const outer = arc(H, R, 0, TAU, 80), innerR = arc(H, RI, 0, TAU, 80).reverse();
  wash([...outer, ...innerR], PAL.glass, { alpha: 0.5, grain: 0.05, blooms: 0, edge: 0, seed: 160 });
  ink(outer, { closed: true, w: 1.6, seed: 161 });
  ink(arc(H, RI, 0, TAU, 80), { closed: true, w: 0.9, alpha: 0.5, seed: 162 });
  highlight(arc(H, (R + RI) / 2, Math.PI * 1.08, Math.PI * 1.5, 14), 2.2, 0.85, 163);
  highlight(arc(H, (R + RI) / 2, Math.PI * 0.62, Math.PI * 0.86, 10), 1.8, 0.6, 164);
}

function paperOverlay() {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.55; ctx.fillStyle = paperPat; ctx.fillRect(0, 0, W, Hpx);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(W / 2, Hpx / 2, Math.min(W, Hpx) * 0.35, W / 2, Hpx / 2, Math.max(W, Hpx) * 0.75);
  g.addColorStop(0, 'rgba(90,70,40,0)'); g.addColorStop(1, 'rgba(90,70,40,0.14)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hpx);
  ctx.restore();
}

function drawScene(p, boil) {
  BOIL = boil;
  const S = sceneState(p);
  setView(S.view);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, W, Hpx);
  drawRoom(S);
  drawGlassBack();
  drawLiquid(S);
  drawLemon(S);
  drawSurface(S);
  drawStars(S);
  drawStream(S);
  drawGlassFront(S);
  paperOverlay();
}

function resize() {
  // The canvas fills the glass panel (laptop) or strip (phone), not the window.
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const box = canvas.getBoundingClientRect();
  W = Math.max(2, Math.floor(box.width * DPR)); Hpx = Math.max(2, Math.floor(box.height * DPR));
  canvas.width = W; canvas.height = Hpx;
}
resize();
addEventListener('resize', resize);
makeTextures();
Story.init({ render: drawScene, boilMs: 110 });
