/*
 * Interactive widgets for the IRM Summer School S3 slides
 * (remanent magnetization).
 *
 * Three widgets, all plain canvas + vanilla JS (no external dependencies):
 *   1. NeelWidget   — Néel relaxation time explorer: double-well anisotropy
 *                     energy barrier vs thermal energy, and the tau(d, T)
 *                     "razor edge" for magnetite.
 *   2. AFDemagWidget— alternating-field demagnetization: grains track the
 *                     decaying AF while it exceeds their coercivity and
 *                     freeze with random polarity as the envelope passes
 *                     below it; a two-component NRM is peeled apart.
 *   3. ZijWidget    — Zijderveld / component-separation explorer: two
 *                     synthetic components with adjustable log-normal
 *                     coercivity spectra, live Zijderveld, equal-area and
 *                     decay panels, and a PCA (Kirschvink 1980) line fit
 *                     with MAD readout.
 *
 * Physics constants follow the course notebooks (W5_VRM_TRM_CRM,
 * W8_getting_directions) and Chapter 7 of Tauxe & Swanson-Hysell (2026).
 * Shared plotting helpers are the same as in the S1 deck's widgets.js.
 */

'use strict';

const KB = 1.380649e-23;   // Boltzmann constant (J/K)
const TAU0 = 1e-9;         // Néel attempt time 1/C (s)

/* ------------------------------------------------------------------ */
/* Small plotting helpers (as in S1)                                   */
/* ------------------------------------------------------------------ */

function setupCanvas(canvas) {
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
  frame(dark, opts = {}) {
    const ctx = this.ctx;
    const axis = dark ? '#bbb' : '#444';
    const grid = dark ? 'rgba(150,150,150,0.25)' : 'rgba(0,0,0,0.12)';
    ctx.save();
    ctx.strokeStyle = axis; ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (opts.zeroLines !== false) {
      const y0 = Math.min(Math.max(0, Math.min(this.ylim[0], this.ylim[1])),
                          Math.max(this.ylim[0], this.ylim[1]));
      ctx.moveTo(this.x(this.xlim[0]), this.y(y0)); ctx.lineTo(this.x(this.xlim[1]), this.y(y0));
      if (this.xlim[0] < 0 && this.xlim[1] > 0) {
        ctx.moveTo(this.x(0), this.y(this.ylim[0])); ctx.lineTo(this.x(0), this.y(this.ylim[1]));
      }
    }
    ctx.stroke();
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    ctx.strokeRect(this.x(this.xlim[0]), this.y(this.ylim[1]),
                   this.x(this.xlim[1]) - this.x(this.xlim[0]),
                   this.y(this.ylim[0]) - this.y(this.ylim[1]));
    ctx.fillStyle = axis;
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.xlabel, (this.x(this.xlim[0]) + this.x(this.xlim[1])) / 2, this.h - 10);
    ctx.save();
    ctx.translate(16, (this.y(this.ylim[0]) + this.y(this.ylim[1])) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(this.ylabel, 0, 0);
    ctx.restore();
    ctx.restore();
  }
  xticks(vals, fmt) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#777'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    for (const v of vals) {
      ctx.fillText(fmt ? fmt(v) : formatNum(v), this.x(v), this.y(this.ylim[0]) + 16);
      ctx.strokeStyle = '#aaa';
      ctx.beginPath();
      ctx.moveTo(this.x(v), this.y(this.ylim[0]));
      ctx.lineTo(this.x(v), this.y(this.ylim[0]) - 5);
      ctx.stroke();
    }
    ctx.restore();
  }
  yticks(vals, fmt) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#777'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
    for (const v of vals) {
      ctx.fillText(fmt ? fmt(v) : formatNum(v), this.x(this.xlim[0]) - 6, this.y(v) + 4);
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
  fillCurve(xs, ys, ybase, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(this.x(xs[0]), this.y(ybase));
    for (let i = 0; i < xs.length; i++) ctx.lineTo(this.x(xs[i]), this.y(ys[i]));
    ctx.lineTo(this.x(xs[xs.length - 1]), this.y(ybase));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  dot(xv, yv, color, r = 6, open = false) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x(xv), this.y(yv), r, 0, 2 * Math.PI);
    if (open) {
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
  }
  square(xv, yv, color, r = 5, open = true) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x(xv) - r, this.y(yv) - r, 2 * r, 2 * r);
    if (open) {
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    } else {
      ctx.fillStyle = color; ctx.fill();
    }
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

/* Deterministic pseudo-random generator (mulberry32) so the widgets look
 * the same on every load. */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* error function (Abramowitz & Stegun 7.1.26, |err| < 1.5e-7) for the
 * log-normal coercivity spectra */
function erf(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

/* fraction of a log-normal coercivity spectrum remaining above `field`:
 * 1 - CDF(field; median, dp), dp = std dev of ln(Bc) */
function fracRemaining(field, median, dp) {
  if (field <= 0) return 1;
  const z = (Math.log(field) - Math.log(median)) / dp;
  return 1 - 0.5 * (1 + erf(z / Math.SQRT2));
}

/* log-normal pdf for drawing spectra */
function lognormPdf(x, median, dp) {
  if (x <= 0) return 0;
  const z = (Math.log(x) - Math.log(median)) / dp;
  return Math.exp(-0.5 * z * z) / (x * dp * Math.sqrt(2 * Math.PI));
}

/* direction (dec, inc in degrees, magnitude) -> [x (N), y (E), z (down)] */
function dir2cart(dec, inc, mag = 1) {
  const d = dec * Math.PI / 180, i = inc * Math.PI / 180;
  return [mag * Math.cos(i) * Math.cos(d),
          mag * Math.cos(i) * Math.sin(d),
          mag * Math.sin(i)];
}

function cart2dir(x, y, z) {
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag === 0) return [0, 0, 0];
  let dec = Math.atan2(y, x) * 180 / Math.PI;
  if (dec < 0) dec += 360;
  const inc = Math.asin(z / mag) * 180 / Math.PI;
  return [dec, inc, mag];
}

