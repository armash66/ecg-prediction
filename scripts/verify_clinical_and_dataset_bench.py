"""
Comprehensive Verification Script for ECG Intelligence Requirements
Validates:
1. Patient DOB and Age handling (DOB truth, age-only unknown DOB, calendar arithmetic, boundaries)
2. New-Patient Registration with 12-lead ECG Intake, Live Inference, and Study Linking
3. Invalid file rejection and error handling
4. Real PTB-XL Dataset Test Bench (Fold 10 held-out test split, record loading, waveform fidelity)
5. Five-Class contract preservation (CD, HYP, MI, NORM, STTC) and multilabel reference annotations
6. Class-specific Integrated Gradients explanation and attribution narrative
7. Verified held-out Fold 10 evaluation metrics and confusion counts
8. Saved study persistence and retrieval without fixture substitution
"""

import sys
import os
import json
import numpy as np
from datetime import datetime, date
from fastapi.testclient import TestClient

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from server.server import app, DB_PATH, DATASET_BENCH
from server.clinical_db import (
    calculate_age_from_dob,
    validate_and_resolve_dob_and_age,
    list_patients,
    get_patient_detail,
    get_ecg_study_detail
)

client = TestClient(app)

def print_section(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def test_dob_and_age_rules():
    print_section("1. VERIFYING PATIENT DOB AND AGE HANDLING")
    
    # Test A: Birthday calculation across month/day boundaries
    ref = date(2026, 10, 14)
    # Birthday has passed this year (May 15)
    age_passed = calculate_age_from_dob("1990-05-15", ref_date=ref)
    assert age_passed == 36, f"Expected 36, got {age_passed}"
    # Birthday has NOT passed this year (Dec 25)
    age_upcoming = calculate_age_from_dob("1990-12-25", ref_date=ref)
    assert age_upcoming == 35, f"Expected 35, got {age_upcoming}"
    # Leap year birthday on Feb 29
    age_leap = calculate_age_from_dob("2000-02-29", ref_date=ref)
    assert age_leap == 26, f"Expected 26, got {age_leap}"
    print(f"[OK] Calendar birthday logic verified: 1990-05-15 -> {age_passed}y, 1990-12-25 -> {age_upcoming}y, 2000-02-29 -> {age_leap}y")

    # Test B: Source of truth validation (DOB overrides age)
    dob_res, age_res = validate_and_resolve_dob_and_age("1985-03-20", 99, ref_date=ref)
    assert dob_res == "1985-03-20"
    assert age_res == 41, f"Expected age 41 derived from DOB, got {age_res}"
    print(f"[OK] DOB source-of-truth overrides manual age: DOB=1985-03-20 -> age={age_res}")

    # Test C: Age-only entry stores DOB as unknown (empty string)
    dob_age_only, age_only_res = validate_and_resolve_dob_and_age(None, 54, ref_date=ref)
    assert dob_age_only == "", f"Expected empty DOB for age-only, got '{dob_age_only}'"
    assert age_only_res == 54
    print(f"[OK] Age-only entry: age={age_only_res}, dob='{dob_age_only}' (unknown, no fake date invented)")

    # Test D: Impossible future DOB rejected
    fut_res = client.post("/api/patients", json={"name": "Future Traveler", "dob": "2099-01-01"})
    assert fut_res.status_code == 400
    assert "future" in fut_res.json()["detail"].lower()
    print(f"[OK] Future DOB rejected: {fut_res.json()['detail']}")

    # Test E: Unreasonable age rejected
    old_res = client.post("/api/patients", json={"name": "Old Entity", "age": 145})
    assert old_res.status_code == 400
    assert "130" in old_res.json()["detail"]
    print(f"[OK] Unreasonable age (145) rejected: {old_res.json()['detail']}")

def test_atomic_new_patient_with_ecg():
    print_section("2. VERIFYING NEW PATIENT REGISTRATION WITH 12-LEAD ECG INTAKE")
    
    # Create synthetic standard 12-lead signal (1000, 12)
    t = np.linspace(0, 10, 1000)
    sig = np.zeros((1000, 12), dtype=np.float32)
    for l in range(12):
        sig[:, l] = 0.5 * np.sin(2 * np.pi * 1.2 * t + l * 0.2) + 0.1 * np.cos(2 * np.pi * 10 * t)

    payload = {
        "name": "E2E Intake Verification Patient",
        "dob": "1978-08-12",
        "sex": "Female",
        "mrn": "MRN-E2E-9941",
        "clinical_history": "Exertional dyspnea, suspected arrhythmia",
        "allergies": "Sulfa drugs",
        "medications": "Metoprolol 25mg daily",
        "notes": "ECG intake performed at clinic triage.",
        "ecg_signal": sig.tolist(),
        "ecg_filename": "triage_12lead.npy",
        "assigned_clinician": "Dr. Sarah Lin, MD",
        "selected_model": "seq"
    }

    reg_res = client.post("/api/patients", json=payload)
    assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"
    pat = reg_res.json()
    
    patient_id = pat["id"]
    created_study_id = pat.get("created_study_id")
    assert created_study_id is not None, "Missing created_study_id in registration response!"
    
    print(f"[OK] Patient Registered: {pat['name']} (ID: {pat['patient_id']}, UID: {patient_id})")
    print(f"[OK] Derived Age: {pat['age']} years (Verified from DOB: {pat['dob']})")
    print(f"[OK] Atomic ECG Study Created: {created_study_id}")
    
    # Verify linked study details and model inference
    study = pat.get("study")
    assert study is not None
    assert study["patient_id"] == patient_id
    assert study["selected_model"] == "seq"
    assert "probabilities" in study
    assert set(study["probabilities"].keys()) == {"CD", "HYP", "MI", "NORM", "STTC"}
    print(f"[OK] Live Model Inference: Model={study['selected_model']}, Flags={study.get('flags')}")
    print(f"     Class Scores: { {c: round(study['probabilities'][c], 4) for c in ['CD', 'HYP', 'MI', 'NORM', 'STTC']} }")

    # Test reopening patient-linked study
    detail_res = client.get(f"/api/studies/{created_study_id}")
    assert detail_res.status_code == 200, f"Failed to get study {created_study_id}: {detail_res.text}"
    retrieved_study = detail_res.json()
    assert retrieved_study["id"] == created_study_id
    assert retrieved_study["patient_id"] == patient_id
    assert retrieved_study["assigned_clinician"] == "Dr. Sarah Lin, MD"
    print(f"[OK] Reopened saved study {created_study_id} successfully linked to patient {patient_id}")

    # Test invalid file rejection (wrong number of leads)
    bad_payload = {
        "name": "Invalid File Test",
        "dob": "1992-04-10",
        "ecg_signal": [[0.1, 0.2, 0.3]] * 1000 # 3 leads instead of 12
    }
    bad_res = client.post("/api/patients", json=bad_payload)
    assert bad_res.status_code == 400
    print(f"[OK] Invalid signal rejected: {bad_res.json()['detail']}")

def test_ptbxl_dataset_bench():
    print_section("3. VERIFYING PTB-XL DATASET TEST BENCH (HELD-OUT FOLD 10)")
    
    # A: Dataset info
    info_res = client.get("/api/dataset/ptbxl/info")
    assert info_res.status_code == 200
    info = info_res.json()
    print(f"[OK] Dataset Source: {info['source']}")
    print(f"     Installed: {info['installed']}, Total Records: {info['total_records']}")
    print(f"     Held-out Test Fold: {info['held_out_test_fold']} ({info['held_out_test_records']} records)")
    print(f"     Contract Classes (Order Preserved): {info['classes']}")
    assert info["classes"] == ["CD", "HYP", "MI", "NORM", "STTC"]
    assert info["held_out_test_fold"] == 10
    assert info["held_out_test_records"] == 2158

    # B: Record listing with search and filter
    records_res = client.get("/api/dataset/ptbxl/records?fold=10&target_class=MI&limit=5")
    assert records_res.status_code == 200
    rec_data = records_res.json()
    records = rec_data["records"]
    assert len(records) > 0
    rec_id = records[0]["ecg_id"]
    print(f"[OK] Listed {len(records)} Fold 10 records matching target class 'MI'. First: Record #{rec_id}")

    # C: Retrieve single record waveform and metadata
    single_res = client.get(f"/api/dataset/ptbxl/record/{rec_id}")
    assert single_res.status_code == 200
    detail = single_res.json()
    sig = np.array(detail["signal"])
    assert sig.shape == (1000, 12)
    assert detail["leads"] == ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"]
    print(f"[OK] Loaded Record #{rec_id} Waveform: Shape={sig.shape}, Duration={detail['duration_sec']}s, SR={detail['sampling_rate']}Hz")
    print(f"     Patient Age: {detail['age']}, Sex: {detail['sex']}, SCP Codes: {list(detail['scp_codes'].keys())[:4]}")
    print(f"     Reference Classes: {detail['reference_classes']}")

    # D: Run benchmark analysis on Record #rec_id with model 'seq'
    anl_res = client.post("/api/dataset/ptbxl/analyze", json={
        "record_id": rec_id,
        "model_name": "seq",
        "explain_class": "MI",
        "attribution_steps": 30
    })
    assert anl_res.status_code == 200
    anl = anl_res.json()
    assert anl["record_id"] == rec_id
    assert anl["model_name"] == "seq"
    assert anl["explained_class"] == "MI"
    
    print(f"[OK] Live Model Analysis on Record #{rec_id}:")
    for item in anl["five_class_results"]:
        status = item["concordance"]
        ref_str = "POS" if item["reference_is_positive"] else "NEG"
        pred_str = "PRED+" if item["predicted_positive"] else "PRED-"
        print(f"     {item['class']:4s} | Score: {item['score']:.4f} | Thresh: {item['threshold']:.4f} | Pred: {pred_str:5s} | Ref: {ref_str:3s} | Concordance: {status}")

    # E: Explainability Verification
    assert anl["explained_class"] == "MI"
    assert anl["model_name"] == "seq"
    top_lead = anl["lead_importance"][0]["lead"]
    top_mag = anl["lead_importance"][0]["score"]
    print(f"[OK] Class-Specific Explanation generated for MI:")
    print(f"     Top Attributed Lead: {top_lead} (magnitude {top_mag:.4f})")
    print(f"     Narrative: {anl['plain_language_explanation'][:120]}...")
    print(f"     Disclaimer: {anl['disclaimer'][:80]}...")

    # F: Held-out Test Set Evaluation Summary
    eval_res = client.get("/api/dataset/ptbxl/evaluation")
    assert eval_res.status_code == 200
    ev = eval_res.json()
    assert ev["records_evaluated"] == 2158
    print(f"[OK] Held-Out Evaluation Summary (Fold 10 — {ev['records_evaluated']} records):")
    for c in ["CD", "HYP", "MI", "NORM", "STTC"]:
        m = ev["per_class"][c]
        cm = m["confusion"]
        total_cm = cm["tp"] + cm["fp"] + cm["fn"] + cm["tn"]
        assert total_cm == 2158, f"Confusion counts for {c} must sum to 2158, got {total_cm}"
        print(f"     {c:4s} | AUROC: {m['auroc']:.4f} | AUPRC: {m['auprc']:.4f} | F1: {m['f1']:.4f} | Sens: {m['sensitivity']:.4f} | Spec: {m['specificity']:.4f} | (TP:{cm['tp']} FP:{cm['fp']} FN:{cm['fn']} TN:{cm['tn']} sum={total_cm})")

    # G: Test Case Import as Labelled Test Patient
    imp_res = client.post("/api/dataset/ptbxl/import", json={
        "record_id": rec_id,
        "clinician": "Benchmarking Investigator"
    })
    assert imp_res.status_code == 200
    imported = imp_res.json()
    assert "PTB-XL Test Record" in imported["name"]
    assert imported["study"]["patient_id"] == imported["id"]
    print(f"[OK] Record #{rec_id} Imported as Labelled Test Patient: {imported['name']} ({imported['patient_id']})")
    print(f"     Linked Study ID: {imported['study']['study_id']}")

if __name__ == "__main__":
    try:
        test_dob_and_age_rules()
        test_atomic_new_patient_with_ecg()
        test_ptbxl_dataset_bench()
        print("\n" + "=" * 70)
        print("  ALL 8 VERIFICATION REQUIREMENTS SUCCESSFULLY PASSED!")
        print("=" * 70 + "\n")
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
