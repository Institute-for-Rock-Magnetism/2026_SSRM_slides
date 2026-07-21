import numpy as np
import matplotlib.pyplot as plt

# Set style for clean, modern academic presentation
plt.rcParams['font.sans-serif'] = 'Arial'
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['axes.edgecolor'] = '#cbd5e1'
plt.rcParams['axes.linewidth'] = 1.2
plt.rcParams['xtick.color'] = '#475569'
plt.rcParams['ytick.color'] = '#475569'

# Define parameters
t_over_tau = np.linspace(0, 5, 500)
M_o = 1.0   # Ancient primary magnetization
M_e = -0.4  # Equilibrium in the modern Earth's field

# Equation: M(t) = M_e + (M_o - M_e) * e^(-t/tau)
M_t = M_e + (M_o - M_e) * np.exp(-t_over_tau)

# Create figure
fig, ax = plt.subplots(figsize=(6.5, 4.2), dpi=300)

# Shade regions based on the t/tau filter
# Stable Region (t/tau < 0.1, or t << tau)
ax.axvspan(0, 0.1, color='#e0f2fe', alpha=0.6, label='Stable Single Domain (SSD)')
# Transition Region
ax.axvspan(0.1, 2.5, color='#f8fafc', alpha=1.0)
# Viscous Region (t/tau > 2.5, or t >> tau)
ax.axvspan(2.5, 5.0, color='#ffedd5', alpha=0.6, label='Viscous Remanent Magnetization (VRM)')

# Plot the relaxation curve
ax.plot(t_over_tau, M_t, color='#0f172a', linewidth=2.5, label='Magnetization $M(t)$')

# Add labels for regions directly onto the plot (completely clear of the curve line)
# Stable region label: shifted to x=0.5, y=0.8
ax.text(0.5, 0.8, 'Stable remanence\n(preserves $M_o$)', color='#0369a1', fontsize=9, fontweight='bold', ha='left', va='center')

# Viscous region label: placed at x=3.75, y=0.1
ax.text(3.75, 0.1, 'Viscous remanence\n(92% overprinted by $M_e$)', color='#c2410c', fontsize=9, fontweight='bold', ha='center', va='center')

# Labels and styling
ax.set_xlabel('Exposure Time / Relaxation Time ($t / \\tau$)', fontsize=10, fontweight='bold', color='#1e293b', labelpad=8)
ax.set_ylabel('Normalized Magnetization $M(t)$', fontsize=10, fontweight='bold', color='#1e293b', labelpad=8)

# Set ticks and limits
ax.set_xlim(0, 5)
ax.set_ylim(-0.6, 1.1)
ax.set_yticks([M_e, 0, M_o])
ax.set_yticklabels(['$M_e$ (Modern)', '0', '$M_o$ (Ancient)'], fontsize=9)
ax.set_xticks([0, 1, 2, 3, 4, 5])
ax.set_xticklabels(['0', '1', '2', '3', '4', '5'], fontsize=9)

# Clean up axes (despine top and right)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.grid(True, linestyle=':', alpha=0.5, color='#cbd5e1')

plt.tight_layout()
plt.savefig('VRM_acquisition.png', bbox_inches='tight', transparent=True)