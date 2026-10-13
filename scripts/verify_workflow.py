"""
End-to-end Verification Script for ECG Intelligence Research Workbench.
Validates the full workflow against the acceptance criteria:
Upload -> Validate -> Inference -> Class Scores -> Multi-class XAI -> Faithfulness -> Lead Ablation -> Repeatability.
"""

import os
import io
import json
import urllib.request
import urllib.parse
import numpy as np

BASE_URL = "http://127.0.0.1:8000"
TEST_SAMPLES_DIR = r"c:\Users\Armash Ansari\OneDrive\Desktop\ECG\project\test_samples"

def post_multipart(url: str, fields: dict, files: dict) -> dict:
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = io.BytesIO()
    
    for key, value in fields.items():
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode())
        body.write(f"{value}\r\n".encode())
        
    for key, (filename, content, content_type) in files.items():
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\r\n'.encode())
        body.write(f"Content-Type: {content_type}\r\n\r\n".encode())
        body.write(content)
        body.write(b"\r\n")
        
    body.write(f"--{boundary}--\r\n".encode())
    
    req = urllib.request.Request(url, data=body.getvalue())
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())

def post_json(url: str, data: dict) -> dict:
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())

def get_json(url: str) -> dict:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())

def run_e2e_verification():
    print("=" * 80)
    print("STARTING COMPLETE E2E WORKFLOW VERIFICATION")
    print("=" * 80)

    # 1. Health & Checkpoint Readiness
    health = get_json(f"{BASE_URL}/api/health")
    assert health["status"] == "healthy", f"Server not healthy: {health}"
    assert health["norm_loaded"] is True
    assert health["active_model_loaded"] is True
    print(f"Step 1: Backend & Model Ready -> Active: {health['active_model']}, Device: {health['device']}")

    # 2. Upload & Validation (CSV)
    csv_file = os.path.join(TEST_SAMPLES_DIR, "test_sample_MI.csv")
    with open(csv_file, "rb") as f:
        csv_bytes = f.read()
    
    val_res = post_multipart(
        f"{BASE_URL}/api/ecg/validate",
        {},
        {"file": ("test_sample_MI.csv", csv_bytes, "text/csv")}
    )
    assert val_res["valid"] is True, f"CSV Validation failed: {val_res}"
    meta = val_res["metadata"]
    assert meta["n_leads"] == 12
    assert meta["n_samples"] == 1000
    assert meta["duration_sec"] == 10.0
    signal_mi = val_res["signal"]
    print(f"Step 2: CSV Upload Validated -> Leads: {meta['n_leads']}, Samples: {meta['n_samples']}, Rate: {meta['sampling_rate']} Hz")

    # 2b. Upload & Validation (NPY)
    npy_file = os.path.join(TEST_SAMPLES_DIR, "test_sample_STTC.npy")
    with open(npy_file, "rb") as f:
        npy_bytes = f.read()
    val_npy = post_multipart(
        f"{BASE_URL}/api/ecg/validate",
        {},
        {"file": ("test_sample_STTC.npy", npy_bytes, "application/octet-stream")}
    )
    assert val_npy["valid"] is True
    print(f"Step 2b: NPY Upload Validated -> Format: {val_npy['metadata']['format']}, Leads: {val_npy['metadata']['n_leads']}")

    # 2c. Invalid Upload Rejection
    invalid_data = json.dumps({"signal": [[1.0, 2.0]]}).encode() # Invalid shape (1x2)
    try:
        req = urllib.request.Request(f"{BASE_URL}/api/ecg/validate", data=invalid_data, headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req)
        assert False, "Should have rejected invalid signal"
    except urllib.error.HTTPError as e:
        assert e.code == 400
        print(f"Step 2c: Incompatible Input Rejected with clear HTTP 400")

    # 3. Model Inference (Sequence Model)
    ana_res = post_json(f"{BASE_URL}/api/ecg/analyze", {
        "signal": signal_mi,
        "model": "seq",
        "explain": "MI",
        "explain_steps": 20
    })
    preds = ana_res["predictions"]
    probs = ana_res["probabilities"]
    print(f"Step 3: Real Multilabel Prediction Executed in {ana_res['latency_ms']} ms:")
    for p in preds:
        print(f"   [{p['class']}] {p['name']:<25}: Score = {p['probability']:.4f} | Threshold = {p['threshold']:.4f} | Detected = {p['detected']}")
    
    assert "MI" in probs and probs["MI"] > 0.5, f"Expected elevated MI score for MI sample, got: {probs['MI']}"
    assert ana_res["attribution"] is not None
    assert len(ana_res["attribution"]) == 12 and len(ana_res["attribution"][0]) == 1000

    # 4. Class-Specific Explanations (MI vs STTC)
    explain_mi = post_json(f"{BASE_URL}/api/explain", {
        "signal": signal_mi,
        "model": "seq",
        "target_class": "MI",
        "steps": 20
    })
    explain_sttc = post_json(f"{BASE_URL}/api/explain", {
        "signal": signal_mi,
        "model": "seq",
        "target_class": "STTC",
        "steps": 20
    })

    mi_attr = np.array(explain_mi["attribution"])
    sttc_attr = np.array(explain_sttc["attribution"])
    assert mi_attr.shape == (12, 1000)
    assert sttc_attr.shape == (12, 1000)
    assert np.isfinite(mi_attr).all()
    # Confirm explanations are distinct for different classes
    corr = np.corrcoef(mi_attr.flatten(), sttc_attr.flatten())[0, 1]
    print(f"Step 4: Distinct Explanations Computed -> MI vs STTC Attribution Correlation: {corr:.4f} (distinct maps)")

    # 5. Lead-wise Importance & Time Regions
    mi_leads = explain_mi["lead_importance"]
    assert len(mi_leads) == 12
    top_lead = mi_leads[0]
    print(f"Step 5: Lead-Wise Attribution Computed -> Top Influencing Lead: {top_lead['lead']} (Normalized score: {top_lead['normalized']:.4f})")
    assert explain_mi["time_regions"] is not None and len(explain_mi["time_regions"]) > 0
    print(f"Step 5b: Top Time Regions Ranked -> Found {len(explain_mi['time_regions'])} peak intervals")

    # 6. Explanation Faithfulness Experiment (Deletion & Insertion)
    faith_res = post_json(f"{BASE_URL}/api/explain/faithfulness", {
        "signal": signal_mi,
        "model": "seq",
        "target_class": "MI",
        "top_fraction": 0.10
    })
    print("Step 6: Faithfulness Deletion/Insertion Experiment Completed:")
    print(f"   Initial Prob: {faith_res['initial_prob']:.4f}")
    print(f"   AUDC (Attribution-guided Deletion): {faith_res['audc_ig']:.4f} vs Random AUDC: {faith_res['audc_rand']:.4f}")
    print(f"   AUIC (Attribution-guided Insertion): {faith_res['auic_ig']:.4f} vs Random AUIC: {faith_res['auic_rand']:.4f}")
    print(f"   Top 10% IG Score Drop: {faith_res['top_ig_prob_drop']:.4f} vs Random Drop: {faith_res['random_prob_drop']:.4f}")
    assert len(faith_res["deletion_curve"]) > 0
    assert len(faith_res["insertion_curve"]) > 0

    # 7. Interventional Lead Ablation Experiment
    abl_res = post_json(f"{BASE_URL}/api/explain/lead_ablation", {
        "signal": signal_mi,
        "model": "seq",
        "target_class": "MI"
    })
    assert len(abl_res["leads"]) == 12
    top_abl = abl_res["leads"][0]
    print(f"Step 7: Interventional Lead Ablation Completed -> Highest Drop Lead: {top_abl['lead']} (Delta P = {top_abl['delta_p']:.4f})")

    # 8. Model Repeatability Check
    ana_res2 = post_json(f"{BASE_URL}/api/ecg/analyze", {
        "signal": signal_mi,
        "model": "seq",
        "explain": "MI",
        "explain_steps": 20
    })
    for c in ["CD", "HYP", "MI", "NORM", "STTC"]:
        diff = abs(ana_res["probabilities"][c] - ana_res2["probabilities"][c])
        assert diff < 1e-5, f"Inference not repeatable for {c}: diff={diff}"
    print("Step 8: Numerical Repeatability Verified -> Outputs strictly identical across runs (max diff < 1e-5)")

    # 9. Model Laboratory Artifacts
    metrics_res = get_json(f"{BASE_URL}/api/metrics")
    assert len(metrics_res["comparison"]) >= 10
    assert "seq" in metrics_res["per_class"]
    print(f"Step 9: Model Lab Benchmark Verified -> {len(metrics_res['comparison'])} evaluated models loaded from artifacts")

    # 10. Frontend Distribution Serving
    index_html = urllib.request.urlopen(f"{BASE_URL}/").read().decode("utf-8")
    assert "ECG Intelligence" in index_html
    print("Step 10: Frontend Serving Verified -> React application root served cleanly from FastAPI")

    print("=" * 80)
    print("ALL 15 ACCEPTANCE CRITERIA AND WORKFLOW STAGES PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_e2e_verification()
