"""Build the interactive Duluth Complex demagnetization figure for the S3 deck.

Reads MagIC-format measurement, sample, and specimen tables from the
sibling 2020_Duluth_Complex repository (Swanson-Hysell et al., 2021,
Geology, doi:10.1130/G47873.1; paleomagnetic measurements and
interpretations by Yiming Zhang) and writes FC_zijderveld.html: a
three-panel Plotly figure (Zijderveld diagram, equal-area projection,
intensity decay) with a specimen selector spanning AF and thermal
demagnetization of ~1096 Ma Duluth Complex / Beaver Bay area gabbros.

Measurement directions are stored in specimen coordinates; they are
rotated to geographic coordinates with pmagpy using the sample azimuth
and dip from samples.txt. The best-fit (PCA) components published in
specimens.txt (geographic coordinates, DE-BFL) are drawn on the
Zijderveld projections over their fitted step ranges.

Run in the ess-jbook environment:
    mamba activate ess-jbook
    python build_FC_zijderveld.py

The generated HTML references lib/plotly/plotly.min.js so the deck
remains fully offline.
"""

from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pmagpy.pmag as pmag

DATA_DIR = (Path(__file__).resolve().parents[2]
            / "2020_Duluth_Complex" / "data" / "pmag_new")
OUT_FILE = Path(__file__).resolve().parent / "FC_zijderveld.html"

# specimen, label — chosen to show: a clean two-component AF result, its
# thermal companion from the same sample, a three-component AF result,
# and a thermal result with a large low-T overprint
SPECIMENS = [
    ("FC1-3a", "AF demag"),
    ("FC1-3b", "thermal demag"),
    ("FC4-6a", "AF · 3 components"),
    ("HCT1-6b", "thermal · big overprint"),
]

# deck palette (matches css/slides.css and js/widgets.js)
C_HORIZ = "#c22b2b"    # horizontal projection: solid circles
C_VERT = "#2b52c2"     # vertical projection: open squares
C_DECAY = "#222222"
FIT_COLORS = ["#b8860b", "#0a7d44", "#7a0019"]  # in order of step_min


def load_tables():
    """Read the MagIC measurements, samples, and specimens tables."""
    meas = pd.read_csv(DATA_DIR / "measurements.txt", sep="\t", skiprows=1)
    samps = pd.read_csv(DATA_DIR / "samples.txt", sep="\t", skiprows=1)
    specs = pd.read_csv(DATA_DIR / "specimens.txt", sep="\t", skiprows=1)
    sites = pd.read_csv(DATA_DIR / "sites.txt", sep="\t", skiprows=1)
    return meas, samps, specs, sites


def specimen_data(meas, samps, name):
    """Assemble one specimen's demag sequence in geographic coordinates.

    Args:
        meas: measurements dataframe (specimen-coordinate directions).
        samps: samples dataframe (azimuth/dip of each sample's lab arrow).
        name: specimen name, e.g. "FC1-3a".

    Returns:
        dict with treatment labels, step values (mT or °C), geographic
        dec/inc (degrees), moment (Am²), and demag type ("AF"|"T").
    """
    rows = meas[meas.specimen == name].sort_values("sequence")
    sample = name[:-1]                       # FC1-3a -> FC1-3
    orient = samps[samps["sample"] == sample].iloc[0]
    az, pl = float(orient.azimuth), float(orient.dip)

    is_thermal = rows.method_codes.str.contains("LP-DIR-T").all()
    labels, steps, decs, incs, moments = [], [], [], [], []
    for r in rows.itertuples():
        gdec, ginc = pmag.dogeo(r.dir_dec, r.dir_inc, az, pl)
        if "LT-NO" in r.method_codes:
            step, label = 0.0, "NRM"
        elif is_thermal:
            step = r.treat_temp - 273.0      # K -> °C
            label = f"{step:g} °C"
        else:
            step = r.treat_ac_field * 1000.0  # T -> mT
            label = f"{step:g} mT"
        labels.append(label)
        steps.append(step)
        decs.append(gdec)
        incs.append(ginc)
        moments.append(r.magn_moment)
    return {
        "name": name,
        "type": "T" if is_thermal else "AF",
        "labels": labels,
        "step": np.array(steps),
        "dec": np.array(decs),
        "inc": np.array(incs),
        "moment": np.array(moments),
    }


