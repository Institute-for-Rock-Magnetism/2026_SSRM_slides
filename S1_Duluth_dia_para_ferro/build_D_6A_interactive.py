"""Build the interactive (zoom/pan) version of the D-6A drill-log figure.

Recreates D_6A_plot_primary.png (built by 2026_SSRM_Duluth_Complex/D-6A_log/
plot_D_6A.py with pystrat/matplotlib) as a self-contained Plotly HTML so the
susceptibility profile can be zoomed and panned live during the S1 lecture.

Panels share the depth axis: a y-zoom in any panel (e.g. box-zoom on the
susceptibility log) synchronizes the lithology column and all other panels.

Data inputs are read from the sibling repository (read-only):
    ../../2026_SSRM_Duluth_Complex/D-6A_log/        section, style, geochem
    ../../2026_SSRM_Duluth_Complex/D-6A_sampling/   magnetics sample footages
    ../../2026_SSRM_Duluth_Complex/D-6A_data/       KT-10 susceptibility profile

Outputs (at the deck root, referencing lib/plotly/plotly.min.js —
kept downward-relative because Safari silently drops ../ subresource
references on file:// pages; see README):
    D_6A_log_interactive.html        full log: lithology + samples + geochem + susc
    D_6A_lith_susc_interactive.html  lithology + wide susceptibility panel (SI),
                                     for the "puzzle to carry through the week" slide

Usage:
    python build_D_6A_interactive.py
"""

import textwrap
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

HERE = Path(__file__).resolve().parent
LOG_DIR = HERE.parent.parent / "2026_SSRM_Duluth_Complex" / "D-6A_log"
SAMPLES_CSV = HERE.parent.parent / "2026_SSRM_Duluth_Complex" / "D-6A_sampling" / "D-6A_samples.csv"
SUSC_CSV = (HERE.parent.parent / "2026_SSRM_Duluth_Complex" / "D-6A_data"
            / "susceptibility_KT10" / "D-6A_KT10_susceptibility.csv")
OUTPUT_LOG_HTML = HERE / "D_6A_log_interactive.html"
OUTPUT_SUSC_HTML = HERE / "D_6A_lith_susc_interactive.html"

EOH_FT = 2125.0  # end of hole; default depth-axis extent

# Marker colors match the matplotlib figure (samples #c0392b, geochem C0, susc C4).
SAMPLE_COLOR = "#c0392b"
GEOCHEM_COLOR = "#1f77b4"
SUSC_COLOR = "#9467bd"


def wrap_html(text, width=55):
    """Wrap a long description string with <br> breaks for a plotly hover box."""
    if not isinstance(text, str) or not text.strip():
        return ""
    return "<br>".join(textwrap.wrap(text, width=width))


def load_inputs():
    """Read all CSV inputs; returns (section, style, names, samples, exxon, susc)."""
    section = pd.read_csv(LOG_DIR / "D_6A_section_primary.csv")
    style = pd.read_csv(LOG_DIR / "D_6A_style.csv")
    names = pd.read_csv(LOG_DIR / "D_6A_facies_names.csv")

    samples = pd.read_csv(SAMPLES_CSV)
    samples.columns = [c.strip() for c in samples.columns]
    samples = samples.map(lambda v: v.strip() if isinstance(v, str) else v)
    samples["footage"] = pd.to_numeric(samples["footage"], errors="coerce")
    samples = samples.dropna(subset=["footage"]).reset_index(drop=True)

    exxon = pd.read_csv(LOG_DIR / "D_6A_geochem_exxon.csv")

    susc = pd.read_csv(SUSC_CSV)
    susc["Depth"] = pd.to_numeric(susc["Depth"], errors="coerce")
    susc["Susceptibility (10^-3 SI)"] = pd.to_numeric(
        susc["Susceptibility (10^-3 SI)"], errors="coerce")
    susc = susc.dropna(subset=["Depth", "Susceptibility (10^-3 SI)"])
    susc = susc[susc["Susceptibility (10^-3 SI)"] > 0].sort_values("Depth")

    return section, style, names, samples, exxon, susc


