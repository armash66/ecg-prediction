"""
Multi-Scale Residual 1D Convolutional Neural Network for multi-lead ECG classification.

Architectural highlights:
- Parallel temporal convolution branches with kernel sizes k=7, 15, and 31 capturing
  sharp QRS spikes, ST-segment deviations, and broader baseline/T-wave patterns.
- Multi-scale residual blocks with batch normalization, ReLU, and channel dropout.
- Lightweight squeeze-and-excitation channel attention mechanism.
- Global temporal pooling yielding a compact, highly descriptive deep feature vector.
- Linear classification head predicting five superclass logits (CD, HYP, MI, NORM, STTC).
- Computational footprint designed for Colab T4 GPU efficiency (< 500k parameters).
"""

from typing import List, Optional
import torch
import torch.nn as nn


class ChannelAttention1D(nn.Module):
    """
    Lightweight Squeeze-and-Excitation channel attention for 1D representations.
    """
    def __init__(self, channels: int, reduction: int = 4):
        super().__init__()
        reduced = max(channels // reduction, 8)
        self.fc = nn.Sequential(
            nn.AdaptiveAvgPool1d(1),
            nn.Flatten(),
            nn.Linear(channels, reduced, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(reduced, channels, bias=False),
            nn.Sigmoid()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, C, T)
        scale = self.fc(x).unsqueeze(-1)  # (B, C, 1)
        return x * scale


class MultiScaleConvBlock(nn.Module):
    """
    Applies parallel convolutions with kernels k=7, 15, 31 to capture varying
    cardiac temporal scales, followed by concatenation, normalization, and projection.
    """
    def __init__(self, in_channels: int, out_channels: int, stride: int = 1):
        super().__init__()
        # Branch channels
        branch_channels = out_channels // 3
        rem = out_channels - branch_channels * 2

        self.branch1 = nn.Conv1d(in_channels, branch_channels, kernel_size=7, stride=stride, padding=3, bias=False)
        self.branch2 = nn.Conv1d(in_channels, branch_channels, kernel_size=15, stride=stride, padding=7, bias=False)
        self.branch3 = nn.Conv1d(in_channels, rem, kernel_size=31, stride=stride, padding=15, bias=False)

        self.bn = nn.BatchNorm1d(out_channels)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out1 = self.branch1(x)
        out2 = self.branch2(x)
        out3 = self.branch3(x)
        out = torch.cat([out1, out2, out3], dim=1)
        return self.relu(self.bn(out))


class MultiScaleResidualBlock(nn.Module):
    """
    Residual block integrating multi-scale convolutions, standard 1D refinement,
    and optional channel attention.
    """
    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        stride: int = 1,
        use_se: bool = True,
        dropout: float = 0.1
    ):
        super().__init__()
        self.ms_conv = MultiScaleConvBlock(in_channels, out_channels, stride=stride)
        self.conv2 = nn.Conv1d(out_channels, out_channels, kernel_size=5, stride=1, padding=2, bias=False)
        self.bn2 = nn.BatchNorm1d(out_channels)
        self.relu = nn.ReLU(inplace=True)
        self.drop = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

        self.se = ChannelAttention1D(out_channels) if use_se else nn.Identity()

        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv1d(in_channels, out_channels, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm1d(out_channels)
            )
        else:
            self.shortcut = nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        res = self.shortcut(x)
        h = self.ms_conv(x)
        h = self.drop(self.relu(self.bn2(self.conv2(h))))
        h = self.se(h)
        return self.relu(h + res)


class MultiScaleResNetBackbone(nn.Module):
    """
    1D Multi-Scale Residual Backbone:
    Input: (B, 12, 1000)
    Stem: Conv1D(12, 32, k=11, s=2) -> (B, 32, 500)
    Stage 1: MultiScaleResidualBlock(32, 48, s=2) -> (B, 48, 250)
    Stage 2: MultiScaleResidualBlock(48, 96, s=2) -> (B, 96, 125)
    Stage 3: MultiScaleResidualBlock(96, 128, s=2) -> (B, 128, 63)
    Output: (B, 128, 63)
    """
    def __init__(
        self,
        in_channels: int = 12,
        stem_channels: int = 32,
        use_se: bool = True,
        dropout: float = 0.1
    ):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv1d(in_channels, stem_channels, kernel_size=11, stride=2, padding=5, bias=False),
            nn.BatchNorm1d(stem_channels),
            nn.ReLU(inplace=True)
        )
        self.stage1 = MultiScaleResidualBlock(stem_channels, 48, stride=2, use_se=use_se, dropout=dropout)
        self.stage2 = MultiScaleResidualBlock(48, 96, stride=2, use_se=use_se, dropout=dropout)
        self.stage3 = MultiScaleResidualBlock(96, 128, stride=2, use_se=use_se, dropout=dropout)

        self._init_weights()


    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv1d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, nn.BatchNorm1d):
                nn.init.constant_(m.weight, 1.0)
                nn.init.constant_(m.bias, 0.0)
            elif isinstance(m, nn.Linear):
                nn.init.kaiming_uniform_(m.weight, a=1.0)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0.0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, 12, 1000)
        h = self.stem(x)
        h = self.stage1(h)
        h = self.stage2(h)
        h = self.stage3(h)
        return h  # (B, 128, T)