def specimen_fits(specs, name):
    """Published PCA components for a specimen, geographic coordinates."""
    rows = specs[(specs.specimen == name)
                 & (specs.dir_tilt_correction == 0)
                 & specs.dir_comp.notna()].copy()
    rows = rows.sort_values("meas_step_min")
    fits = []
    for r in rows.itertuples():
        if r.meas_step_unit == "K":
            lo, hi = r.meas_step_min - 273.0, r.meas_step_max - 273.0
        else:                                  # T
            lo, hi = r.meas_step_min * 1000.0, r.meas_step_max * 1000.0
        fits.append({
            "comp": r.dir_comp, "dec": r.dir_dec, "inc": r.dir_inc,
            "mad": r.dir_mad_free, "lo": lo, "hi": hi,
        })
    return fits


def dir2cart(dec, inc, mag=1.0):
    """Direction (declination, inclination, magnitude) to x (N), y (E), z (down)."""
    dec, inc = np.radians(dec), np.radians(inc)
    return (mag * np.cos(inc) * np.cos(dec),
            mag * np.cos(inc) * np.sin(dec),
            mag * np.sin(inc))


def eqarea_xy(dec, inc):
    """Equal-area (Schmidt) projection coordinates, north up.

    R = sqrt(1 - |sin(inc)|): R = 1 on the horizontal, 0 at vertical.
    """
    dec, inc = np.radians(dec), np.radians(inc)
    r = np.sqrt(1.0 - np.abs(np.sin(inc)))
    return r * np.sin(dec), r * np.cos(dec)


def fit_segment(data, fit, rot):
    """PCA line segment through the fitted steps, in rotated cartesian coords.

    The best-fit line passes through the centroid of the steps inside the
    fitted range, along the fitted direction; its extent is set by
    projecting those steps onto the direction.
    """
    sel = (data["step"] >= fit["lo"] - 1e-9) & (data["step"] <= fit["hi"] + 1e-9)
    if sel.sum() < 2:
        return None
    x, y, z = dir2cart(data["dec"] - rot, data["inc"], data["moment"])
    pts = np.column_stack([x[sel], y[sel], z[sel]])
    centroid = pts.mean(axis=0)
    u = np.array(dir2cart(fit["dec"] - rot, fit["inc"]))
    t = (pts - centroid) @ u
    pad = 0.06 * (t.max() - t.min())
    ends = np.array([centroid + (t.min() - pad) * u,
                     centroid + (t.max() + pad) * u])
    return ends