def lithology_traces(section, style, names):
    """One horizontal bar per bed, colored/width-scaled by facies.

    Bars are positioned at bed mid-depth with bar width = bed thickness, so the
    column reads exactly like the pystrat section while giving per-bed hover.
    """
    style = style.set_index("facies")
    name_of = dict(zip(names["facies"], names["name"]))

    mids = (section["DEPTH_FROM_FT"] + section["DEPTH_TO_FT"]) / 2
    thicknesses = section["THICKNESS"].astype(float)
    widths = [style.loc[f, "width"] for f in section["FACIES"]]
    colors = [
        f"rgb({style.loc[f, 'R']:.0f},{style.loc[f, 'G']:.0f},{style.loc[f, 'B']:.0f})"
        for f in section["FACIES"]
    ]
    hover = [
        (f"<b>{row.FACIES}</b> — {name_of.get(row.FACIES, '')}<br>"
         f"{row.DEPTH_FROM_FT:.0f}–{row.DEPTH_TO_FT:.0f} ft "
         f"({row.THICKNESS:.0f} ft) · {row.FORMATION}<br>"
         f"<span style='color:#555'>{wrap_html(row.DESCRIPTION)}</span>")
        for row in section.itertuples()
    ]
    bars = go.Bar(
        x=widths, y=mids, orientation="h", width=thicknesses,
        marker=dict(color=colors, line=dict(color="black", width=0.5)),
        hovertext=hover, hoverinfo="text", hoverlabel=dict(align="left"),
        showlegend=False,
    )

    # Legend proxies: one null scatter per facies present, in style-file order.
    used = set(section["FACIES"])
    legend_traces = []
    for facies in style.index:
        if facies not in used:
            continue
        full = name_of.get(facies)
        label = full if facies == "OVB" else (
            f"{facies} — {full}" if full else facies)
        color = f"rgb({style.loc[facies, 'R']:.0f},{style.loc[facies, 'G']:.0f},{style.loc[facies, 'B']:.0f})"
        legend_traces.append(go.Scatter(
            x=[None], y=[None], mode="markers",
            marker=dict(symbol="square", size=11, color=color,
                        line=dict(color="black", width=0.5)),
            name=label, showlegend=True, hoverinfo="skip",
        ))
    return bars, legend_traces


def formation_labels(section, fig):
    """Vertical SKTS-unit labels + boundary ticks in the gutter left of the column."""
    units = []
    for row in section.itertuples():
        if units and row.FORMATION == units[-1]["name"]:
            units[-1]["to"] = row.DEPTH_TO_FT
        else:
            units.append({"name": row.FORMATION,
                          "from": row.DEPTH_FROM_FT, "to": row.DEPTH_TO_FT})
    for i, u in enumerate(units):
        # Stagger labels between two gutter columns so thin adjacent units
        # (BH / BAN (u) / U3 / BAN (l) / GRAN) don't collide.
        fig.add_annotation(
            x=-0.14 if i % 2 == 0 else -0.36,
            y=(u["from"] + u["to"]) / 2, xref="x", yref="y",
            text=u["name"], textangle=-90, showarrow=False,
            font=dict(size=9, color="#222"),
        )
        fig.add_shape(  # boundary tick across the label gutter
            type="line", x0=-0.45, x1=0, y0=u["from"], y1=u["from"],
            xref="x", yref="y", line=dict(color="#888", width=0.6),
        )
    fig.add_shape(type="line", x0=-0.45, x1=0, y0=EOH_FT, y1=EOH_FT,
                  xref="x", yref="y", line=dict(color="#888", width=0.6))


def samples_trace(samples):
    """Horizontal tick per magnetics-sample footage; hover carries the metadata."""
    hover = [
        (f"<b>{row._asdict().get('sample name', '')}</b> · {row.footage:.0f} ft<br>"
         f"{row._asdict().get('rock type', '')}"
         + (f"<br><span style='color:#555'>{wrap_html(row._asdict().get('our description', ''))}</span>"
            if isinstance(row._asdict().get('our description'), str) else ""))
        for row in samples.rename(columns={
            "sample name": "sample name"}).itertuples()
    ]
    return go.Scatter(
        x=[0.5] * len(samples), y=samples["footage"], mode="markers",
        marker=dict(symbol="line-ew-open", size=9, color=SAMPLE_COLOR,
                    line=dict(color=SAMPLE_COLOR, width=1.2)),
        hovertext=hover, hoverinfo="text", hoverlabel=dict(align="left"),
        showlegend=False,
    )


