import pytest
import os
import json
import numpy as np
import torch
from ecg_intelligence import CLASSES
from ecg_intelligence.models.classifier import build_torch_model
from ecg_intelligence.inference.validation import validate_inference_input
from ecg_intelligence.inference.postprocessing import apply_thresholds_and_format
from ecg_intelligence.inference.predictor import ECGPredictor


def test_validate_inference_input():
    sig = np.random.randn(1000, 12).astype(np.float32)
    assert validate_inference_input(sig) is not None

    with pytest.raises(ValueError):
        validate_inference_input(np.random.randn(1000, 8))


def test_apply_thresholds_and_format():
    probs = np.array([0.8, 0.2, 0.9, 0.1, 0.4])
    thresholds = {'CD': 0.5, 'HYP': 0.5, 'MI': 0.5, 'NORM': 0.5, 'STTC': 0.5}

    results = apply_thresholds_and_format(probs, thresholds)
    assert len(results) == 5
    # Should be sorted descending by probability
    assert results[0]['probability'] >= results[1]['probability']
    # Check top class is MI (0.9)
    assert results[0]['class'] == 'MI'
    assert results[0]['detected'] is True


def test_predictor_mock_artifacts(tmp_path):
    # Mock normalisation statistics
    norm_file = os.path.join(tmp_path, "norm.npz")
    np.savez(
        norm_file,
        mu=np.zeros(12, dtype=np.float32),
        sd=np.ones(12, dtype=np.float32),
        fm=np.zeros(139, dtype=np.float32),
        fs=np.ones(139, dtype=np.float32)
    )

    # Mock model weights
    net = build_torch_model(num_features=139, mode='gated')
    model_file = os.path.join(tmp_path, "model_gated.pt")
    torch.save(net.state_dict(), model_file)

    # Mock result file
    res_file = os.path.join(tmp_path, "result_gated.json")
    with open(res_file, "w") as f:
        json.dump({"thresholds": {c: 0.5 for c in CLASSES}}, f)

    predictor = ECGPredictor(cache_dir=str(tmp_path), mode='gated')
    dummy_ecg = np.random.randn(1000, 12).astype(np.float32)
    out = predictor.predict(dummy_ecg)

    assert "probabilities" in out
    assert "predictions" in out
    assert len(out["probabilities"]) == 5
    assert len(out["predictions"]) == 5
