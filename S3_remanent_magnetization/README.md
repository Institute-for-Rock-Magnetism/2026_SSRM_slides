# S3 — Remanent magnetization: how rocks become and stay magnetized

Session 3 slide deck for the 2026 IRM Summer School of Rock Magnetism
(Wednesday, July 22). A reveal.js deck in two arcs: (1) how remanence is
acquired and why it survives — Néel theory, then VRM, TRM, and CRM as three
routes across the same blocking boundary; and (2) how the record is read —
sampling and orientation, measurement, AF and thermal demagnetization,
Zijderveld diagrams, PCA, and field tests. DRM is deliberately excluded (it
has its own session on sediments).

Content follows chapters 7 and 9 of Tauxe & Swanson-Hysell (2026),
*Essentials of Paleomagnetism*, interactive JupyterBook edition
([pmagpy.github.io/Essentials-JupyterBook](https://pmagpy.github.io/Essentials-JupyterBook/)),
and the `W5_VRM_TRM_CRM` and `W8_getting_directions` notebooks in the
[2026_ESCI_pmag_course](https://github.com/Institute-for-Rock-Magnetism/2026_ESCI_pmag_course)
repository.

## Presenting

Open [index.html](index.html) in a browser — double-clicking the file works in
Chrome, Safari, and Firefox — or serve it locally:

```
python -m http.server
# then http://localhost:8000/S3_remanent_magnetization/
```

Everything (reveal.js, KaTeX, Plotly, fonts, images, widgets) lives inside
this folder, so the deck is a portable standalone that works with no internet
connection. Press `s` for speaker notes, `f` for fullscreen, `Esc` for the
slide overview.

## Structure

| Part | Content |
|---|---|
| 1 | Néel theory: dynamic equilibrium, relaxation time, the Néel diagram (+ interactive relaxation-time explorer) |
| 2 | VRM (+ embedded Essentials VRM widget), Brunhes overprints, thermoviscous remanence |
| 3 | TRM: blocking on cooling (+ embedded Essentials TRM widget), blocking-temperature spectra, TRM intensity, pTRM laws, grain size |
| 4 | CRM: blocking volume (+ embedded Essentials CRM widget), red beds, alteration |
| 5 | NRM as a vector sum; sampling, orientation, terminology, magnetometers, coordinate transforms |
| 6 | Demagnetization: thermal, then AF (+ new interactive AF widget) |
| 7 | IRM (lightning) and ARM/pARM/GRM |
| 8 | Zijderveld diagrams (+ new component/PCA explorer widget), overlap, PCA/MAD/DANG, real Duluth Complex data (interactive Plotly) |
| 9 | Field tests (fold, conglomerate, baked contact) + the D-6A workflow |

## Interactive widgets

Two kinds of interactive content:

### Embedded Essentials-JupyterBook widgets (`*_widget.html`)

`vrm_widget.html`, `trm_widget.html`, and `crm_widget.html` are the chapter 7
interactives from the Essentials JupyterBook (CC BY 4.0), copied from
`Essentials-JupyterBook/book/figures/chapter7/` and embedded as iframes. Each
animates the same Néel diagram (grain population in volume–anisotropy space)
with a different driver: elapsed time (VRM), temperature (TRM), and grain
growth (CRM). Two local changes were made to each copy for offline use:

- the Plotly CDN script tag is repointed to the vendored
  `lib/plotly/plotly.min.js`
- the Google Fonts `@import` is removed (falls back to Georgia/system fonts)

Reapply both if the source widgets are regenerated and re-copied.

### Canvas widgets ([js/widgets.js](js/widgets.js))

Three new canvas-based widgets with no external dependencies, in the style of
the S1 deck:

- **Néel relaxation explorer** (`data-widget="neel"`): grain-diameter and
  temperature sliders; left pane shows the two-well anisotropy energy
  landscape with the thermal-energy band to scale, right pane plots
  log₁₀ τ vs grain size against 100 s / 1 Myr / 4.5 Gyr guides. Magnetite
  parameters: τ = τ₀ exp(Kv/k_BT) with τ₀ = 10⁻⁹ s,
  M_s(T) = M_s(0)(1 − T/T_c)^0.38, K ∝ M_s², T_c = 580 °C, and
  K₀ = 30 kJ/m³ calibrated so a ~25 nm equivalent-sphere grain is stable for
  Gyr at 20 °C but superparamagnetic at 300 °C (the chapter 7 narrative).
- **AF demagnetization** (`data-widget="afdemag"`): a two-component NRM
  (soft overprint, median coercivity 12 mT; hard ancient component, 60 mT;
  log-normal spectra) carried by 260 grains. During a step, grains with
  coercivity below the decaying envelope flip with the field and freeze with
  random polarity; the decay curve and the swinging net-M arrow are computed
  from the actual grain population.
- **Zijderveld / PCA explorer** (`data-widget="zij"`): port of the
  `W8_getting_directions` ipywidgets explorer — median/DP sliders for two
  components with preset overlap cases, live coercivity spectra, Zijderveld,
  equal-area, and decay panels, plus a Kirschvink (1980) free-line PCA fit
  with live MAD and angular error from the true component direction.

## Interactive Duluth Complex demagnetization data

[FC_zijderveld.html](FC_zijderveld.html) is a three-panel Plotly figure
(Zijderveld, equal-area, intensity decay) of real AF and thermal
demagnetization data for ~1096 Ma Duluth Complex / Beaver Bay area gabbros
(sites FC1, FC4, HCT1), with the published PCA component fits drawn over
their step ranges. Data are the MagIC-format tables in the sibling
[2020_Duluth_Complex](https://github.com/Swanson-Hysell-Group/2020_Duluth_Complex)
repository (Swanson-Hysell et al., 2021, *Geology*,
[doi:10.1130/G47873.1](https://doi.org/10.1130/G47873.1); measurements by
Yiming Zhang). Directions are rotated from specimen to geographic coordinates
with PmagPy (`pmag.dogeo`) using the sample orientations. Regenerate with:

```
mamba activate ess-jbook
python build_FC_zijderveld.py
```

The script reads `measurements.txt`, `samples.txt`, `specimens.txt`, and
`sites.txt` from the sibling checkout; the generated HTML is self-contained
apart from `lib/plotly/plotly.min.js`, so the deck works fully offline.

## Slide runtime (`lib/`)

`lib/` holds vendored copies of reveal.js 5.2.1 (trimmed to the white theme +
Source Sans Pro), KaTeX 0.16.22, and Plotly.js (from plotly.py 6.5.2), copied
from the S1 deck per the repository's per-deck vendoring policy (see
[TECHNICAL.md](../TECHNICAL.md)).

## Figure sources and attribution

- All `images/*.png` and `kates_sheep.jpg` figures are from Tauxe, L. &
  Swanson-Hysell, N. L. (2026), *Essentials of Paleomagnetism*, interactive
  JupyterBook edition (CC BY 4.0), copied from
  `Essentials-JupyterBook/book/figures/chapter7/` and `chapter9/` (plus
  `tauvd.png` from `chapter4/`); original photo credits as noted in slide
  captions (sheep drawing by Kate Akin; lava photo by Daniel Staudigel).
  Exceptions: `images/uniaxial_energy.png` is generated by
  `images/build_energy_landscape.py` (run in `ess-jbook`), which adapts the
  shape-anisotropy energy-landscape calculation from
  `Essentials-JupyterBook/scripts/chapter5_figure1.py` (no applied field,
  plus elongate-grain cartoons); and `images/pullaiah_magnetite.png` is
  generated by `images/pullaiah.py` — a magnetite-only Pullaiah nomogram
  (T ln Cτ / M_s² contours after Pullaiah et al., 1975; C = 10¹⁰ s⁻¹,
  M_s(T) power law with β = 0.43).
- `vrm_widget.html`, `trm_widget.html`, `crm_widget.html` — Essentials
  JupyterBook chapter 7 interactives (CC BY 4.0), localized as described
  above.
- `FC_zijderveld.html` — built from Swanson-Hysell et al. (2021) data
  (CC BY 4.0 repository).