def specimen_traces(data, fits, visible):
    """All traces for one specimen; returns the trace list and their panel columns."""
    rot = data["dec"][0]                     # project along the NRM declination
    x, y, z = dir2cart(data["dec"] - rot, data["inc"], data["moment"])
    unit = "mT" if data["type"] == "AF" else "°C"
    hover = [f"{lab}<br>Dec {d:.1f}° · Inc {i:.1f}° (geographic)<br>"
             f"moment = {m:.2e} Am²"
             for lab, d, i, m in zip(data["labels"], data["dec"],
                                     data["inc"], data["moment"])]

    traces, cols = [], []

    traces.append(go.Scatter(
        x=x, y=y, mode="lines+markers", name="horizontal (N′ vs E′)",
        marker=dict(symbol="circle", size=7, color=C_HORIZ),
        line=dict(color=C_HORIZ, width=1.5),
        text=hover, hoverinfo="text", visible=visible, showlegend=visible))
    cols.append(1)
    traces.append(go.Scatter(
        x=x, y=z, mode="lines+markers", name="vertical (N′ vs Down)",
        marker=dict(symbol="square-open", size=7,
                    color=C_VERT, line=dict(color=C_VERT, width=1.5)),
        line=dict(color=C_VERT, width=1.5),
        text=hover, hoverinfo="text", visible=visible, showlegend=visible))
    cols.append(1)

    # published PCA fits over their step ranges, on both projections
    for k, fit in enumerate(fits):
        seg = fit_segment(data, fit, rot)
        if seg is None:
            continue
        color = FIT_COLORS[k % len(FIT_COLORS)]
        label = (f"{fit['comp']}: {fit['dec']:.0f}°/{fit['inc']:.0f}° · "
                 f"MAD {fit['mad']:.1f}° · {fit['lo']:g}–{fit['hi']:g} {unit}")
        traces.append(go.Scatter(
            x=seg[:, 0], y=seg[:, 1], mode="lines", name=label,
            line=dict(color=color, width=3, dash="dash"),
            hoverinfo="name", visible=visible, showlegend=visible,
            legendgroup=f"fit{k}"))
        cols.append(1)
        traces.append(go.Scatter(
            x=seg[:, 0], y=seg[:, 2], mode="lines", name=label,
            line=dict(color=color, width=3, dash="dot"),
            hoverinfo="name", visible=visible, showlegend=False,
            legendgroup=f"fit{k}"))
        cols.append(1)

    # equal-area: demag path + points + fitted directions as stars
    ex, ey = eqarea_xy(data["dec"], data["inc"])
    down = data["inc"] >= 0
    traces.append(go.Scatter(
        x=ex, y=ey, mode="lines", line=dict(color="#999", width=1),
        hoverinfo="skip", visible=visible, showlegend=False))
    cols.append(2)
    traces.append(go.Scatter(
        x=ex, y=ey, mode="markers",
        marker=dict(symbol=np.where(down, "circle", "circle-open"), size=8,
                    color="#222", line=dict(color="#222", width=1.5)),
        text=hover, hoverinfo="text", visible=visible, showlegend=False))
    cols.append(2)
    for k, fit in enumerate(fits):
        fx, fy = eqarea_xy(np.array([fit["dec"]]), np.array([fit["inc"]]))
        traces.append(go.Scatter(
            x=fx, y=fy, mode="markers",
            marker=dict(symbol="star" if fit["inc"] >= 0 else "star-open",
                        size=15, color=FIT_COLORS[k % len(FIT_COLORS)],
                        line=dict(width=1.5)),
            name=f"{fit['comp']} fit", hoverinfo="name",
            visible=visible, showlegend=False, legendgroup=f"fit{k}"))
        cols.append(2)

    # intensity decay
    traces.append(go.Scatter(
        x=data["step"], y=data["moment"] / data["moment"][0],
        mode="lines+markers", marker=dict(size=6, color=C_DECAY),
        line=dict(color=C_DECAY, width=1.5),
        text=hover, hoverinfo="text", visible=visible, showlegend=False))
    cols.append(3)

    return traces, cols


def eqarea_net():
    """Static equal-area net: outer circle, inclination rings, cardinal ticks."""
    shapes = []
    for inc in (0, 30, 60):
        r = np.sqrt(1.0 - np.sin(np.radians(inc)))
        shapes.append(dict(
            type="circle", xref="x2", yref="y2",
            x0=-r, x1=r, y0=-r, y1=r,
            line=dict(color="#888" if inc == 0 else "#ddd", width=1.2 if inc == 0 else 1)))
    for ang in range(0, 360, 90):
        a = np.radians(ang)
        shapes.append(dict(
            type="line", xref="x2", yref="y2",
            x0=0.97 * np.sin(a), y0=0.97 * np.cos(a),
            x1=1.05 * np.sin(a), y1=1.05 * np.cos(a),
            line=dict(color="#888", width=1.5)))
    return shapes


def title_text(data, site_row):
    unit = "mT" if data["type"] == "AF" else "°C"
    kind = "AF" if data["type"] == "AF" else "thermal"
    return (f"<b>{data['name']}</b> — {site_row.lithologies.lower()}, "
            f"site {site_row.site} (~1096 Ma) · {kind} demag, "
            f"{len(data['step']) - 1} steps to {data['step'].max():g} {unit}")


