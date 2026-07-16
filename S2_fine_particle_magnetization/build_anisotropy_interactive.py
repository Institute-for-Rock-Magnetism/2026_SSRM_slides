"""Build the interactive 3D anisotropy-energy-surface figures for the S2 deck.

Generates three self-contained Plotly HTML files (Plotly.js loaded from the
deck's vendored lib/plotly/plotly.min.js so the deck works offline):

- anisotropy_magnetite_300K.html — magnetocrystalline energy surface of
  magnetite at room temperature (easy [111], hard [100])
- anisotropy_magnetite_130K.html — the same surface at the isotropic point
  (K1 = 0), drawn on the same colorbar scale as the 300 K figure
- anisotropy_hematite.html — hematite's uniaxial easy-plane energy surface

The plotting functions are adapted from the code cells in chapter 4 of
Tauxe & Swanson-Hysell (2026), Essentials of Paleomagnetism, interactive
JupyterBook edition (CC BY 4.0):
https://pmagpy.github.io/Essentials-JupyterBook/chapters/chapter4

Run in the ess-jbook environment:

    source ~/miniforge3/bin/activate ess-jbook
    python build_anisotropy_interactive.py
"""

import itertools

import numpy as np
import plotly.graph_objects as go

PLOTLYJS = 'lib/plotly/plotly.min.js'


def format_miller(h, k, l):
    """Convert indices to a crystallographic string with overbars."""
    def to_char(n):
        if n < 0:
            return f"{abs(n)}̅"
        return str(n)
    return f"[{to_char(h)}{to_char(k)}{to_char(l)}]"