def geochem_trace(exxon, col, unit_label, fmt=".3g"):
    """Point-per-assay trace for one Exxon geochem column (BDLs stored negative)."""
    values = pd.to_numeric(exxon[col], errors="coerce")
    mask = values.notna() & (values > 0)
    df = exxon[mask]
    return go.Scatter(
        x=values[mask], y=df["DEPTH_MID_FT"], mode="markers",
        marker=dict(size=5.5, color=GEOCHEM_COLOR),
        hovertemplate=(f"%{{x:{fmt}}} {unit_label}<br>"
                       "%{customdata[0]:.0f}–%{customdata[1]:.0f} ft"
                       "<extra></extra>"),
        customdata=df[["DEPTH_FROM_FT", "DEPTH_TO_FT"]].values,
        showlegend=False,
    )


def susc_trace(susc):
    """Dense KT-10 profile as unconnected dots (no implied continuity)."""
    notes = susc["Other notes"].fillna("") if "Other notes" in susc else ""
    hover = [
        f"{v:.3g} ×10<sup>-3</sup> SI · {d:.0f} ft" + (f"<br>{n}" if n else "")
        for d, v, n in zip(susc["Depth"], susc["Susceptibility (10^-3 SI)"], notes)
    ]
    return go.Scatter(
        x=susc["Susceptibility (10^-3 SI)"], y=susc["Depth"], mode="markers",
        marker=dict(size=3, color=SUSC_COLOR),
        hovertext=hover, hoverinfo="text",
        showlegend=False,
    )


def build_lith_susc_figure(section, style, names, susc):
    """Two panels: lithology column + a wide susceptibility profile in SI units.

    Built for the "puzzle to carry through the week" slide — the susceptibility
    axis gets most of the width and dense log ticks (decades plus 2x/5x labels)
    so the five-orders-of-magnitude variability is readable and zoomable.
    """
    fig = make_subplots(
        rows=1, cols=2, shared_yaxes=True,
        column_widths=[0.24, 0.76], horizontal_spacing=0.02,
        subplot_titles=("Lithology", "Magnetic susceptibility (SI, log axis)"),
    )

    bars, _ = lithology_traces(section, style, names)
    fig.add_trace(bars, row=1, col=1)
    formation_labels(section, fig)

    susc_si = susc.copy()
    susc_si["Susceptibility (10^-3 SI)"] *= 1e-3  # 10^-3 SI -> SI
    trace = susc_trace(susc_si)
    trace.hovertext = [
        f"{v:.3g} SI · {d:.0f} ft"
        for d, v in zip(susc_si["Depth"], susc_si["Susceptibility (10^-3 SI)"])
    ]
    trace.marker.size = 4.5
    fig.add_trace(trace, row=1, col=2)

    fig.update_yaxes(range=[EOH_FT, 0], row=1, col=1,
                     title_text="Depth from collar (ft)",
                     ticks="outside", showgrid=False, zeroline=False)
    fig.update_yaxes(showgrid=False, zeroline=False, row=1, col=2)
    fig.update_xaxes(range=[-0.5, 1.02], visible=False, row=1, col=1)
    # dtick="D2" labels each decade plus the 2x and 5x minor ticks;
    # exponentformat="power" renders decades as 10^n rather than SI prefixes.
    fig.update_xaxes(
        type="log", dtick="D2", exponentformat="power",
        showgrid=True, gridcolor="#e3e0da", griddash="dash",
        ticks="outside", tickfont=dict(size=11), row=1, col=2,
    )

    fig.update_annotations(font_size=12)
    for ann in fig.layout.annotations:
        if ann.textangle == -90:
            ann.font.size = 9

    fig.update_layout(
        template="plotly_white",
        bargap=0, barmode="overlay",
        margin=dict(l=70, r=15, t=52, b=30),
        hovermode="closest",
        plot_bgcolor="white", paper_bgcolor="white",
        showlegend=False,
        dragmode="zoom",
    )
    return fig


