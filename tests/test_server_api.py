import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import pytest
import numpy as np
from fastapi.testclient import TestClient
from server.server import app
from ecg_intelligence import CLASSES, LEADS

client = TestClient(app)


def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert data["status"] in ("healthy", "degraded")
    assert "active_model" in data
    assert data["sampling_rate"] == 100
    assert data["classes"] == CLASSES
    assert data["leads"] == LEADS


def test_api_models():
    res = client.get("/api/models")
    assert res.status_code == 200
    data = res.json()
    assert "active_model" in data
    assert "models" in data
    models = {m["id"]: m for m in data["models"]}
    assert "seq" in models
    assert "cnn" in models
    assert "gated" in models
    assert models["seq"]["inference_ready"] is True
    assert models["xgb"]["inference_ready"] is False


def test_api_metrics():
    res = client.get("/api/metrics")
    assert res.status_code == 200
    data = res.json()
    assert "research_summary" in data
    assert data["research_summary"]["labelled_records"] == 21388
    assert "comparison" in data
    assert len(data["comparison"]) > 0


def test_api_samples():
    res = client.get("/api/samples")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "samples" in data
    assert data["total"] > 0

    res_sample = client.get("/api/sample/0")
    assert res_sample.status_code == 200
    sample_data = res_sample.json()
    assert len(sample_data["signal"]) == 1000
    assert len(sample_data["signal"][0]) == 12
    assert "labels" in sample_data


def test_api_validate_json():
    dummy = np.random.randn(1000, 12).tolist()
    res = client.post("/api/ecg/validate", json={"signal": dummy})
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert data["metadata"]["n_leads"] == 12
    assert data["metadata"]["n_samples"] == 1000


def test_api_validate_invalid_shape():
    dummy_bad = np.random.randn(1000, 8).tolist()
    res = client.post("/api/ecg/validate", json={"signal": dummy_bad})
    assert res.status_code == 400
    assert res.json()["valid"] is False


def test_api_analyze():
    dummy = np.random.randn(1000, 12).tolist()
    res = client.post("/api/ecg/analyze", json={"signal": dummy, "model": "seq"})
    assert res.status_code == 200
    data = res.json()
    assert data["model"] == "seq"
    assert "probabilities" in data
    assert len(data["probabilities"]) == 5
    for c in CLASSES:
        assert c in data["probabilities"]
        assert 0.0 <= data["probabilities"][c] <= 1.0
    assert "predictions" in data
    assert len(data["predictions"]) == 5
    assert "latency_ms" in data
    assert "disclaimer" in data


def test_api_explain():
    dummy = np.random.randn(1000, 12).tolist()
    res = client.post("/api/explain", json={"signal": dummy, "model": "seq", "target_class": "MI", "steps": 10})
    assert res.status_code == 200
    data = res.json()
    assert "attribution" in data
    assert len(data["attribution"]) == 12
    assert len(data["attribution"][0]) == 1000
    assert "lead_importance" in data
    assert len(data["lead_importance"]) == 12


def test_api_faithfulness():
    dummy = np.random.randn(1000, 12).tolist()
    res = client.post("/api/explain/faithfulness", json={"signal": dummy, "model": "seq", "target_class": "MI", "top_fraction": 0.10})
    assert res.status_code == 200
    data = res.json()
    assert "top_ig_prob_drop" in data
    assert "random_prob_drop" in data
    assert "ratio_drop" in data


def test_api_lead_ablation():
    dummy = np.random.randn(1000, 12).tolist()
    res = client.post("/api/explain/lead_ablation", json={"signal": dummy, "model": "seq", "target_class": "MI"})
    assert res.status_code == 200
    data = res.json()
    assert "leads" in data
    assert len(data["leads"]) == 12
    assert "delta_p" in data["leads"][0]
    assert "impact_pct" in data["leads"][0]


def test_api_select_model():
    res = client.post("/api/models/select", json={"model": "gated"})
    assert res.status_code == 200
    assert res.json()["active_model"] == "gated"

    # Reset back to seq
    client.post("/api/models/select", json={"model": "seq"})


def test_serve_frontend():
    res = client.get("/")
    assert res.status_code == 200
    assert "root" in res.text


def test_api_artifacts():
    res = client.get("/api/artifacts")
    assert res.status_code == 200
    data = res.json()
    assert "artifacts" in data
    assert len(data["artifacts"]) > 0