def plot_magnetocrystalline_anisotropy(K1, K2, radius_nm, temperature, cbar_max=None):
    """Plot the 3D magnetocrystalline anisotropy energy surface for magnetite.

    Args:
        K1 (float): First magnetocrystalline anisotropy constant (J/m³).
        K2 (float): Second magnetocrystalline anisotropy constant (J/m³).
        radius_nm (float): Grain radius in nanometers.
        temperature (float): Temperature in Kelvin.
        cbar_max (float, optional): Maximum value for the colorbar. If None,
            uses the actual maximum energy; pass the 300 K maximum when
            drawing the 130 K figure so the two share a color scale.

    Returns:
        tuple: (fig, energy_max) — the Plotly figure and the maximum energy
            barrier (J) of this surface.
    """
    exaggeration = 0.6   # geometric distortion factor
    cube_scale = 1.5     # reference cube size

    # energy surface over the unit sphere
    phi = np.linspace(0, 2 * np.pi, 100)
    theta = np.linspace(0, np.pi, 100)
    phi, theta = np.meshgrid(phi, theta)

    a1 = np.sin(theta) * np.cos(phi)
    a2 = np.sin(theta) * np.sin(phi)
    a3 = np.cos(theta)

    term1 = (a1**2 * a2**2) + (a2**2 * a3**2) + (a3**2 * a1**2)
    term2 = a1**2 * a2**2 * a3**2
    E_density = (K1 * term1) + (K2 * term2)

    r_particle = radius_nm * 1e-9
    volume = (4 / 3) * np.pi * r_particle**3
    E_total = E_density * volume
    E_norm = E_total - E_total.min()
    energy_max = E_norm.max()
    cmax_val = cbar_max if cbar_max is not None else energy_max

    r_blob = 1.0 + (exaggeration * (E_norm / cmax_val))
    x_blob = r_blob * np.sin(theta) * np.cos(phi)
    y_blob = r_blob * np.sin(theta) * np.sin(phi)
    z_blob = r_blob * np.cos(theta)

    # reference cube
    v_val = 0.6 * cube_scale
    x_cube = [v_val, v_val, -v_val, -v_val, v_val, v_val, -v_val, -v_val]
    y_cube = [v_val, -v_val, -v_val, v_val, v_val, -v_val, -v_val, v_val]
    z_cube = [v_val, v_val, v_val, v_val, -v_val, -v_val, -v_val, -v_val]
    i_ind = [7, 0, 0, 0, 4, 4, 6, 6, 4, 0, 3, 2]
    j_ind = [3, 4, 1, 2, 5, 6, 5, 2, 0, 1, 6, 3]
    k_ind = [0, 7, 2, 3, 6, 7, 1, 1, 5, 5, 7, 6]

    fig = go.Figure()

    fig.add_trace(go.Surface(
        z=z_blob, x=x_blob, y=y_blob,
        surfacecolor=E_norm,
        cmin=0,
        cmax=cmax_val,
        colorscale='magma_r',
        colorbar=dict(title='Energy<br>Barrier (J)', len=0.5, thickness=15,
                      x=0.9, exponentformat='e'),
        opacity=1.0,
        hoverinfo='none',
        contours_x=dict(highlight=False), contours_y=dict(highlight=False),
        contours_z=dict(highlight=False),
        name='Energy'
    ))

    fig.add_trace(go.Mesh3d(
        x=x_cube, y=y_cube, z=z_cube, i=i_ind, j=j_ind, k=k_ind,
        color='silver', opacity=1, flatshading=True,
        lighting=dict(ambient=0.5, diffuse=0.8),
        hoverinfo='skip', visible=False, name='Cube'
    ))

    # crystallographic axes
    max_extent = max(1.0 + exaggeration, v_val)
    axis_scale = max_extent + 0.5

    hard_axes = [([1, 0, 0]), ([-1, 0, 0]), ([0, 1, 0]),
                 ([0, -1, 0]), ([0, 0, 1]), ([0, 0, -1])]
    for vec in hard_axes:
        v = np.array(vec) * axis_scale
        fig.add_trace(go.Scatter3d(x=[0, v[0]], y=[0, v[1]], z=[0, v[2]],
                                   mode='lines', line=dict(color='red', width=5),
                                   hoverinfo='skip', showlegend=False))
        fig.add_trace(go.Scatter3d(x=[v[0]], y=[v[1]], z=[v[2]], mode='text',
                                   text=[f"{format_miller(*vec)}"],
                                   textfont=dict(color='red', size=12),
                                   hoverinfo='skip', showlegend=False))

    for x, y, z in itertools.product([1, -1], repeat=3):
        vec = np.array([x, y, z])
        v = (vec / np.linalg.norm(vec)) * axis_scale
        fig.add_trace(go.Scatter3d(x=[0, v[0]], y=[0, v[1]], z=[0, v[2]],
                                   mode='lines',
                                   line=dict(color='blue', width=4, dash='dash'),
                                   hoverinfo='skip', showlegend=False))
        fig.add_trace(go.Scatter3d(x=[v[0]], y=[v[1]], z=[v[2]], mode='text',
                                   text=[f"{format_miller(x, y, z)}"],
                                   textfont=dict(color='blue', size=11),
                                   hoverinfo='skip', showlegend=False))

    n_traces = len(fig.data)
    vis_energy = [True, False] + [True] * (n_traces - 2)
    vis_cube = [False, True] + [True] * (n_traces - 2)

    fig.update_layout(
        width=None, height=None, autosize=True,
        margin=dict(r=150, b=0, l=10, t=30),
        title=dict(text=(f'Magnetocrystalline anisotropy (equant grain, '
                         f'diameter = {radius_nm*2} nm; temp = {temperature} K)'),
                   x=0.0, y=0.99, font=dict(size=13)),
        hovermode=False,
        updatemenus=[dict(
            type="buttons", direction="left", x=0.5, xanchor="center",
            y=0.0, yanchor="top",
            bgcolor="rgba(255, 255, 255, 0.9)",
            pad=dict(t=0, b=2, l=0, r=0),
            font=dict(size=11),
            buttons=list([
                dict(label="Energy Landscape", method="update",
                     args=[{"visible": vis_energy},
                           {"title": (f"Magnetite Energy Surface (equant grain, "
                                      f"diameter = {radius_nm*2} nm; "
                                      f"temperature = {temperature} K)")}]),
                dict(label="Crystal Geometry", method="update",
                     args=[{"visible": vis_cube},
                           {"title": (f"Physical Crystal Shape (equant grain, "
                                      f"diameter = {radius_nm*2} nm)")}]),
            ]),
        )],
        scene=dict(xaxis=dict(visible=False), yaxis=dict(visible=False),
                   zaxis=dict(visible=False),
                   aspectmode='data',
                   camera=dict(eye=dict(x=1.2, y=0.6, z=0.9)),
                   dragmode='orbit'),
    )

    return fig, energy_max


