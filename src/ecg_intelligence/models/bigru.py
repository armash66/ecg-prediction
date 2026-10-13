"""
Bidirectional Gated Recurrent Unit (BiGRU) with temporal attention aggregation.
"""

import torch
import torch.nn as nn
from .attention import TemporalAttention


class BiGRUSoftAttention(nn.Module):
    """
    Processes temporal feature maps (B, T, C) with a bidirectional GRU
    followed by softmax temporal attention pooling.
    """
    def __init__(self, in_dim: int = 128, hidden_dim: int = 64):
        super().__init__()
        self.gru = nn.GRU(in_dim, hidden_dim, batch_first=True, bidirectional=True)
        # Bidirectional hidden size = 64 * 2 = 128
        self.att = TemporalAttention(hidden_dim * 2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        x: (B, C, T) from convolutional backbone.
        Transposes to (B, T, C) for recurrent processing.
        Returns pooled embedding (B, 128).
        """
        # (B, C, T) -> (B, T, C)
        h, _ = self.gru(x.transpose(1, 2))
        # Temporal attention over time dimension
        out = self.att(h)
        return out
