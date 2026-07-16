/*
 * Interactive magnetization widgets for the IRM Summer School S2 slides
 * (fine-particle magnetization: anisotropy, domain states, and hysteresis).
 *
 * All plain canvas + vanilla JS (no external dependencies), in the style of
 * the S1 deck (plot helpers are shared with S1_Duluth_dia_para_ferro):
 *
 *   1. SWSingleWidget   — Stoner–Wohlfarth hysteresis loop of ONE uniaxial
 *                         single-domain grain as a function of the angle phi
 *                         between the applied field and the easy axis.
 *   2. SDLoopFigure     — static annotated loop of a 3-D random assemblage
 *                         of uniaxial SD grains (Mr/Ms = 0.5 emerges).
 *   3. BackfieldWidget  — simulated backfield (DC demagnetization)
 *                         experiment on the same 3-D random SW assemblage;
 *                         Bcr and the coercivity spectrum are emergent.
 *   4. SlopeCorrWidget  — hysteresis processing rehearsal: ferromagnetic +
 *                         paramagnetic mixture, high-field slope fit and
 *                         subtraction, Ms / Mr / Mr/Ms readouts.
 *   5. DomainStateWidget— SD → flower → vortex → MD cartoon with the
 *                         energy-vs-size budget that drives the transitions.
 *
 * Stoner–Wohlfarth physics follows Stoner & Wohlfarth (1948) and chapter 5
 * of Tauxe & Swanson-Hysell (2026), Essentials of Paleomagnetism: a moment
 * at angle theta from the easy axis of a grain with uniaxial anisotropy Ku
 * in a field B applied at angle phi has reduced energy
 *     eps/Ku = sin^2(theta) - 2 h cos(theta - phi),   h = B / B_K,
 * with the microscopic coercivity B_K = 2 Ku / Ms = mu0 (N_b - N_a) Ms for
 * prolate-spheroid shape anisotropy. Moments ride the local energy minimum
 * they occupy and flip irreversibly only when that minimum vanishes, at the
 * switching field h_f = 1 / (cos^{2/3}phi + sin^{2/3}phi)^{3/2}.
 */

'use strict';

const MU0 = 4 * Math.PI * 1e-7; // permeability of free space (H/m)
const MS_MAGNETITE = 480e3;     // saturation magnetization of magnetite (A/m)

/* ------------------------------------------------------------------ */
/* Small plotting helpers (shared with the S1 deck)                    */
/* ------------------------------------------------------------------ */

