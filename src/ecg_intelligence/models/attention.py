"""
Soft temporal attention mechanism for dynamic weighting of ECG time frames.
"""

import torch
import torch.nn as nn


class TemporalAttention(nn.Module):
    """
    Computes learnable temporal attention weights:
    w = softmax(Linear(h), dim=1)
    out = sum(h * w, dim=1)
    """
    def __init__(self, in_features: int = 128):
        super().__init__()
        self.att_linear = nn.Linear(in_features, 1)

    def forward(self, h: torch.Tensor) -> torch.Tensor:
        """
        h: (B, T, in_features)
        Returns:
            context: (B, in_features)
        """
        scores = self.att_linear(h)               # (B, T, 1)
        weights = torch.softmax(scores, dim=1)    # (B, T, 1)
        context = (h * weights).sum(dim=1)        # (B, in_features)
        return context
