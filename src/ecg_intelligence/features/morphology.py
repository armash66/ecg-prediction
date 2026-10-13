"""
Morphological ECG features (QRS width, ST elevation estimation, R peak height).
"""

from typing import List, Dict
import numpy as np


def extract_morphology_features(lead_signal: np.ndarray, r_peaks: np.ndarray) -> Dict[str, float]:
    """
    Computes summary morphology indicators across detected beats in a lead.
    Fallback to zeros if no beats are detected.
    """
    if len(r_peaks) == 0:
        return {'mean_r_amp': 0.0, 'std_r_amp': 0.0}

    valid_peaks = [p for p in r_peaks if 0 <= p < len(lead_signal)]
    if not valid_peaks:
        return {'mean_r_amp': 0.0, 'std_r_amp': 0.0}

    r_amps = lead_signal[valid_peaks]
    return {
        'mean_r_amp': float(np.mean(r_amps)),
        'std_r_amp': float(np.std(r_amps))
    }
