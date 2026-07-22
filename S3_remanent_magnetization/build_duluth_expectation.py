"""Build the Duluth Complex expected-direction figure for the S3 deck.

Reproduces the analysis of
    2026_SSRM_Duluth_Complex/Duluth_Complex_background/duluth_complex_paleomagnetism.ipynb
and writes images/duluth_complex_expectation.png: a three-panel equal-area
figure that (a) compiles published Duluth Complex site directions in
geographic coordinates, (b) restores each dataset to paleohorizontal with
its own local structural tilt to recover the primary Keweenawan direction,
and (c) applies the South Kawishiwi (D-6A) tilt and collapses the result to
a constant-inclination small circle — the expectation for an azimuthally
unoriented drill core.

Data sources (read-only, from the sibling 2026_SSRM_Duluth_Complex repo):
  * Beck (1970) compiled site directions for the anorthositic and layered
    series, as compiled by Swanson-Hysell et al. (2021).
  * New Duluth Complex sites (FC1, FC4, HCT1) from MagIC contribution 17073
    (Swanson-Hysell et al., 2021), already cached locally.
  * Published igneous-layering orientations used for the tilt corrections.

Run in the ess-jbook environment:
    mamba activate ess-jbook
    python build_duluth_expectation.py
"""

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

import pmagpy.ipmag as ipmag
import pmagpy.pmag as pmag
import pmagpy.contribution_builder as cb

DATA = (Path(__file__).resolve().parents[2] / "2026_SSRM_Duluth_Complex"
        / "Duluth_Complex_background" / "pmag_data")
OUT = Path(__file__).resolve().parent / "images" / "duluth_complex_expectation.png"

# Structural tilt of the D-6A (South Kawishiwi intrusion) part of the complex
D6A_DIP_DIRECTION, D6A_DIP = 135.0, 15.0

# deck palette
C_ANOR = "#8fb7ff"     # anorthositic series (Beck)
C_LAYER = "#0072B2"    # layered series (Beck)
C_NEW = "#c22b2b"      # new FC/HCT sites
C_INSITU = "#b0b0b0"   # in-situ directions in panel (b)
C_PRIMARY = "#0a7d44"  # tilt-corrected / primary
C_D6A = "#b8860b"      # expected D-6A inclination


def load_directions():
    """Compiled Beck (1970) directions and new MagIC characteristic directions."""
    beck = pd.read_csv(DATA / "pmag_compiled" / "Beck1969a_sites.txt",
                       sep="\t", header=1)
    anorthositic = beck[beck["location"] == "Anorthositic series"]
    layered = beck[beck["location"] == "Layered series"]

    contribution = cb.Contribution(str(DATA / "pmag_new_MagIC"))
    sites = contribution.tables["sites"].df.reset_index()
    # medium-stability components (mc from AF, mt from thermal) are the
    # characteristic Keweenawan remanence; lc/lt are viscous overprints
    characteristic = sites[sites["dir_comp_name"].isin(["mc", "mt"])].copy()
    for col in ("dir_dec", "dir_inc"):
        characteristic[col] = characteristic[col].astype(float)
    return anorthositic, layered, characteristic


def mean_bedding_tilt(planes):
    """Mean bedding (dip_direction, dip) from the Fisher mean of the plane poles."""
    pole = ipmag.fisher_mean((planes["DIPD_TREND"] - 180).tolist(),
                             (90 - planes["DIP_PLUNGE"]).tolist())
    return (pole["dec"] + 180) % 360, 90 - pole["inc"]


def local_tilts():
    """Structural tilt for the Beck Duluth-area sites and for the FC/HCT sites."""
    d = DATA / "intrusive_orientations"

    def layering(filename, structures=("IL", "IM", "IU", "IT")):
        df = pd.read_csv(d / filename)
        return df[df["STRUCTURE"].isin(structures)]

    west = layering("West_Duluth_orientations.csv")
    heights = layering("Duluth_Heights_orientations.csv")
    duluth_area = pd.concat([west, heights[heights["Y"] < 5183000]])
    beck_tilt = mean_bedding_tilt(duluth_area[duluth_area["DIP_PLUNGE"] < 35])

    hct = layering("HCT_WLFG_geochron_orientations.csv",
                   structures=("IL", "IM", "IU"))
    hct = hct[(hct["DIP_PLUNGE"] < 25) & (hct["DIPD_TREND"] < 220)]
    fc_tilt = mean_bedding_tilt(hct)
    return beck_tilt, fc_tilt


def tilt_correct(df, dip_direction, dip):
    """Tilt-correct a site table to paleohorizontal; returns (decs, incs)."""
    corrected = [pmag.dotilt(dec, inc, dip_direction, dip)
                 for dec, inc in zip(df["dir_dec"], df["dir_inc"])]
    return [c[0] for c in corrected], [c[1] for c in corrected]


def inclination_small_circle(inc, n=361):
    """Equal-area (x, y) of a constant-inclination small circle (all declinations)."""
    xy = np.array([pmag.dimap(dec, inc) for dec in np.linspace(0.0, 360.0, n)])
    return xy[:, 0], xy[:, 1]


