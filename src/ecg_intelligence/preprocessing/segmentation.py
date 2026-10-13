"""
R-peak detection and RR-interval computation with robust failure fallbacks.
"""

from typing import Tuple
import numpy as np
from scipy import signal as sps
from .. import FS
from .filtering import bandpass_filter_lead2


def detect_r_peaks(
    signal_lead2: np.ndarray,
    distance_samples: int = int(0.25 * FS),
    height_ratio: float = 0.3,
    fs: int = FS
) -> np.ndarray:
    """
    Detects R-peaks on filtered lead II using energy envelope peak finding.
    Handles flatline, zero-energy, or noisy signals gracefully.
    """
    y = bandpass_filter_lead2(signal_lead2, fs=fs)
    max_val = y.max()
    if max_val <= 1e-7:
        return np.array([], dtype=int)

    peaks, _ = sps.find_peaks(y, distance=distance_samples, height=height_ratio * max_val)
    return peaks


def compute_rr_intervals(peaks: np.ndarray, fs: int = FS) -> np.ndarray:
    """
    Computes RR intervals in seconds from peak indices.
    Returns empty array if fewer than 2 peaks detected.
    """
    if len(peaks) < 2:
        return np.array([], dtype=np.float32)
    return (np.diff(peaks) / float(fs)).astype(np.float32)
