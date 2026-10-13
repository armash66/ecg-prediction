"""
Fusion mechanisms: Concatenation baseline and proposed Adaptive Gated Fusion.
"""

from typing import Tuple, Optional
import torch
import torch.nn as nn


class ConcatenationFusionModule(nn.Module):
    """
    Standard multimodal concatenation baseline:
    z = [deep, feat] of dimension 128 + 64 = 192.
    """
    def __init__(self):
        super().__init__()

    def forward(self, deep_emb: torch.Tensor, feat_emb: torch.Tensor) -> torch.Tensor:
        return torch.cat([deep_emb, feat_emb], dim=1)


class GatedFusionModule(nn.Module):
    """
    Adaptive Gated Fusion mechanism:
    Projects deep representation (128) and handcrafted feature representation (64)
    into a common latent space (96). Computes an adaptive gate vector g in [0, 1]^96:
        g = Sigmoid(Linear([deep, feat]))
        z = g * tanh(Wd * deep) + (1 - g) * tanh(Wf * feat)
    """
    def __init__(self, deep_dim: int = 128, feat_dim: int = 64, proj_dim: int = 96):
        super().__init__()
        self.pd = nn.Linear(deep_dim, proj_dim)
        self.pf = nn.Linear(feat_dim, proj_dim)
        self.gate = nn.Sequential(
            nn.Linear(deep_dim + feat_dim, proj_dim),
            nn.Sigmoid()
        )
        self.last_gate: Optional[torch.Tensor] = None

    def forward(self, deep_emb: torch.Tensor, feat_emb: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        concat_emb = torch.cat([deep_emb, feat_emb], dim=1)
        g = self.gate(concat_emb)
        self.last_gate = g.detach()
        z = g * torch.tanh(self.pd(deep_emb)) + (1.0 - g) * torch.tanh(self.pf(feat_emb))
        return z, g