def build_log_figure(section, style, names, samples, exxon, susc):
    """Full six-panel log: lithology + samples + Cu/Ni/Co + susceptibility."""
    fig = make_subplots(
        rows=1, cols=6, shared_yaxes=True,
        column_widths=[0.21, 0.08, 0.14, 0.14, 0.14, 0.19],
        horizontal_spacing=0.015,
        subplot_titles=(
            "Lithology", f"Samples<br>n = {len(samples)}", "Cu (wt%)",
            "Ni (ppm)", "Co (ppm)", "Mag. susc.<br>(10<sup>-3</sup> SI)",
        ),
    )

    bars, legend_traces = lithology_traces(section, style, names)
    fig.add_trace(bars, row=1, col=1)
    for tr in legend_traces:
        fig.add_trace(tr, row=1, col=1)
    formation_labels(section, fig)

    fig.add_trace(samples_trace(samples), row=1, col=2)
    fig.add_trace(geochem_trace(exxon, "Cu_pct", "wt% Cu"), row=1, col=3)
    fig.add_trace(geochem_trace(exxon, "Ni_ppm", "ppm Ni", fmt=".0f"), row=1, col=4)
    fig.add_trace(geochem_trace(exxon, "Co_ppm", "ppm Co", fmt=".0f"), row=1, col=5)
    fig.add_trace(susc_trace(susc), row=1, col=6)

    # Depth axis: reversed (drill-core convention), shared across all panels.
    fig.update_yaxes(range=[EOH_FT, 0], row=1, col=1,
                     title_text="Depth from collar (ft)",
                     ticks="outside", showgrid=False, zeroline=False)
    for c in range(2, 7):
        fig.update_yaxes(showgrid=False, zeroline=False, row=1, col=c)

    fig.update_xaxes(range=[-0.5, 1.02], visible=False, row=1, col=1)
    fig.update_xaxes(range=[0, 1], visible=False, fixedrange=True, row=1, col=2)
    grid = dict(showgrid=True, gridcolor="#e3e0da", griddash="dash",
                ticks="outside", tickfont=dict(size=10))
    # dtick=1 keeps log axes to decade labels only (no 2/5 minor labels).
    fig.update_xaxes(type="log", dtick=1, **grid, row=1, col=3)
    fig.update_xaxes(type="log", dtick=1, **grid, row=1, col=4)
    fig.update_xaxes(**grid, row=1, col=5)
    fig.update_xaxes(type="log", **grid, row=1, col=6)

    fig.update_annotations(font_size=12)  # subplot titles (formation labels re-set below)
    for ann in fig.layout.annotations:
        if ann.textangle == -90:
            ann.font.size = 9

    fig.update_layout(
        template="plotly_white",
        bargap=0, barmode="overlay",
        margin=dict(l=70, r=10, t=52, b=30),
        hovermode="closest",
        plot_bgcolor="white", paper_bgcolor="white",
        legend=dict(
            title=dict(text="Facies", font=dict(size=11)),
            font=dict(size=9.5), itemsizing="constant",
            x=1.0, xanchor="left", y=1.0, yanchor="top",
            tracegroupgap=0,
        ),
        dragmode="zoom",
    )
    return fig


def write_deck_html(fig, output_html):
    """Write a figure as a full HTML page sized to fill its iframe."""
    fig.write_html(
        output_html,
        include_plotlyjs="lib/plotly/plotly.min.js",
        full_html=True,
        default_width="100%", default_height="100vh",
        config={
            "responsive": True,
            "scrollZoom": True,
            "displaylogo": False,
            "modeBarButtonsToRemove": ["select2d", "lasso2d", "autoScale2d"],
        },
    )
    # Zero out the default body margin so 100vh fills the iframe exactly.
    html = output_html.read_text()
    html = html.replace("<body>", '<body style="margin:0;overflow:hidden">', 1)
    output_html.write_text(html)
    print(f"wrote {output_html.relative_to(HERE)}")


def main():
    section, style, names, samples, exxon, susc = load_inputs()
    write_deck_html(
        build_log_figure(section, style, names, samples, exxon, susc),
        OUTPUT_LOG_HTML,
    )
    write_deck_html(
        build_lith_susc_figure(section, style, names, susc),
        OUTPUT_SUSC_HTML,
    )
    print("  zoom: drag a box (or scroll) · pan: pan tool or shift-drag · "
          "reset: double-click")


if __name__ == "__main__":
    main()
