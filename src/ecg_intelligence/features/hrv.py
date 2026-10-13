"""
Heart Rate Variability (HRV) and rhythm features extracted from Lead II.
"""

from typing import List
import numpy as np
from .. import FS
from ..preprocessing.segmentation import detect_r_peaks, compute_rr_intervals


def extract_hrv_features(lead_ii_signal: np.ndarray, fs: int = FS) -> List[float]:
    """
    Extracts 7 HRV and rhythm features from lead II:
    1. peak count (len(pk))
    2. mean RR (s)
    3. std RR (s)
    4. RMSSD (s) - root mean square of successive differences
    5. min RR (s)
    6. max RR (s)
    7. pNN50 - proportion of successive RR differences > 50 ms (0.05 s)

    If fewer than 2 peaks are detected, returns [len(pk), 0, 0, 0, 0, 0, 0].
    """
    peaks = detect_r_peaks(lead_ii_signal, fs=fs)
    rr = compute_rr_intervals(peaks, fs=fs)

    if len(rr) >= 2:
        diff_rr = np.diff(rr)
        mean_rr = float(np.mean(rr))
        std_rr = float(np.std(rr))
        rmssd = float(np.sqrt(np.mean(diff_rr ** 2)))
        min_rr = float(np.min(rr))
        max_rr = float(np.max(rr))
        pnn50 = float(np.mean(np.abs(diff_rr) > 0.05))

        return [float(len(peaks)), mean_rr, std_rr, rmssd, min_rr, max_rr, pnn50]
    else:
        return [float(len(peaks)), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
