"""
Master handcrafted feature extractor assembling 139-dimensional feature representation.
"""

from typing import List
import numpy as np
from joblib import Parallel, delayed
from .wavelets import extract_wavelet_energies
from .statistics import extract_lead_statistics
from .hrv import extract_hrv_features


def extract_handcrafted_features(x: np.ndarray) -> np.ndarray:
    """
    Extracts handcrafted features from a 12-lead ECG signal of shape (1000, 12).
    - 12 leads x (6 statistics + 5 wavelet relative energies) = 132 features
    - 7 HRV rhythm features from Lead II (index 1)
    Total = 139 features.

    Returns:
        f: np.ndarray of shape (139,), dtype float32, NaN/Inf safely replaced.
    """
    f: List[float] = []

    # 1. Per-lead statistics and wavelets
    for l in range(12):
        s = x[:, l]
        # 6 statistics
        f.extend(extract_lead_statistics(s))
        # 5 wavelet subband energies (db4 level 4)
        f.extend(extract_wavelet_energies(s, wavelet_name='db4', level=4))

    # 2. Lead II rhythm / HRV features
    lead2 = x[:, 1]
    f.extend(extract_hrv_features(lead2))

    arr = np.array(f, dtype=np.float32)
    return np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)


def extract_all_features(X: np.ndarray, n_jobs: int = -1) -> np.ndarray:
    """
    Extracts handcrafted features in parallel across an array of signals of shape (N, 1000, 12).
    Returns array F of shape (N, 139).
    """
    features = Parallel(n_jobs=n_jobs)(
        delayed(extract_handcrafted_features)(x) for x in X
    )
    return np.stack(features).astype(np.float32)
