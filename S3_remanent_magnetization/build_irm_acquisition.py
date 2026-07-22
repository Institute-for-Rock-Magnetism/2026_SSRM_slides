"""Build a simple IRM acquisition figure for the S3 deck.

Two panels that say exactly what an IRM experiment is:
  (a) what you do  - pulse the specimen in a field at constant temperature,
      remove the field, measure the remanence; repeat with a bigger pulse.
  (b) what you plot - the IRM acquisition curve, which flattens at the
      saturation IRM (sIRM, Mr) once every grain that can flip has flipped.

The curve is a log-normal cumulative coercivity distribution, the standard
idealization for a single magnetite-like population.

Run in the ess-jbook environment:
    mamba activate ess-jbook
    python build_irm_acquisition.py
"""

from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from scipy.stats import norm

OUT = Path(__file__).resolve().parent / "images" / "irm_acquisition.png"

MEDIAN, DP = 45.0, 0.32        # median coercivity (mT) and log10 dispersion
# pulse fields in mT, run out to 2 T as a pulse magnetizer would
STEPS = [5, 10, 20, 30, 50, 80, 120, 200, 300, 500, 800, 1200, 2000]

C_FIELD = "#D55E00"            # applied field
C_REM = "#0072B2"              # remanence
C_SAT = "#7a0019"              # saturation annotation


def irm(field):
    """Fraction of sIRM acquired after a pulse in `field` (mT)."""
    field = np.asarray(field, dtype=float)
    out = np.zeros_like(field)
    ok = field > 0
    out[ok] = norm.cdf(np.log10(field[ok] / MEDIAN) / DP)
    return out


def main():
    plt.rcParams.update({"font.size": 11,
                         "font.family": ["Source Sans Pro", "Helvetica Neue",
                                         "DejaVu Sans"]})
    fig = plt.figure(figsize=(12.4, 4.9))
    gs = GridSpec(2, 2, figure=fig, width_ratios=[1, 1.15],
                  height_ratios=[1, 1], hspace=0.12, wspace=0.24)

    steps = np.array(STEPS, dtype=float)
    acquired = irm(steps)
    n = len(steps)
    x = np.arange(1, n + 1)

    # ---- (a) top: the applied field pulses -------------------------------
    ax_f = fig.add_subplot(gs[0, 0])
    # log scale: the pulses span 5 mT to 2 T, which linear bars cannot show
    ax_f.set_yscale("log")
    ax_f.set_ylim(3, 6000)
    ax_f.vlines(x, 3, steps, color=C_FIELD, lw=3)
    ax_f.plot(x, steps, "o", color=C_FIELD, ms=5)
    ax_f.set_ylabel("pulse field\n$B$ (mT)", fontsize=10)
    ax_f.set_xlim(0.3, n + 0.7)
    ax_f.set_xticks([])
    ax_f.set_yticks([10, 100, 1000])
    ax_f.set_yticklabels(["10", "100", "1000"])
    ax_f.set_title("(a) what you do: pulse, remove field, measure",
                   fontsize=12, loc="left")
    for s in ("top", "right"):
        ax_f.spines[s].set_visible(False)
    ax_f.text(0.02, 0.96, "each field applied only for an instant,\nat constant temperature",
              transform=ax_f.transAxes, ha="left", va="top",
              fontsize=9, color="#555")
    ax_f.text(n + 0.55, 2000, " 2 T", ha="left", va="center",
              fontsize=9, color=C_FIELD, clip_on=False)

    # ---- (a) bottom: the remanence staircase -----------------------------
    ax_m = fig.add_subplot(gs[1, 0])
    # remanence is measured in zero field and holds until the next pulse
    stair_x, stair_y = [0.5], [0.0]
    for xi, yi in zip(x, acquired):
        stair_x += [xi - 0.5, xi + 0.5]
        stair_y += [yi, yi]
    ax_m.plot(stair_x, stair_y[:len(stair_x)], color=C_REM, lw=2)
    ax_m.plot(x, acquired, "o", color=C_REM, ms=5)
    ax_m.axhline(1.0, color=C_SAT, ls="--", lw=1.4)
    ax_m.set_ylabel("remanence\n$M_r$ / sIRM", fontsize=10)
    ax_m.set_xlabel("successive pulses →", fontsize=10)
    ax_m.set_xlim(0.3, n + 0.7)
    ax_m.set_ylim(-0.04, 1.16)
    ax_m.set_xticks([])
    for s in ("top", "right"):
        ax_m.spines[s].set_visible(False)
    ax_m.text(n * 0.62, 1.04, "saturation", color=C_SAT, fontsize=9.5)

    # ---- (b) the acquisition curve ---------------------------------------
    ax = fig.add_subplot(gs[:, 1])
    smooth = np.logspace(np.log10(1.5), np.log10(2600), 500)
    ax.plot(smooth, irm(smooth), color=C_REM, lw=2.4)
    ax.plot(steps, acquired, "o", color=C_REM, ms=7,
            mec="white", mew=1.4, zorder=3)
    ax.axhline(1.0, color=C_SAT, ls="--", lw=1.6)
    ax.text(2500, 1.02, "sIRM", color=C_SAT, fontsize=13, fontweight="bold",
            ha="right", va="bottom")
    ax.text(2500, 0.955, "saturation IRM ($M_r$)", color=C_SAT, fontsize=9.5,
            ha="right", va="top")

    ax.annotate("grains flip in order of coercivity",
                xy=(42, 0.48), xytext=(105, 0.24),
                fontsize=9.5, color="#555",
                arrowprops=dict(arrowstyle="->", color="#888", lw=1.2))

    ax.set_xscale("log")
    ax.set_xlim(1.5, 2600)
    ax.set_ylim(-0.04, 1.16)
    ax.set_xlabel("pulse field $B$ (mT)", fontsize=11)
    ax.set_ylabel("IRM / sIRM", fontsize=11)
    ax.set_title("(b) what you plot: the IRM acquisition curve",
                 fontsize=12, loc="left")
    ax.set_xticks([2, 10, 50, 100, 300, 1000, 2000])
    ax.set_xticklabels(["2", "10", "50", "100", "300", "1000", "2000"])
    ax.grid(alpha=0.25, which="major")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)

    fig.savefig(OUT, dpi=200, bbox_inches="tight", facecolor="white")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
