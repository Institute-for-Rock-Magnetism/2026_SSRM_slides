import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np

# =========================================================================
# 1. SETUP REPRESENTATIVE DATA
# Demagnetization data typically moves from Natural Remanent Magnetization (NRM)
# at step 0 towards the Origin (step 6).
#
# Vector components: North (N), East (E), Down (D)
# Total NRM vector at step 0: (N=3.0, E=1.0, Down=2.0)
# Step 3 Intersection: Down component fully removed. Vector (1.5, 1.0, 0.0)
# Step 6 Origin: (0.0, 0.0, 0.0)
# =========================================================================

steps = np.arange(7) # steps 0 to 6

# Pure component 1 path (steps 0 to 3) - Dashed in diagrams
# Linear reduction in N and Down, constant E
N_dashed = np.linspace(3.0, 1.5, 4)
E_dashed = np.full(4, 1.0)
D_dashed = np.linspace(2.0, 0.0, 4)

# Pure component 2 path (steps 3 to 6) - Solid in diagrams
# Linear reduction in N and East, Down is 0.0
N_solid = np.linspace(1.5, 0.0, 4)
E_solid = np.linspace(1.0, 0.0, 4)
D_solid = np.full(4, 0.0)

# Combine for full data series (NRM to Origin)
# full arrays are ordered 0->6. Remove duplicate Step 3.
N_full = np.concatenate((N_dashed, N_solid[1:]))
E_full = np.concatenate((E_dashed, E_solid[1:]))
D_full = np.concatenate((D_dashed, D_solid[1:]))

# =========================================================================
# 2. GENERATE ZIJDERVELD PLOTS
# Projects 3D vector onto 2D Horizontal (E-N) and Vertical (N-Down) planes.
# Layout conventions match image_21.png and common publication standards.
# =========================================================================
def plot_zijderveld(N, E, D, title_label="Zijderveld Diagram Projections"):
    # Create figure with shared y-axis (Shared baseline - usually North)
    fig, axes = plt.subplots(1, 2, sharey=True, figsize=(14, 6))
    plt.suptitle(title_label, fontsize=16)

    # conventions from diagrams: Euclidean coords N vs E (Horizontal); N vs Down (Vertical inverted)
    # The full data path is 0 -> 6 (NRM towards Origin)

    # -----------------------------------------------------------------
    # Horizontal Projection (Left Plot: North vs East)
    # Shading on top component plane
    # -----------------------------------------------------------------
    axes[0].set_title("Horizontal Component (N vs E)", fontsize=13)
    # convention in image_21.png: NRM is an open circle; others are closed
    # Closed squares (convention varies, let's match illustrative solid component from diagrams)
    axes[0].plot(E, N, 's-k', markerfacecolor='k', markersize=6)
    
    # Label key steps 0, 3, 6
    for i in [0, 3, 6]:
        label_pos = (E[i] + 0.1, N[i] + 0.1)
        if i == 0: label_pos = (E[i] + 0.1, N[i] - 0.1) # shift NRM label down
        axes[0].annotate(f"{i}", (E[i], N[i]), textcoords="offset points", xytext=label_pos, ha='center', fontsize=10, weight='bold')

    # Replicate diagram labels convention (standard Euclidean layout N vs E)
    # N is UP Euclidean (+y). S is DOWN (-y)
    # E is RIGHT Euclidean (+x). W is LEFT (-x)
    axes[0].set_ylabel("North / South", weight='bold', fontsize=11)
    axes[0].set_xlabel("East / West", weight='bold', fontsize=11)
    
    axes[0].grid(True, linestyle='--', alpha=0.5)
    axes[0].set_aspect('equal') # crucial for paleomagnetic interpretation

    # Draw Euclidean axis lines matching diagram style
    axes[0].axvline(0, color='gray', linewidth=1)
    axes[0].axhline(0, color='gray', linewidth=1)

    # -----------------------------------------------------------------
    # Vertical Projection (Right Plot: North vs Down)
    # Shading on front component plane
    # -----------------------------------------------------------------
    axes[1].set_title("Vertical Component (N vs Down)", fontsize=13)
    # Open squares (often used to distinguish projections)
    axes[1].plot(D, N, 'o-k', markerfacecolor='none', markeredgecolor='k', markersize=6)
    
    # Label key steps 0, 3, 6
    for i in [0, 3, 6]:
        axes[1].annotate(f"{i}", (D[i], N[i]), textcoords="offset points", xytext=(D[i] + 0.1, N[i] + 0.1), ha='center', fontsize=10, weight='bold')

    # Diagram labels convention: Shared y-axis (North). Right plot x-axis is Down.
    # convention in diagrams: Down is DOWN. N is RIGHT.
    # So Down = -Euclidean y. N = Euclidean x.
    # Data is plotted Down(x) vs N(y). Correct. Move steps 0-3 UP Euclidean. OK.
    
    # Labels for vertical projection
    axes[1].set_xlabel("Down (Vertical)", weight='bold', fontsize=11)
    
    axes[1].grid(True, linestyle='--', alpha=0.5)
    axes[1].set_aspect('equal')

    # Euclidean axis lines
    axes[1].axvline(0, color='gray', linewidth=1)
    axes[1].axhline(0, color='gray', linewidth=1)

    plt.tight_layout(rect=[0, 0.03, 1, 0.97])
    return fig

