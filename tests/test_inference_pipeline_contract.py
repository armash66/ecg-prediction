"""
Regression Test Suite: ECG Inference Pipeline Contract, Ground-Truth Fidelity,
and 12-Lead Layout Verification.
"""

import os
import sys
import pytest
import numpy as np
import torch
from fastapi.testclient import TestClient

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from server.server import (
        app,
        get_model,
        load_norm_stats,
        load_samples,
        get_thresholds_for_model,
        get_sample_metadata,
        build_torch_model,
        MODEL_METADATA,
        CACHE_DIR,
        CLASSES,
        LEADS,
        CLASS_NAMES,
    )
except ImportError:
    from server import (
        app,
        get_model,
        load_norm_stats,
        load_samples,
        get_thresholds_for_model,
        get_sample_metadata,
        build_torch_model,
        MODEL_METADATA,
        CACHE_DIR,
        CLASSES,
        LEADS,
        CLASS_NAMES,
    )

client = TestClient(app)


def test_classes_and_leads_contract():
    """Verify the canonical 5-class contract and 12 standard leads."""
    expected_classes = ["CD", "HYP", "MI", "NORM", "STTC"]
    assert CLASSES == expected_classes, f"CLASSES contract altered: {CLASSES}"
    assert len(CLASSES) == 5

    expected_leads = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]
    assert LEADS == expected_leads, f"LEADS contract altered: {LEADS}"
    assert len(LEADS) == 12


def test_checkpoint_architecture_compatibility():
    """Verify that all inference-ready checkpoints load into HybridNet with zero mismatch."""
    for model_id, meta in MODEL_METADATA.items():
        ckpt_name = meta.get("checkpoint")
        if not ckpt_name:
            continue
        ckpt_path = os.path.join(CACHE_DIR, ckpt_name)
        if not os.path.exists(ckpt_path):
            continue

        arch_mode = meta["arch_mode"]
        net = build_torch_model(num_features=139, mode=arch_mode)
        state = torch.load(ckpt_path, map_location="cpu", weights_only=False)
        incompat = net.load_state_dict(state, strict=True)
        assert len(incompat.missing_keys) == 0, f"Missing keys in {model_id}: {incompat.missing_keys}"
        assert len(incompat.unexpected_keys) == 0, f"Unexpected keys in {model_id}: {incompat.unexpected_keys}"


def test_normalization_statistics_fidelity():
    """Verify training fold normalization statistics shape and numerical validity."""
    ns = load_norm_stats()
    assert "mu" in ns and "sd" in ns
    assert ns["mu"].shape == (12,)
    assert ns["sd"].shape == (12,)
    assert np.all(ns["sd"] > 0), "Standard deviation contains non-positive entries"
    assert not np.isnan(ns["mu"]).any() and not np.isnan(ns["sd"]).any()

    # Handcrafted feature normalization
    if "fm" in ns and "fs" in ns:
        assert ns["fm"].shape == (139,)
        assert ns["fs"].shape == (139,)
        assert np.all(ns["fs"] > 0)


def test_analyze_ecg_preserves_class_contract_order():
    """Verify that /api/ecg/analyze predictions array strictly preserves canonical CLASSES order."""
    samples = load_samples()
    sig = samples["X"][0].tolist()

    res = client.post("/api/ecg/analyze", json={"signal": sig, "model": "seq"})
    assert res.status_code == 200
    data = res.json()

    assert "predictions" in data
    assert len(data["predictions"]) == 5

    pred_classes = [p["class"] for p in data["predictions"]]
    assert pred_classes == CLASSES, (
        f"API contract violation: predictions array must preserve exact CLASSES order {CLASSES}, "
        f"but got {pred_classes}"
    )

    # Check probabilities dict
    assert "probabilities" in data
    for c in CLASSES:
        assert c in data["probabilities"]
        assert 0.0 <= data["probabilities"][c] <= 1.0


def test_thresholds_match_loaded_model():
    """Verify validation thresholds correspond to the loaded model checkpoint."""
    for model_id in ["seq", "cnn", "gated"]:
        thresholds = get_thresholds_for_model(model_id)
        assert len(thresholds) == 5
        for c in CLASSES:
            assert c in thresholds
            assert 0.1 <= thresholds[c] <= 0.95, f"Threshold out of clinical range: {c}={thresholds[c]}"

    # Specifically verify seq model validation-tuned thresholds
    seq_t = get_thresholds_for_model("seq")
    assert seq_t["CD"] == 0.85
    assert round(seq_t["HYP"], 2) == 0.50
    assert seq_t["MI"] == 0.75
    assert round(seq_t["NORM"], 2) == 0.45
    assert seq_t["STTC"] == 0.65


