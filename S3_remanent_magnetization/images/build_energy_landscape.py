"""Build the uniaxial anisotropy energy landscape figure for the S3 deck.

Adapted from Essentials-JupyterBook/scripts/chapter5_figure1.py (panel b),
with no applied field: the shape-anisotropy energy density
    epsilon_a = K_u sin^2(theta),   K_u = 1/2 mu0 (N_b - N_a) M_s^2
for a 2:1 prolate magnetite spheroid, annotated with cartoons of the
elongate grain showing the moment at theta = 0, 90, and 180 degrees.

Run in the ess-jbook environment from this directory:
    mamba activate ess-jbook
    python build_energy_landscape.py
Writes uniaxial_energy.png alongside the script.
"""

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Ellipse

MU0 = 4 * np.pi * 1e-7
M_S = 480e3        # A/m, magnetite
Q = 2.0            # prolate elongation a/b


def demag_factors_prolate(q):
    """Demagnetizing factors (N_a along the long axis, N_b across) of a
    prolate spheroid with elongation q = a/b."""
    e = np.sqrt(1.0 - 1.0 / q**2)
    N_a = (1.0 - e**2) / (2.0 * e**3) * (np.log((1.0 + e) / (1.0 - e)) - 2.0 * e)
    N_b = (1.0 - N_a) / 2.0
    return N_a, N_b


def draw_grain(ax, fx, fy, theta_deg):
    """Cartoon of the elongate grain (long axis horizontal) with its moment
    arrow at angle theta from the long axis, drawn in an equal-aspect inset
    axes centered at axes-fraction position (fx, fy)."""
    ia = ax.inset_axes([fx - 0.085, fy - 0.11, 0.17, 0.22])
    ia.set_xlim(-1.15, 1.15)
    ia.set_ylim(-1.15, 1.15)
    ia.set_aspect("equal")
    ia.axis("off")
    ia.add_patch(Ellipse((0, 0), 2.0, 2.0 / Q, facecolor="#ffe94d",
                         edgecolor="#8a7300", linewidth=1.2))
    th = np.deg2rad(theta_deg)
    dx, dy = 0.85 * np.cos(th), 0.85 * np.sin(th)
    ia.annotate("", xy=(dx, dy), xytext=(-dx, -dy),
                arrowprops=dict(arrowstyle="-|>", lw=2.4, color="#222",
                                mutation_scale=16))


def main():
    N_a, N_b = demag_factors_prolate(Q)
    K_u = 0.5 * MU0 * (N_b - N_a) * M_S**2          # ~3.5e4 J/m^3

    theta_deg = np.linspace(0.0, 180.0, 1801)
    eps = K_u * np.sin(np.deg2rad(theta_deg)) ** 2

    fig, ax = plt.subplots(figsize=(7.6, 4.4))
    ax.plot(theta_deg, eps, linewidth=3, color="#0072B2", zorder=3)

    ax.set_xlim(0, 180)
    ax.set_ylim(-2500, 50000)
    ax.set_xticks(np.arange(0, 181, 20))
    ax.set_yticks(np.arange(0, 40001, 10000))
    ax.tick_params(direction="in", length=6, width=1)
    for spine in ax.spines.values():
        spine.set_linewidth(1.8)
    ax.grid(True, alpha=0.5)

    ax.set_xlabel(r"$\theta$, angle of moment from the long axis (degrees)", fontsize=12)
    ax.set_ylabel(r"Energy density $\epsilon_a$ (J m$^{-3}$)", fontsize=12)

    # minima and barrier annotations
    label_bbox = dict(boxstyle="round,pad=0.25", facecolor="white",
                      alpha=0.85, edgecolor="none")
    for x in (0, 180):
        ax.scatter(x, 0, s=70, facecolors="none", edgecolors="k",
                   zorder=6, clip_on=False)
    ax.annotate("easy", (4, 1500), fontsize=12, color="#0a7d44",
                fontweight="bold", bbox=label_bbox)
    ax.annotate("easy", (176, 1500), fontsize=12, color="#0a7d44",
                fontweight="bold", ha="right", bbox=label_bbox)
    ax.annotate("hard", (90, 36200), fontsize=12, color="#c22b2b",
                fontweight="bold", ha="center", bbox=label_bbox)

    ax.annotate("", xy=(90, K_u), xytext=(90, 0),
                arrowprops=dict(arrowstyle="<->", color="#555", lw=1.5))
    ax.annotate(r"barrier $\epsilon = K_u$" + "\n" + r"($E = K_u v$ per grain)",
                (90, 0.45 * K_u), fontsize=11, color="#333",
                ha="center", va="center", bbox=label_bbox, zorder=6)

    # grain cartoons: the same elongate grain with its moment rotated
    for fx, th in ((0.122, 0), (0.5, 90), (0.878, 180)):
        draw_grain(ax, fx, 0.90, th)

    out = Path(__file__).resolve().parent / "uniaxial_energy.png"
    fig.savefig(out, dpi=200, bbox_inches="tight", facecolor="white")
    print(f"wrote {out}  (K_u = {K_u:.3g} J/m^3)")


if __name__ == "__main__":
    main()