/* human-friendly time formatting for relaxation times */
function formatTau(tau) {
  const YR = 3.156e7;
  if (tau < 1e-6) return (tau * 1e9).toPrecision(2) + ' ns';
  if (tau < 1e-3) return (tau * 1e6).toPrecision(2) + ' μs';
  if (tau < 1) return (tau * 1e3).toPrecision(2) + ' ms';
  if (tau < 60) return tau.toPrecision(2) + ' s';
  if (tau < 3600) return (tau / 60).toPrecision(2) + ' min';
  if (tau < 86400) return (tau / 3600).toPrecision(2) + ' hr';
  if (tau < YR) return (tau / 86400).toPrecision(2) + ' days';
  if (tau < 1e3 * YR) return (tau / YR).toPrecision(2) + ' yr';
  if (tau < 1e6 * YR) return (tau / YR / 1e3).toPrecision(2) + ' kyr';
  if (tau < 1e9 * YR) return (tau / YR / 1e6).toPrecision(2) + ' Myr';
  if (tau < 13.8e9 * YR) return (tau / YR / 1e9).toPrecision(2) + ' Gyr';
  return '≫ age of universe';
}

/* ------------------------------------------------------------------ */
/* Widget 1: Néel relaxation time explorer                             */
/* ------------------------------------------------------------------ */

/* Magnetite with uniaxial (shape) anisotropy:
 *   tau = tau0 * exp( K(T) v / kB T )
 *   Ms(T) = Ms0 * ((Tc - T)/(Tc - Troom))^gamma  (normalized at 20 °C)
 *   K(T)  = K0 * (Ms(T)/Ms(Troom))^2             (shape anisotropy, K ∝ Ms²)
 * with gamma = 0.38 and Tc = 580 °C, as in the W5 course notebook and
 * Chapter 7. K0 = 30 kJ/m³ is calibrated so that an equivalent spherical
 * diameter of 25 nm gives tau ≈ Gyr at 20 °C but is superparamagnetic at
 * 300 °C — the Chapter 7 narrative. Volume uses a sphere of diameter d.
 */

const NEEL = {
  K0: 3.0e4,        // J/m³ at room temperature
  Tc: 580,          // °C
  Troom: 20,        // °C
  gamma: 0.38,
};

function neelK(T_C) {
  if (T_C >= NEEL.Tc) return 0;
  const msRatio = Math.pow((NEEL.Tc - T_C) / (NEEL.Tc - NEEL.Troom), NEEL.gamma);
  return NEEL.K0 * msRatio * msRatio;
}

function neelLogTau(d_nm, T_C) {
  // log10 of tau (s) for equivalent spherical diameter d_nm at T_C
  const v = Math.PI / 6 * Math.pow(d_nm * 1e-9, 3);
  const K = neelK(T_C);
  const expo = K * v / (KB * (T_C + 273.15));
  return Math.log10(TAU0) + expo / Math.LN10;
}

class NeelWidget {
  constructor(root) {
    this.root = root;
    this.d = 25;      // nm
    this.T = 20;      // °C
    this.buildDOM();
    this.redraw();
    new ResizeObserver(() => this.redraw()).observe(this.cPlot);
    this.root._redraw = () => this.redraw();
  }

  buildDOM() {
    this.root.innerHTML = `
      <div class="widget-controls">
        <label class="wslider">grain diameter
          <input class="s-d" type="range" min="10" max="45" step="0.1" value="${this.d}">
          <span class="wval" data-ro="d"></span></label>
        <label class="wslider">temperature
          <input class="s-t" type="range" min="20" max="575" step="5" value="${this.T}">
          <span class="wval" data-ro="T"></span></label>
        <span class="wreadout">Kv/k<sub>B</sub>T = <span data-ro="ratio"></span> &nbsp;
          <strong>τ = <span data-ro="tau"></span></strong></span>
      </div>
      <div class="widget-canvases">
        <div class="wpane wpane-full">
          <canvas class="c-plot"></canvas>
          <div class="wcaption">relaxation time vs grain size — exponential physics puts
            "seconds" and "age of the Earth" a few nm apart</div>
        </div>
      </div>`;
    this.cPlot = this.root.querySelector('.c-plot');
    this.ro = {};
    this.root.querySelectorAll('[data-ro]').forEach(el => this.ro[el.dataset.ro] = el);
    this.root.querySelector('.s-d').addEventListener('input', e => {
      this.d = parseFloat(e.target.value);
      this.redraw();
    });
    this.root.querySelector('.s-t').addEventListener('input', e => {
      this.T = parseFloat(e.target.value);
      this.redraw();
    });
  }

  redraw() {
    const v = Math.PI / 6 * Math.pow(this.d * 1e-9, 3);
    const Kv = neelK(this.T) * v;
    const kT = KB * (this.T + 273.15);
    const logTau = neelLogTau(this.d, this.T);
    const tau = Math.pow(10, Math.min(logTau, 300));
    this.ro.d.textContent = `${this.d.toFixed(1)} nm`;
    this.ro.T.textContent = `${this.T.toFixed(0)} °C`;
    this.ro.ratio.textContent = (Kv / kT).toFixed(1);
    this.ro.tau.textContent = formatTau(tau);
    this.drawPlot(logTau);
  }

