/*
 * Interactive magnetization widgets for the IRM Summer School S1 slides.
 *
 * Three widgets, all plain canvas + vanilla JS (no external dependencies):
 *   1. DiaParaWidget  — linear M vs B response of diamagnets/paramagnets with
 *                       an atomic-moment view (induced opposing moments vs
 *                       thermally agitated permanent moments).
 *   2. FerroWidget    — Stoner–Wohlfarth assemblage of uniaxial
 *                       single-domain grains; the hysteresis loop emerges
 *                       from the grain-by-grain moment physics.
 *   3. MixtureWidget  — wasp-waisted loops from magnetite + hematite mixtures.
 *
 * Physical constants and mineral values follow the course notebooks
 * (W2_dia_para_ferro). Alignment of moments in the atomic views is
 * exaggerated for visibility — real dia/para alignments are parts in 10^4.
 */

'use strict';

const MU0 = 4 * Math.PI * 1e-7; // permeability of free space (H/m)

/* ------------------------------------------------------------------ */
/* Small plotting helpers                                              */
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
    ctx.moveTo(this.x(0), this.y(this.ylim[0])); ctx.lineTo(this.x(0), this.y(this.ylim[1]));
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
    // x ticks at limits and zero
    ctx.font = '12px sans-serif';
    for (const v of [this.xlim[0], this.xlim[1] / 2, this.xlim[1], this.xlim[0] / 2]) {
      if (v === 0) continue;
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
  clipData() {
    // clip subsequent drawing to the data rectangle, so curves that run past
    // the axis range are cut at the frame edge rather than spilling into the
    // margins. Pair with unclip().
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x(this.xlim[0]), this.y(this.ylim[1]),
             this.x(this.xlim[1]) - this.x(this.xlim[0]),
             this.y(this.ylim[0]) - this.y(this.ylim[1]));
    ctx.clip();
  }
  unclip() { this.ctx.restore(); }
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

/* ------------------------------------------------------------------ */
/* Widget 1: diamagnetic / paramagnetic linear response                */
/* ------------------------------------------------------------------ */

