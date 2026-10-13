"""
Multi-label 2x2 confusion matrices per diagnostic class.
"""

from typing import Dict, List
import numpy as np
from sklearn.metrics import confusion_matrix
from .. import CLASSES


def compute_multilabel_confusion(
    y_true: np.ndarray,
    predictions: np.ndarray
) -> Dict[str, List[List[int]]]:
    """
    Computes per-class [[TN, FP], [FN, TP]] confusion matrices.
    """
    cms: Dict[str, List[List[int]]] = {}
    for i, c in enumerate(CLASSES):
        cm = confusion_matrix(y_true[:, i], predictions[:, i], labels=[0, 1])
        cms[c] = cm.tolist()
    return cms
