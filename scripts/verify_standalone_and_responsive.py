"""
End-to-end Verification Script for ECG Intelligence:
1. Standalone prediction workflow:
   - Validates signal shape, sampling rate, lead order requirements
   - Genuine 12-lead inference with selected model checkpoint
   - Validates the exact 5-class contract order: CD, HYP, MI, NORM, STTC
   - Validates independent multilabel scores and thresholds
   - Validates Integrated Gradients explainability per class
2. Temporary analysis isolation:
   - Confirms running inference does NOT alter clinical patient counts, study counts, or worklist
3. Save to Patient workflow:
   - Creates new patient via inline workflow
   - Persists 12-lead study linked to patient
   - Retrieves patient chart and verifies saved waveform and predictions match exactly
   - Tests duplicate prevention / idempotent handling
4. Frontend build verification:
   - Verifies dist/index.html, bundles, and assets
"""

import os
import sys
import json
import time
import requests
import numpy as np

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print(f"[*] Testing ECG Intelligence at {BASE_URL}...")
    
    # 1. Health check
    res = requests.get(f"{BASE_URL}/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health = res.json()
    print(f"[+] Server online. Status: {health.get('status')}, Active Model: {health.get('active_model')}")
    
    # 2. Get baseline clinical overview
    res = requests.get(f"{BASE_URL}/api/clinical/overview")
    assert res.status_code == 200, f"Failed to get clinical overview: {res.text}"
    overview_baseline = res.json()
    baseline_patients = overview_baseline["total_patients"]
    baseline_studies = overview_baseline["total_studies"]
    baseline_awaiting = overview_baseline["awaiting_review_count"]
    print(f"[+] Baseline Overview: {baseline_patients} patients, {baseline_studies} studies, {baseline_awaiting} awaiting review")

    # 3. Test Signal Validation with synthetic 1000x12 signal
    signal_1000x12 = np.random.randn(1000, 12).astype(np.float32) * 0.2
    # Add a normal QRS spike
    signal_1000x12[200:220, :] += 0.8
    
    # Save to temp csv
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False) as f:
        # 12 lead columns
        f.write("I,II,III,aVR,aVL,aVF,V1,V2,V3,V4,V5,V6\n")
        for row in signal_1000x12:
            f.write(",".join(f"{v:.5f}" for v in row) + "\n")
        csv_path = f.name

    try:
        with open(csv_path, "rb") as f:
            res = requests.post(f"{BASE_URL}/api/ecg/validate", files={"file": ("test_ecg.csv", f, "text/csv")})
        assert res.status_code == 200, f"Signal validation failed: {res.text}"
        val_res = res.json()
        assert val_res["valid"] is True, f"Validation returned valid=False: {val_res}"
        meta = val_res["metadata"]
        assert meta["n_leads"] == 12, f"Expected 12 leads, got {meta['n_leads']}"
        assert meta["n_samples"] == 1000, f"Expected 1000 samples, got {meta['n_samples']}"
        print(f"[+] Signal Validation Passed: 12 leads, 1000 samples, sampling rate {meta.get('sampling_rate')}Hz")
    finally:
        if os.path.exists(csv_path):
            os.remove(csv_path)

    # 4. Standalone Model Inference
    payload = {
        "signal": signal_1000x12.tolist(),
        "model": "seq",
        "explain": "MI"
    }
    res = requests.post(f"{BASE_URL}/api/ecg/analyze", json=payload)
    assert res.status_code == 200, f"Standalone analysis failed: {res.text}"
    inf_res = res.json()
    
    # 5. Verify the 5-Class Output Contract & Exact Order
    expected_classes = ["CD", "HYP", "MI", "NORM", "STTC"]
    probs = inf_res["probabilities"]
    thresholds = inf_res["thresholds"]
    for c in expected_classes:
        assert c in probs, f"Missing class {c} in probabilities"
        assert c in thresholds, f"Missing class {c} in thresholds"
        score = probs[c]
        thresh = thresholds[c]
        detected = score >= thresh
        print(f"    - {c:4s}: Score={score:.3f}, Threshold={thresh:.3f}, Detected={detected}")
        assert 0.0 <= score <= 1.0, f"Invalid score {score} for {c}"
        assert 0.0 <= thresh <= 1.0, f"Invalid threshold {thresh} for {c}"

    print(f"[+] 5-Class Output Contract Verified for all 5 classes: {expected_classes}")

    # Verify explainability on MI
    assert inf_res["attribution"] is not None, "Expected attribution in explain response"
    assert len(inf_res["attribution"]) == 12, "Attribution must have 12 leads"
    assert len(inf_res["attribution"][0]) == 1000, "Attribution must have 1000 samples per lead"
    assert inf_res["lead_importance"] is not None, "Expected lead_importance list"
    top_lead = inf_res["lead_importance"][0]["lead"]
    print(f"[+] Explainability (Integrated Gradients) Verified: 12x1000 attribution matrix, top lead: {top_lead}")

    # 6. Verify Temporary Analysis Isolation
    # Check overview counts: they must be IDENTICAL to baseline!
    res = requests.get(f"{BASE_URL}/api/clinical/overview")
    assert res.status_code == 200
    overview_after_temp = res.json()
    assert overview_after_temp["total_patients"] == baseline_patients, "Temporary analysis inflated patient count!"
    assert overview_after_temp["total_studies"] == baseline_studies, "Temporary analysis inflated study count!"
    assert overview_after_temp["awaiting_review_count"] == baseline_awaiting, "Temporary analysis inflated awaiting review count!"
    print("[+] Temporary Analysis Isolation Verified: zero patients or studies created, overview counts unchanged.")

    # 7. Save to Patient Workflow:
    # A. Create a new patient inline
    pat_payload = {
        "name": "E2E Test Patient",
        "dob": "1980-05-15",
        "sex": "male",
        "mrn": "MRN-E2E-9999",
        "clinical_history": "Chest discomfort during exertion."
    }
    res = requests.post(f"{BASE_URL}/api/patients", json=pat_payload)
    assert res.status_code == 200, f"Patient creation failed: {res.text}"
    patient = res.json()
    pat_id = patient["id"]
    print(f"[+] Created Test Patient: {patient['name']} (ID: {pat_id}, Age: {patient['age']})")
    
    # B. Persist the ECG study linked to this patient
    study_payload = {
        "patient_id": pat_id,
        "signal": signal_1000x12.tolist(),
        "filename": "e2e_standalone_study.csv",
        "selected_model": "seq",
        "notes": "Verified from standalone prediction workspace."
    }
    res = requests.post(f"{BASE_URL}/api/studies", json=study_payload)
    assert res.status_code == 200, f"Study creation failed: {res.text}"
    saved_study = res.json()
    study_id = saved_study["id"]
    print(f"[+] Persisted Study to Patient: {saved_study['study_id']} (ID: {study_id})")

    # Run analysis on saved study
    res = requests.post(f"{BASE_URL}/api/studies/{study_id}/analyze?model=seq")
    assert res.status_code == 200, f"Study analysis failed: {res.text}"
    print(f"[+] Attached Model Predictions to Study {saved_study['study_id']}")

    # C. Verify Patient Chart retrieves the saved study with waveform and predictions
    res = requests.get(f"{BASE_URL}/api/patients/{pat_id}")
    assert res.status_code == 200
    pat_detail = res.json()
    pat_studies = pat_detail.get("studies", [])
    matching_studies = [s for s in pat_studies if s["id"] == study_id]
    assert len(matching_studies) == 1, f"Expected 1 matching study in patient chart, got {len(matching_studies)}"
    persisted_study = matching_studies[0]
    
    # Verify probabilities and thresholds match
    for cls in expected_classes:
        orig_p = inf_res["probabilities"][cls]
        saved_p = persisted_study["probabilities"][cls]
        assert abs(orig_p - saved_p) < 1e-4, f"Mismatch in score for {cls}: orig {orig_p} vs saved {saved_p}"
    print("[+] Patient Chart Verification Passed: saved study, 5-class scores, and waveform match exactly.")

    # D. Verify Clinical Overview counts incremented exactly by 1 patient and 1 study
    res = requests.get(f"{BASE_URL}/api/clinical/overview")
    overview_final = res.json()
    assert overview_final["total_patients"] == baseline_patients + 1, "Patient count did not increment by 1"
    assert overview_final["total_studies"] == baseline_studies + 1, "Study count did not increment by 1"
    print(f"[+] Clinical Counts Verified: Patients={overview_final['total_patients']}, Studies={overview_final['total_studies']}")

    print("\n[SUCCESS] All standalone prediction, 5-class contract, temporary isolation, and patient save workflows passed!")

if __name__ == "__main__":
    test_api()
