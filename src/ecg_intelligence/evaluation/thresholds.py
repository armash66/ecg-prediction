"""
Decision threshold optimization strictly tuned on validation fold 9.
"""

from typing import Dict, List, Tuple
import numpy as np
from sklearn.metrics import f1_score
from .. import CLASSES


def optimize_thresholds_on_val(
    y_val: np.ndarray,
    p_val: np.ndarray,
    threshold_grid: np.ndarray = np.linspace(0.05, 0.95, 19)
) -> Dict[str, float]:
    """
    Selects optimal F1 threshold per class strictly on validation fold 9.
    Test fold 10 is NEVER accessed for threshold tuning.
    """
    best_thresholds: Dict[str, float] = {}
    for i, c in enumerate(CLASSES):
        scores = []
        for t in threshold_grid:
            pred = (p_val[:, i] > t).astype(int)
            scores.append(f1_score(y_val[:, i], pred, zero_division=0))
        best_t = float(threshold_grid[np.argmax(scores)])
        best_thresholds[c] = best_t

    return best_thresholds