  drawPlot(logTauNow) {
    const { ctx, w, h } = setupCanvas(this.cPlot);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const YR = 3.156e7;
    const plot = new Plot2D(ctx, w, h, [10, 45], [-10, 26],
      { xlabel: 'equivalent spherical diameter (nm)', ylabel: 'relaxation time τ (s)',
        margin: { l: 78, r: 14, t: 14, b: 44 } });
    plot.frame(dark, { zeroLines: false });
    plot.xticks([10, 20, 30, 40]);
    const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '5': '⁵', '8': '⁸', '9': '⁹' };
    plot.yticks([-9, 0, 9, 18, 25],
                v => '10' + String(v).split('').map(c => SUP[c]).join(''));

    // guide lines: 100 s, 1 Myr, age of Earth
    const guides = [
      [Math.log10(100), '100 s — lab', dark ? '#7fd4ff' : '#0b6aa8'],
      [Math.log10(1e6 * YR), '1 Myr', dark ? '#ffb26b' : '#c25400'],
      [Math.log10(4.5e9 * YR), '4.5 Gyr — age of Earth', dark ? '#ff8f8f' : '#c22b2b'],
    ];
    for (const [ly, txt, col] of guides) {
      plot.line([10, 45], [ly, ly], col, 1.5, [6, 5]);
      plot.label(txt, 44.5, ly + 0.8, col, 'right', '13px sans-serif');
    }

    // tau(d) curves, clipped where they leave the top of the axis
    const tauCurve = (T, yTop) => {
      const xs = [], ys = [];
      let pd = null, py = null;
      for (let d = 10; d <= 45; d += 0.25) {
        const y = neelLogTau(d, T);
        if (y > yTop) {
          if (pd !== null) {
            const f = (yTop - py) / (y - py);
            xs.push(pd + f * (d - pd));
            ys.push(yTop);
          }
          break;
        }
        xs.push(d); ys.push(y);
        pd = d; py = y;
      }
      return { xs, ys };
    };

    // faint reference curve at 20 °C when the slider is elsewhere
    if (this.T > 22) {
      const ref = tauCurve(20, 26);
      plot.line(ref.xs, ref.ys, dark ? 'rgba(200,200,210,0.4)' : 'rgba(90,90,100,0.35)', 2, [3, 4]);
      plot.label('20 °C', 12.5, neelLogTau(14, 20) + 1.2, dark ? '#999' : '#888', 'left', '12px sans-serif');
    }

    // tau(d) at current temperature
    const cur = tauCurve(this.T, 26);
    plot.line(cur.xs, cur.ys, dark ? '#7fd4a8' : '#0a7d44', 3.5);
    // the dot simply leaves the plot once tau is beyond the axis range
    const logTauDot = neelLogTau(this.d, this.T);
    if (logTauDot >= -10 && logTauDot <= 26) {
      plot.dot(this.d, logTauDot, dark ? '#fff' : '#111', 7);
    }

    // SP / SSD shading relative to the 100 s line
    plot.label('superparamagnetic ↓', 11, Math.log10(100) - 2.2, dark ? '#9ab' : '#68a',
               'left', 'italic 13px sans-serif');
    plot.label('blocked (stable) ↑', 11, Math.log10(100) + 3.0, dark ? '#9ab' : '#68a',
               'left', 'italic 13px sans-serif');
  }
}

/* ------------------------------------------------------------------ */
/* Widget 2: AF demagnetization                                        */
/* ------------------------------------------------------------------ */

/* A two-component NRM carried by single-domain grains:
 *   component A — soft overprint (e.g. VRM in the present field),
 *                 log-normal coercivity spectrum, median 12 mT
 *   component B — hard ancient remanence, median 60 mT
 * During an AF step at peak field Bpk, every grain with Bc < envelope
 * tracks the alternating field (flipping every half cycle); as the
 * envelope decays past its coercivity the grain freezes with random
 * polarity, so demagnetized grains cancel pairwise and only grains with
 * Bc > Bpk keep their NRM polarity. Directions are drawn in a 2-D plane
 * for the cartoon; the physics of the decay curve uses the full grain
 * populations.
 */

