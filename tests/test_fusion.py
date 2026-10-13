import pytest
import torch
from ecg_intelligence.models.fusion import GatedFusionModule, ConcatenationFusionModule


def test_concatenation_fusion():
    B = 4
    ed = torch.randn(B, 128)
    ef = torch.randn(B, 64)

    concat_mod = ConcatenationFusionModule()
    z = concat_mod(ed, ef)
    assert z.shape == (B, 192)


def test_gated_fusion_behavior():
    B = 8
    ed = torch.randn(B, 128)
    ef = torch.randn(B, 64)

    gated_mod = GatedFusionModule(deep_dim=128, feat_dim=64, proj_dim=96)
    z, g = gated_mod(ed, ef)

    assert z.shape == (B, 96)
    assert g.shape == (B, 96)
    # Check that gate is bounded strictly in [0, 1]
    assert (g >= 0.0).all() and (g <= 1.0).all()
    # Check that last_gate was recorded
    assert gated_mod.last_gate is not None
