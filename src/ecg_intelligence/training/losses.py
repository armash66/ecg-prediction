"""
Multi-label loss functions and class-imbalance weighting.
"""

from typing import Optional
import numpy as np
import torch
import torch.nn as nn


def compute_positive_weights(
    y_train: np.ndarray,
    max_clamp: float = 5.0,
    eps: float = 1e-6
) -> torch.Tensor:
    """
    Computes positive class weights: pos_weight = (1 - p) / (p + eps), clamped to max_clamp.
    Prevents gradient explosion on highly sparse diagnostic classes.
    """
    p = y_train.mean(axis=0)
    p = np.clip(p, eps, 1.0 - eps)
    weights = (1.0 - p) / p
    clamped_weights = np.clip(weights, 0.1, max_clamp)
    return torch.from_numpy(clamped_weights).float()


class MultiLabelBCEWithLogitsLoss(nn.Module):
    """
    Binary Cross-Entropy with Logits and per-class positive weighting.
    """
    def __init__(self, pos_weight: Optional[torch.Tensor] = None):
        super().__init__()
        self.criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        return self.criterion(logits, targets)
