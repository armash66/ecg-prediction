"""
Expected Calibration Error (ECE) for multi-label confidence estimation.
"""

from typing import Dict
import numpy as np
from .. import CLASSES


def compute_expected_calibration_error(
    y_true: np.ndarray,
    probs: np.ndarray,
    n_bins: int = 10
) -> Dict[str, float]:
    """
    Computes per-class ECE across evenly spaced probability bins.
    """
    bin_limits = np.linspace(0, 1, n_bins + 1)
    ece_scores: Dict[str, float] = {}

    for i, c in enumerate(CLASSES):
        y_c = y_true[:, i]
        p_c = probs[:, i]
        ece = 0.0

        for b in range(n_bins):
            mask = (p_c >= bin_limits[b]) & (p_c < bin_limits[b + 1])
            if mask.sum() > 0:
                acc = np.mean(y_c[mask])
                conf = np.mean(p_c[mask])
                ece += (mask.sum() / len(y_c)) * np.abs(acc - conf)

        ece_scores[c] = float(ece)

    return ece_scores