def main():
    anorthositic, layered, characteristic = load_directions()
    (beck_dipdir, beck_dip), (fc_dipdir, fc_dip) = local_tilts()
    print(f"Beck Duluth-area tilt:   {beck_dipdir:.0f}°/{beck_dip:.0f}°")
    print(f"new sites (FC/HCT) tilt: {fc_dipdir:.0f}°/{fc_dip:.0f}°")

    anor_tc = tilt_correct(anorthositic, beck_dipdir, beck_dip)
    layer_tc = tilt_correct(layered, beck_dipdir, beck_dip)
    char_tc = tilt_correct(characteristic, fc_dipdir, fc_dip)

    primary_dec = anor_tc[0] + layer_tc[0] + char_tc[0]
    primary_inc = anor_tc[1] + layer_tc[1] + char_tc[1]
    primary = ipmag.fisher_mean(dec=primary_dec, inc=primary_inc)

    insitu_dec = (anorthositic["dir_dec"].tolist() + layered["dir_dec"].tolist()
                  + characteristic["dir_dec"].tolist())
    insitu_inc = (anorthositic["dir_inc"].tolist() + layered["dir_inc"].tolist()
                  + characteristic["dir_inc"].tolist())
    insitu = ipmag.fisher_mean(dec=insitu_dec, inc=insitu_inc)

    # apply the D-6A tilt to the primary direction (negative dip adds tilt)
    d6a_dec, d6a_inc = pmag.dotilt(primary["dec"], primary["inc"],
                                   D6A_DIP_DIRECTION, -D6A_DIP)
    print(f"in situ mean:  D = {insitu['dec']:.1f}, I = {insitu['inc']:.1f}, "
          f"a95 = {insitu['alpha95']:.1f}, n = {insitu['n']}")
    print(f"primary mean:  D = {primary['dec']:.1f}, I = {primary['inc']:.1f}, "
          f"a95 = {primary['alpha95']:.1f}, n = {primary['n']}")
    print(f"expected D-6A: D = {d6a_dec:.1f}, I = {d6a_inc:.1f}")

    plt.rcParams.update({"font.size": 11,
                         "font.family": ["Source Sans Pro", "Helvetica Neue",
                                         "DejaVu Sans"]})
    fig, axes = plt.subplots(1, 3, figsize=(15.6, 5.9))

    # (a) the compilation, in geographic coordinates
    plt.sca(axes[0])
    ipmag.plot_net()
    ipmag.plot_di(layered["dir_dec"].tolist(), layered["dir_inc"].tolist(),
                  color=C_LAYER, label="layered series (Beck, 1970)", markersize=28)
    ipmag.plot_di(anorthositic["dir_dec"].tolist(), anorthositic["dir_inc"].tolist(),
                  color=C_ANOR, label="anorthositic series (Beck, 1970)", markersize=28)
    ipmag.plot_di(characteristic["dir_dec"].tolist(), characteristic["dir_inc"].tolist(),
                  color=C_NEW, label="new FC/HCT sites (MagIC 17073)",
                  markersize=45, marker="s")
    axes[0].set_title("(a) compiled directions, in situ\n"
                      f"$I$ = {insitu['inc']:.0f}° — but each area has its own tilt",
                      fontsize=12)
    axes[0].legend(loc=3, fontsize=8.5, framealpha=0.9)

    # (b) each dataset restored with its own local tilt
    plt.sca(axes[1])
    ipmag.plot_net()
    ipmag.plot_di(insitu_dec, insitu_inc, color=C_INSITU, markersize=20,
                  label="in situ (geographic)")
    ipmag.plot_di(primary_dec, primary_inc, color=C_PRIMARY, markersize=28,
                  label="tilt-corrected (primary)")
    ipmag.plot_di([primary["dec"]], [primary["inc"]], color=C_PRIMARY,
                  markersize=260, marker="*")
    axes[1].set_title("(b) restored to paleohorizontal\n"
                      f"primary $D$ = {primary['dec']:.0f}°, "
                      f"$I$ = {primary['inc']:.0f}°, "
                      f"$\\alpha_{{95}}$ = {primary['alpha95']:.1f}°",
                      fontsize=12)
    axes[1].legend(loc=3, fontsize=8.5, framealpha=0.9)

    # (c) expectation for the azimuthally unoriented D-6A core
    plt.sca(axes[2])
    ipmag.plot_net()
    xp, yp = inclination_small_circle(primary["inc"])
    axes[2].plot(xp, yp, color=C_PRIMARY, lw=2, ls="--",
                 label=f"primary $I$ = {primary['inc']:.0f}° (paleohorizontal)")
    ipmag.plot_di([primary["dec"]], [primary["inc"]], color=C_PRIMARY,
                  markersize=220, marker="*")
    xd, yd = inclination_small_circle(d6a_inc)
    axes[2].plot(xd, yd, color=C_D6A, lw=2.6,
                 label=f"expected D-6A $I$ = {d6a_inc:.0f}° (in situ)")
    ipmag.plot_di([d6a_dec], [d6a_inc], color=C_D6A, markersize=220, marker="*")
    axes[2].set_title("(c) expectation for the unoriented core\n"
                      f"D-6A tilt {D6A_DIP:.0f}°/{D6A_DIP_DIRECTION:.0f}° "
                      "shallows $I$; declination is arbitrary",
                      fontsize=12)
    axes[2].legend(loc=3, fontsize=8.5, framealpha=0.9)

    fig.tight_layout()
    fig.savefig(OUT, dpi=200, bbox_inches="tight", facecolor="white")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
