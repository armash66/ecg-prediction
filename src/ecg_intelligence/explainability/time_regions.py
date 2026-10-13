"""
Temporal region attribution ranking and interval analysis.
"""

from typing import List, Dict, Any, Tuple
import numpy as np
from .. import LEADS, FS


def extract_top_time_regions(
    attribution_map: np.ndarray,
    window_size: int = 15,
    num_regions: int = 5,
    fs: int = FS
) -> List[Dict[str, Any]]:
    """
    Ranks temporal intervals based on integrated attribution magnitude across all 12 leads.
    Non-overlapping window search prevents redundant adjacent intervals.

    Args:
        attribution_map: (12, T) signed attribution array.
        window_size: Window duration in samples (default 15 samples = 150ms at 100Hz).
        num_regions: Number of top regions to extract.
        fs: Sampling frequency in Hz.

    Returns:
        List of dicts containing interval timing, attribution magnitude,
        dominant lead, and lead breakdown.
    """
    if attribution_map.ndim != 2 or attribution_map.shape[0] != 12:
        raise ValueError(f"Expected attribution map shape (12, T), got {attribution_map.shape}")

    total_len = attribution_map.shape[1]
    # Sum absolute attribution across all 12 leads per time step
    temporal_mag = np.abs(attribution_map).sum(axis=0)  # (T,)

    # Convolve with rectangular window to find window sums
    kernel = np.ones(window_size)
    window_sums = np.convolve(temporal_mag, kernel, mode='valid')  # length: T - window_size + 1

    regions: List[Dict[str, Any]] = []
    # Mask to prevent selecting overlapping windows
    occupied = np.zeros(total_len, dtype=bool)

    # Greedily pick highest magnitude non-overlapping windows
    sorted_indices = np.argsort(window_sums)[::-1]

    for start_idx in sorted_indices:
        if len(regions) >= num_regions:
            break
        end_idx = start_idx + window_size
        # Check overlap
        if np.any(occupied[start_idx:end_idx]):
            continue

        # Mark as occupied
        occupied[start_idx:end_idx] = True

        window_attr = attribution_map[:, start_idx:end_idx]
        lead_mags = np.abs(window_attr).sum(axis=1)
        total_window_mag = float(np.sum(lead_mags))
        top_lead_idx = int(np.argmax(lead_mags))

        lead_breakdown = {
            LEADS[l]: float(lead_mags[l]) for l in range(12)
        }

        regions.append({
            "rank": len(regions) + 1,
            "start_sample": int(start_idx),
            "end_sample": int(end_idx),
            "start_sec": round(float(start_idx) / fs, 3),
            "end_sec": round(float(end_idx) / fs, 3),
            "duration_ms": int((window_size / fs) * 1000),
            "magnitude": round(total_window_mag, 5),
            "dominant_lead": LEADS[top_lead_idx],
            "dominant_lead_pct": round(float(lead_mags[top_lead_idx] / (total_window_mag + 1e-9)) * 100, 1),
            "lead_breakdown": lead_breakdown,
        })

    return regions