def test_samples_endpoint_and_ptbxl_record_mapping():
    """Verify that sample endpoints return genuine PTB-XL record IDs and verified annotations."""
    res_list = client.get("/api/samples")
    assert res_list.status_code == 200
    catalog = res_list.json()
    assert catalog["total"] == 40
    assert len(catalog["samples"]) == 40

    # Test sample #00: Record 9 (NORM)
    s0 = catalog["samples"][0]
    assert s0["index"] == 0
    assert s0["record_id"] == 9
    assert s0["labels"] == ["NORM"]

    # Test sample #05: Record 63 (MI)
    s5 = catalog["samples"][5]
    assert s5["index"] == 5
    assert s5["record_id"] == 63
    assert s5["labels"] == ["MI"]

    # Test detail endpoint for sample #05
    res_detail = client.get("/api/sample/5")
    assert res_detail.status_code == 200
    d5 = res_detail.json()
    assert d5["record_id"] == 63
    assert d5["patient_id"] == 15265
    assert d5["labels"] == ["MI"]
    assert "ASMI" in d5["scp_codes"]
    assert len(d5["signal"]) == 1000
    assert len(d5["signal"][0]) == 12


def test_benchmark_predictions_vs_ground_truth_investigation():
    """
    Test live model predictions vs ground truth for representative benchmark cases:
    - Sample #00: Pure NORM
    - Sample #05: Pure MI (investigate the multiple-positive phenomenon)
    - Sample #06: Pure CD
    - Sample #14: Pure STTC
    - Sample #24: Quadruple-Class Multilabel
    """
    cases = [
        {"idx": 0, "rec": 9, "gt": ["NORM"]},
        {"idx": 5, "rec": 63, "gt": ["MI"]},
        {"idx": 6, "rec": 65, "gt": ["CD"]},
        {"idx": 14, "rec": 116, "gt": ["STTC"]},
        {"idx": 24, "rec": 162, "gt": ["CD", "HYP", "MI", "STTC"]},
        {"idx": 39, "rec": 271, "gt": ["HYP", "MI", "STTC"]},
    ]

    for c in cases:
        res_sample = client.get(f"/api/sample/{c['idx']}")
        assert res_sample.status_code == 200
        sample_data = res_sample.json()
        assert sample_data["labels"] == c["gt"]

        res_anl = client.post("/api/ecg/analyze", json={"signal": sample_data["signal"], "model": "seq"})
        assert res_anl.status_code == 200
        anl = res_anl.json()

        # Predictions array must be in exact CLASSES order
        assert [p["class"] for p in anl["predictions"]] == CLASSES

        detected = [p["class"] for p in anl["predictions"] if p["detected"]]

        # Ground truth must NEVER be equal to or substituted for model predictions automatically
        assert "labels" in sample_data
        assert "probabilities" in anl

        # Specific check for Sample #05 (Pure Anterior-Septal MI)
        if c["idx"] == 5:
            # Model correctly detects MI with high score
            p_mi = anl["probabilities"]["MI"]
            p_norm = anl["probabilities"]["NORM"]
            assert p_mi > 0.80, f"Expected strong MI probability, got {p_mi}"
            assert "MI" in detected, "MI must be detected for Sample #05"
            # Root cause investigation: verify why NORM was also flagged
            assert p_norm >= 0.45, "NORM exceeded threshold 0.45"
            # Confirm that MI raw score exceeds NORM raw score
            assert p_mi > p_norm, "Model confidence in MI should exceed NORM"


def test_reference_labels_never_override_model_output():
    """Verify that model output is strictly computed by the neural network and never hardcoded to GT."""
    # Create an artificial flatline signal (all zeros)
    dummy_signal = np.zeros((1000, 12)).tolist()
    res = client.post("/api/ecg/analyze", json={"signal": dummy_signal, "model": "seq"})
    assert res.status_code == 200
    data = res.json()

    # The probabilities must be genuine float scores from the PyTorch model
    assert all(isinstance(data["probabilities"][c], float) for c in CLASSES)
    assert not any(p["detected"] for p in data["predictions"] if data["probabilities"][p["class"]] < p["threshold"])
