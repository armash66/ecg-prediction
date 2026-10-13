"""
ECG signal preprocessing, filtering, normalisation, resampling, and data augmentation.
"""

from .filtering import bandpass_filter_lead2, filter_signal
from .normalization import compute_norm_stats, normalize_signals, normalize_features
from .resampling import ensure_1000x12, resample_signal
from .segmentation import detect_r_peaks, compute_rr_intervals
from .augmentation import apply_ecg_augmentation

__all__ = [
    "bandpass_filter_lead2",
    "filter_signal",
    "compute_norm_stats",
    "normalize_signals",
    "normalize_features",
    "ensure_1000x12",
    "resample_signal",
    "detect_r_peaks",
    "compute_rr_intervals",
    "apply_ecg_augmentation"
]
