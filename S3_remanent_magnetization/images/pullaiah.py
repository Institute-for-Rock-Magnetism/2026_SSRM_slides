import numpy as np
import matplotlib.pyplot as plt

# ---------------------------------------------------------
# Physical Constants & Parameters
# ---------------------------------------------------------
Tc_C = 580.0                 # Curie temperature of magnetite in Celsius
Tc_K = Tc_C + 273.15         # Curie temperature in Kelvin
T_ref_K = 20.0 + 273.15      # Reference temperature (room temp, 20°C) in Kelvin
log10_C = 10.0               # Frequency factor exponent (C = 10^10 s^-1)

# ---------------------------------------------------------
# Spontaneous Magnetization Function Ms(T)
# ---------------------------------------------------------
def Ms_ratio(T_K):
    """
    Returns Ms(T) / Ms(T_ref) using a standard power law fit
    for magnetite (beta = 0.43).
    """
    frac = (Tc_K - T_K) / (Tc_K - T_ref_K)
    frac = np.clip(frac, 0.0, None)
    return frac ** 0.43

# ---------------------------------------------------------
# Nomogram Contour Calculation
# ---------------------------------------------------------
def calculate_log_tau(T_K, T_anchor_K, y_anchor):
    """
    Calculates log10(tau) along a contour defined by an anchor point (T_anchor, y_anchor).
    """
    ms_T = Ms_ratio(T_K)
    ms_anchor = Ms_ratio(T_anchor_K)
    
    if ms_anchor == 0:
        return np.full_like(T_K, -log10_C)
        
    numerator = (y_anchor + log10_C) * T_anchor_K * (ms_T ** 2)
    denominator = T_K * (ms_anchor ** 2)
    
    return (numerator / denominator) - log10_C

# ---------------------------------------------------------
# Plot Setup
# ---------------------------------------------------------
fig, ax1 = plt.subplots(figsize=(8.5, 6), dpi=150)

# Generate a dense array of temperature coordinates (in Celsius) up to near Tc
T_C = np.linspace(20, 579.9, 1000)
T_K = T_C + 273.15

# Define the anchor temperatures (in °C) where each contour crosses the bottom line (log10(tau) = 0)
T_bottoms = [60, 130, 210, 300, 390, 470, 520, 545, 555, 560]

# Plot each contour line
for T_b in T_bottoms:
    T_b_K = T_b + 273.15
    log_tau = calculate_log_tau(T_K, T_b_K, y_anchor=0.0)
    
    mask = (log_tau >= 0.0) & (log_tau <= 18.0)
    if np.any(mask):
        ax1.plot(T_C[mask], log_tau[mask], color='#922222', linewidth=1.5)

# Add Curie Temperature dashed line & label
ax1.axvline(x=Tc_C, color='black', linestyle='--', linewidth=1.5, alpha=0.8)
ax1.text(Tc_C - 8, 17.5, '$T_C$ Magnetite ($580^\circ$C)', rotation=90, 
         va='top', ha='right', fontsize=11, fontweight='bold', color='black')

# Formatting the primary X and Y axes
ax1.set_xlim(20, 600)
ax1.set_ylim(0, 18)

# Increased axis label sizes
ax1.set_xlabel('Temperature ( °C )', fontsize=14, labelpad=10)
ax1.set_ylabel('Relaxation time (seconds)', fontsize=14, labelpad=10)

# Main tick parameter metrics
ax1.tick_params(axis='both', labelsize=11)

# Format primary Y-axis tick labels as powers of 10
y_ticks = np.arange(0, 19, 2)
ax1.set_yticks(y_ticks)
ax1.set_yticklabels([f"$10^{{{int(y)}}}$" for y in y_ticks])

# Recreate thin black gridlines
ax1.grid(True, which='both', axis='y', linestyle='-', color='black', linewidth=0.5, alpha=0.6)
ax1.grid(False, axis='x')

# ---------------------------------------------------------
# Secondary Y-axis (Geological Time Scales)
# ---------------------------------------------------------
ax2 = ax1.twinx()
ax2.set_ylim(0, 18)

geo_ticks = [2.0, 3.56, 7.50, 10.50, 13.50, 16.50]
geo_labels = ["100 s", "1 hr", "1 yr", "1 kyr", "1 Myr", "1 Gyr"]

ax2.set_yticks(geo_ticks)
ax2.set_yticklabels(geo_labels)

# Match label size of secondary y-axis to the primary axis (size=11)
ax2.tick_params(axis='y', labelsize=11, length=5)

plt.tight_layout()
plt.savefig('pullaiah_magnetite.png')