class AFDemagWidget {
  constructor(root) {
    this.root = root;
    // component directions in the drawing plane (angle from +x, deg)
    this.compA = { angle: 70, frac: 0.35, median: 12, dp: 0.5,
                   color: '#D55E00', colorDark: '#ffb26b', name: 'A — soft overprint' };
    this.compB = { angle: -15, frac: 0.65, median: 60, dp: 0.35,
                   color: '#0072B2', colorDark: '#8fb7ff', name: 'B — ancient remanence' };
    this.peak = 20;               // slider value (mT)
    this.stepSeq = [4, 8, 12, 16, 20, 30, 40, 60, 90, 130, 180];
    this.anim = null;             // running envelope animation state
    this.seed = 7;
    this.makeGrains();
    this.buildDOM();
    this.lastT = performance.now();
    const step = (t) => {
      if (this.root.offsetParent !== null) this.tick(t);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  makeGrains() {
    // 260 grains for the physics; the first 28 are also drawn
    const rand = rng(this.seed);
    this.grains = [];
    const N = 260;
    for (let i = 0; i < N; i++) {
      const isA = rand() < this.compA.frac;
      const comp = isA ? this.compA : this.compB;
      // log-normal coercivity
      let u = 0;
      for (let k = 0; k < 12; k++) u += rand();   // ~N(6,1)
      const bc = comp.median * Math.exp(comp.dp * (u - 6));
      // small angular scatter about the component direction
      const ang = comp.angle + (rand() - 0.5) * 24;
      this.grains.push({
        isA, bc, ang,
        sign: 1,                   // +1 = NRM polarity along its axis
        fx: rand(), fy: rand(),
        flick: rand() * 2 * Math.PI,
      });
    }
    this.demagLevel = 0;           // highest AF applied so far
    this.curve = [[0, 1]];         // measured decay curve [peak, M/M0]
    this.M0 = this.netM();
  }

  netM() {
    // vector sum over all grains (unit moments along their axes)
    let mx = 0, my = 0;
    for (const g of this.grains) {
      const a = g.ang * Math.PI / 180;
      mx += g.sign * Math.cos(a);
      my += g.sign * Math.sin(a);
    }
    return { x: mx, y: my, mag: Math.sqrt(mx * mx + my * my) };
  }

  buildDOM() {
    this.root.innerHTML = `
      <div class="widget-controls">
        <label class="wslider">peak AF
          <input class="s-b" type="range" min="2" max="200" step="1" value="${this.peak}">
          <span class="wval" data-ro="pk"></span></label>
        <button class="wbtn wstep">▶ apply AF step</button>
        <button class="wbtn wseq">▶▶ full demag sequence</button>
        <button class="wbtn wreset">↻ reset (re-magnetize)</button>
        <span class="wreadout">M/M₀ = <span data-ro="M"></span></span>
      </div>
      <div class="widget-canvases">
        <div class="wpane">
          <canvas class="c-grains"></canvas>
          <div class="wcaption">grains flip with the AF while it exceeds their coercivity,
            then freeze with random polarity — <span style="color:#D55E00">soft overprint</span> ·
            <span style="color:#0072B2">hard ancient component</span></div>
        </div>
        <div class="wpane wpane-wide">
          <canvas class="c-plot"></canvas>
          <div class="wcaption">net magnetization vs peak AF — the soft component is stripped
            first, the direction swings to the surviving hard component</div>
        </div>
      </div>`;
    this.cGrains = this.root.querySelector('.c-grains');
    this.cPlot = this.root.querySelector('.c-plot');
    this.ro = {};
    this.root.querySelectorAll('[data-ro]').forEach(el => this.ro[el.dataset.ro] = el);
    this.sB = this.root.querySelector('.s-b');
    this.sB.addEventListener('input', () => { this.peak = parseFloat(this.sB.value); });
    this.root.querySelector('.wstep').addEventListener('click', () => this.startStep(this.peak));
    this.root.querySelector('.wseq').addEventListener('click', () => this.runSequence());
    this.root.querySelector('.wreset').addEventListener('click', () => {
      this.seed += 1;
      this.makeGrains();
      this.anim = null;
      this.queue = null;
    });
  }

  startStep(peak) {
    if (this.anim) return;
    this.animRand = rng(this.seed * 977 + Math.round(peak * 13));
    this.anim = { peak, t: 0, dur: 2.4 };
  }

  runSequence() {
    if (this.anim) return;
    this.queue = this.stepSeq.filter(p => p > this.demagLevel);
    if (this.queue.length) {
      const p = this.queue.shift();
      this.sB.value = p; this.peak = p;
      this.startStep(p);
    }
  }

  finishStep(peak) {
    // freeze every grain with bc < peak at a random polarity
    for (const g of this.grains) {
      if (g.bc < peak) g.sign = this.animRand() < 0.5 ? 1 : -1;
    }
    this.demagLevel = Math.max(this.demagLevel, peak);
    const M = this.netM();
    this.curve.push([peak, M.mag / this.M0.mag]);
    this.curve.sort((a, b) => a[0] - b[0]);
    this.anim = null;
    if (this.queue && this.queue.length) {
      const p = this.queue.shift();
      this.sB.value = p; this.peak = p;
      this.startStep(p);
    }
  }

  tick(tNow) {
    const dt = Math.max(0, Math.min(0.05, (tNow - this.lastT) / 1000));
    this.lastT = tNow;

    let envelope = 0, phasefield = 0;
    if (this.anim) {
      this.anim.t += dt;
      const fr = this.anim.t / this.anim.dur;
      if (fr >= 1) {
        this.finishStep(this.anim.peak);
      } else {
        // ramp up quickly, then decay; ~60 visible oscillations
        const ramp = Math.min(1, fr * 8);
        const decay = fr < 0.125 ? 1 : Math.exp(-(fr - 0.125) * 4.2);
        envelope = this.anim.peak * ramp * decay;
        phasefield = Math.sin(2 * Math.PI * 24 * this.anim.t);
      }
    }
    this.envelope = envelope;
    this.fieldNow = envelope * phasefield;

    const M = this.netM();
    this.ro.pk.textContent = `${this.peak.toFixed(0)} mT`;
    this.ro.M.textContent = (M.mag / this.M0.mag).toFixed(2);
    this.drawGrains(M);
    this.drawPlot(M);
  }

  drawGrains(M) {
    const { ctx, w, h } = setupCanvas(this.cGrains);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);

    // rock-slab background
    ctx.fillStyle = dark ? '#3c3c42' : '#b6b6b6';
    ctx.beginPath();
    ctx.roundRect(3, 3, w - 6, h - 42, 12);
    ctx.fill();

    // AF waveform strip along the bottom
    const wy = h - 20, wh = 16;
    ctx.strokeStyle = dark ? '#777' : '#999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, wy); ctx.lineTo(w - 8, wy);
    ctx.stroke();
    if (this.anim) {
      const fr = this.anim.t / this.anim.dur;
      const col = dark ? 'rgba(130,175,255,0.95)' : 'rgba(35,75,190,0.9)';
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= 300; i++) {
        const f = i / 300;
        const ramp = Math.min(1, f * 8);
        const dec = f < 0.125 ? 1 : Math.exp(-(f - 0.125) * 4.2);
        const env = ramp * dec;
        const yv = env * Math.sin(2 * Math.PI * 24 * f * this.anim.dur);
        const x = 8 + f * (w - 16);
        const y = wy - yv * wh;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // progress cursor
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(8 + fr * (w - 16), wy - (this.fieldNow / Math.max(this.anim.peak, 1e-9)) * wh, 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`AF: ${this.envelope.toFixed(0)} mT`, 10, wy - wh - 4);
    } else {
      ctx.fillStyle = dark ? '#888' : '#777';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(this.demagLevel > 0
        ? `demagnetized to ${this.demagLevel.toFixed(0)} mT`
        : 'NRM state — apply an AF step', 10, wy - 6);
    }

    // grains (first 28 of the population)
    const cols = 7, rows = 4, top = 10, bot = h - 48;
    const drawn = this.grains.slice(0, cols * rows);
    drawn.forEach((g, i) => {
      const cx = (i % cols + 0.5) * (w - 16) / cols + 8;
      const cy = top + (Math.floor(i / cols) + 0.5) * (bot - top) / rows;
      let a = g.ang * Math.PI / 180;
      let sign = g.sign;
      // grains inside the live AF flip with the instantaneous field
      if (this.anim && g.bc < this.envelope) {
        g.flick += 0.9;
        sign = this.fieldNow >= 0 ? 1 : -1;
      }
      const len = Math.min((w - 16) / cols, (bot - top) / rows) * 0.36;
      const col = g.isA ? (dark ? this.compA.colorDark : this.compA.color)
                        : (dark ? this.compB.colorDark : this.compB.color);
      const demagged = !this.anim && g.bc < this.demagLevel;
      ctx.globalAlpha = demagged ? 0.45 : 1;
      drawArrow(ctx,
                cx - sign * Math.cos(a) * len, cy + sign * Math.sin(a) * len,
                cx + sign * Math.cos(a) * len, cy - sign * Math.sin(a) * len,
                col, 3, 8);
      ctx.globalAlpha = 1;
    });

    // net magnetization arrow, centered
    const cx = w / 2, cy = (top + bot) / 2;
    const scale = 90 / Math.max(this.M0.mag, 1e-9);
    if (M.mag / this.M0.mag > 0.02) {
      ctx.save();
      ctx.shadowColor = dark ? '#000' : '#fff';
      ctx.shadowBlur = 8;
      drawArrow(ctx, cx - M.x * scale / 2, cy + M.y * scale / 2,
                cx + M.x * scale / 2, cy - M.y * scale / 2,
                dark ? '#fff' : '#111', 5, 12);
      ctx.restore();
      ctx.fillStyle = dark ? '#fff' : '#111';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('M', cx + M.x * scale / 2 + 8, cy - M.y * scale / 2);
    }
  }

  drawPlot(M) {
    const { ctx, w, h } = setupCanvas(this.cPlot);
    const dark = isDark();
    ctx.clearRect(0, 0, w, h);
    const plot = new Plot2D(ctx, w, h, [0, 200], [0, 1.08],
      { xlabel: 'peak alternating field (mT)', ylabel: 'M / M₀' });
    plot.frame(dark, { zeroLines: false });
    plot.xticks([0, 50, 100, 150, 200]);
    plot.yticks([0, 0.5, 1]);

    // theoretical remaining fractions of each component (coherent part)
    const xs = [], fa = [], fb = [], ftot = [];
    // vector-sum magnitude of what remains, from the component geometry
    const aA = this.compA.angle * Math.PI / 180, aB = this.compB.angle * Math.PI / 180;
    const wA = this.compA.frac, wB = this.compB.frac;
    const m0x = wA * Math.cos(aA) + wB * Math.cos(aB);
    const m0y = wA * Math.sin(aA) + wB * Math.sin(aB);
    const m0 = Math.sqrt(m0x * m0x + m0y * m0y);
    for (let b = 0; b <= 200; b += 2) {
      const ra = fracRemaining(b, this.compA.median, this.compA.dp);
      const rb = fracRemaining(b, this.compB.median, this.compB.dp);
      const mx = wA * ra * Math.cos(aA) + wB * rb * Math.cos(aB);
      const my = wA * ra * Math.sin(aA) + wB * rb * Math.sin(aB);
      xs.push(b); fa.push(ra); fb.push(rb);
      ftot.push(Math.sqrt(mx * mx + my * my) / m0);
    }
    plot.line(xs, fa, dark ? this.compA.colorDark : this.compA.color, 2, [6, 4]);
    plot.line(xs, fb, dark ? this.compB.colorDark : this.compB.color, 2, [6, 4]);
    plot.line(xs, ftot, dark ? 'rgba(220,220,220,0.5)' : 'rgba(60,60,60,0.35)', 2);
    plot.label('A remaining', 26, 0.30, dark ? this.compA.colorDark : this.compA.color, 'left', '13px sans-serif');
    plot.label('B remaining', 108, 0.62, dark ? this.compB.colorDark : this.compB.color, 'left', '13px sans-serif');

    // measured curve from the grain population
    const mcol = dark ? '#fff' : '#111';
    plot.line(this.curve.map(p => p[0]), this.curve.map(p => p[1]), mcol, 3);
    for (const [b, m] of this.curve) plot.dot(b, m, mcol, 4.5);

    // live point during an animation
    if (this.anim) plot.dot(this.envelope, M.mag / this.M0.mag, dark ? '#ffd166' : '#b8860b', 6);
  }
}

/* ------------------------------------------------------------------ */
/* Widget 3: Zijderveld / component separation explorer                */
/* ------------------------------------------------------------------ */

/* Synthetic two-component specimen, as in the W8 course notebook:
 *   component A — overprint:  Dec 0°,  Inc 60°, intensity 0.3
 *   component B — primary:    Dec 290°, Inc 20°, intensity 0.7
 * Each component's coercivity spectrum is log-normal (median, DP
 * adjustable). At every AF step the remaining vector sum is "measured";
 * the four panels show the spectra, the Zijderveld diagram (projected
 * along the NRM declination), the equal-area projection and the
 * intensity decay. A PCA line (Kirschvink 1980, free line) is fit to the
 * steps at and above an adjustable start step, with live MAD and the
 * angular distance from the true component B direction.
 */

const ZIJ_STEPS = [0, 3, 6, 9, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200];

class ZijWidget {
  constructor(root) {
    this.root = root;
    this.A = { dec: 0, inc: 60, m: 0.3, median: 12, dp: 0.4,
               color: '#D55E00', colorDark: '#ffb26b' };
    this.B = { dec: 290, inc: 20, m: 0.7, median: 100, dp: 0.3,
               color: '#0072B2', colorDark: '#8fb7ff' };
    this.fitFrom = 8;              // index into ZIJ_STEPS
    this.buildDOM();
    this.redraw();
    new ResizeObserver(() => this.redraw()).observe(this.root.querySelector('.c-zij'));
    this.root._redraw = () => this.redraw();
  }