class LinearResponseWidget {
  constructor(root, mode) {
    this.root = root;
    this.mode = mode;                // 'dia' | 'para', fixed per instance
    this.B = 0;                      // applied field (T) — starts at zero
    this.T = 300;                    // temperature (K), para mode only
    this.playing = false;            // no autoplay; user starts the cycle
    this.phase = 0;
    this.kappaDia = -1.5e-5;         // quartz
    this.kappaPara300 = 1.6e-3;      // typical mantle olivine at 300 K
    this.Bmax = 1.0;

    // persistent thermal state for the paramagnetic moments
    const rand = rng(42);
    this.moments = [];
    for (let i = 0; i < 24; i++) {
      this.moments.push({
        theta: rand() * 2 * Math.PI,
        omega: 0,
        seed: rand() * 2 * Math.PI,
        speed: 0.5 + rand(),
      });
    }

    this.buildDOM();
    this.lastT = performance.now();
    const step = (t) => {
      if (this.rootVisible()) this.tick(t);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  rootVisible() {
    return this.root.offsetParent !== null;
  }

  kappa() {
    if (this.mode === 'dia') return this.kappaDia;
    return this.kappaPara300 * 300 / this.T; // Curie law κ ∝ 1/T
  }

  buildDOM() {
    const material = this.mode === 'dia'
      ? 'quartz &nbsp;κ = −1.5×10⁻⁵ (SI)'
      : 'olivine &nbsp;κ = 1.6×10⁻³ (SI) at 300 K';
    const tempSlider = this.mode === 'para'
      ? `<label class="wslider wtemp">T <input type="range" min="100" max="900" step="10" value="300">
          <span class="wval" data-ro="T">300 K</span></label>`
      : '';
    this.root.innerHTML = `
      <div class="widget-controls">
        <span class="wreadout"><strong>${material}</strong></span>
        <label class="wslider">B <input type="range" min="-1" max="1" step="0.01" value="0">
          <span class="wval" data-ro="B">0.00 T</span></label>
        ${tempSlider}
        <button class="wbtn wplay">▶ cycle field</button>
        <span class="wreadout">κ = <span data-ro="kappa"></span> &nbsp; M = <span data-ro="M"></span></span>
      </div>
      <div class="widget-canvases">
        <div class="wpane">
          <canvas class="c-moments"></canvas>
          <div class="wcaption">atomic moments <em>(alignment exaggerated)</em></div>
        </div>
        <div class="wpane">
          <canvas class="c-plot"></canvas>
          <div class="wcaption">measured response — a line through the origin, no memory</div>
        </div>
      </div>`;
    this.cMoments = this.root.querySelector('.c-moments');
    this.cPlot = this.root.querySelector('.c-plot');
    this.bSlider = this.root.querySelector('.wslider input');
    this.tSlider = this.root.querySelector('.wtemp input');
    this.playBtn = this.root.querySelector('.wplay');
    this.ro = {};
    this.root.querySelectorAll('[data-ro]').forEach(el => this.ro[el.dataset.ro] = el);

    this.bSlider.addEventListener('input', () => {
      this.playing = false;
      this.playBtn.textContent = '▶ cycle field';
      this.B = parseFloat(this.bSlider.value);
    });
    if (this.tSlider) {
      this.tSlider.addEventListener('input', () => { this.T = parseFloat(this.tSlider.value); });
    }
    this.playBtn.addEventListener('click', () => {
      this.playing = !this.playing;
      if (this.playing) {
        // resume the cycle smoothly from wherever the slider left B
        this.phase = Math.asin(Math.max(-1, Math.min(1, this.B / this.Bmax)));
      }
      this.playBtn.textContent = this.playing ? '⏸ pause' : '▶ cycle field';
    });
  }

  tick(tNow) {
    const dt = Math.max(0, Math.min(0.05, (tNow - this.lastT) / 1000));
    this.lastT = tNow;
    if (this.playing) {
      this.phase += dt * 0.7;
      this.B = this.Bmax * Math.sin(this.phase);
      this.bSlider.value = this.B.toFixed(2);
    }
    const kappa = this.kappa();
    const M = kappa * this.B / MU0;
    this.ro.B.textContent = `${this.B.toFixed(2)} T`;
    if (this.ro.T) this.ro.T.textContent = `${this.T.toFixed(0)} K`;
    this.ro.kappa.textContent = kappa.toExponential(1) + ' (SI)';
    this.ro.M.textContent = `${M.toFixed(M > 100 ? 0 : 1)} A/m`;
    this.drawMoments(dt);
    this.drawPlot(M, kappa);
  }

  drawMoments(dt) {
    const { ctx, w, h } = setupCanvas(this.cMoments);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);

    // applied-field arrows in the background
    const fieldFrac = this.B / this.Bmax;
    const fcolor = dark ? 'rgba(120,170,255,0.45)' : 'rgba(60,110,220,0.35)';
    if (Math.abs(fieldFrac) > 0.02) {
      for (let i = 0; i < 5; i++) {
        const x = (i + 0.5) * w / 5;
        const len = 0.42 * h * fieldFrac;
        drawArrow(ctx, x, h / 2 + len / 2, x, h / 2 - len / 2, fcolor, 5, 12);
      }
      ctx.fillStyle = fcolor;
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('B', 8, 22);
    }

    const cols = 6, rows = 4;
    const dx = w / cols, dy = h / rows;
    const armax = Math.min(dx, dy) * 0.38;
    const up = -1; // canvas y grows downward; "up" = negative y

    this.moments.forEach((m, i) => {
      const cx = (i % cols + 0.5) * dx;
      const cy = (Math.floor(i / cols) + 0.5) * dy;
      if (this.mode === 'dia') {
        // induced moment: opposes B, length proportional to |B|
        const len = armax * Math.abs(fieldFrac);
        if (len < 2) { // no field: draw the bare atom
          this.atomDot(ctx, cx, cy, dark);
          return;
        }
        const dir = -Math.sign(fieldFrac); // opposite to applied field
        this.atomDot(ctx, cx, cy, dark);
        drawArrow(ctx, cx, cy - up * dir * len, cx, cy + up * dir * len,
                  dark ? '#7fd4a8' : '#0a7d44', 3.5, 9);
      } else {
        // permanent moment: jitters thermally, biased toward B.
        // Exaggerated Langevin-like alignment for visibility.
        const align = Math.tanh(3.0 * fieldFrac * (300 / this.T)); // -1..1
        const jitterAmp = 0.5 + 1.6 * (this.T / 900);
        m.seed += dt * m.speed * (1 + this.T / 300);
        const noise = Math.sin(m.seed * 2.1 + i) + Math.sin(m.seed * 3.7);
        // canvas angle (y down): -π/2 points toward +B (up), +π/2 toward -B
        const randomAngle = m.theta + noise * jitterAmp;
        const targetAngle = align >= 0 ? -Math.PI / 2 : Math.PI / 2;
        let dAng = ((targetAngle - randomAngle) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        const a = randomAngle + dAng * Math.abs(align);
        const len = armax;
        this.atomDot(ctx, cx, cy, dark);
        drawArrow(ctx, cx - Math.cos(a) * len, cy - Math.sin(a) * len,
                  cx + Math.cos(a) * len, cy + Math.sin(a) * len,
                  dark ? '#ffb26b' : '#c25400', 3.5, 9);
      }
    });
  }

  atomDot(ctx, cx, cy, dark) {
    ctx.save();
    ctx.fillStyle = dark ? 'rgba(200,200,210,0.35)' : 'rgba(60,60,70,0.18)';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  drawPlot(M, kappa) {
    const { ctx, w, h } = setupCanvas(this.cPlot);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const Mfull = Math.abs(this.mode === 'dia' ? this.kappaDia : this.kappaPara300 * 3) / MU0 * this.Bmax;
    const plot = new Plot2D(ctx, w, h, [-this.Bmax, this.Bmax], [-Mfull * 1.1, Mfull * 1.1],
      { xlabel: 'B = μ₀H, applied field (T)', ylabel: 'M, magnetization (A/m)' });
    plot.frame(dark);
    const xs = [-this.Bmax, this.Bmax];
    const ys = xs.map(b => kappa * b / MU0);
    plot.line(xs, ys, this.mode === 'dia' ? (dark ? '#7fd4a8' : '#0a7d44')
                                          : (dark ? '#ffb26b' : '#c25400'), 3);
    plot.dot(this.B, M, dark ? '#fff' : '#111');
    // annotate in the corner the line doesn't pass through
    if (this.mode === 'dia') {
      plot.label('slope κ < 0', this.Bmax * 0.95, Mfull * 0.9, dark ? '#ddd' : '#333', 'right');
    } else {
      plot.label('slope κ > 0 (κ ∝ 1/T)', -this.Bmax * 0.95, Mfull * 0.9, dark ? '#ddd' : '#333');
    }
  }
}

/* ------------------------------------------------------------------ */
/* Takács (2001) hysteresis model                                      */
/* ------------------------------------------------------------------ */

function takacsBranches(Ms, Bc, squareness, Bmax, n = 400) {
  /* Returns {B, desc, asc}: field sweep and the two major-loop branches.
   * Mirrors calculate_takacs_arrays() in Week2_ferromagnetism.ipynb. */
  const HcAm = Bc / MU0;
  const ratio = Math.min(0.99, Math.max(0.01, squareness));
  const s = HcAm / Math.atanh(ratio);
  const a0 = HcAm / s;
  const xm = (Bmax / MU0) / s;
  const b1 = (Math.tanh(xm + a0) - Math.tanh(xm - a0)) / 2;
  const B = [], desc = [], asc = [];
  for (let i = 0; i < n; i++) {
    const b = -Bmax + (2 * Bmax * i) / (n - 1);
    const x = (b / MU0) / s;
    B.push(b);
    desc.push(Ms * (Math.tanh(x + a0) - b1));
    asc.push(Ms * (Math.tanh(x - a0) + b1));
  }
  return { B, desc, asc };
}

function takacsAt(Ms, Bc, squareness, Bmax, b, branch) {
  const HcAm = Bc / MU0;
  const ratio = Math.min(0.99, Math.max(0.01, squareness));
  const s = HcAm / Math.atanh(ratio);
  const a0 = HcAm / s;
  const xm = (Bmax / MU0) / s;
  const b1 = (Math.tanh(xm + a0) - Math.tanh(xm - a0)) / 2;
  const x = (b / MU0) / s;
  return branch === 'desc' ? Ms * (Math.tanh(x + a0) - b1)
                           : Ms * (Math.tanh(x - a0) + b1);
}

/* ------------------------------------------------------------------ */
/* Widget 2: ferromagnetic hysteresis — Stoner–Wohlfarth assemblage    */
/* ------------------------------------------------------------------ */

/* Physics as in Week3_the_flipping_field.ipynb: uniaxial single-domain
 * grains with prolate-spheroid shape anisotropy. Each grain has a fixed
 * easy axis at angle psi; its moment angle theta lives in the reduced
 * energy landscape
 *     eps(theta) / Ku = sin^2(theta - psi) - 2 h cos(theta - phi)
 * with reduced field h = B / B_K and microscopic switching field
 *     B_K = 2 Ku / Ms = mu0 (N_b - N_a) Ms.
 * Moments relax into the local energy minimum they occupy and flip
 * irreversibly only when that minimum disappears — the loop on the right
 * is computed from the same grain population, nothing is fitted. */

function demagFactorsProlate(q) {
  // demagnetizing factors of a prolate spheroid with elongation q = a/b
  const e = Math.sqrt(1 - 1 / (q * q));
  const Na = (1 - e * e) / (2 * e ** 3) * (Math.log((1 + e) / (1 - e)) - 2 * e);
  const Nb = (1 - Na) / 2;
  return { Na, Nb };
}

function swGradient(theta, psi, h, phi) {
  // d(eps/Ku)/dtheta of the reduced Stoner–Wohlfarth energy
  return Math.sin(2 * (theta - psi)) + 2 * h * Math.sin(theta - phi);
}

function stratifiedPsis(rand, N) {
  // easy axes stratified over [0, π) with jitter, then shuffled so the
  // population is representatively "random" (Mr/Ms ≈ 2/π in-plane)
  // with no ordering pattern
  const psis = [];
  for (let i = 0; i < N; i++) psis.push((i + rand()) * Math.PI / N);
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [psis[i], psis[j]] = [psis[j], psis[i]];
  }
  return psis;
}

function swMajorLoop(psis, hmax, n, phi = 0) {
  /* Descending branch of the major loop for an assemblage with easy axes
   * psis, in reduced units: sweep h from +hmax to -hmax, relaxing each
   * moment to convergence in its occupied minimum at every step. The
   * ascending branch is the inversion image of this one. */
  const th = psis.map(() => phi); // saturated along +B
  const H = [], M = [];
  for (let i = 0; i < n; i++) {
    const h = hmax - (2 * hmax * i) / (n - 1);
    // descent step below the stability limit 1/(1 + |h|) set by the
    // energy's maximum curvature 2 + 2|h|
    const step = 0.6 / (1 + Math.abs(h));
    for (let j = 0; j < th.length; j++) {
      for (let k = 0; k < 400; k++) {
        const grad = swGradient(th[j], psis[j], h, phi);
        th[j] -= step * grad;
        if (Math.abs(grad) < 1e-7) break;
      }
    }
    H.push(h);
    M.push(th.reduce((s, t) => s + Math.cos(t - phi), 0) / th.length);
  }
  return { H, M };
}

class FerroWidget {
  constructor(root) {
    this.root = root;
    this.MsMagnetite = 480e3;  // A/m, magnetite (as in the W3 notebook)
    this.q = 2.0;              // grain elongation a/b
    this.phi = 0;              // field direction: horizontal, +B to the right
    // saturation reference: by 3 B_K every grain has switched and the hard-axis
    // grains have rotated onto Ms — this sets the fixed plot axis (at a/b = 3)
    this.satReduced = 3.0;
    this.h = 0;                // reduced applied field B / B_K
    this.playing = false;      // start demagnetized; user launches the cycle
    this.phase = 0;
    this.trail = [];
    this.seed = 11;

    this.updateHmax();         // cycle peak (mT) fixed beyond the axis for every a/b
    this.makeGrains();
    this.buildDOM();
    this.lastT = performance.now();
    const step = (t) => {
      if (this.root.offsetParent !== null) this.tick(t);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  bK() {
    // microscopic switching field (T) from shape anisotropy
    const { Na, Nb } = demagFactorsProlate(this.q);
    return MU0 * (Nb - Na) * this.MsMagnetite;
  }

  blimMT() {
    // fixed plot range, set by the widest loop (max elongation a/b = 3) so
    // that changing elongation narrows/widens the loop within a constant axis
    // rather than rescaling it away
    const { Na, Nb } = demagFactorsProlate(3);
    const bkMax = MU0 * (Nb - Na) * this.MsMagnetite;
    return Math.ceil(this.satReduced * bkMax * 1000 / 50) * 50;
  }

  updateHmax() {
    // drive the cycle to the same peak field (mT) — just past the axis edge —
    // for every elongation, so all loops run off the top of the plot rather
    // than stopping short at different field levels
    const peakMT = this.blimMT() * 1.12;
    this.hmax = peakMT / 1000 / this.bK();
  }

  makeGrains() {
    // Moments start demagnetized: each along its own easy axis with
    // random polarity, so M = 0.
    const rand = rng(this.seed);
    const cols = 5, rows = 3, N = cols * rows;
    const psis = stratifiedPsis(rand, N);
    this.grains = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const psi = psis[r * cols + c];
        this.grains.push({
          psi,
          theta: psi + (rand() < 0.5 ? 0 : Math.PI),
          fx: (c + 0.5 + (rand() - 0.5) * 0.34) / cols,
          fy: (r + 0.5 + (rand() - 0.5) * 0.34) / rows,
        });
      }
    }
    this.computeLoop();
    this.trail = [];
  }

  computeLoop() {
    /* Major loop of this exact grain population (descending branch swept,
     * ascending branch mirrored — SW loops are inversion-symmetric). */
    const n = 481;
    const { H, M } = swMajorLoop(this.grains.map(g => g.psi), this.hmax, n, this.phi);
    this.loopDesc = { H, M };
    this.loopAsc = { H: H.map(v => -v).reverse(), M: M.map(v => -v).reverse() };
    // read Mr/Ms (descending branch at h = 0) and the coercivity crossing
    const iZero = (n - 1) / 2;
    this.MrMs = M[iZero];
    this.hc = 0;
    for (let i = iZero; i < n; i++) {
      if (M[i] <= 0) {
        const f = M[i - 1] / (M[i - 1] - M[i]);
        this.hc = Math.abs(H[i - 1] + f * (H[i] - H[i - 1]));
        break;
      }
    }
  }

  buildDOM() {
    this.root.innerHTML = `
      <div class="widget-controls">
        <label class="wslider">elongation a/b
          <input class="s-q" type="range" min="1.2" max="3" step="0.05" value="${this.q}">
          <span class="wval" data-ro="q"></span></label>
        <span class="wreadout">B = <span class="wval" data-ro="B">0 mT</span></span>
        <button class="wbtn wplay">▶ cycle field</button>
        <button class="wbtn wnew">↻ new grains</button>
        <label class="wtoggle"><input class="s-preview" type="checkbox"> preview loop &amp; B<sub>c</sub>/M<sub>r</sub></label>
        <span class="wreadout">B<sub>K</sub> = <span data-ro="bk"></span> &nbsp; M/M<sub>s</sub> = <span data-ro="M"></span></span>
      </div>
      <div class="widget-canvases">
        <div class="wpane">
          <canvas class="c-moments"></canvas>
          <div class="wcaption">uniaxial SD grains — moments align with strong B, relax to easy axes at B = 0</div>
        </div>
        <div class="wpane wpane-wide">
          <canvas class="c-plot"></canvas>
          <div class="wcaption">loop emerges from grain-by-grain flips — hysteresis <em>is</em> magnetic memory</div>
        </div>
      </div>`;
    this.cMoments = this.root.querySelector('.c-moments');
    this.cPlot = this.root.querySelector('.c-plot');
    this.ro = {};
    this.root.querySelectorAll('[data-ro]').forEach(el => this.ro[el.dataset.ro] = el);
    this.playBtn = this.root.querySelector('.wplay');
    this.sQ = this.root.querySelector('.s-q');
    this.sPreview = this.root.querySelector('.s-preview');
    this.showPreview = this.sPreview.checked;
    this.sPreview.addEventListener('change', () => { this.showPreview = this.sPreview.checked; });
    this.sQ.addEventListener('input', () => {
      // the plot axis is fixed; only B_K (the mT scale) changes, so the loop
      // widens/narrows on a constant axis. Re-solve the peak field and the
      // preview loop for the new elongation, and restart the trail.
      this.q = parseFloat(this.sQ.value);
      this.updateHmax();
      this.computeLoop();
      this.trail = [];
    });
    this.playBtn.addEventListener('click', () => {
      this.playing = !this.playing;
      if (this.playing) {
        // resume the cycle smoothly from wherever the field currently sits
        this.phase = Math.asin(Math.max(-1, Math.min(1, this.h / this.hmax)));
      }
      this.playBtn.textContent = this.playing ? '⏸ pause' : '▶ cycle field';
    });
    this.root.querySelector('.wnew').addEventListener('click', () => {
      this.seed += 1;
      this.makeGrains();
    });
  }

  tick(tNow) {
    const dt = Math.max(0, Math.min(0.05, (tNow - this.lastT) / 1000));
    this.lastT = tNow;
    const bkMT = this.bK() * 1000;
    if (this.playing) {
      this.phase += dt * 0.45;
      this.h = this.hmax * Math.sin(this.phase);
    }

    // viscous relaxation: each moment chases the minimum it occupies and
    // flips (fast swing) when the field has destroyed that minimum
    const rate = Math.min(0.2, dt * 6);
    for (const g of this.grains) {
      for (let s = 0; s < 8; s++) {
        g.theta -= rate * swGradient(g.theta, g.psi, this.h, this.phi);
      }
      g.theta = ((g.theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    }
    const M = this.grains.reduce((s, g) => s + Math.cos(g.theta - this.phi), 0) / this.grains.length;
    const BmT = this.h * bkMT;

    this.trail.push([BmT, M]);
    if (this.trail.length > 900) this.trail.shift();

    this.ro.B.textContent = `${BmT.toFixed(0)} mT`;
    this.ro.q.textContent = this.q.toFixed(2);
    this.ro.bk.textContent = `${bkMT.toFixed(0)} mT`;
    this.ro.M.textContent = M.toFixed(2);

    this.drawGrains();
    this.drawPlot(BmT, M, bkMT);
  }

  drawGrains() {
    const { ctx, w, h } = setupCanvas(this.cMoments);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);

    // rock-slab background
    ctx.fillStyle = dark ? '#3c3c42' : '#b6b6b6';
    ctx.beginPath();
    ctx.roundRect(3, 3, w - 6, h - 6, 12);
    ctx.fill();

    // applied field arrow along the top (horizontal field)
    const frac = this.h / this.hmax;
    if (Math.abs(frac) > 0.02) {
      const fcolor = dark ? 'rgba(130,175,255,0.95)' : 'rgba(35,75,190,0.9)';
      const len = 0.34 * w * Math.max(-1, Math.min(1, frac));
      drawArrow(ctx, w / 2 - len, 24, w / 2 + len, 24, fcolor, 5, 12);
      ctx.fillStyle = fcolor;
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('B', 10, 30);
    }

    // grains: ellipse long axis = easy axis (psi), arrow = moment (theta)
    const top = 42;
    const a = Math.min(w / 5, (h - top) / 3) * 0.42;      // semi-major
    const b = a / this.q;                                  // semi-minor
    const fill = dark ? '#e8d33f' : '#ffe94d';
    const edge = dark ? 'rgba(0,0,0,0.55)' : 'rgba(90,75,0,0.55)';
    for (const g of this.grains) {
      const cx = 14 + g.fx * (w - 28);
      const cy = top + g.fy * (h - top - 12);
      ctx.save();
      ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 2;
      ctx.beginPath();
      // canvas rotation is clockwise-positive, math angle is ccw: negate
      ctx.ellipse(cx, cy, a, b, -g.psi, 0, 2 * Math.PI);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      const len = a * 0.92;
      drawArrow(ctx,
                cx - Math.cos(g.theta) * len, cy + Math.sin(g.theta) * len,
                cx + Math.cos(g.theta) * len, cy - Math.sin(g.theta) * len,
                dark ? '#111' : '#111', 3, 9);
    }
  }

  drawPlot(BmT, M, bkMT) {
    const { ctx, w, h } = setupCanvas(this.cPlot);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const lim = this.blimMT();
    const plot = new Plot2D(ctx, w, h, [-lim, lim], [-1.2, 1.2],
      { xlabel: 'B, applied field (mT)', ylabel: 'M / Ms' });
    plot.frame(dark);

    const accent = dark ? '#7fd4ff' : '#0b6aa8';

    // the field is swept past the axis edge, so clip the loop to the frame:
    // its saturated branches run off the sides at the same (off-screen) peak
    plot.clipData();

    // optional preview: the quasi-static major loop plus its emergent Bc/Mr
    // markers, drawn under the trail so the interactive run overlays it
    if (this.showPreview) {
      const loopCol = dark ? 'rgba(160,160,170,0.75)' : 'rgba(90,90,100,0.55)';
      plot.line(this.loopDesc.H.map(v => v * bkMT), this.loopDesc.M, loopCol, 2);
      plot.line(this.loopAsc.H.map(v => v * bkMT), this.loopAsc.M, loopCol, 2);
    }

    // recent path trail (includes the initial magnetization curve) —
    // the loop emerges from the interactive cycle
    if (this.trail.length > 1) {
      const tcol = dark ? '#ffd166' : '#b8860b';
      plot.line(this.trail.map(p => p[0]), this.trail.map(p => p[1]), tcol, 3.5);
    }
    plot.dot(BmT, M, dark ? '#fff' : '#111');
    plot.unclip();

    // Ms reference is always shown; Mr and Bc are labeled only with the
    // preview (Bc's live zero-crossing lags the quasi-static value by the sweep rate)
    plot.label('Ms', lim * 0.72, 1.09, accent, 'left');
    plot.line([lim * 0.5, lim], [1, 1], accent, 1.5, [5, 4]);
    if (this.showPreview) {
      plot.dot(0, this.MrMs, accent, 5);
      plot.label('Mr', -lim * 0.05, this.MrMs + 0.07, accent, 'right');
      const BcMT = this.hc * bkMT;
      plot.dot(BcMT, 0, accent, 5);
      plot.label('Bc', BcMT + lim * 0.02, -0.14, accent, 'left');
    }
  }
}

/* ------------------------------------------------------------------ */
/* Static figure: anatomy of a hysteresis loop                         */
/* ------------------------------------------------------------------ */

class LoopAnatomyFigure {
  /* Non-interactive labeled loop for the "anatomy" slide. Same
   * Stoner–Wohlfarth physics and axes as FerroWidget, but computed from
   * a large assemblage (240 grains) so the loop is smooth. */
  constructor(root) {
    this.root = root;
    const q = 2.0; // grain elongation, matching the interactive's default
    const { Na, Nb } = demagFactorsProlate(q);
    this.bkMT = MU0 * (Nb - Na) * 480e3 * 1000;
    const hmax = 3.0, n = 241;
    const { H, M } = swMajorLoop(stratifiedPsis(rng(3), 240), hmax, n);
    this.desc = { H, M };
    this.asc = { H: H.map(v => -v).reverse(), M: M.map(v => -v).reverse() };
    this.MrMs = M[(n - 1) / 2];
    this.hc = 0;
    for (let i = (n - 1) / 2; i < n; i++) {
      if (M[i] <= 0) {
        const f = M[i - 1] / (M[i - 1] - M[i]);
        this.hc = Math.abs(H[i - 1] + f * (H[i] - H[i - 1]));
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
    const plot = new Plot2D(ctx, w, h, [-lim, lim], [-1.2, 1.2],
      { xlabel: 'B, applied field (mT)', ylabel: 'M / Ms' });
    plot.frame(dark);

    const loopCol = dark ? '#ff8f8f' : '#c22b2b';
    plot.line(this.desc.H.map(v => v * this.bkMT), this.desc.M, loopCol, 3.5);
    plot.line(this.asc.H.map(v => v * this.bkMT), this.asc.M, loopCol, 3.5);

    const accent = dark ? '#7fd4ff' : '#0b6aa8';
    const font = 'bold 19px sans-serif';
    plot.line([lim * 0.35, lim], [1, 1], accent, 2, [6, 5]);
    plot.label('Ms', lim * 0.66, 1.08, accent, 'left', font);
    plot.dot(0, this.MrMs, accent, 6);
    plot.label('Mr', -lim * 0.04, this.MrMs + 0.09, accent, 'right', font);
    // mark Bc where the descending branch crosses M = 0 (negative side)
    const BcMT = this.hc * this.bkMT;
    plot.dot(-BcMT, 0, accent, 6);
    plot.label('Bc', -BcMT + lim * 0.025, -0.17, accent, 'left', font);
  }
}

/* ------------------------------------------------------------------ */
/* Widget 3: magnetite + hematite mixtures (wasp-waisted loops)        */
/* ------------------------------------------------------------------ */

class MixtureWidget {
  constructor(root) {
    this.root = root;
    // intrinsic properties, as in Week2_ferromagnetism.ipynb
    this.mag = { Ms: 92.0, Bc: 0.02, sq: 0.1 };  // strong, soft
    this.hem = { Ms: 0.4, Bc: 0.30, sq: 0.6 };   // weak, hard
    this.fMag = 0.005;                            // magnetite mass fraction
    this.Bmax = 1.8;
    this.buildDOM();
    this.draw();
    // redraw on theme change / resize
    new ResizeObserver(() => this.draw()).observe(this.root.querySelector('.c-plot'));
    this.root._redraw = () => this.draw();
  }

  buildDOM() {
    this.root.innerHTML = `
      <div class="widget-controls">
        <label class="wslider" style="min-width:430px">magnetite mass fraction
          <input class="s-f" type="range" min="0" max="3" step="0.02" value="${Math.log10(this.fMag * 1e4) }">
          <span class="wval" data-ro="f"></span></label>
        <span class="wreadout">rest of the rock's ferromagnetic fraction is hematite</span>
      </div>
      <div class="widget-canvases">
        <div class="wpane wpane-full">
          <canvas class="c-plot"></canvas>
          <div class="wcaption">0.5 wt% magnetite rivals 99.5 wt% hematite — trace magnetite dominates</div>
        </div>
      </div>`;
    this.sF = this.root.querySelector('.s-f');
    this.ro = { f: this.root.querySelector('[data-ro=f]') };
    this.sF.addEventListener('input', () => {
      // slider is log-scaled: 0..3 -> 0.01%..10% (value = 10^x / 1e4)
      this.fMag = Math.pow(10, parseFloat(this.sF.value)) / 1e4;
      this.draw();
    });
  }

  draw() {
    const { ctx, w, h } = setupCanvas(this.root.querySelector('.c-plot'));
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const fM = this.fMag, fH = 1 - fM;
    const MsM = this.mag.Ms * fM, MsH = this.hem.Ms * fH;
    const yMax = Math.max(MsM + MsH, 0.5) * 1.2;
    this.ro.f.textContent = fM >= 0.001 ? `${(fM * 100).toFixed(2)} wt%` : `${(fM * 100).toFixed(3)} wt%`;

    const plot = new Plot2D(ctx, w, h, [-this.Bmax, this.Bmax], [-yMax, yMax],
      { xlabel: 'B, applied field (T)', ylabel: 'M of rock (Am²/kg)' });
    plot.frame(dark);

    const bM = takacsBranches(MsM, this.mag.Bc, this.mag.sq, this.Bmax);
    const bH = takacsBranches(MsH, this.hem.Bc, this.hem.sq, this.Bmax);
    const totD = bM.desc.map((v, i) => v + bH.desc[i]);
    const totA = bM.asc.map((v, i) => v + bH.asc[i]);

    const cMag = dark ? '#8fb7ff' : '#2b52c2';
    const cHem = dark ? '#ff8f8f' : '#c22b2b';
    const cTot = dark ? '#eee' : '#111';
    plot.line(bM.B, bM.desc, cMag, 1.8, [6, 4]);
    plot.line(bM.B, bM.asc, cMag, 1.8, [6, 4]);
    plot.line(bH.B, bH.desc, cHem, 1.8, [6, 4]);
    plot.line(bH.B, bH.asc, cHem, 1.8, [6, 4]);
    plot.line(bM.B, totD, cTot, 3.2);
    plot.line(bM.B, totA, cTot, 3.2);

    // coercivity of the mixed rock: where the total descending branch
    // crosses M = 0 (at -Bc; sweep is in ascending-B order)
    let BcT = 0;
    for (let i = 1; i < totD.length; i++) {
      if (totD[i - 1] < 0 && totD[i] >= 0) {
        const f = totD[i - 1] / (totD[i - 1] - totD[i]);
        BcT = Math.abs(bM.B[i - 1] + f * (bM.B[i] - bM.B[i - 1]));
        break;
      }
    }

    plot.label(`total rock: Ms = ${(MsM + MsH).toFixed(2)} Am²/kg · Bc = ${(BcT * 1000).toFixed(0)} mT`,
               -this.Bmax * 0.97, yMax * 0.88, cTot);
    plot.label(`magnetite (${(fM * 100).toFixed(2)}%): ${MsM.toFixed(2)} Am²/kg`, -this.Bmax * 0.97, yMax * 0.72, cMag);
    plot.label(`hematite (${(fH * 100).toFixed(2)}%): ${MsH.toFixed(2)} Am²/kg`, -this.Bmax * 0.97, yMax * 0.56, cHem);
  }
}

/* ------------------------------------------------------------------ */
/* bootstrapping                                                       */
/* ------------------------------------------------------------------ */

window.addEventListener('load', () => {
  document.querySelectorAll('[data-widget="dia"]').forEach(el => new LinearResponseWidget(el, 'dia'));
  document.querySelectorAll('[data-widget="para"]').forEach(el => new LinearResponseWidget(el, 'para'));
  document.querySelectorAll('[data-widget="ferro"]').forEach(el => { el._widget = new FerroWidget(el); });
  document.querySelectorAll('[data-widget="loopanatomy"]').forEach(el => { el._widget = new LoopAnatomyFigure(el); });
  document.querySelectorAll('[data-widget="mixture"]').forEach(el => new MixtureWidget(el));
});