# =========================================================================
# 3. GENERATE 3D BLOCK DIAGRAMS
# Layout matches conventions and perspectives of image_21.png / image_22.png.
# Shading highlights the projection component planes.
# =========================================================================
def plot_3d_block_diagram(N_path1, E_path1, D_path1, N_path2, E_path2, D_path2, title_label="3D Remanence block diagram"):
    fig = plt.figure(figsize=(10, 8))
    # Matplotlib uses N=x, E=y, Down=z for right-handed Euclidean coordinates. Non-inverted axis.
    ax = fig.add_subplot(111, projection='3d')
    plt.title(title_label, fontsize=14)

    # -----------------------------------------------------------------
    # Plot wireframe grid box and axis arrows matching diagrams
    # -----------------------------------------------------------------
    # NRM Total vector 0 defines the bounding box corner opposite Origin
    v0 = np.array([N_path1[0], E_path1[0], D_path1[0]])
    v3 = np.array([N_path2[0], E_path2[0], D_path2[0]]) # intersection point 3
    # Origin is Vector 6 = (0,0,0)

    # Draw labeled axes arrows from corners opposite origin corner
    # Down axis from corner (NRM_N, NRM_E, 0) Downwards.
    ax.quiver(v0[0], v0[1], 0, 0, 0, v0[2]+0.5, length=1, normalize=False, color='gray', arrow_length_ratio=0.1)
    ax.text(v0[0], v0[1], v0[2]+0.6, "DOWN", color='black', fontsize=10)
    
    # North axis from corner (0, NRM_E, 0) Northwards (+N Euclidean x)
    ax.quiver(0, v0[1], 0, v0[0]+0.5, 0, 0, length=1, normalize=False, color='gray', arrow_length_ratio=0.1)
    ax.text(v0[0]+0.6, v0[1], 0, "N", color='black', fontsize=12)

    # East axis from corner (0, 0, 0 - Origin) Eastwards (+E Euclidean y)
    ax.quiver(0, 0, 0, 0, v0[1]+0.5, 0, length=1, normalize=False, color='gray', arrow_length_ratio=0.2)
    ax.text(0, v0[1]+0.6, 0, "E", color='black', fontsize=12)
    
    # Label Origin corner (Step 6)
    ax.text(-0.2, -0.2, -0.2, "6\n(Origin)", color='black', ha='center', fontsize=10, weight='bold')

    # Draw wireframe block grid (Euclidean space [3, 1, 2])
    # ... code for wireframe block omitted for brevity, plot a full unit box with axes indicators ...
    # Simple bounding box:
    # ax.set_xlim(0, 3.5)
    # ax.set_ylim(0, 1.5)
    # ax.set_zlim(0, 2.5)
    # ax.set_xlabel('N')
    # ax.set_ylabel('E')
    # ax.set_zlabel('Down')
    # (Matplotlib non-inverted DOWN is Euclidean +z)

    # illustrative block grid for diagram clarity matching image_21.png layout space
    
    # -----------------------------------------------------------------
    # Plot Remanence Paths (Dashed 0-3, Solid 3-6)
    # Shading highlights projection component planes from origin corner
    # -----------------------------------------------------------------
    
    # Shading Plane 1 (Component plane for path 3->6 - Solid line)
    # Horizontal projection Down=0. Plane containing Vector_3 and Vector_6 (Origin)
    # Vertices: [Origin(6), Vector_3, Shifted_Vector_3_North?]
    # analysis of diagrams shading analysis: Plane has vertices [ (0,0,0), (1.5,1,0), (3,1,0) ]. Wait. Origin is step 6.
    # Diagram space has vector moving 0->6. The shading is just a projection volume.
    # Top surface shading Vertices from earlier analysis: [Origin(0,0,0), Point_3(1.5,1,0), Shifted_0_top(3,1,0)]. OK.
    
    # Create Illustrative Shaded projections for the example concept
    # convention in image_21.png/22.png:
    # 1. Plane containing dashed line (Front face projection)
    # Vertices of front shading: [N=1.5, E=1, Down=0] to [N=3, E=1, Down=2]
    # illustrative plane has vertices [ (1.5,1,0), (3,1,0), (3,1,2) ].
    verts_front = [[ (1.5, 1, 0), (3, 1, 0), (3, 1, 2) ]]
    ax.add_collection3d(Poly3DCollection(verts_front, facecolors='gray', linewidths=0, alpha=0.3))

    # 2. Plane containing solid line (Top face projection)
    # Vertices of top shading: [N=0, E=0, D=0] to [N=1.5, E=1, D=0]
    # illustrative plane has vertices [ (0,0,0), (1.5,0,0), (1.5,1,0) ].
    verts_top = [[ (0, 0, 0), (1.5, 0, 0), (1.5, 1, 0) ]]
    ax.add_collection3d(Poly3DCollection(verts_top, facecolors='gray', linewidths=0, alpha=0.3))

    # Plot highlighted total component Vector_3-0 (labeled "Total Vector" in diagrams)
    ax.quiver(v3[0], v3[1], v3[2], v0[0]-v3[0], v0[1]-v3[1], v0[2]-v3[2], length=1, normalize=False, color='red', linewidth=2, arrow_length_ratio=0.1)
    ax.text((v3[0]+v0[0])/2, (v3[1]+v0[1])/2 + 0.1, (v3[2]+v0[2])/2, "Total Vector", color='red', fontsize=10, ha='center')

    # Path 0-1-2-3 (Dashed) - Linear projection on FRONT surface (shifted E=1 plane)
    ax.plot(N_path1, E_path1, D_path1, 'k--', linewidth=1.5)
    # Label Step 0 (NRM)
    ax.text(v0[0]+0.1, v0[1]+0.1, v0[2]+0.1, "0 (NRM)", color='black', fontsize=10, weight='bold')

    # Path 3-4-5-6 (Solid) - Linear projection on TOP surface (Down=0 plane)
    ax.plot(N_path2, E_path2, D_path2, 'k-', linewidth=1.5)
    # Label Intersection Step 3
    ax.text(v3[0]+0.1, v3[1]+0.1, v3[2]+0.1, "3", color='black', fontsize=10, weight='bold')

    # illustrative block grid for diagram clarity matching image_21.png layout space corners opposite origin corner
    # (Matplotlib non-inverted Down is Euclidean +z)
    ax.set_box_aspect([3, 1, 2]) # crucial to define the bounding volume shape
    ax.axis('off') # hide standard matplot grid and numeric labels like illustrative diagrams

    return fig