  buildDOM() {
    this.root.innerHTML = `
      <div class="widget-controls">
        <span class="wreadout"><strong style="color:${this.A.color}">A (overprint)</strong></span>
        <label class="wslider">median <input class="s-am" type="range" min="2" max="100" step="1" value="${this.A.median}">
          <span class="wval" data-ro="am"></span></label>
        <label class="wslider">DP <input class="s-ad" type="range" min="0.1" max="1" step="0.02" value="${this.A.dp}">
          <span class="wval" data-ro="ad"></span></label>
        <span class="wreadout"><strong style="color:${this.B.color}">B (primary)</strong></span>
        <label class="wslider">median <input class="s-bm" type="range" min="10" max="200" step="1" value="${this.B.median}">
          <span class="wval" data-ro="bm"></span></label>
        <label class="wslider">DP <input class="s-bd" type="range" min="0.1" max="1" step="0.02" value="${this.B.dp}">
          <span class="wval" data-ro="bd"></span></label>
        <div class="btn-group">
          <button class="wbtn wpre" data-pre="none">no overlap</button>
          <button class="wbtn wpre" data-pre="partial">partial</button>
          <button class="wbtn wpre" data-pre="strong">strong</button>
        </div>
      </div>
      <div class="widget-controls">
        <label class="wslider">PCA fit from step
          <input class="s-fit" type="range" min="1" max="${ZIJ_STEPS.length - 3}" step="1" value="${this.fitFrom}">
          <span class="wval" data-ro="fit"></span></label>
        <span class="wreadout">fitted: <span data-ro="fitdir"></span> ·
          MAD = <span data-ro="mad"></span> ·
          Δ from true B = <span data-ro="dang"></span></span>
      </div>
      <div class="widget-canvases">
        <div class="wpane"><canvas class="c-spec"></canvas>
          <div class="wcaption">coercivity spectra (dM/dB)</div></div>
        <div class="wpane wpane-wide"><canvas class="c-zij"></canvas>
          <div class="wcaption">Zijderveld — ● horizontal (N′–E′) · □ vertical (N′–Down) ·
            <span style="color:#0a7d44">PCA fit</span></div></div>
        <div class="wpane"><canvas class="c-eq"></canvas>
          <div class="wcaption">equal-area — ★ true A, B</div></div>
        <div class="wpane"><canvas class="c-dec"></canvas>
          <div class="wcaption">intensity decay</div></div>
      </div>`;
    this.ro = {};
    this.root.querySelectorAll('[data-ro]').forEach(el => this.ro[el.dataset.ro] = el);
    const bind = (cls, obj, key) => {
      this.root.querySelector(cls).addEventListener('input', e => {
        obj[key] = parseFloat(e.target.value);
        this.redraw();
      });
    };
    bind('.s-am', this.A, 'median');
    bind('.s-ad', this.A, 'dp');
    bind('.s-bm', this.B, 'median');
    bind('.s-bd', this.B, 'dp');
    this.root.querySelector('.s-fit').addEventListener('input', e => {
      this.fitFrom = parseInt(e.target.value, 10);
      this.redraw();
    });
    const presets = {
      none: [12, 0.4, 100, 0.3],
      partial: [20, 0.5, 70, 0.4],
      strong: [30, 0.6, 50, 0.5],
    };
    this.root.querySelectorAll('.wpre').forEach(btn => {
      btn.addEventListener('click', () => {
        const [am, ad, bm, bd] = presets[btn.dataset.pre];
        this.A.median = am; this.A.dp = ad;
        this.B.median = bm; this.B.dp = bd;
        this.root.querySelector('.s-am').value = am;
        this.root.querySelector('.s-ad').value = ad;
        this.root.querySelector('.s-bm').value = bm;
        this.root.querySelector('.s-bd').value = bd;
        this.redraw();
      });
    });
  }

