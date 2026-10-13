"""
Multi-layer perceptron (MLP) for embedding handcrafted feature vectors.
"""

import torch
import torch.nn as nn


class HandcraftedFeatureEncoder(nn.Module):
    """
    Projects 139-dimensional handcrafted ECG features into a compact 64-dimensional embedding:
    Linear(nf, 128) -> BatchNorm1d -> ReLU -> Dropout(0.3) -> Linear(128, 64) -> ReLU
    """
    def __init__(self, in_features: int = 139, hidden_dim: int = 128, out_dim: int = 64, dropout: float = 0.3):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(in_features, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, out_dim),
            nn.ReLU()
        )

    def forward(self, f: torch.Tensor) -> torch.Tensor:
        return self.encoder(f)
