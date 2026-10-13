"""
1D Residual Network blocks and backbone for multi-lead ECG feature representation.
"""

import torch
import torch.nn as nn


class ResNet1DBlock(nn.Module):
    """
    Residual block for 1D ECG signals with projection shortcut.
    """
    def __init__(self, cin: int, cout: int, k: int = 7, stride: int = 1):
        super().__init__()
        self.c1 = nn.Conv1d(cin, cout, k, stride, k // 2, bias=False)
        self.b1 = nn.BatchNorm1d(cout)
        self.c2 = nn.Conv1d(cout, cout, k, 1, k // 2, bias=False)
        self.b2 = nn.BatchNorm1d(cout)
        self.sc = nn.Sequential(
            nn.Conv1d(cin, cout, 1, stride, bias=False),
            nn.BatchNorm1d(cout)
        )
        self.act = nn.ReLU()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = self.act(self.b1(self.c1(x)))
        h = self.b2(self.c2(h))
        return self.act(h + self.sc(x))


class ResNet1DBackbone(nn.Module):
    """
    1D ResNet stem and 3-stage residual stack:
    Input: (B, 12, 1000)
    Stem: Conv1D(12, 32, k=15, s=2) -> (B, 32, 500)
    Stage 1: Block(32, 64, s=2) -> (B, 64, 250)
    Stage 2: Block(64, 128, s=2) -> (B, 128, 125)
    Stage 3: Block(128, 128, s=2) -> (B, 128, 63)
    """
    def __init__(self, in_channels: int = 12, stem_channels: int = 32):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv1d(in_channels, stem_channels, 15, 2, 7, bias=False),
            nn.BatchNorm1d(stem_channels),
            nn.ReLU()
        )
        self.layers = nn.Sequential(
            ResNet1DBlock(stem_channels, 64, stride=2),
            ResNet1DBlock(64, 128, stride=2),
            ResNet1DBlock(128, 128, stride=2)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.layers(self.stem(x))  # (B, 128, T)