  demagData() {
    // vector sum remaining at every AF step, in cartesian [N, E, Down]
    const Ac = dir2cart(this.A.dec, this.A.inc, this.A.m);
    const Bc = dir2cart(this.B.dec, this.B.inc, this.B.m);
    const pts = ZIJ_STEPS.map(b => {
      const ra = fracRemaining(b, this.A.median, this.A.dp);
      const rb = fracRemaining(b, this.B.median, this.B.dp);
      return [Ac[0] * ra + Bc[0] * rb,
              Ac[1] * ra + Bc[1] * rb,
              Ac[2] * ra + Bc[2] * rb];
    });
    return { pts, Ac, Bc };
  }

  pca(pts) {
    /* Kirschvink (1980) free best-fit line: principal eigenvector of the
     * orientation tensor of the mean-centered demag points. Power
     * iteration with deflation gives the three eigenvalues. */
    const n = pts.length;
    if (n < 3) return null;
    const mean = [0, 0, 0];
    for (const p of pts) { mean[0] += p[0] / n; mean[1] += p[1] / n; mean[2] += p[2] / n; }
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of pts) {
      const d = [p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j];
    }
    const mul = (A, v) => [
      A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2],
      A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2],
      A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]];
    const norm = v => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    const eig = (A) => {
      let v = [0.6, 0.5, 0.63];
      let lam = 0;
      for (let k = 0; k < 120; k++) {
        const w = mul(A, v);
        lam = norm(w);
        if (lam < 1e-15) return { lam: 0, v: [1, 0, 0] };
        v = [w[0] / lam, w[1] / lam, w[2] / lam];
      }
      return { lam, v };
    };
    const e1 = eig(C);
    const D = C.map((row, i) => row.map((cv, j) => cv - e1.lam * e1.v[i] * e1.v[j]));
    const e2 = eig(D);
    const trace = C[0][0] + C[1][1] + C[2][2];
    const lam3 = Math.max(0, trace - e1.lam - e2.lam);
    const mad = Math.atan(Math.sqrt((e2.lam + lam3) / Math.max(e1.lam, 1e-30))) * 180 / Math.PI;
    // orient the eigenvector along the demag path (early -> late decays
    // toward the origin, so the component points from late to early)
    const seg = [pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1], pts[0][2] - pts[n - 1][2]];
    let v = e1.v;
    if (v[0] * seg[0] + v[1] * seg[1] + v[2] * seg[2] < 0) v = [-v[0], -v[1], -v[2]];
    return { v, mad, mean };
  }

  redraw() {
    const dark = isDark();
    const { pts, Ac, Bc } = this.demagData();
    const rotDeg = cart2dir(pts[0][0], pts[0][1], pts[0][2])[0];  // NRM dec
    const rot = rotDeg * Math.PI / 180;
    const rp = pts.map(p => [p[0] * Math.cos(rot) + p[1] * Math.sin(rot),
                             -p[0] * Math.sin(rot) + p[1] * Math.cos(rot),
                             p[2]]);

    // PCA on steps >= fitFrom
    const sel = rp.slice(this.fitFrom);
    const fit = this.pca(sel);

    this.ro.am.textContent = `${this.A.median.toFixed(0)} mT`;
    this.ro.ad.textContent = this.A.dp.toFixed(2);
    this.ro.bm.textContent = `${this.B.median.toFixed(0)} mT`;
    this.ro.bd.textContent = this.B.dp.toFixed(2);
    this.ro.fit.textContent = `${ZIJ_STEPS[this.fitFrom]} mT`;

    if (fit) {
      // rotate fitted vector back to geographic for the readout
      const gx = fit.v[0] * Math.cos(rot) - fit.v[1] * Math.sin(rot);
      const gy = fit.v[0] * Math.sin(rot) + fit.v[1] * Math.cos(rot);
      const [fdec, finc] = cart2dir(gx, gy, fit.v[2]);
      const bU = dir2cart(this.B.dec, this.B.inc, 1);
      const dot = Math.max(-1, Math.min(1, gx * bU[0] + gy * bU[1] + fit.v[2] * bU[2]));
      const dang = Math.acos(dot) * 180 / Math.PI;
      this.ro.fitdir.textContent = `${fdec.toFixed(0)}° / ${finc.toFixed(0)}°`;
      this.ro.mad.textContent = `${fit.mad.toFixed(1)}°`;
      this.ro.dang.textContent = `${dang.toFixed(1)}°`;
      this.ro.dang.style.color = dang > 10 ? '#c22b2b' : (dang > 5 ? '#c25400' : '#0a7d44');
    }

    this.drawSpectra(dark);
    this.drawZij(dark, rp, fit);
    this.drawEq(dark, pts);
    this.drawDecay(dark, pts);
  }

  drawSpectra(dark) {
    const { ctx, w, h } = setupCanvas(this.root.querySelector('.c-spec'));
    ctx.clearRect(0, 0, w, h);
    const xs = [];
    for (let b = 0.5; b <= 200; b += 1) xs.push(b);
    const pa = xs.map(b => lognormPdf(b, this.A.median, this.A.dp) * this.A.m);
    const pb = xs.map(b => lognormPdf(b, this.B.median, this.B.dp) * this.B.m);
    const ymax = Math.max(...pa, ...pb) * 1.15;
    const plot = new Plot2D(ctx, w, h, [0, 200], [0, ymax],
      { xlabel: 'coercivity (mT)', ylabel: 'dM/dB', margin: { l: 34, r: 8, t: 8, b: 40 } });
    plot.frame(dark, { zeroLines: false });
    plot.xticks([0, 50, 100, 150, 200]);
    const ca = dark ? this.A.colorDark : this.A.color;
    const cb = dark ? this.B.colorDark : this.B.color;
    plot.fillCurve(xs, pa, 0, dark ? 'rgba(255,178,107,0.25)' : 'rgba(213,94,0,0.18)');
    plot.fillCurve(xs, pb, 0, dark ? 'rgba(143,183,255,0.25)' : 'rgba(0,114,178,0.16)');
    plot.line(xs, pa, ca, 2.5);
    plot.line(xs, pb, cb, 2.5);
    plot.label('A', this.A.median, ymax * 0.94, ca, 'center');
    plot.label('B', this.B.median, ymax * 0.94, cb, 'center');
  }

  drawZij(dark, rp, fit) {
    const { ctx, w, h } = setupCanvas(this.root.querySelector('.c-zij'));
    ctx.clearRect(0, 0, w, h);
    // symmetric limits over both projections; Zijderveld convention:
    // positive E'/Down plotted downward (inverted y)
    let amax = 0;
    for (const p of rp) amax = Math.max(amax, Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
    amax *= 1.15;
    const plot = new Plot2D(ctx, w, h, [-amax, amax], [amax, -amax],
      { xlabel: 'N′ (rotated to NRM dec)', ylabel: '', margin: { l: 14, r: 10, t: 10, b: 40 } });
    plot.frame(dark);

    const ch = dark ? '#ff8f8f' : '#c22b2b';
    const cv = dark ? '#8fb7ff' : '#2b52c2';
    plot.line(rp.map(p => p[0]), rp.map(p => p[1]), ch, 1.6);
    plot.line(rp.map(p => p[0]), rp.map(p => p[2]), cv, 1.6);

    // PCA fit line drawn over the fitted steps on both projections
    if (fit) {
      const sel = rp.slice(this.fitFrom);
      const ts = sel.map(p => (p[0] - fit.mean[0]) * fit.v[0]
                            + (p[1] - fit.mean[1]) * fit.v[1]
                            + (p[2] - fit.mean[2]) * fit.v[2]);
      const tmin = Math.min(...ts) - 0.08 * (Math.max(...ts) - Math.min(...ts));
      const tmax = Math.max(...ts) + 0.08 * (Math.max(...ts) - Math.min(...ts));
      const gcol = dark ? '#7fd4a8' : '#0a7d44';
      for (const idx of [1, 2]) {          // horizontal (y=E'), vertical (y=Down)
        plot.line([fit.mean[0] + tmin * fit.v[0], fit.mean[0] + tmax * fit.v[0]],
                  [fit.mean[idx] + tmin * fit.v[idx], fit.mean[idx] + tmax * fit.v[idx]],
                  gcol, 2.5, [7, 5]);
      }
    }

    rp.forEach((p, i) => {
      const fitted = i >= this.fitFrom;
      plot.dot(p[0], p[1], ch, fitted ? 5.5 : 4, false);
      plot.square(p[0], p[2], cv, fitted ? 5 : 3.5, true);
    });
    // mark NRM
    plot.label('NRM', rp[0][0], rp[0][1] - amax * 0.06, dark ? '#ddd' : '#333', 'center', '12px sans-serif');
  }

  drawEq(dark, pts) {
    const { ctx, w, h } = setupCanvas(this.root.querySelector('.c-eq'));
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) / 2 - 16;
    const cx = w / 2, cy = h / 2;
    const axis = dark ? '#bbb' : '#666';
    ctx.strokeStyle = axis; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
    ctx.strokeStyle = dark ? '#555' : '#ddd'; ctx.lineWidth = 1;
    for (const inc of [30, 60]) {
      const r = R * Math.sqrt(1 - Math.sin(inc * Math.PI / 180));
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.fillStyle = axis; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - R - 5);

    const toXY = (dec, inc) => {
      const r = R * Math.sqrt(1 - Math.abs(Math.sin(inc * Math.PI / 180)));
      const d = dec * Math.PI / 180;
      return [cx + r * Math.sin(d), cy - r * Math.cos(d)];
    };

    // demag path
    ctx.strokeStyle = dark ? '#888' : '#999'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [dec, inc] = cart2dir(p[0], p[1], p[2]);
      const [x, y] = toXY(dec, inc);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    pts.forEach(p => {
      const [dec, inc] = cart2dir(p[0], p[1], p[2]);
      const [x, y] = toXY(dec, inc);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI);
      if (inc >= 0) { ctx.fillStyle = dark ? '#ddd' : '#222'; ctx.fill(); }
      else {
        ctx.fillStyle = dark ? '#222' : '#fff'; ctx.fill();
        ctx.strokeStyle = dark ? '#ddd' : '#222'; ctx.lineWidth = 1.6; ctx.stroke();
      }
    });

    // true component directions as stars
    const star = (x, y, col) => {
      ctx.save();
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const rr = k % 2 === 0 ? 9 : 4;
        const a = -Math.PI / 2 + k * Math.PI / 5;
        const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    const [ax, ay] = toXY(this.A.dec, this.A.inc);
    const [bx, by] = toXY(this.B.dec, this.B.inc);
    star(ax, ay, dark ? this.A.colorDark : this.A.color);
    star(bx, by, dark ? this.B.colorDark : this.B.color);
  }

  drawDecay(dark, pts) {
    const { ctx, w, h } = setupCanvas(this.root.querySelector('.c-dec'));
    ctx.clearRect(0, 0, w, h);
    const mags = pts.map(p => Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]));
    const plot = new Plot2D(ctx, w, h, [0, 200], [0, 1.08],
      { xlabel: 'peak AF (mT)', ylabel: 'M/M₀', margin: { l: 36, r: 8, t: 8, b: 40 } });
    plot.frame(dark, { zeroLines: false });
    plot.xticks([0, 100, 200]);
    plot.yticks([0, 0.5, 1]);
    const col = dark ? '#eee' : '#222';
    plot.line(ZIJ_STEPS, mags.map(m => m / mags[0]), col, 2.2);
    ZIJ_STEPS.forEach((b, i) => plot.dot(b, mags[i] / mags[0], col, 3.5));
  }
}

/* ------------------------------------------------------------------ */
/* bootstrapping                                                       */
/* ------------------------------------------------------------------ */

window.addEventListener('load', () => {
  document.querySelectorAll('[data-widget="neel"]').forEach(el => { el._widget = new NeelWidget(el); });
  document.querySelectorAll('[data-widget="afdemag"]').forEach(el => { el._widget = new AFDemagWidget(el); });
  document.querySelectorAll('[data-widget="zij"]').forEach(el => { el._widget = new ZijWidget(el); });
});
