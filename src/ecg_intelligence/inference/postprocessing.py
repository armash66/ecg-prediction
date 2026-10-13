"""
Post-processing of raw probabilities, threshold comparisons, and diagnostic formatting.
"""

from typing import Dict, Any, List
import numpy as np
from .. import CLASSES, CLASS_NAMES


def apply_thresholds_and_format(
    probabilities: np.ndarray,
    thresholds: Dict[str, float]
) -> List[Dict[str, Any]]:
    """
    Formats multi-label probabilities and detection flags into ordered result items.
    """
    results: List[Dict[str, Any]] = []
    for i, c in enumerate(CLASSES):
        prob = float(probabilities[i])
        thr = float(thresholds.get(c, 0.5))
        detected = bool(prob >= thr)
        results.append({
            'class': c,
            'name': CLASS_NAMES.get(c, c),
            'probability': prob,
            'threshold': thr,
            'detected': detected
        })

    # Sort descending by probability
    results.sort(key=lambda x: x['probability'], reverse=True)
    return results