def plot_hematite_anisotropy(K1, K3, radius_nm, temperature):
    """Plot the 3D hematite uniaxial (easy-plane) anisotropy energy surface.

    Args:
        K1 (float): Perpendicular anisotropy constant (J/m³); negative for
            easy-plane behavior.
        K3 (float): In-plane (basal plane) anisotropy constant (J/m³).
        radius_nm (float): Grain radius in nanometers.
        temperature (float): Temperature in Kelvin.

    Returns:
        tuple: (fig, energy_max) — the Plotly figure and maximum energy (J).
    """
    exaggeration = 1.8
    crystal_scale = 2.0

    phi = np.linspace(0, 2 * np.pi, 100)
    theta = np.linspace(0, np.pi, 100)
    phi_grid, theta_grid = np.meshgrid(phi, theta)

    # K1 sin²θ (c-axis hard when K1 < 0) + weak 6-fold basal-plane term
    E_density = (K1 * np.sin(theta_grid)**2
                 + K3 * np.sin(theta_grid)**4 * np.cos(6 * phi_grid))

    r_particle = radius_nm * 1e-9
    volume = (4 / 3) * np.pi * r_particle**3
    E_total = E_density * volume
    E_norm = E_total - E_total.min()
    energy_max = E_norm.max()

    r_blob = 1.0 + (exaggeration * (E_norm / energy_max))
    x_blob = r_blob * np.sin(theta_grid) * np.cos(phi_grid)
    y_blob = r_blob * np.sin(theta_grid) * np.sin(phi_grid)
    z_blob = r_blob * np.cos(theta_grid)

    # hexagonal plate (platy habit; c-axis vertical)
    r_hex = 0.9 * crystal_scale
    c_height = 0.15 * crystal_scale
    angles_hex = np.linspace(0, 2 * np.pi, 7)[:-1]

    x_hex, y_hex, z_hex = [], [], []
    for angle in angles_hex:
        x_hex.append(r_hex * np.cos(angle))
        y_hex.append(r_hex * np.sin(angle))
        z_hex.append(-c_height / 2)
    for angle in angles_hex:
        x_hex.append(r_hex * np.cos(angle))
        y_hex.append(r_hex * np.sin(angle))
        z_hex.append(c_height / 2)

    i_ind, j_ind, k_ind = [], [], []
    for i in range(6):
        i_next = (i + 1) % 6
        i_ind.append(0); j_ind.append(i); k_ind.append(i_next)
    for i in range(6):
        i_next = (i + 1) % 6
        i_ind.append(6); j_ind.append(6 + i); k_ind.append(6 + i_next)
    for i in range(6):
        i_next = (i + 1) % 6
        i_ind.extend([i, i_next])
        j_ind.extend([6 + i, 6 + i_next])
        k_ind.extend([i_next, 6 + i])

    fig = go.Figure()

    fig.add_trace(go.Surface(
        z=z_blob, x=x_blob, y=y_blob,
        surfacecolor=E_norm,
        cmin=0,
        colorscale='plasma',
        colorbar=dict(title='Energy<br>Barrier (J)', len=0.5, thickness=15,
                      x=0.9, exponentformat='e'),
        opacity=1.0,
        hoverinfo='none',
        contours_x=dict(highlight=False), contours_y=dict(highlight=False),
        contours_z=dict(highlight=False),
        name='Energy'
    ))

    fig.add_trace(go.Mesh3d(
        x=x_hex, y=y_hex, z=z_hex, i=i_ind, j=j_ind, k=k_ind,
        color='lightcoral', opacity=0.9, flatshading=True,
        lighting=dict(ambient=0.5, diffuse=0.8),
        hoverinfo='skip', visible=False, name='Crystal'
    ))

    max_extent = max(1.0 + exaggeration, r_hex, c_height / 2)
    axis_scale = max_extent + 0.3

    hard_color, easy_color = 'red', 'blue'

    fig.add_trace(go.Scatter3d(x=[0, 0], y=[0, 0], z=[-axis_scale, axis_scale],
                               mode='lines',
                               line=dict(color=hard_color, width=5, dash='dash'),
                               hoverinfo='skip', showlegend=False))
    fig.add_trace(go.Scatter3d(x=[0], y=[0], z=[axis_scale], mode='text',
                               text=['c-axis<br>(hard)'],
                               textfont=dict(color=hard_color, size=12),
                               hoverinfo='skip', showlegend=False))

    basal_angles = np.linspace(0, 2 * np.pi, 6, endpoint=False)
    for angle in basal_angles:
        x_end = axis_scale * 0.7 * np.cos(angle)
        y_end = axis_scale * 0.7 * np.sin(angle)
        fig.add_trace(go.Scatter3d(x=[0, x_end], y=[0, y_end], z=[0, 0],
                                   mode='lines',
                                   line=dict(color=easy_color, width=4),
                                   hoverinfo='skip', showlegend=False))

    n_traces = len(fig.data)
    vis_energy = [True, False] + [True] * (n_traces - 2)
    vis_crystal = [False, True] + [True] * (n_traces - 2)

    K1_abs = abs(K1)

    fig.update_layout(
        width=None, height=None, autosize=True,
        margin=dict(r=150, b=0, l=10, t=30),
        title=dict(text=(f'Hematite uniaxial anisotropy — easy plane '
                         f'(diameter = {radius_nm*2} nm; temp = {temperature} K)'),
                   x=0.0, y=0.99, font=dict(size=13)),
        hovermode=False,
        annotations=[
            dict(
                text=(f'K<sub>u1</sub> = {K1_abs:.1e} J/m³ (c-axis, hard); '
                      f'in-plane K₃ ≈ 0–{K3:.0f} J/m³'),
                xref='paper', yref='paper',
                x=0.5, y=0.06,
                xanchor='center', yanchor='top',
                showarrow=False,
                font=dict(size=10, color='rgba(0,0,0,0.6)'),
                bgcolor='rgba(255,255,255,0.8)',
                borderpad=4
            )
        ],
        updatemenus=[dict(
            type="buttons", direction="left", x=0.5, xanchor="center",
            y=0.0, yanchor="top",
            bgcolor="rgba(255, 255, 255, 0.9)",
            pad=dict(t=0, b=2, l=0, r=0),
            font=dict(size=11),
            buttons=list([
                dict(label="Energy Landscape", method="update",
                     args=[{"visible": vis_energy},
                           {"title": (f"Hematite Energy Surface (diameter = "
                                      f"{radius_nm*2} nm; temp = {temperature} K)")}]),
                dict(label="Hematite Crystal", method="update",
                     args=[{"visible": vis_crystal},
                           {"title": (f"Hematite Crystal (platy habit, diameter = "
                                      f"{radius_nm*2} nm)")}]),
            ]),
        )],
        scene=dict(xaxis=dict(visible=False), yaxis=dict(visible=False),
                   zaxis=dict(visible=False),
                   aspectmode='data',
                   camera=dict(eye=dict(x=1.8, y=1.0, z=1.3)),
                   dragmode='orbit'),
    )

    return fig, energy_max


def write(fig, filename):
    fig.write_html(filename, include_plotlyjs=PLOTLYJS, full_html=True,
                   config={'responsive': True, 'displayModeBar': False})
    print(f'wrote {filename}')


if __name__ == '__main__':
    # room temperature: K1, K2 of magnetite (Syono 1963 / Fletcher & O'Reilly 1974)
    fig_300K, energy_max = plot_magnetocrystalline_anisotropy(
        K1=-1.35e4, K2=-0.44e4, radius_nm=25, temperature=300)
    write(fig_300K, 'anisotropy_magnetite_300K.html')

    # isotropic point: K1 = 0, same colorbar scale as the 300 K figure
    fig_130K, _ = plot_magnetocrystalline_anisotropy(
        K1=0.0, K2=-0.44e4, radius_nm=25, temperature=130,
        cbar_max=energy_max)
    write(fig_130K, 'anisotropy_magnetite_130K.html')

    # hematite: K1 from Dunlop & Özdemir (1997), in-plane K3 from
    # Martín-Hernández & Guerrero-Suárez (2012)
    fig_hem, _ = plot_hematite_anisotropy(
        K1=-1.2e6, K3=13, radius_nm=200, temperature=300)
    write(fig_hem, 'anisotropy_hematite.html')