def main():
    meas, samps, specs, sites = load_tables()

    # sanity check the specimen->geographic rotation against a value from
    # the original CIT file (FC1-1a NRM: geographic 323.7/47.4)
    chk = specimen_data(meas, samps, "FC1-1a")
    assert abs(chk["dec"][0] - 323.7) < 0.3 and abs(chk["inc"][0] - 47.4) < 0.3, \
        f"dogeo rotation check failed: got {chk['dec'][0]:.1f}/{chk['inc'][0]:.1f}"

    fig = make_subplots(
        rows=1, cols=3, column_widths=[0.40, 0.32, 0.28],
        horizontal_spacing=0.07,
        subplot_titles=("Zijderveld diagram", "Equal-area projection",
                        "Intensity decay"))

    all_data, trace_counts = [], []
    for k, (name, _) in enumerate(SPECIMENS):
        data = specimen_data(meas, samps, name)
        fits = specimen_fits(specs, name)
        all_data.append(data)
        traces, cols = specimen_traces(data, fits, visible=(k == 0))
        trace_counts.append(len(traces))
        for tr, col in zip(traces, cols):
            fig.add_trace(tr, row=1, col=col)

    site_of = {name: sites[sites.site == name.split("-")[0]].iloc[0]
               for name, _ in SPECIMENS}

    buttons, offset = [], 0
    offsets = []
    for n in trace_counts:
        offsets.append(offset)
        offset += n
    total = offset
    for k, (name, blabel) in enumerate(SPECIMENS):
        vis = [False] * total
        for j in range(trace_counts[k]):
            vis[offsets[k] + j] = True
        data = all_data[k]
        unit = "peak AF (mT)" if data["type"] == "AF" else "temperature (°C)"
        buttons.append(dict(
            label=f"{name} · {blabel}", method="update",
            args=[{"visible": vis},
                  {"title.text": title_text(data, site_of[name]),
                   "xaxis3.title.text": unit}]))

    fig.update_layout(
        title=dict(text=title_text(all_data[0], site_of[SPECIMENS[0][0]]),
                   x=0.01, font=dict(size=14)),
        updatemenus=[dict(
            type="buttons", direction="right", buttons=buttons,
            x=1.0, xanchor="right", y=1.22, yanchor="top",
            pad=dict(l=2, r=2, t=1, b=1), font=dict(size=11))],
        legend=dict(orientation="h", x=0.0, y=-0.14, font=dict(size=11)),
        margin=dict(l=55, r=15, t=95, b=60),
        height=520, plot_bgcolor="white", paper_bgcolor="white",
        shapes=eqarea_net(),
        font=dict(family="'Source Sans Pro', 'Helvetica Neue', sans-serif"))

    # Zijderveld panel: equal aspect; y reversed so that on the horizontal
    # projection W is up when x is the rotated N component (Zijderveld
    # convention as in pmagplotlib.plot_zij), and Down plots downward on
    # the vertical projection
    fig.update_xaxes(row=1, col=1, title_text="N′ (rotated to NRM dec) — Am²",
                     zeroline=True, zerolinecolor="#888", zerolinewidth=1.2,
                     showgrid=True, gridcolor="#eee")
    fig.update_yaxes(row=1, col=1, title_text="circles: E′ · squares: Down (Am²)",
                     zeroline=True, zerolinecolor="#888", zerolinewidth=1.2,
                     showgrid=True, gridcolor="#eee",
                     scaleanchor="x", scaleratio=1, autorange="reversed")
    fig.update_xaxes(row=1, col=2, visible=False, range=[-1.18, 1.18])
    fig.update_yaxes(row=1, col=2, visible=False, range=[-1.18, 1.18],
                     scaleanchor="x2", scaleratio=1)
    fig.update_xaxes(row=1, col=3, title_text="peak AF (mT)",
                     showgrid=True, gridcolor="#eee", zeroline=False)
    fig.update_yaxes(row=1, col=3, title_text="M / M(NRM)",
                     range=[0, 1.05], showgrid=True, gridcolor="#eee",
                     zeroline=False)

    for ann in fig.layout.annotations:       # subplot titles
        ann.font = dict(size=13, color="#555")
    fig.add_annotation(xref="x2", yref="y2", x=0, y=1.12, text="N",
                       showarrow=False, font=dict(size=12, color="#555"))

    fig.write_html(OUT_FILE, include_plotlyjs="lib/plotly/plotly.min.js",
                   full_html=True, config={"displaylogo": False})
    print(f"wrote {OUT_FILE}")


if __name__ == "__main__":
    main()
