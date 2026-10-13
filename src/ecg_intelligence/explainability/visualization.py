"""
Matplotlib visualization routines for 12-lead ECGs and attribution heatmaps.
"""

from typing import Optional
import numpy as np
import matplotlib
import matplotlib.pyplot as plt
from .. import LEADS, FS


def plot_12_lead_ecg(sig: np.ndarray, fs: int = FS) -> plt.Figure:
    """
    Renders 6x2 layout for standard 12-lead ECG.
    sig: (1000, 12)
    """
    fig, axes = plt.subplots(6, 2, figsize=(12, 8), sharex=True)
    t = np.arange(len(sig)) / float(fs)
    for l, ax in enumerate(axes.T.flatten()):
        ax.plot(t, sig[:, l], color='#111827', lw=0.7)
        ax.set_ylabel(LEADS[l], rotation=0, labelpad=14, fontsize=9, fontweight='bold')
        ax.set_yticks([])
        ax.grid(True, linestyle=':', alpha=0.5)
    axes[5, 0].set_xlabel('Time (s)', fontsize=9)
    axes[5, 1].set_xlabel('Time (s)', fontsize=9)
    fig.tight_layout()
    return fig


def plot_attribution_lead(
    sig: np.ndarray,
    ig_lead: np.ndarray,
    lead_idx: int,
    title: str,
    fs: int = FS
) -> plt.Figure:
    """
    Overlays attribution intensity heatmap onto single ECG lead waveform.
    """
    t = np.arange(len(sig)) / float(fs)
    fig, ax = plt.subplots(figsize=(12, 3))
    ax.plot(t, sig[:, lead_idx], color='#111827', lw=0.8)

    # Normalize attribution intensity to [0, 1]
    a = np.abs(ig_lead)
    a_norm = a / (a.max() + 1e-9)

    ax.imshow(
        a_norm[None, :],
        aspect='auto',
        cmap='Reds',
        alpha=0.45,
        extent=[0, t[-1], sig[:, lead_idx].min(), sig[:, lead_idx].max()]
    )
    ax.set_title(title, fontsize=10, fontweight='bold')
    ax.set_xlabel('Time (seconds)', fontsize=9)
    ax.set_ylabel('Amplitude (mV)', fontsize=9)
    ax.grid(True, linestyle=':', alpha=0.4)
    fig.tight_layout()
    return fig