def test_api_compare():
    dummy = np.random.randn(1000, 12).tolist()
    res = client.post("/api/ecg/compare", json={"signal": dummy, "models": ["seq", "cnn"]})
    assert res.status_code == 200
    data = res.json()
    assert "models" in data
    assert "seq" in data["models"]
    assert "cnn" in data["models"]
    assert "agreement" in data


def test_api_robustness():
    dummy = np.random.randn(1000, 12).tolist()
    res = client.post("/api/robustness", json={"signal": dummy, "model": "seq", "experiment_type": "gaussian_noise", "intensity": 0.05})
    assert res.status_code == 200
    data = res.json()
    assert "shifts" in data
    assert "stability_score" in data


def test_api_analyses_persistence_and_report():
    dummy = np.random.randn(1000, 12).tolist()
    res = client.post("/api/ecg/analyze", json={"signal": dummy, "model": "seq"})
    assert res.status_code == 200
    anl_id = res.json().get("analysis_id")
    assert anl_id is not None

    # Retrieve list
    list_res = client.get("/api/analyses")
    assert list_res.status_code == 200
    assert list_res.json()["total"] > 0

    # Retrieve specific detail
    detail_res = client.get(f"/api/analyses/{anl_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == anl_id

    # Retrieve report
    rep_res = client.get(f"/api/analyses/{anl_id}/report")
    assert rep_res.status_code == 200
    assert "Research Report" in rep_res.text

    # Delete
    del_res = client.delete(f"/api/analyses/{anl_id}")
    assert del_res.status_code == 200


def test_api_spectrogram():
    sig = np.random.randn(1000, 12).tolist()
    res = client.post("/api/signal/spectrogram", json={"signal": sig, "lead": "II"})
    assert res.status_code == 200
    data = res.json()
    assert data["lead"] == "II"
    assert "frequencies" in data
    assert "times" in data
    assert "power_db" in data
    assert "band_energies" in data
    assert len(data["power_db"]) > 0


def test_api_morphology():
    sig = np.random.randn(1000, 12).tolist()
    res = client.post("/api/signal/morphology", json={"signal": sig, "lead": 1})
    assert res.status_code == 200
    data = res.json()
    assert data["lead"] == "II"
    assert "statistics" in data
    assert "morphology" in data
    assert "min_mv" in data["statistics"]
    assert "detected_r_peaks" in data["morphology"]


def test_api_explain_methods_and_batch_matrices():
    sig = np.random.randn(1000, 12).tolist()

    # 1. Gradient x Input
    res_gxi = client.post("/api/explain", json={
        "signal": sig,
        "target_class": "MI",
        "method": "gradient_x_input"
    })
    assert res_gxi.status_code == 200
    assert res_gxi.json()["method"] == "gradient_x_input"

    # 2. SmoothGrad
    res_sg = client.post("/api/explain", json={
        "signal": sig,
        "target_class": "MI",
        "method": "smoothgrad"
    })
    assert res_sg.status_code == 200
    assert res_sg.json()["method"] == "smoothgrad"

    # 3. Integrated Gradients with Diagnostics
    res_ig = client.post("/api/explain", json={
        "signal": sig,
        "target_class": "MI",
        "method": "integrated_gradients",
        "steps": 20
    })
    assert res_ig.status_code == 200
    ig_data = res_ig.json()
    assert "diagnostics" in ig_data
    assert "completeness_error" in ig_data["diagnostics"]

    # 4. Batch Class x Lead Matrix
    res_batch = client.post("/api/explain/batch_matrix", json={
        "signal": sig,
        "steps": 10
    })
    assert res_batch.status_code == 200
    batch_data = res_batch.json()
    assert len(batch_data["magnitude_matrix"]) == 5
    assert len(batch_data["magnitude_matrix"][0]) == 12

    # 5. Class x Time Matrix
    res_time = client.post("/api/explain/class_time_matrix", json={
        "signal": sig,
        "num_windows": 10
    })
    assert res_time.status_code == 200
    time_data = res_time.json()
    assert len(time_data["magnitude_matrix"]) == 5
    assert len(time_data["magnitude_matrix"][0]) == 10

    # 6. Full Lead Ablation Matrix
    res_abl = client.post("/api/explain/lead_ablation_matrix", json={"signal": sig})
    assert res_abl.status_code == 200
    abl_data = res_abl.json()
    assert len(abl_data["delta_p_matrix"]) == 5
    assert len(abl_data["delta_p_matrix"][0]) == 12


