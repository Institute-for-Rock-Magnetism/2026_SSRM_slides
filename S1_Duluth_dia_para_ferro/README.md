# S1 — Diamagnetism, paramagnetism, and ferromagnetism (+ Duluth Complex project introduction)

Session 1 slide deck for the 2026 IRM Summer School of Rock Magnetism. A reveal.js
deck that introduces the D-6A Duluth Complex group project, uses the KT-10
susceptibility core log as a data vignette, and builds from that puzzle through
magnetic fields and units, susceptibility, and the three classes of magnetic
response. Content is repurposed from `W2_dia_para_ferro/Week2_dia_para_ferro_intro.ipynb`
and `Week2_ferromagnetism.ipynb` in the
[2026_ESCI_pmag_course](https://github.com/Institute-for-Rock-Magnetism/2026_ESCI_pmag_course)
repository, where this deck was first developed.

## Presenting

Open [index.html](index.html) in a browser — double-clicking the file works in
Chrome, Safari, and Firefox — or serve it locally:

```
python -m http.server
# then http://localhost:8000/S1_Duluth_dia_para_ferro/
```

Everything (reveal.js, KaTeX, fonts, images, widgets) lives inside this folder,
so the deck is a portable standalone that works with no internet connection.
Keeping the runtime in `lib/` inside the deck folder matters for Safari: a
`file://` page in Safari can only load subresources from its own directory and
below, so assets referenced via `../` render fine in Chrome but silently fail
in Safari. Press `s` for speaker notes, `f` for fullscreen, `Esc` for the slide
overview.

## Structure

| Part | Content |
|---|---|
| 1 | The project: Duluth Complex, drill core D-6A, groups, research questions — and the KT-10 susceptibility log as the puzzle for the week |
| 2 | Fields and magnetization: H, M, B and their units |
| 3 | Magnetic susceptibility and the three classes of response |
| 4–5 | Diamagnetism, paramagnetism (+ interactive linear-response widget) |
| 6 | Ferromagnetism: exchange coupling, hysteresis (+ interactive loop widget), Curie temperature, mixtures (+ wasp-waisted widget) |
| 7 | Back to the core: reading the susceptibility log, the instrument week, the notebook exercise |

## Interactive widgets

[js/widgets.js](js/widgets.js) implements three canvas-based animations with no
external dependencies:

- **Linear responses** (`data-widget="dia"` and `data-widget="para"`): standalone
  diamagnetic (quartz, κ = −1.5×10⁻⁵) and paramagnetic (olivine, κ = 1.6×10⁻³ at
  300 K with Curie-law 1/T scaling) widgets — atomic-moment view beside a live
  M–B plot. Both start at B = 0, paused. Moment alignment is exaggerated for
  visibility and labeled as such.
- **Hysteresis** (`data-widget="ferro"`): major loops from the Takács (2001)
  tanh model — the same model as `Week2_ferromagnetism.ipynb` — with MD/SD
  magnetite and hematite presets, Bc and Mr/Ms sliders, and a moment-flipping
  panel. Scrubbing between branches is eased for visual continuity, so
  mid-cycle reversals are illustrative rather than true minor loops.
- **Mixtures** (`data-widget="mixture"`): magnetite + hematite composite loops
  (wasp-waisting), with a log-scaled magnetite mass-fraction slider.

## Interactive D-6A drill log

The "Midcontinent Rift, seen magnetically" slide embeds
[aeromagnetic_minnesota.html](aeromagnetic_minnesota.html), an interactive
viewer of the MGS 2007 statewide aeromagnetic compilation (total field,
tilt-enhanced, and first-vertical-derivative views, recolored with Crameri's
vik palette), copied from
`2026_SSRM_Duluth_Complex/Duluth_Complex_background/aeromagnetic/` — see the
`data/SOURCE.md` there for provenance. The deck copy is self-contained (rasters
embedded as data URLs, works offline) with one local change: `color-scheme` is
forced to light so the panel matches the white deck theme on dark-mode systems.
Reapply that one-liner if the source file is regenerated and re-copied.

The "Locating drill core D-6A" slide embeds
[D_6A_location_map.html](D_6A_location_map.html), a folium/Leaflet map of
Duluth Complex bedrock geology (Macrostrat / MGS state map units) with the
D-6A collar, copied from `2026_SSRM_Duluth_Complex/D-6A_location/` (regenerate
there with `make_location_map.py`). Unlike the rest of the deck, this map
needs an internet connection — its Leaflet/Bootstrap libraries load from CDNs
and the basemap tiles stream from OSM/Esri.

Two further slides embed interactive Plotly figures in place of static PNGs:

- [D_6A_log_interactive.html](D_6A_log_interactive.html) (drill core D-6A
  slide) — rebuild of `D_6A_plot_primary.png`: lithology + magnetics samples +
  Cu/Ni/Co assays + KT-10 susceptibility, all panels sharing the depth axis,
  so a box-zoom on the susceptibility profile synchronizes the lithology
  column and geochem panels.
- [D_6A_lith_susc_interactive.html](D_6A_lith_susc_interactive.html) ("puzzle
  to carry through the week" slide) — lithology beside a wide susceptibility
  panel in SI units with dense log ticks, replacing `D_6A_lith_susc.png`.

Drag a box (or scroll) to zoom, double-click to reset, hover for lithology
descriptions and values. Regenerate both with:

```
mamba activate ess-jbook
python build_D_6A_interactive.py
```

The script reads its CSV inputs (section, style, Exxon geochem, magnetics-sample
footages, KT-10 profile) from the sibling `2026_SSRM_Duluth_Complex` repository;
the generated HTML is self-contained apart from `lib/plotly/plotly.min.js`
(vendored from plotly.py 6.5.2), so the deck still works fully offline.

## Slide runtime (`lib/`)

`lib/` holds vendored copies of reveal.js 5.2.1 (trimmed to the white theme +
Source Sans Pro), KaTeX 0.16.22, and Plotly.js (`lib/plotly/`), each with its
LICENSE file where applicable. When building
the S2 (fine-particle magnetism and hysteresis) and S3_remanent_magnetization
decks, copy this `lib/` folder into each deck directory — per-deck vendoring
keeps every deck double-clickable in Safari (see above) and portable on its own.

## Figure sources and attribution

- `D_6A_plot_primary.png`, `D_6A_lith_susc.png` (crop), `core_shed.png`,
  `core_box.jpg`, `core_box_185.png` (no longer on a slide),
  `Swanson-Hysell2021_map.png` — from the
  [2026_SSRM_Duluth_Complex](https://github.com/Institute-for-Rock-Magnetism/2026_SSRM_Duluth_Complex)
  repository (Severson 1992 log; May 2026 sampling; Swanson-Hysell et al. 2021).
- `current_loop.png`, `spins.png` — from `W2_dia_para_ferro/images/` in the
  [2026_ESCI_pmag_course](https://github.com/Institute-for-Rock-Magnetism/2026_ESCI_pmag_course) repository.
- `negative_exchange.png` — from the instructor's ESCI 4204/8204 Class 3 teaching
  materials (superexchange orbital cartoon); the exchange/superexchange and
  magnetite-ferrimagnetism slides adapt content from
  `exchange_coupling_slides.tex` in that same folder.
- `larmor.png`, `para.png`, `MsT.png`, `structure.png` — Tauxe et al.,
  *Essentials of Paleomagnetism* (interactive JupyterBook edition), CC BY 4.0;
  attributed on the slides where used.
- Hysteresis model: Takács, J. (2001), *COMPEL*, 20(4), 1002–1014.