function setupCanvas(canvas) {
  // Scale for device pixel ratio so lines stay crisp on projectors/retina.
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

class Plot2D {
  /*
   * Minimal 2-D plot: maps data coords to canvas coords, draws axes
   * through the origin, ticks, and labels.
   */
  constructor(ctx, w, h, xlim, ylim, opts = {}) {
    this.ctx = ctx;
    this.margin = opts.margin || { l: 62, r: 14, t: 14, b: 44 };
    this.w = w; this.h = h;
    this.xlim = xlim; this.ylim = ylim;
    this.xlabel = opts.xlabel || '';
    this.ylabel = opts.ylabel || '';
  }
  x(v) {
    const { l, r } = this.margin;
    return l + (v - this.xlim[0]) / (this.xlim[1] - this.xlim[0]) * (this.w - l - r);
  }
  y(v) {
    const { t, b } = this.margin;
    return this.h - b - (v - this.ylim[0]) / (this.ylim[1] - this.ylim[0]) * (this.h - t - b);
  }
  frame(dark) {
    const ctx = this.ctx;
    const axis = dark ? '#bbb' : '#444';
    const grid = dark ? 'rgba(150,150,150,0.25)' : 'rgba(0,0,0,0.12)';
    ctx.save();
    // zero lines
    ctx.strokeStyle = axis; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(this.x(this.xlim[0]), this.y(0)); ctx.lineTo(this.x(this.xlim[1]), this.y(0));
    if (this.xlim[0] < 0 && this.xlim[1] > 0) {
      ctx.moveTo(this.x(0), this.y(this.ylim[0])); ctx.lineTo(this.x(0), this.y(this.ylim[1]));
    }
    ctx.stroke();
    // light frame
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    ctx.strokeRect(this.x(this.xlim[0]), this.y(this.ylim[1]),
                   this.x(this.xlim[1]) - this.x(this.xlim[0]),
                   this.y(this.ylim[0]) - this.y(this.ylim[1]));
    // labels
    ctx.fillStyle = axis;
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.xlabel, (this.x(this.xlim[0]) + this.x(this.xlim[1])) / 2, this.h - 10);
    ctx.save();
    ctx.translate(16, (this.y(this.ylim[0]) + this.y(this.ylim[1])) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(this.ylabel, 0, 0);
    ctx.restore();
    // x ticks at limits, half-limits and zero
    ctx.font = '12px sans-serif';
    for (const v of [this.xlim[0], this.xlim[1] / 2, this.xlim[1], this.xlim[0] / 2]) {
      if (v === 0) continue;
      if (v < this.xlim[0] || v > this.xlim[1]) continue;
      ctx.fillText(formatNum(v), this.x(v), this.y(this.ylim[0]) + 16);
    }
    // y ticks
    ctx.textAlign = 'right';
    for (const v of [this.ylim[0], this.ylim[1]]) {
      if (v === 0) continue;
      ctx.fillText(formatNum(v), this.x(this.xlim[0]) - 6, this.y(v) + 4);
    }
    ctx.restore();
  }
  line(xs, ys, color, width = 2, dash = []) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const px = this.x(xs[i]), py = this.y(ys[i]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
  dot(xv, yv, color, r = 7) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x(xv), this.y(yv), r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
  label(text, xv, yv, color, align = 'left', font = 'bold 15px sans-serif') {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color; ctx.font = font; ctx.textAlign = align;
    ctx.fillText(text, this.x(xv), this.y(yv));
    ctx.restore();
  }
}

function formatNum(v) {
  const av = Math.abs(v);
  if (av >= 10000 || (av < 0.01 && av > 0)) return v.toExponential(0).replace('e+', 'e');
  if (av >= 100) return v.toFixed(0);
  if (av >= 1) return (Math.round(v * 100) / 100).toString();
  return (Math.round(v * 1000) / 1000).toString();
}

function drawArrow(ctx, x0, y0, x1, y1, color, width = 3, headLen = 9) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.stroke();
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - headLen * Math.cos(ang - 0.45), y1 - headLen * Math.sin(ang - 0.45));
  ctx.lineTo(x1 - headLen * Math.cos(ang + 0.45), y1 - headLen * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function isDark() {
  return document.documentElement.dataset.slideTheme === 'dark';
}

/* Deterministic pseudo-random generator so the widgets look the same on
 * every load (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Inverse of the standard normal CDF (Acklam's rational approximation),
 * used to build deterministic stratified log-normal coercivity spreads. */
function normQuantile(p) {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
         (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/* ------------------------------------------------------------------ */
/* Stoner–Wohlfarth machinery                                          */
/* ------------------------------------------------------------------ */

function demagFactorsProlate(q) {
  // demagnetizing factors of a prolate spheroid with elongation q = a/b
  const e = Math.sqrt(1 - 1 / (q * q));
  const Na = (1 - e * e) / (2 * e ** 3) * (Math.log((1 + e) / (1 - e)) - 2 * e);
  const Nb = (1 - Na) / 2;
  return { Na, Nb };
}

function bkFromElongation(q) {
  // microscopic coercivity (T) of a prolate magnetite spheroid, B_K = mu0 dN Ms
  const { Na, Nb } = demagFactorsProlate(q);
  return MU0 * (Nb - Na) * MS_MAGNETITE;
}

function swGradient(theta, psi, h, phi) {
  // d(eps/Ku)/dtheta of the reduced Stoner–Wohlfarth energy for a grain
  // with easy axis at angle psi, field of reduced strength h at angle phi
  return Math.sin(2 * (theta - psi)) + 2 * h * Math.sin(theta - phi);
}

function swEnergy(theta, h, phi) {
  // reduced Stoner–Wohlfarth energy eps/Ku for a grain with easy axis at 0
  const s = Math.sin(theta);
  return s * s - 2 * h * Math.cos(theta - phi);
}

function swCurvature(theta, h, phi) {
  // d2(eps/Ku)/dtheta2 for a grain with easy axis at 0
  return 2 * Math.cos(2 * theta) + 2 * h * Math.cos(theta - phi);
}

function swTrack(thetaPrev, h, phi) {
  /* Exact quasi-static equilibrium for a grain with easy axis at 0: the
   * local minimum of the reduced energy whose basin contains thetaPrev.
   * A steepest-descent walk on a fine angular grid finds the basin floor
   * (this cannot stall at a fold, where gradient descent slows to a
   * crawl), then Newton's method polishes the root of the gradient. The
   * result depends only on (thetaPrev, h, phi) — not on step size or
   * frame rate — so sweeping the field fast or slow gives the same loop,
   * and the moment jumps branches exactly when its minimum vanishes. */
  const n = 1440;
  const dth = 2 * Math.PI / n;
  let i = Math.round(thetaPrev / dth);
  let e0 = swEnergy(i * dth, h, phi);
  for (let k = 0; k < n; k++) {
    const em = swEnergy((i - 1) * dth, h, phi);
    const ep = swEnergy((i + 1) * dth, h, phi);
    if (em < e0 && em <= ep) { i -= 1; e0 = em; }
    else if (ep < e0) { i += 1; e0 = ep; }
    else break;
  }
  let theta = i * dth;
  for (let k = 0; k < 30; k++) {
    const g = swGradient(theta, 0, h, phi);
    const c = swCurvature(theta, h, phi);
    if (c <= 0) break;
    const step = Math.max(-2 * dth, Math.min(2 * dth, g / c));
    theta -= step;
    if (Math.abs(g) < 1e-12) break;
  }
  return theta;
}

function swFlippingField(phi) {
  // reduced switching field h_f(phi) = H_f / H_K from the SW astroid;
  // phi is the angle between the field and the easy-axis direction
  // opposite the moment
  const c = Math.abs(Math.cos(phi)), s = Math.abs(Math.sin(phi));
  return 1 / Math.pow(Math.pow(c, 2 / 3) + Math.pow(s, 2 / 3), 1.5);
}

function swRelax(theta, psi, h, phi, iters = 400) {
  // relax a moment into the local energy minimum it currently occupies;
  // gradient-descent step below the stability limit set by the maximum
  // curvature 2 + 2|h| of the reduced energy
  const step = 0.6 / (1 + Math.abs(h));
  for (let k = 0; k < iters; k++) {
    const grad = swGradient(theta, psi, h, phi);
    theta -= step * grad;
    if (Math.abs(grad) < 1e-8) break;
  }
  return theta;
}

function stratified3DPsis(N) {
  /* Easy-axis angles psi from the field axis for a 3-D random assemblage:
   * uniformly distributed axis directions have cos(psi) uniform on [0,1],
   * so stratified sampling gives sum(cos psi)/N = 1/2 exactly — the
   * classic Mr/Ms = 0.5 of a random uniaxial SD population. */
  const psis = [];
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;      // stratified cos(psi)
    psis.push(Math.acos(u));
  }
  return psis;
}

function swAssemblageLoop(psis, scales, hmax, n) {
  /* Descending branch of the major loop of an assemblage of uniaxial SD
   * grains with easy-axis angles psis (from the field axis) and per-grain
   * coercivity scale factors (B_K,i = scale_i × B_K,median). Everything in
   * reduced units h = B / B_K,median; the ascending branch is the
   * inversion image. Each grain's moment stays in the plane containing
   * the field and its easy axis, so the 2-D SW energy applies grain by
   * grain. Returns {H, M} plus MrMs and hc read off the branch. */
  const th = psis.map(() => 0);   // saturated along +B (phi = 0)
  const H = [], M = [];
  for (let i = 0; i < n; i++) {
    const h = hmax - (2 * hmax * i) / (n - 1);
    let msum = 0;
    for (let j = 0; j < th.length; j++) {
      th[j] = swRelax(th[j], psis[j], h / scales[j], 0);
      msum += Math.cos(th[j]);
    }
    H.push(h);
    M.push(msum / th.length);
  }
  // Mr/Ms at h = 0 and coercivity crossing
  let MrMs = 0, hc = 0;
  for (let i = 1; i < n; i++) {
    if (H[i] <= 0 && H[i - 1] > 0) {
      MrMs = M[i - 1] + (M[i] - M[i - 1]) * (0 - H[i - 1]) / (H[i] - H[i - 1]);
    }
    if (M[i] <= 0 && M[i - 1] > 0) {
      const f = M[i - 1] / (M[i - 1] - M[i]);
      hc = Math.abs(H[i - 1] + f * (H[i] - H[i - 1]));
      break;
    }
  }
  return { H, M, MrMs, hc };
}

function swInitialCurve(psis, scales, hmax, n, seed = 7) {
  /* Initial magnetization curve from an AF-demagnetized state: each moment
   * starts on its own easy axis with random polarity; sweep h from 0 up. */
  const rand = rng(seed);
  const th = psis.map(p => (rand() < 0.5 ? p : p + Math.PI));
  const H = [], M = [];
  for (let i = 0; i < n; i++) {
    const h = (hmax * i) / (n - 1);
    let msum = 0;
    for (let j = 0; j < th.length; j++) {
      th[j] = swRelax(th[j], psis[j], h / scales[j], 0);
      msum += Math.cos(th[j]);
    }
    H.push(h);
    M.push(msum / th.length);
  }
  return { H, M };
}

function makeScales(N, sigma, seed = 5) {
  /* Deterministic stratified log-normal coercivity scale factors with
   * median 1 and log-std sigma, shuffled so scale is uncorrelated with
   * the (also stratified) easy-axis angle. */
  const scales = [];
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    scales.push(Math.exp(sigma * normQuantile(u)));
  }
  const rand = rng(seed);
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [scales[i], scales[j]] = [scales[j], scales[i]];
  }
  return scales;
}

/* ------------------------------------------------------------------ */
/* Widget 1: single-grain Stoner–Wohlfarth loop vs field angle phi     */
/* ------------------------------------------------------------------ */

class SWSingleWidget {
  constructor(root) {
    this.root = root;
    this.q = 1.5;                 // grain elongation a/b (sets B_K)
    this.phiDeg = 30;             // angle between field and easy axis
    this.hmax = 2.0;              // cycle amplitude in units of B_K
    this.h = 0;
    this.playing = false;
    this.phase = 0;               // field cycle starts at h = 0 heading positive
    this.trail = [];
    this.theta = 0;               // moment starts along +easy-axis (toward +B)
    this.thetaVis = 0;            // smoothed copy of theta for the grain arrow
    this.computeLoop();
    this.buildDOM();
    this.lastT = performance.now();
    const step = (t) => {
      if (this.root.offsetParent !== null) this.tick(t);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  bK() { return bkFromElongation(this.q); }

  phiRad() {
    // tiny offset breaks the unstable equilibrium at exactly phi = 0
    return Math.max(0.35, this.phiDeg) * Math.PI / 180;
  }

  computeLoop() {
    /* Major loop of the single grain: easy axis at psi = 0, field at
     * angle phi; sweep h from +hmax down to -hmax, relax at each step,
     * record the moment component along the field, mirror for the
     * ascending branch. */
    const phi = this.phiRad();
    const n = 561;
    let th = phi;                 // saturated along +B
    const H = [], M = [];
    for (let i = 0; i < n; i++) {
      const h = this.hmax - (2 * this.hmax * i) / (n - 1);
      th = swTrack(th, h, phi);
      H.push(h);
      M.push(Math.cos(th - phi));
    }
    this.loopDesc = { H, M };
    this.loopAsc = { H: H.map(v => -v).reverse(), M: M.map(v => -v).reverse() };
    this.hf = swFlippingField(phi);
    this.trail = [];
  }

  buildDOM() {
    this.root.innerHTML = `
      <div class="widget-controls">
        <label class="wslider">φ <input class="s-phi" type="range" min="0" max="90" step="1" value="${this.phiDeg}">
          <span class="wval" data-ro="phi">${this.phiDeg}°</span></label>
        <div class="btn-group">
          ${[0, 22, 45, 70, 90].map(a => `<button class="wbtn wphi" data-phi="${a}">${a}°</button>`).join('')}
        </div>
        <span class="wreadout">B = <span class="wval" data-ro="B">0 mT</span></span>
        <button class="wbtn wplay">▶ cycle field</button>
        <span class="wreadout">μ₀H<sub>f</sub> = <span data-ro="hf"></span></span>
      </div>
      <div class="widget-canvases">
        <div class="wpane">
          <canvas class="c-grain"></canvas>
          <div class="wcaption">one uniaxial SD grain (magnetite, a/b = 1.5) — field applied at φ to the easy axis</div>
        </div>
        <div class="wpane wpane-wide">
          <canvas class="c-plot"></canvas>
          <div class="wcaption">moment component along B — the loop collapses as φ → 90°</div>
        </div>
      </div>`;
    this.cGrain = this.root.querySelector('.c-grain');
    this.cPlot = this.root.querySelector('.c-plot');
    this.ro = {};
    this.root.querySelectorAll('[data-ro]').forEach(el => this.ro[el.dataset.ro] = el);
    this.sPhi = this.root.querySelector('.s-phi');
    this.playBtn = this.root.querySelector('.wplay');

    this.sPhi.addEventListener('input', () => {
      this.phiDeg = parseFloat(this.sPhi.value);
      this.computeLoop();
    });
    this.root.querySelectorAll('.wphi').forEach(btn => {
      btn.addEventListener('click', () => {
        this.phiDeg = parseFloat(btn.dataset.phi);
        this.sPhi.value = this.phiDeg;
        this.computeLoop();
      });
    });
    this.playBtn.addEventListener('click', () => {
      this.playing = !this.playing;
      this.playBtn.textContent = this.playing ? '⏸ pause' : '▶ cycle field';
    });
  }

  tick(tNow) {
    const dt = Math.max(0, Math.min(0.05, (tNow - this.lastT) / 1000));
    this.lastT = tNow;
    const bkMT = this.bK() * 1000;
    if (this.playing) {
      this.phase += dt * 0.5;
      this.h = this.hmax * Math.sin(this.phase);
    }
    // exact quasi-static equilibrium: the occupied minimum for the current
    // field, independent of how fast the field was swept to get here
    const phi = this.phiRad();
    this.theta = swTrack(this.theta, this.h, phi);
    // the grain arrow eases toward theta (time-based, so frame-rate
    // independent) purely as a visual for the flip; the plot uses theta
    let dvis = this.theta - this.thetaVis;
    dvis = Math.atan2(Math.sin(dvis), Math.cos(dvis));
    this.thetaVis += dvis * (1 - Math.exp(-dt * 14));
    const mPar = Math.cos(this.theta - phi);
    const BmT = this.h * bkMT;

    this.trail.push([BmT, mPar]);
    if (this.trail.length > 900) this.trail.shift();

    this.ro.phi.textContent = `${this.phiDeg.toFixed(0)}°`;
    this.ro.B.textContent = `${BmT.toFixed(0)} mT`;
    this.ro.hf.textContent = this.phiDeg >= 89.5
      ? '∞ (no flip — reversible)'
      : `${(this.hf * bkMT).toFixed(0)} mT`;

    this.drawGrain(phi);
    this.drawPlot(BmT, mPar, bkMT);
  }

  drawGrain(phi) {
    const { ctx, w, h } = setupCanvas(this.cGrain);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2 + 8;
    const a = Math.min(w, h) * 0.30;     // semi-major (easy axis horizontal)
    const b = a / this.q;

    // grain with easy axis horizontal
    ctx.save();
    ctx.fillStyle = dark ? '#e8d33f' : '#ffe94d';
    ctx.strokeStyle = dark ? 'rgba(0,0,0,0.55)' : 'rgba(90,75,0,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, a, b, 0, 0, 2 * Math.PI);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // easy axis dashed line
    ctx.save();
    ctx.strokeStyle = dark ? 'rgba(200,200,210,0.6)' : 'rgba(60,60,70,0.45)';
    ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - a * 1.35, cy); ctx.lineTo(cx + a * 1.35, cy);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = dark ? '#bbb' : '#666';
    ctx.font = '13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('easy axis', cx + a * 1.02, cy + 18);

    // applied field arrow at angle phi (up-and-over from +x), length ∝ |B|
    const frac = this.h / this.hmax;
    if (Math.abs(frac) > 0.02) {
      const fcolor = dark ? 'rgba(130,175,255,0.95)' : 'rgba(35,75,190,0.9)';
      const len = a * 1.15 * Math.max(-1, Math.min(1, frac));
      const dx = Math.cos(phi) * len, dy = -Math.sin(phi) * len;
      drawArrow(ctx, cx - dx, cy - dy, cx + dx, cy + dy, fcolor, 5, 12);
      ctx.fillStyle = fcolor;
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText('B', cx + Math.cos(phi) * a * 1.3 + 6, cy - Math.sin(phi) * a * 1.3);
    }

    // moment arrow at angle thetaVis (smoothed theta) from the easy axis
    const len = a * 0.9;
    const mdx = Math.cos(this.thetaVis) * len, mdy = -Math.sin(this.thetaVis) * len;
    drawArrow(ctx, cx - mdx, cy - mdy, cx + mdx, cy + mdy, dark ? '#eee' : '#111', 3.5, 10);
    ctx.fillStyle = dark ? '#eee' : '#111';
    ctx.font = 'bold italic 16px sans-serif';
    ctx.fillText('m', cx + mdx + 8, cy + mdy - 6);
  }

  drawPlot(BmT, mPar, bkMT) {
    const { ctx, w, h } = setupCanvas(this.cPlot);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const lim = Math.ceil(this.hmax * bkMT / 10) * 10;
    const plot = new Plot2D(ctx, w, h, [-lim, lim], [-1.2, 1.2],
      { xlabel: 'B, applied field (mT)', ylabel: 'm∥ / m  (component along B)' });
    plot.frame(dark);

    const loopCol = dark ? '#ff8f8f' : '#c22b2b';
    plot.line(this.loopDesc.H.map(v => v * bkMT), this.loopDesc.M, loopCol, 3);
    plot.line(this.loopAsc.H.map(v => v * bkMT), this.loopAsc.M, loopCol, 3);

    // flipping field markers
    if (this.phiDeg < 89.5) {
      const accent = dark ? '#7fd4ff' : '#0b6aa8';
      const bf = this.hf * bkMT;
      plot.line([-bf, -bf], [-1.15, 1.15], accent, 1.5, [5, 4]);
      plot.label('−μ₀Hf', -bf, 1.12, accent, 'right', 'bold 13px sans-serif');
      plot.line([bf, bf], [-1.15, 1.15], accent, 1.5, [5, 4]);
      plot.label('+μ₀Hf', bf, 1.12, accent, 'left', 'bold 13px sans-serif');
    }

    if (this.trail.length > 1) {
      const tcol = dark ? '#ffd166' : '#b8860b';
      plot.line(this.trail.map(p => p[0]), this.trail.map(p => p[1]), tcol, 3.5);
    }
    plot.dot(BmT, mPar, dark ? '#fff' : '#111');
  }
}

/* ------------------------------------------------------------------ */
/* Widget 2: static annotated loop of a 3-D random SD assemblage       */
/* ------------------------------------------------------------------ */

class SDLoopFigure {
  /* Non-interactive labeled loop computed from a 3-D random assemblage of
   * uniaxial SD grains (stratified easy axes: Mr/Ms = 0.5 exactly).
   * Includes the initial magnetization curve from a demagnetized state
   * and annotations for chi_lf, Ms, Mr, and Bc. */
  constructor(root) {
    this.root = root;
    this.q = 1.5;
    this.bkMT = bkFromElongation(this.q) * 1000;
    const hmax = 2.0, n = 321, N = 240;
    const psis = stratified3DPsis(N);
    const scales = psis.map(() => 1);
    const loop = swAssemblageLoop(psis, scales, hmax, n);
    this.desc = loop;
    this.asc = { H: loop.H.map(v => -v).reverse(), M: loop.M.map(v => -v).reverse() };
    this.initial = swInitialCurve(psis, scales, hmax, 161);
    this.MrMs = loop.MrMs;
    this.hc = loop.hc;
    this.limMT = Math.ceil(hmax * this.bkMT / 50) * 50;

    this.root.innerHTML = `
      <div class="widget-canvases">
        <div class="wpane wpane-full">
          <canvas class="c-plot"></canvas>
        </div>
      </div>`;
    this.canvas = this.root.querySelector('.c-plot');
    this.draw();
    new ResizeObserver(() => this.draw()).observe(this.canvas);
    this.root._redraw = () => this.draw();
  }

  draw() {
    const { ctx, w, h } = setupCanvas(this.canvas);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const lim = this.limMT;
    const plot = new Plot2D(ctx, w, h, [-lim, lim], [-1.2, 1.2],
      { xlabel: 'B, applied field (mT)', ylabel: 'M / Ms' });
    plot.frame(dark);

    const loopCol = dark ? '#ff8f8f' : '#c22b2b';
    plot.line(this.desc.H.map(v => v * this.bkMT), this.desc.M, loopCol, 3.5);
    plot.line(this.asc.H.map(v => v * this.bkMT), this.asc.M, loopCol, 3.5);

    // initial magnetization curve from the demagnetized state
    const icol = dark ? '#8fd48f' : '#0a7d44';
    plot.line(this.initial.H.map(v => v * this.bkMT), this.initial.M, icol, 3, [7, 5]);
    plot.label('initial curve (χlf)', lim * 0.1, 0.15, icol, 'left', 'bold 15px sans-serif');

    const accent = dark ? '#7fd4ff' : '#0b6aa8';
    const font = 'bold 19px sans-serif';
    plot.line([lim * 0.35, lim], [1, 1], accent, 2, [6, 5]);
    plot.label('Ms', lim * 0.66, 1.09, accent, 'left', font);
    plot.dot(0, this.MrMs, accent, 6);
    plot.label(`Mr = ${this.MrMs.toFixed(2)} Ms`, -lim * 0.05, this.MrMs + 0.1, accent, 'right', font);
    const BcMT = this.hc * this.bkMT;
    plot.dot(-BcMT, 0, accent, 6);
    plot.label('Bc', -BcMT - lim * 0.02, -0.17, accent, 'right', font);
  }
}

/* ------------------------------------------------------------------ */
/* Widget 3: backfield experiment on a SW assemblage                   */
/* ------------------------------------------------------------------ */

class BackfieldWidget {
  /* Simulates the backfield (DC demagnetization) protocol on a 3-D random
   * assemblage of uniaxial SD grains: saturate in +B, then apply and
   * remove progressively larger reverse fields, measuring the remanence
   * at zero field after each step.
   *
   * The physics is exact Stoner–Wohlfarth: a grain whose easy axis makes
   * angle psi with the field axis flips when the reverse field reaches
   * B_K,i × h_f(psi); its remanence contribution is ±cos(psi). The
   * in-field descending branch of the same population (computed by energy
   * minimization) is drawn for comparison, so Bc < Bcr is emergent.
   *
   * The assemblage is a two-component mixture: a soft population at the
   * magnetite shape-anisotropy B_K and a hard population at hardRatio ×
   * B_K, so the switching-field spectrum is bimodal and Bcr of the
   * mixture falls in the trough between the modes. */
  constructor(root) {
    this.root = root;
    this.q = 1.5;                  // elongation → median B_K (soft population)
    this.sigma = 0.0;              // log-normal spread of B_K (0 = ideal SD)
    this.fHard = 0.5;              // fraction of grains in the hard population
    this.hardRatio = 4;            // hard-population B_K as a multiple of soft
    this.N = 400;
    this.hmax = 6.0;
    this.hNow = 0;                 // current reverse field (units of B_K,median)
    this.playing = false;
    this.rebuild();
    this.buildDOM();
    this.lastT = performance.now();
    const step = (t) => {
      if (this.root.offsetParent !== null) this.tick(t);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  bK() { return bkFromElongation(this.q); }

  isHard(i) {
    // golden-ratio sequence: deterministic, hits fHard exactly in the
    // large-N limit, and is uncorrelated with the stratified psi ordering
    return ((i * 0.6180339887498949) % 1) < this.fHard;
  }

  rebuild() {
    const psis = stratified3DPsis(this.N);
    const scales = makeScales(this.N, this.sigma);
    // per-grain reduced switching field (units of the soft B_K,median) and
    // remanence contribution
    this.grains = psis.map((psi, i) => {
      const hard = this.isHard(i);
      return {
        psi, hard,
        hSwitch: scales[i] * (hard ? this.hardRatio : 1) * swFlippingField(psi),
        mRem: Math.cos(psi),
      };
    });
    // backfield remanence curve Mr(B)/SIRM: grains with hSwitch <= h have
    // flipped. SIRM = mean(cos psi) = 1/2.
    const sirm = this.grains.reduce((s, g) => s + g.mRem, 0) / this.N;
    const n = 301;
    this.curveH = []; this.curveM = [];
    for (let i = 0; i < n; i++) {
      const hb = (this.hmax * i) / (n - 1);
      let m = 0;
      for (const g of this.grains) m += (g.hSwitch <= hb ? -g.mRem : g.mRem);
      this.curveH.push(hb);
      this.curveM.push(m / this.N / sirm);
    }
    // Bcr: remanence zero crossing
    this.hcr = 0;
    for (let i = 1; i < n; i++) {
      if (this.curveM[i] <= 0 && this.curveM[i - 1] > 0) {
        const f = this.curveM[i - 1] / (this.curveM[i - 1] - this.curveM[i]);
        this.hcr = this.curveH[i - 1] + f * (this.curveH[i] - this.curveH[i - 1]);
        break;
      }
    }
    // in-field descending branch of the same mixture (coarser grain set
    // for speed; the curve is smooth thanks to stratification)
    const NN = 160;
    const psis2 = stratified3DPsis(NN);
    const scales2 = makeScales(NN, this.sigma)
      .map((s, i) => s * (this.isHard(i) ? this.hardRatio : 1));
    const loop = swAssemblageLoop(psis2, scales2, this.hmax, 201);
    this.inField = loop;
    this.hcInField = loop.hc;
    // per-population switching-field spectra (histograms of hSwitch
    // weighted by |2 mRem|, the remanence each grain carries through the
    // flip), normalized together so the stacked peak is 1
    const nb = 48;
    this.specSoft = new Array(nb).fill(0);
    this.specHard = new Array(nb).fill(0);
    this.specMax = this.hmax;
    for (const g of this.grains) {
      const b = Math.min(nb - 1, Math.floor(g.hSwitch / this.specMax * nb));
      (g.hard ? this.specHard : this.specSoft)[b] += 2 * Math.abs(g.mRem);
    }
    const peak = Math.max(...this.specSoft.map((v, i) => v + this.specHard[i]));
    this.specSoft = this.specSoft.map(v => v / peak);
    this.specHard = this.specHard.map(v => v / peak);
  }

  buildDOM() {
    const lim = () => Math.ceil(this.hmax * this.bK() * 1000 / 10) * 10;
    this.root.innerHTML = `
      <div class="widget-controls">
        <label class="wslider">reverse field <input class="s-b" type="range" min="0" max="${lim()}" step="0.5" value="0">
          <span class="wval" data-ro="B">0 mT</span></label>
        <label class="wslider">hard fraction
          <input class="s-fh" type="range" min="0" max="1" step="0.05" value="${this.fHard}">
          <span class="wval" data-ro="fh">${Math.round(this.fHard * 100)}%</span></label>
        <label class="wslider">coercivity spread σ
          <input class="s-sig" type="range" min="0" max="0.6" step="0.05" value="${this.sigma}">
          <span class="wval" data-ro="sig">${this.sigma.toFixed(2)}</span></label>
        <button class="wbtn wplay">▶ run experiment</button>
        <span class="wreadout">B<sub>cr</sub> = <span data-ro="bcr"></span> ·
          B<sub>c</sub> = <span data-ro="bc"></span> ·
          H<sub>cr</sub>/H<sub>c</sub> = <span data-ro="ratio"></span></span>
      </div>
      <div class="widget-canvases">
        <div class="wpane">
          <canvas class="c-spec"></canvas>
          <div class="wcaption">switching-field spectra: soft (blue) + hard (pink) — solid bars have flipped</div>
        </div>
        <div class="wpane wpane-wide">
          <canvas class="c-plot"></canvas>
          <div class="wcaption">remanence after each backfield step (green) vs in-field magnetization (grey)</div>
        </div>
      </div>`;
    this.cSpec = this.root.querySelector('.c-spec');
    this.cPlot = this.root.querySelector('.c-plot');
    this.ro = {};
    this.root.querySelectorAll('[data-ro]').forEach(el => this.ro[el.dataset.ro] = el);
    this.sB = this.root.querySelector('.s-b');
    this.sFh = this.root.querySelector('.s-fh');
    this.sSig = this.root.querySelector('.s-sig');
    this.playBtn = this.root.querySelector('.wplay');

    this.sB.addEventListener('input', () => {
      this.playing = false;
      this.playBtn.textContent = '▶ run experiment';
      this.hNow = parseFloat(this.sB.value) / 1000 / this.bK();
    });
    this.sFh.addEventListener('input', () => {
      this.fHard = parseFloat(this.sFh.value);
      this.rebuild();
    });
    this.sSig.addEventListener('input', () => {
      this.sigma = parseFloat(this.sSig.value);
      this.rebuild();
    });
    this.playBtn.addEventListener('click', () => {
      this.playing = !this.playing;
      if (this.playing && this.hNow >= this.hmax * 0.99) this.hNow = 0;
      this.playBtn.textContent = this.playing ? '⏸ pause' : '▶ run experiment';
    });
  }

  tick(tNow) {
    const dt = Math.max(0, Math.min(0.05, (tNow - this.lastT) / 1000));
    this.lastT = tNow;
    const bkMT = this.bK() * 1000;
    if (this.playing) {
      this.hNow += dt * 0.6;
      if (this.hNow >= this.hmax) {
        this.hNow = this.hmax;
        this.playing = false;
        this.playBtn.textContent = '▶ run experiment';
      }
      this.sB.value = (this.hNow * bkMT).toFixed(1);
    }
    this.ro.B.textContent = `−${(this.hNow * bkMT).toFixed(0)} mT`;
    this.ro.fh.textContent = `${Math.round(this.fHard * 100)}%`;
    this.ro.sig.textContent = this.sigma.toFixed(2);
    this.ro.bcr.textContent = `${(this.hcr * bkMT).toFixed(0)} mT`;
    this.ro.bc.textContent = `${(this.hcInField * bkMT).toFixed(0)} mT`;
    this.ro.ratio.textContent = (this.hcr / this.hcInField).toFixed(2);
    this.drawSpec(bkMT);
    this.drawPlot(bkMT);
  }

  drawSpec(bkMT) {
    const { ctx, w, h } = setupCanvas(this.cSpec);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const plot = new Plot2D(ctx, w, h, [0, this.specMax * bkMT], [0, 1.15],
      { xlabel: '|B|, switching field (mT)', ylabel: 'remanence carried',
        margin: { l: 50, r: 12, t: 12, b: 44 } });
    plot.frame(dark);
    const nb = this.specSoft.length;
    const bw = this.specMax * bkMT / nb;
    const softCol = dark
      ? ['rgba(127,196,255,0.95)', 'rgba(127,196,255,0.3)']
      : ['rgba(11,106,168,0.85)', 'rgba(11,106,168,0.25)'];
    const hardCol = dark
      ? ['rgba(255,143,171,0.95)', 'rgba(255,143,171,0.3)']
      : ['rgba(198,45,88,0.85)', 'rgba(198,45,88,0.25)'];
    for (let i = 0; i < nb; i++) {
      const b0 = i * bw;
      const flipped = (i + 0.5) * bw <= this.hNow * bkMT;
      const x0 = plot.x(b0), x1 = plot.x(b0 + bw * 0.92);
      const yBase = plot.y(0);
      const ySoft = plot.y(this.specSoft[i]);
      ctx.fillStyle = softCol[flipped ? 0 : 1];
      ctx.fillRect(x0, ySoft, x1 - x0, yBase - ySoft);
      const yHard = plot.y(this.specSoft[i] + this.specHard[i]);
      ctx.fillStyle = hardCol[flipped ? 0 : 1];
      ctx.fillRect(x0, yHard, x1 - x0, ySoft - yHard);
    }
    // population labels above their modes (soft peaks near B_K/2, hard
    // near hardRatio × B_K/2)
    const font = 'bold 13px sans-serif';
    if (this.fHard < 1) plot.label('soft', 0.55 * bkMT, 1.08,
      dark ? '#7fc4ff' : '#0b6aa8', 'center', font);
    if (this.fHard > 0) plot.label('hard', this.hardRatio * 0.55 * bkMT, 1.08,
      dark ? '#ff8fab' : '#c62d58', 'center', font);
    // current field marker
    if (this.hNow > 0.001) {
      const accent = dark ? '#ffd166' : '#b8860b';
      plot.line([this.hNow * bkMT, this.hNow * bkMT], [0, 1.12], accent, 2.5);
    }
  }

  drawPlot(bkMT) {
    const { ctx, w, h } = setupCanvas(this.cPlot);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const lim = Math.ceil(this.hmax * bkMT / 10) * 10;
    const plot = new Plot2D(ctx, w, h, [-lim, 0], [-1.2, 1.2],
      { xlabel: 'B, reverse field (mT)', ylabel: 'M / SIRM   (remanence)',
        margin: { l: 62, r: 20, t: 14, b: 44 } });
    plot.frame(dark);

    // in-field descending branch (M/Ms — note different normalization)
    const gcol = dark ? 'rgba(170,170,180,0.8)' : 'rgba(110,110,120,0.7)';
    plot.line(this.inField.H.filter(v => v <= 0).map(v => v * bkMT),
              this.inField.M.filter((_, i) => this.inField.H[i] <= 0), gcol, 2, [6, 4]);
    plot.label('in-field M/Ms', -lim * 0.97, -0.62, gcol, 'left', 'bold 13px sans-serif');

    // backfield remanence curve up to the current field
    const green = dark ? '#8fd48f' : '#0a7d44';
    const idx = this.curveH.findIndex(v => v > this.hNow);
    const upto = idx === -1 ? this.curveH.length : Math.max(1, idx);
    plot.line(this.curveH.slice(0, upto).map(v => -v * bkMT),
              this.curveM.slice(0, upto), green, 3.5);
    const mNow = this.curveM[Math.min(upto - 1, this.curveM.length - 1)];
    plot.dot(-this.hNow * bkMT, mNow, dark ? '#fff' : '#111');

    // Bcr and Bc markers
    const accent = dark ? '#7fd4ff' : '#0b6aa8';
    if (this.hNow >= this.hcr) {
      plot.dot(-this.hcr * bkMT, 0, accent, 6);
      plot.label('−Bcr', -this.hcr * bkMT, 0.16, accent, 'left', 'bold 15px sans-serif');
    }
    plot.dot(-this.hcInField * bkMT, 0, gcol, 5);
    plot.label('−Bc', -this.hcInField * bkMT + lim * 0.01, -0.2, gcol, 'left', 'bold 14px sans-serif');
  }
}

/* ------------------------------------------------------------------ */
/* Widget 4: hysteresis processing — high-field slope correction       */
/* ------------------------------------------------------------------ */

class SlopeCorrWidget {
  /* A synthetic "measured" specimen: single-domain magnetite (exact SW
   * assemblage loop, mass-normalized with Ms = 92 Am²/kg for pure
   * magnetite) dispersed in a paramagnetic olivine matrix (linear in B).
   * The y-axis is held fixed at the largest signal the sliders can
   * produce, so changing the composition visibly changes the loop. */
  constructor(root) {
    this.root = root;
    this.fMag = 0.001;           // magnetite mass fraction (0.1 wt%)
    this.chiPara = 5e-7;         // olivine-ish mass susceptibility (m³/kg)
    this.Bmax = 1.0;             // T
    this.q = 1.5;
    this.bkT = bkFromElongation(this.q);
    // fixed y range: max ferromagnetic + max paramagnetic the sliders allow
    this.yLim = (Math.pow(10, 0.7) / 1e3 * 92 + 10 * 1e-7 * this.Bmax / MU0) * 1.05;
    // reduced SW loop, computed once (3-D random assemblage)
    const psis = stratified3DPsis(200);
    const scales = makeScales(200, 0.25);
    const loop = swAssemblageLoop(psis, scales, this.Bmax / this.bkT, 361);
    this.desc = loop;             // H in units of bkT, descending
    this.buildDOM();
    this.draw();
    new ResizeObserver(() => this.draw()).observe(this.root.querySelector('.c-plot'));
    this.root._redraw = () => this.draw();
  }

  buildDOM() {
    this.root.innerHTML = `
      <div class="widget-controls">
        <label class="wslider" style="min-width:330px">magnetite content
          <input class="s-f" type="range" min="-1.5" max="0.7" step="0.02" value="${Math.log10(this.fMag * 1e3)}">
          <span class="wval" data-ro="f"></span></label>
        <label class="wslider">paramagnetic matrix χ
          <input class="s-chi" type="range" min="0" max="10" step="0.25" value="${this.chiPara * 1e7}">
          <span class="wval" data-ro="chi"></span></label>
        <span class="wreadout" data-ro="params"></span>
      </div>
      <div class="widget-canvases">
        <div class="wpane wpane-full">
          <canvas class="c-plot"></canvas>
          <div class="wcaption">measured loop: single-domain magnetite + paramagnetic matrix · fixed axes — the loop grows and tilts as the composition changes</div>
        </div>
      </div>`;
    this.ro = {};
    this.root.querySelectorAll('[data-ro]').forEach(el => this.ro[el.dataset.ro] = el);
    this.sF = this.root.querySelector('.s-f');
    this.sChi = this.root.querySelector('.s-chi');
    this.sF.addEventListener('input', () => {
      this.fMag = Math.pow(10, parseFloat(this.sF.value)) / 1e3;
      this.draw();
    });
    this.sChi.addEventListener('input', () => {
      this.chiPara = parseFloat(this.sChi.value) * 1e-7;
      this.draw();
    });
  }

  measured(hArr, mArr) {
    /* Assemble the "measured" branch in mass units: ferromagnetic SW loop
     * scaled by the magnetite fraction plus the paramagnetic line. */
    const MsF = this.fMag * 92.0;                     // Am²/kg
    const B = hArr.map(v => v * this.bkT);            // T
    const M = mArr.map((m, i) => MsF * m + this.chiPara * B[i] / MU0);
    return { B, M, MsF };
  }

  draw() {
    const { ctx, w, h } = setupCanvas(this.root.querySelector('.c-plot'));
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);

    const desc = this.measured(this.desc.H, this.desc.M);
    const asc = { B: desc.B.map(v => -v).reverse(), M: desc.M.map(v => -v).reverse() };

    this.ro.f.textContent = `${(this.fMag * 100).toFixed(this.fMag < 0.001 ? 3 : 2)} wt%`;
    this.ro.chi.textContent = `${(this.chiPara * 1e7).toFixed(1)}×10⁻⁷ m³/kg`;
    this.ro.params.innerHTML =
      `ferromagnetic Ms = ${desc.MsF.toFixed(3)} Am²/kg · ` +
      `paramagnetic M at B<sub>max</sub> = ${(this.chiPara * this.Bmax / MU0).toFixed(3)} Am²/kg`;

    // fixed y range so slider changes read as loop changes, not axis changes
    const plot = new Plot2D(ctx, w, h, [-this.Bmax, this.Bmax], [-this.yLim, this.yLim],
      { xlabel: 'B, applied field (T)', ylabel: 'M (Am²/kg)' });
    plot.frame(dark);

    const rawCol = dark ? 'rgba(170,170,180,0.9)' : 'rgba(90,90,100,0.75)';
    plot.line(desc.B, desc.M, rawCol, 3);
    plot.line(asc.B, asc.M, rawCol, 3);
  }
}

/* ------------------------------------------------------------------ */
/* Static figure: Mrh / Mih loop decomposition                         */
/* ------------------------------------------------------------------ */

class MrhMihFigure {
  /* Decomposition of the hysteresis loop into its irreversible and
   * reversible parts, computed from the same 3-D random SW assemblage:
   *   Mrh(H) = (M+ - M-)/2  — remanent hysteretic magnetization
   *   Mih(H) = (M+ + M-)/2  — induced hysteretic magnetization
   * where M+ / M- are the upper (descending) and lower (ascending)
   * branches. Mr = Mrh(0); Brh is the median field of Mrh (where it
   * falls to half of Mr), a close cousin of Bcr. This mirrors
   * rockmag.calc_Mr_Mrh_Mih_Brh in RockmagPy (Jackson & Solheid, 2010). */
  constructor(root) {
    this.root = root;
    this.q = 1.5;
    this.bkMT = bkFromElongation(this.q) * 1000;
    const hmax = 2.0, n = 321, N = 200;
    const psis = stratified3DPsis(N);
    const scales = makeScales(N, 0.25);
    const loop = swAssemblageLoop(psis, scales, hmax, n);
    // grid is symmetric: H[i] = -H[n-1-i]; lower branch M-(H) = -M+(-H)
    const H = loop.H, Mp = loop.M;
    const Mm = Mp.map((_, i) => -Mp[n - 1 - i]);
    this.H = H;
    this.Mp = Mp;
    this.Mm = Mm;
    this.Mrh = Mp.map((v, i) => (v - Mm[i]) / 2);
    this.Mih = Mp.map((v, i) => (v + Mm[i]) / 2);
    const iZero = (n - 1) / 2;
    this.Mr = this.Mrh[iZero];
    // Brh: |H| where Mrh falls to half of Mr
    this.hrh = 0;
    for (let i = iZero; i < n; i++) {
      if (this.Mrh[i] <= this.Mr / 2) {
        this.hrh = Math.abs(H[i]);
        break;
      }
    }
    this.limMT = Math.ceil(hmax * this.bkMT / 50) * 50;

    this.root.innerHTML = `
      <div class="widget-canvases">
        <div class="wpane wpane-full">
          <canvas class="c-plot"></canvas>
        </div>
      </div>`;
    this.canvas = this.root.querySelector('.c-plot');
    this.draw();
    new ResizeObserver(() => this.draw()).observe(this.canvas);
    this.root._redraw = () => this.draw();
  }

  draw() {
    const { ctx, w, h } = setupCanvas(this.canvas);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const lim = this.limMT;
    const plot = new Plot2D(ctx, w, h, [-lim, lim], [-1.15, 1.15],
      { xlabel: 'B, applied field (mT)', ylabel: 'M / Ms' });
    plot.frame(dark);

    const HmT = this.H.map(v => v * this.bkMT);
    const cUp = dark ? '#7fa8ff' : '#2b52c2';
    const cLo = dark ? '#9fd4ff' : '#5aa0d8';
    const cRh = dark ? '#8fd48f' : '#0a7d44';
    const cIh = dark ? '#eee' : '#111';
    plot.line(HmT, this.Mp, cUp, 2.5);
    plot.line(HmT, this.Mm, cLo, 2.5);
    plot.line(HmT, this.Mrh, cRh, 3.5);
    plot.line(HmT, this.Mih, cIh, 3, [7, 5]);

    const font = 'bold 15px sans-serif';
    plot.label('M⁺ (upper branch)', -lim * 0.95, 0.62, cUp, 'left', font);
    plot.label('M⁻ (lower branch)', lim * 0.28, -0.62, cLo, 'left', font);
    plot.label('Mrh = (M⁺−M⁻)/2 — irreversible', lim * 0.06, 0.36, cRh, 'left', font);
    plot.label('Mih = (M⁺+M⁻)/2 — reversible', lim * 0.3, 0.9, cIh, 'left', font);

    const accent = dark ? '#7fd4ff' : '#0b6aa8';
    plot.dot(0, this.Mr, accent, 6);
    plot.label('Mr = Mrh(0)', -lim * 0.03, this.Mr + 0.09, accent, 'right', font);
    const brhMT = this.hrh * this.bkMT;
    plot.line([-brhMT, -brhMT], [0, this.Mr / 2], accent, 2, [5, 4]);
    plot.dot(-brhMT, this.Mr / 2, accent, 5);
    plot.label('Brh (median of Mrh) ≈ Bcr', -brhMT - lim * 0.02, this.Mr / 2 + 0.09, accent, 'right', 'bold 14px sans-serif');
  }
}

/* ------------------------------------------------------------------ */
/* Widget 5: domain-state explorer (SD → flower → vortex → MD)         */
/* ------------------------------------------------------------------ */

class DomainStateWidget {
  /* Cartoon of the remanent spin structure of an equant magnetite grain
   * as it grows, with the energy budget that drives the transitions:
   * the magnetostatic self energy of the uniform state grows with volume
   * (∝ d³) while the cost of a curled/walled structure grows more slowly
   * (∝ d²), so above a critical size the grain abandons uniform
   * magnetization. Threshold sizes for equant magnetite follow chapter 4
   * (Nagy et al., 2017): SD below ~60–70 nm, flower to ~80 nm, vortex to
   * ~200 nm, domain walls beyond. The spin fields drawn are schematic
   * (2-D slices through 3-D micromagnetic states). */
  constructor(root) {
    this.root = root;
    this.d = 50;   // grain diameter, nm
    this.buildDOM();
    this.draw();
    new ResizeObserver(() => this.draw()).observe(this.cGrain);
    this.root._redraw = () => this.draw();
  }

  state() {
    if (this.d < 68) return 'SD';
    if (this.d < 85) return 'flower';
    if (this.d < 200) return 'vortex';
    return 'MD';
  }

  buildDOM() {
    this.root.innerHTML = `
      <div class="widget-controls">
        <label class="wslider" style="min-width:420px">grain diameter
          <input class="s-d" type="range" min="20" max="300" step="1" value="${this.d}">
          <span class="wval" data-ro="d">${this.d} nm</span></label>
        <span class="wreadout">state: <strong data-ro="state"></strong> ·
          net remanence ≈ <span data-ro="mnet"></span> of M<sub>s</sub>v</span>
      </div>
      <div class="widget-canvases">
        <div class="wpane">
          <canvas class="c-grain"></canvas>
          <div class="wcaption">remanent spin structure (schematic 2-D slice; equant magnetite)</div>
        </div>
        <div class="wpane">
          <canvas class="c-energy"></canvas>
          <div class="wcaption">the energy budget: uniform state's self energy (∝ d³) vs curled state (∝ d²)</div>
        </div>
      </div>`;
    this.cGrain = this.root.querySelector('.c-grain');
    this.cEnergy = this.root.querySelector('.c-energy');
    this.ro = {};
    this.root.querySelectorAll('[data-ro]').forEach(el => this.ro[el.dataset.ro] = el);
    this.sD = this.root.querySelector('.s-d');
    this.sD.addEventListener('input', () => {
      this.d = parseFloat(this.sD.value);
      this.draw();
    });
  }

  netMoment() {
    // schematic remanence efficiency of each state
    const st = this.state();
    if (st === 'SD') return 1.0;
    if (st === 'flower') return 1 - 0.25 * (this.d - 68) / (85 - 68);
    if (st === 'vortex') return Math.max(0.05, 0.35 - 0.25 * (this.d - 85) / (200 - 85));
    return 0.03;
  }

  draw() {
    this.ro.d.textContent = `${this.d.toFixed(0)} nm`;
    const st = this.state();
    const names = { SD: 'single domain (uniform)', flower: 'flower', vortex: 'single vortex', MD: 'multidomain' };
    this.ro.state.textContent = names[st];
    this.ro.mnet.textContent = `${(this.netMoment() * 100).toFixed(0)}%`;
    this.drawGrain(st);
    this.drawEnergy();
  }

  spinAt(x, y, R, st) {
    /* Schematic remanent spin direction at position (x, y) in a circular
     * grain slice of radius R (canvas coords relative to center, y down).
     * Returns [ux, uy] or null (for the out-of-plane vortex core). */
    const r = Math.hypot(x, y);
    if (st === 'SD') return [0, -1];
    if (st === 'flower') {
      // uniform + outward splay growing toward the surface and with d
      const splay = 0.9 * (this.d - 68) / (85 - 68) * Math.pow(r / R, 3);
      const ang = -Math.PI / 2 + splay * Math.atan2(y, x) / Math.PI * 2 * Math.sign(x || 1);
      // simpler: tilt away from vertical, toward the local radial direction
      const radial = Math.atan2(y, x);
      let a = -Math.PI / 2;
      let dAng = ((radial - a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      a += dAng * splay * 0.45;
      return [Math.cos(a), Math.sin(a)];
    }
    if (st === 'vortex') {
      const core = 0.18 * R;
      if (r < core) return null;              // core: out of plane
      // circulating (tangential) spins
      const t = Math.atan2(y, x) + Math.PI / 2;
      return [Math.cos(t), Math.sin(t)];
    }
    // MD: two lamellar domains + wall at x = 0
    if (Math.abs(x) < 0.06 * R) return [x < 0 ? -0.4 : 0.4, x < 0 ? -0.9 : 0.9]; // wall (rotating)
    return x < 0 ? [0, -1] : [0, 1];
  }

  drawGrain(st) {
    const { ctx, w, h } = setupCanvas(this.cGrain);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.185 * Math.pow(this.d / 60, 0.42); // grows gently with d

    // grain body
    ctx.save();
    ctx.fillStyle = dark ? '#4a4a52' : '#d9d4cb';
    ctx.strokeStyle = dark ? '#888' : '#8d8577';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // spin lattice
    const spacing = Math.max(16, R / 5.2);
    const col = dark ? '#ffb26b' : '#c25400';
    for (let gy = -R; gy <= R; gy += spacing) {
      for (let gx = -R; gx <= R; gx += spacing) {
        if (Math.hypot(gx, gy) > R * 0.88) continue;
        const s = this.spinAt(gx, gy, R, st);
        const px = cx + gx, py = cy + gy;
        if (s === null) {
          // vortex core: out-of-plane symbol (circled dot)
          ctx.save();
          ctx.strokeStyle = dark ? '#ff8f8f' : '#c22b2b';
          ctx.fillStyle = dark ? '#ff8f8f' : '#c22b2b';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px, py, 6, 0, 2 * Math.PI); ctx.stroke();
          ctx.beginPath(); ctx.arc(px, py, 2, 0, 2 * Math.PI); ctx.fill();
          ctx.restore();
          continue;
        }
        const L = spacing * 0.42;
        drawArrow(ctx, px - s[0] * L, py - s[1] * L, px + s[0] * L, py + s[1] * L, col, 2.5, 7);
      }
    }
    // MD wall shading
    if (st === 'MD') {
      ctx.save();
      ctx.fillStyle = dark ? 'rgba(255,143,143,0.18)' : 'rgba(194,43,43,0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.clip();
      ctx.fillRect(cx - R * 0.1, cy - R, R * 0.2, 2 * R);
      ctx.restore();
      ctx.fillStyle = dark ? '#ff8f8f' : '#c22b2b';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('domain wall', cx, cy - R - 10);
    }
    if (st === 'vortex') {
      ctx.fillStyle = dark ? '#ff8f8f' : '#c22b2b';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('core (out of plane) — carries the remanence', cx, cy - R - 10);
    }
    // scale label
    ctx.fillStyle = dark ? '#bbb' : '#666';
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`d = ${this.d.toFixed(0)} nm`, cx, cy + R + 24);
  }

  drawEnergy() {
    const { ctx, w, h } = setupCanvas(this.cEnergy);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    /* Log-log energy-vs-size sketch: self energy of the uniform state
     * E_self = (1/2) mu0 (1/3) Ms² × (π/6) d³ and the cost of the curled
     * alternative ~ wall/vortex energy ε_w × (π/4) d² with
     * ε_w = 2π√(AK) ≈ 3×10⁻³ J/m² for magnetite. Absolute crossings are
     * geometry dependent; the ∝d³ vs ∝d² competition is the point. */
    const eSelf = d => 0.5 * MU0 * (1 / 3) * MS_MAGNETITE ** 2 * (Math.PI / 6) * (d * 1e-9) ** 3;
    const eWall = d => 3e-3 * (Math.PI / 4) * (d * 1e-9) ** 2;
    const dMin = 20, dMax = 300;
    const xs = [], ysS = [], ysW = [];
    for (let d = dMin; d <= dMax; d *= 1.06) {
      xs.push(Math.log10(d));
      ysS.push(Math.log10(eSelf(d) * 1e18));   // attojoules for a friendly axis
      ysW.push(Math.log10(eWall(d) * 1e18));
    }
    const ylo = Math.min(...ysS, ...ysW) - 0.3, yhi = Math.max(...ysS, ...ysW) + 0.4;
    const plot = new Plot2D(ctx, w, h, [Math.log10(dMin), Math.log10(dMax)], [ylo, yhi],
      { xlabel: 'grain diameter (nm, log scale)', ylabel: 'log₁₀ energy (aJ)',
        margin: { l: 56, r: 12, t: 12, b: 44 } });
    // custom frame without zero lines (log-log)
    const axis = dark ? '#bbb' : '#444';
    ctx.save();
    ctx.strokeStyle = axis; ctx.lineWidth = 1.2;
    ctx.strokeRect(plot.x(plot.xlim[0]), plot.y(plot.ylim[1]),
                   plot.x(plot.xlim[1]) - plot.x(plot.xlim[0]),
                   plot.y(plot.ylim[0]) - plot.y(plot.ylim[1]));
    ctx.fillStyle = axis; ctx.font = '15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(plot.xlabel, (plot.x(plot.xlim[0]) + plot.x(plot.xlim[1])) / 2, h - 8);
    ctx.save();
    ctx.translate(16, (plot.y(plot.ylim[0]) + plot.y(plot.ylim[1])) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(plot.ylabel, 0, 0);
    ctx.restore();
    ctx.font = '12px sans-serif';
    for (const d of [20, 50, 100, 200, 300]) {
      ctx.fillText(`${d}`, plot.x(Math.log10(d)), plot.y(plot.ylim[0]) + 16);
    }
    ctx.restore();

    // regime bands
    const bands = [[20, 68, 'SD'], [68, 85, 'flower'], [85, 200, 'vortex'], [200, 300, 'MD']];
    for (const [d0, d1, name] of bands) {
      const active = this.d >= d0 && this.d < d1 || (name === 'MD' && this.d >= 200);
      ctx.fillStyle = active
        ? (dark ? 'rgba(255,204,51,0.16)' : 'rgba(255,204,51,0.3)')
        : 'rgba(128,128,128,0.05)';
      ctx.fillRect(plot.x(Math.log10(d0)), plot.y(yhi),
                   plot.x(Math.log10(d1)) - plot.x(Math.log10(d0)), plot.y(ylo) - plot.y(yhi));
      ctx.fillStyle = active ? (dark ? '#ffcc33' : '#8a6d00') : (dark ? '#999' : '#999');
      ctx.font = active ? 'bold 13px sans-serif' : '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, (plot.x(Math.log10(d0)) + plot.x(Math.log10(d1))) / 2, plot.y(yhi) + 18);
    }

    const cSelf = dark ? '#ff8f8f' : '#c22b2b';
    const cWall = dark ? '#8fd48f' : '#0a7d44';
    plot.line(xs, ysS, cSelf, 3);
    plot.line(xs, ysW, cWall, 3, [7, 5]);
    plot.label('uniform: self energy ∝ d³', xs[Math.floor(xs.length * 0.4)] - 0.28,
               ysS[Math.floor(xs.length * 0.72)], cSelf, 'left', 'bold 13px sans-serif');
    plot.label('curled: cost ∝ d²', xs[Math.floor(xs.length * 0.55)],
               ysW[Math.floor(xs.length * 0.48)] - 0.35, cWall, 'left', 'bold 13px sans-serif');

    // marker at current d
    const ld = Math.log10(this.d);
    const accent = dark ? '#ffd166' : '#b8860b';
    plot.line([ld, ld], [ylo, yhi], accent, 2);
    plot.dot(ld, Math.log10(eSelf(this.d) * 1e18), cSelf, 5);
    plot.dot(ld, Math.log10(eWall(this.d) * 1e18), cWall, 5);
  }
}

/* ------------------------------------------------------------------ */
/* bootstrapping                                                       */
/* ------------------------------------------------------------------ */

window.addEventListener('load', () => {
  document.querySelectorAll('[data-widget="swsingle"]').forEach(el => { el._widget = new SWSingleWidget(el); });
  document.querySelectorAll('[data-widget="sdloop"]').forEach(el => { el._widget = new SDLoopFigure(el); });
  document.querySelectorAll('[data-widget="backfield"]').forEach(el => { el._widget = new BackfieldWidget(el); });
  document.querySelectorAll('[data-widget="slopecorr"]').forEach(el => { el._widget = new SlopeCorrWidget(el); });
  document.querySelectorAll('[data-widget="mrhmih"]').forEach(el => { el._widget = new MrhMihFigure(el); });
  document.querySelectorAll('[data-widget="domainstate"]').forEach(el => { el._widget = new DomainStateWidget(el); });
});