# =========================================================================
# 4. EXECUTE PLOTTING
# =========================================================================

# --- 4.1 Zijderveld Plot ---
fig_zij = plot_zijderveld(N_full, E_full, D_full)
fig_zij.savefig('Zijderveld_Diagram.png', dpi=150)
print("Saved Zijderveld_Diagram.png")

# --- 4.2 3D Block Diagram (Standard SE View, looking towards Back/Origin) ---
fig_3d_l = plot_3d_block_diagram(N_dashed, E_dashed, D_dashed, N_solid, E_solid, D_solid, "3D Block Diagram (View: Looking 'into' block corner opposite Origin)")
# Set Standard illustrative diagram perspective (view into the box space, like a simplified Left Diagram)
# Azimuth looks from SE roughly, elevation 30
# Matplotlib non-inverted Down is Euclidean +z. To look *into* box from SE: elev=30, azim=-45. Looking NW-Down.
# The diagram in image_21.png Left view seems to be from roughly SE, above.
ax_3d_l = fig_3d_l.gca()
ax_3d_l.view_init(elev=30, azim=-45) # looks towards origin (step 6, far corner)
fig_3d_l.savefig('BlockDiagram_Left_Standard.png', dpi=150)
print("Saved BlockDiagram_Left_Standard.png")

# --- 4.3 3D Block Diagram (West View, constraint: "looking in towards the origin like in the example [image_22.png]") ---
fig_3d_r = plot_3d_block_diagram(N_dashed, E_dashed, D_dashed, N_solid, E_solid, D_solid, "3D Block Diagram (View: looking *in* towards the origin like image_22.png example)")
ax_3d_r = fig_3d_r.gca()

# User constraint: "looking in towards the origin like in the example [image_22.png]".
# Origin is step 6 (far corner).
# Looking directly *towards* step 6 from the front (Euclidean North=-3, East=-1, Down=-2).
# A pure West view is azimuth=-90. The diagram space is illustrative. Let's provide a clear
# oblique view looking *into* the volume towards the back-right-bottom corner (where step 6 is).
# Matplotlib uses N=x, E=y, Down=z non-inverted. Look towards +N, +E, +Down.
# View from opposite corner (S, W, Up Euclidean). -x, -y, +z (Down non-inverted).
# Elevated perspective, looking into the box volume. elev=20, azim=-120 (looking towards origin +N +E). OK.
ax_3d_r.view_init(elev=20, azim=-120) 
fig_3d_r.savefig('BlockDiagram_Right_ViewIntoVolume.png', dpi=150)
print("Saved BlockDiagram_Right_ViewIntoVolume.png")

# Show plots (if running interactively)
# plt.show()