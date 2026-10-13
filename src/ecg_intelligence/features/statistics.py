"""
Per-lead time-domain statistical features.
"""

from typing import List
import numpy as np
from scipy import stats


def extract_lead_statistics(lead_signal: np.ndarray) -> List[float]:
    """
    Extracts 6 core statistical moments and differential features for a single lead:
    1. mean
    2. standard deviation
    3. peak-to-peak amplitude (ptp)
    4. skewness
    5. kurtosis
    6. mean absolute successive difference (variation)
    """
    s = lead_signal
    mean_val = float(np.mean(s))
    std_val = float(np.std(s))
    ptp_val = float(np.ptp(s))
    skew_val = float(stats.skew(s))
    kurt_val = float(stats.kurtosis(s))
    diff_val = float(np.mean(np.abs(np.diff(s))))

    return [mean_val, std_val, ptp_val, skew_val, kurt_val, diff_val]
