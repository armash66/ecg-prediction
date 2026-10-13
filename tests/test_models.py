import pytest
import torch
from ecg_intelligence.models.classifier import build_torch_model
from ecg_intelligence.models.xgboost_model import MultiLabelXGBoost
from ecg_intelligence.models.ensemble import EnsemblePredictor
import numpy as np


def test_models_forward_shapes():
    B = 4
    x = torch.randn(B, 12, 1000)
    f = torch.randn(B, 139)

    modes = ['cnn', 'multiscale', 'seq', 'feat', 'hybrid', 'gated']
    for mode in modes:
        net = build_torch_model(num_features=139, mode=mode, num_classes=5)
        out = net(x if mode != 'feat' else None, f if mode in ('feat', 'hybrid', 'gated') else None)
        assert out.shape == (B, 5), f"Failed shape check for mode {mode}"


def test_multiscale_model_details():
    B = 2
    x = torch.randn(B, 12, 1000)
    net = build_torch_model(num_features=139, mode='multiscale', num_classes=5, use_se=True, dropout=0.2)
    out = net(x)
    assert out.shape == (B, 5)

    # Check parameter count is reasonable for Colab T4 (< 600,000 params)
    n_params = sum(p.numel() for p in net.parameters())
    assert 50_000 < n_params < 600_000, f"Expected 50k-600k params, got {n_params}"




def test_xgboost_fit_predict():
    N = 50
    F = np.random.randn(N, 139).astype(np.float32)
    Y = (np.random.rand(N, 5) > 0.5).astype(np.float32)

    xgb_clf = MultiLabelXGBoost(params={'n_estimators': 5, 'max_depth': 2, 'n_jobs': 1})
    xgb_clf.fit(F, Y)
    probs = xgb_clf.predict_proba(F)

    assert probs.shape == (N, 5)
    assert np.all((probs >= 0.0) & (probs <= 1.0))


def test_ensemble_predictor():
    N = 10
    p_deep = np.full((N, 5), 0.8, dtype=np.float32)
    p_xgb = np.full((N, 5), 0.4, dtype=np.float32)

    ens = EnsemblePredictor(deep_weight=0.6, xgb_weight=0.4)
    blended = ens.blend(p_deep, p_xgb)

    assert blended.shape == (N, 5)
    expected_val = 0.6 * 0.8 + 0.4 * 0.4
    assert np.allclose(blended, expected_val, atol=1e-5)
