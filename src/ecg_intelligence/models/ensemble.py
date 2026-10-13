"""
Probability-level weighted ensembling between Deep Neural Networks and XGBoost.
"""

from typing import Tuple
import numpy as np


class EnsemblePredictor:
    """
    Combines predicted probabilities via weighted linear blend:
    p_ens = w_deep * p_deep + (1 - w_deep) * p_xgb
    Default weights: 0.6 deep + 0.4 XGBoost.
    """
    def __init__(self, deep_weight: float = 0.6, xgb_weight: float = 0.4):
        total = deep_weight + xgb_weight
        self.w_deep = deep_weight / total
        self.w_xgb = xgb_weight / total

    def blend(self, p_deep: np.ndarray, p_xgb: np.ndarray) -> np.ndarray:
        if p_deep.shape != p_xgb.shape:
            raise ValueError(f"Shape mismatch: {p_deep.shape} vs {p_xgb.shape}")
        return (self.w_deep * p_deep + self.w_xgb * p_xgb).astype(np.float32)
