"""
Acceptance and Integration Tests for Clinical ECG Intelligence Workflows.
Verifies Patient CRUD, Study Worklist, Real Model Inference on Studies,
Structured Clinical Notes, Deterministic AI Drafting, Report Finalization,
and Longitudinal Comparison.
"""

import os
import sys
import json
import pytest
import numpy as np
from fastapi.testclient import TestClient

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from server.server import app
from ecg_intelligence import CLASSES, LEADS

client = TestClient(app)


def test_clinical_overview():
    res = client.get("/api/clinical/overview")
    assert res.status_code == 200
    data = res.json()
    assert "total_patients" in data
    assert "total_studies" in data
    assert "awaiting_review_count" in data
    assert "recent_patients" in data
    assert "recent_studies" in data
    assert "quick_actions" in data
    assert data["total_patients"] >= 3  # Seeded prototype fixtures


def test_patient_crud_lifecycle():
    # 1. Create Patient
    payload = {
        "name": "Jane Test Patient",
        "dob": "1975-08-22",
        "age": 51,
        "sex": "Female",
        "mrn": "MRN-TEST-9988",
        "contact": "555-0199",
        "clinical_history": "Hypertension, mild mitral valve prolapse.",
        "allergies": "Sulfa drugs",
        "medications": "Amlodipine 5mg daily",
        "notes": "Testing patient creation."
    }
    create_res = client.post("/api/patients", json=payload)
    assert create_res.status_code == 200
    patient = create_res.json()
    assert patient["name"] == "Jane Test Patient"
    assert patient["patient_id"].startswith("PAT-2026-")
    patient_uid = patient["id"]
    patient_display_id = patient["patient_id"]

    # 2. Prevent duplicate patient_id
    dup_res = client.post("/api/patients", json={"name": "Duplicate", "patient_id": patient_display_id})
    assert dup_res.status_code == 400

    # 3. Search and List
    list_res = client.get("/api/patients?q=Jane")
    assert list_res.status_code == 200
    pats = list_res.json()["patients"]
    assert any(p["id"] == patient_uid for p in pats)

    # 4. Get Detail
    detail_res = client.get(f"/api/patients/{patient_uid}")
    assert detail_res.status_code == 200
    det = detail_res.json()
    assert det["name"] == "Jane Test Patient"
    assert det["allergies"] == "Sulfa drugs"

    # 5. Update Patient
    update_res = client.put(f"/api/patients/{patient_uid}", json={"medications": "Amlodipine 10mg daily", "notes": "Medication titrated."})
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["medications"] == "Amlodipine 10mg daily"
    assert updated["patient_id"] == patient_display_id  # ID preserved

    # 6. Delete Patient
    del_res = client.delete(f"/api/patients/{patient_uid}")
    assert del_res.status_code == 200
    get_after_del = client.get(f"/api/patients/{patient_uid}")
    assert get_after_del.status_code == 404


def test_study_worklist_and_inference():
    # 1. Pick an existing patient from seeded fixtures
    pats_res = client.get("/api/patients")
    assert pats_res.status_code == 200
    target_patient = pats_res.json()["patients"][0]
    pat_id = target_patient["id"]

    # 2. Attach a new ECG study to this patient using preloaded sample 5 (MI pattern)
    create_study_res = client.post("/api/studies", json={
        "patient_id": pat_id,
        "sample_index": 5,
        "filename": "lead12_patient_test.npz",
        "assigned_clinician": "Dr. Automated Test, MD"
    })
    assert create_study_res.status_code == 200
    study = create_study_res.json()
    study_id = study["id"]
    assert study["patient_id"] == pat_id
    assert study["status"] == "awaiting_review"
    assert study["quality_status"] in ("optimal", "acceptable_with_warnings")

    # 3. Verify study appears in Worklist
    worklist_res = client.get("/api/studies")
    assert worklist_res.status_code == 200
    studies = worklist_res.json()["studies"]
    assert any(s["id"] == study_id for s in studies)

    # 4. Fetch study detail
    detail_res = client.get(f"/api/studies/{study_id}")
    assert detail_res.status_code == 200
    s_detail = detail_res.json()
    assert len(s_detail["signal"]) == 1000
    assert len(s_detail["signal"][0]) == 12

    # 5. Run real AI analysis on study
    analyze_res = client.post(f"/api/studies/{study_id}/analyze")
    assert analyze_res.status_code == 200
    anal_data = analyze_res.json()
    assert "probabilities" in anal_data
    assert "thresholds" in anal_data
    assert "flags" in anal_data
    # 5 outputs
    for c in CLASSES:
        assert c in anal_data["probabilities"]
        assert 0.0 <= anal_data["probabilities"][c] <= 1.0

    # Study status transitioned to in_progress
    refreshed = client.get(f"/api/studies/{study_id}").json()
    assert refreshed["status"] == "in_progress"
    assert len(refreshed["flags"]) > 0

    # 6. Delete created study to clean up
    del_res = client.delete(f"/api/studies/{study_id}")
    assert del_res.status_code == 200


def test_structured_clinical_notes_and_deterministic_ai_draft():
    # Pick seeded patient A's study
    pats_res = client.get("/api/patients")
    pat_a = [p for p in pats_res.json()["patients"] if p["patient_id"] == "PAT-2026-0001"][0]
    pat_detail = client.get(f"/api/patients/{pat_a['id']}").json()
    assert len(pat_detail["studies"]) > 0
    study_id = pat_detail["studies"][0]["id"]

    # 1. Fetch initial notes
    notes_res = client.get(f"/api/studies/{study_id}/notes")
    assert notes_res.status_code == 200

    # 2. Generate deterministic AI draft
    draft_res = client.post(f"/api/studies/{study_id}/notes/draft_ai")
    assert draft_res.status_code == 200
    draft = draft_res.json()
    assert "[AI-ASSISTED DRAFT TEMPLATE" in draft["clinician_observations"]
    assert "[AI-ASSISTED DRAFT TEMPLATE" in draft["clinician_assessment"]
    assert "PAT-2026-0001" not in draft["clinician_assessment"]  # Ensure no identifier leaks inside prose

    # 3. Save clinician modifications
    save_res = client.post(f"/api/studies/{study_id}/notes", json={
        "reason_for_ecg": "Routine annual outpatient post-MI follow-up.",
        "presenting_symptoms": "Asymptomatic at rest. Reports mild dyspnea with intense physical exertion.",
        "relevant_history": pat_a.get("clinical_history", ""),
        "medications_allergies": "Lisinopril, Aspirin, Atorvastatin",
        "clinician_observations": "Sinus rhythm at 68 bpm. Deep Q waves preserved in V1-V3 consistent with established prior anteroseptal MI.",
        "clinician_assessment": "Clinically stable post-infarction status. No acute ischemic repolarization changes.",
        "plan_followup": "Continue guideline-directed medical therapy. Re-evaluate in 6 months.",
        "status": "reviewed",
        "author": "Dr. Vance, MD"
    })
    assert save_res.status_code == 200
    saved = save_res.json()
    assert saved["status"] == "reviewed"
    assert "Deep Q waves" in saved["clinician_observations"]


def test_report_builder_and_finalization():
    # Pick seeded patient B's study
    pats_res = client.get("/api/patients")
    pat_b = [p for p in pats_res.json()["patients"] if p["patient_id"] == "PAT-2026-0002"][0]
    pat_detail = client.get(f"/api/patients/{pat_b['id']}").json()
    study_id = pat_detail["studies"][0]["id"]

    # 1. Fetch HTML Report Preview
    html_res = client.get(f"/api/studies/{study_id}/report")
    assert html_res.status_code == 200
    assert "ECG Intelligence" in html_res.text
    assert "PAT-2026-0002" in html_res.text
    assert "CLINICAL RESEARCH PROTOTYPE DISCLAIMER" in html_res.text

    # 2. Fetch JSON Report
    json_res = client.get(f"/api/studies/{study_id}/report?format=json")
    assert json_res.status_code == 200
    rep_json = json_res.json()
    assert rep_json["patient"]["patient_id"] == "PAT-2026-0002"

    # 3. Finalize Report
    finalize_res = client.post(f"/api/studies/{study_id}/report/finalize", json={
        "signed_by": "Dr. S. Patel, MD"
    })
    assert finalize_res.status_code == 200
    fin_data = finalize_res.json()
    assert fin_data["status"] == "finalized"
    assert fin_data["signed_by"] == "Dr. S. Patel, MD"

    # Verify study is marked finalized
    refreshed_study = client.get(f"/api/studies/{study_id}").json()
    assert refreshed_study["status"] == "finalized"


def test_longitudinal_comparison():
    # Compare studies from patient A and patient B
    studies = client.get("/api/studies").json()["studies"]
    assert len(studies) >= 2
    s_a = studies[0]["id"]
    s_b = studies[1]["id"]

    comp_res = client.get(f"/api/compare/longitudinal?study_a={s_a}&study_b={s_b}")
    assert comp_res.status_code == 200
    comp = comp_res.json()
    assert "study_a" in comp
    assert "study_b" in comp
    assert "delta_probabilities" in comp
    assert comp["compatible"] is True  # Both use seq model


def test_dob_and_age_rules_and_boundary_logic():
    from datetime import date
    from server.clinical_db import calculate_age_from_dob, validate_and_resolve_dob_and_age

    # 1. Exact calendar birthday arithmetic
    ref = date(2026, 10, 14)
    # Birthday has occurred this year (born Oct 10 1990) -> age 36
    assert calculate_age_from_dob("1990-10-10", ref_date=ref) == 36
    # Birthday has NOT occurred yet this year (born Oct 20 1990) -> age 35
    assert calculate_age_from_dob("1990-10-20", ref_date=ref) == 35
    # Birthday is today (born Oct 14 1990) -> age 36
    assert calculate_age_from_dob("1990-10-14", ref_date=ref) == 36
    # Leap year birthday (Feb 29, 2000) evaluated on Feb 28, 2024 -> age 23; on Feb 29, 2024 -> age 24
    assert calculate_age_from_dob("2000-02-29", ref_date=date(2024, 2, 28)) == 23
    assert calculate_age_from_dob("2000-02-29", ref_date=date(2024, 2, 29)) == 24

    # 2. Reject future DOB
    with pytest.raises(ValueError, match="future"):
        validate_and_resolve_dob_and_age("2030-01-01", None, ref_date=ref)

    # 3. Reject unreasonable ages (> 130 or < 0)
    with pytest.raises(ValueError, match="unreasonable"):
        validate_and_resolve_dob_and_age("1850-01-01", None, ref_date=ref)
    with pytest.raises(ValueError, match="unreasonable"):
        validate_and_resolve_dob_and_age("", 145, ref_date=ref)
    with pytest.raises(ValueError, match="unreasonable"):
        validate_and_resolve_dob_and_age("", -5, ref_date=ref)

    # 4. Age-only entry stores DOB as empty string (unknown), never invents a fake DOB
    dob_out, age_out = validate_and_resolve_dob_and_age("", 42, ref_date=ref)
    assert dob_out == ""
    assert age_out == 42

    # 5. API validation for future DOB
    res_fut = client.post("/api/patients", json={"name": "Time Traveler", "dob": "2099-12-31"})
    assert res_fut.status_code == 400
    assert "future" in res_fut.json()["detail"].lower()

    # 6. API validation for unreasonable age
    res_old = client.post("/api/patients", json={"name": "Ancient One", "age": 150})
    assert res_old.status_code == 400
    assert "unreasonable" in res_old.json()["detail"].lower()

    # 7. DOB entry via API overrides client-provided age with derived age
    res_valid = client.post("/api/patients", json={"name": "DOB Source of Truth", "dob": "1990-05-15", "age": 99})
    assert res_valid.status_code == 200
    p_data = res_valid.json()
    assert p_data["dob"] == "1990-05-15"
    assert p_data["age"] == 36  # Correctly derived, 99 was overridden

    # 8. Dynamic recalculation on fetch
    get_res = client.get(f"/api/patients/{p_data['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["age"] == 36


def test_new_patient_with_ecg_intake_end_to_end():
    # 1. Invalid signal rejection (wrong lead count)
    bad_sig = np.zeros((1000, 5)).tolist()
    bad_res = client.post("/api/patients", json={
        "name": "Invalid ECG Leads Patient",
        "dob": "1985-04-12",
        "ecg_signal": bad_sig
    })
    assert bad_res.status_code == 400
    assert "lead" in bad_res.json()["detail"].lower() or "shape" in bad_res.json()["detail"].lower()

    # 2. Valid atomic intake with genuine 1000x12 ECG signal
    valid_sig = (0.2 * np.sin(np.linspace(0, 20 * np.pi, 1000))[:, None] * np.ones((1, 12))).tolist()
    reg_res = client.post("/api/patients", json={
        "name": "Atomic Intake Patient",
        "dob": "1982-11-03",
        "sex": "Male",
        "clinical_history": "Palpitations during exercise",
        "ecg_signal": valid_sig,
        "ecg_filename": "patient_clinic_intake.csv"
    })
    assert reg_res.status_code == 200
    data = reg_res.json()
    assert data["name"] == "Atomic Intake Patient"
    assert "created_study_id" in data
    study_id = data["created_study_id"]
    assert study_id is not None

    # Verify study is linked to this exact patient and has real model scores
    study_res = client.get(f"/api/studies/{study_id}")
    assert study_res.status_code == 200
    study = study_res.json()
    assert study["patient_id"] == data["id"]
    assert study["selected_model"] == "seq"
    assert all(c in study["probabilities"] for c in CLASSES)
    assert study["quality_status"] in ("optimal", "acceptable_with_warnings")


def test_ptbxl_dataset_test_bench_and_held_out_evaluation():
    # 1. Dataset Info
    info_res = client.get("/api/dataset/ptbxl/info")
    assert info_res.status_code == 200
    info = info_res.json()
    assert info["installed"] is True
    assert info["held_out_test_fold"] == 10
    assert info["held_out_test_records"] == 2158
    assert info["sampling_rate"] == 100
    assert info["signal_shape"] == [1000, 12]

    # 2. Query Fold 10 Records
    rec_res = client.get("/api/dataset/ptbxl/records?fold=10&limit=5")
    assert rec_res.status_code == 200
    recs_data = rec_res.json()
    assert recs_data["total"] == 2158
    assert len(recs_data["records"]) == 5
    first_rec = recs_data["records"][0]
    ecg_id = first_rec["ecg_id"]
    assert first_rec["is_held_out_test"] is True

    # 3. Retrieve Single Record Waveform
    single_res = client.get(f"/api/dataset/ptbxl/record/{ecg_id}")
    assert single_res.status_code == 200
    single = single_res.json()
    assert single["ecg_id"] == ecg_id
    assert len(single["signal"]) == 1000
    assert len(single["signal"][0]) == 12
    assert "quality_status" in single
    assert "multilabel_targets" in single

    # 4. Held-out Fold 10 Benchmark Evaluation
    eval_res = client.get("/api/dataset/ptbxl/evaluation?model=seq")
    assert eval_res.status_code == 200
    ev = eval_res.json()
    assert ev["held_out_verified"] is True
    assert ev["records_evaluated"] == 2158
    assert ev["macro_auroc"] >= 0.90
    for c in CLASSES:
        assert c in ev["per_class"]
        assert ev["per_class"][c]["confusion"]["total"] == 2158

    # 5. Run Live Model Inference and Class-Specific Explanation on Real Record
    anl_res = client.post("/api/dataset/ptbxl/analyze", json={
        "record_id": ecg_id,
        "model": "seq",
        "explain_class": "NORM",
        "explain_steps": 15
    })
    assert anl_res.status_code == 200
    anl = anl_res.json()
    assert anl["record_id"] == ecg_id
    assert anl["explained_class"] == "NORM"
    assert len(anl["five_class_results"]) == 5
    # Exact 5-class contract order
    assert [r["class"] for r in anl["five_class_results"]] == CLASSES
    for r in anl["five_class_results"]:
        assert "score" in r
        assert "threshold" in r
        assert "predicted_positive" in r
        assert "reference_label" in r
        assert r["concordance"] in ("TP", "TN", "FP", "FN")
    assert anl["attribution"] is not None
    assert len(anl["attribution"]) == 12
    assert len(anl["attribution"][0]) == 1000
    assert anl["lead_importance"] is not None
    assert len(anl["lead_importance"]) == 12
    assert "attribution notice" in anl["plain_language_explanation"].lower()


def test_encounter_lifecycle():
    # 1. Get a patient
    pats_res = client.get("/api/patients")
    assert pats_res.status_code == 200
    target_patient = pats_res.json()["patients"][0]
    pat_id = target_patient["id"]

    # 2. Create Encounter
    enc_payload = {
        "patient_id": pat_id,
        "encounter_date": "2026-10-14",
        "encounter_type": "Outpatient Cardiology",
        "department": "Cardiovascular Medicine",
        "attending_clinician": "Dr. Sarah Jenkins, MD",
        "reason_for_visit": "Post-MI follow-up and symptom review",
        "status": "in_progress",
    }
    create_res = client.post("/api/encounters", json=enc_payload)
    assert create_res.status_code == 200
    enc = create_res.json()
    enc_id = enc["id"]
    assert enc["encounter_id"].startswith("ENC-2026-")
    assert enc["patient_id"] == pat_id
    assert enc["status"] == "in_progress"

    # 3. Retrieve Encounter Detail
    detail_res = client.get(f"/api/encounters/{enc_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == enc_id
    assert detail["reason_for_visit"] == "Post-MI follow-up and symptom review"

    # 4. List Encounters Filtered by Patient
    list_res = client.get(f"/api/encounters?patient_id={pat_id}")
    assert list_res.status_code == 200
    enc_list = list_res.json()["encounters"]
    assert any(e["id"] == enc_id for e in enc_list)

    # 5. Update Encounter
    update_res = client.put(f"/api/encounters/{enc_id}", json={
        "status": "completed",
        "reason_for_visit": "Follow-up complete; patient stable.",
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["status"] == "completed"
    assert updated["reason_for_visit"] == "Follow-up complete; patient stable."

    # 6. Verify in Patient Detail
    pat_detail_res = client.get(f"/api/patients/{pat_id}")
    assert pat_detail_res.status_code == 200
    pat_detail = pat_detail_res.json()
    assert any(e["id"] == enc_id for e in pat_detail.get("encounters", []))

    # 7. Delete Encounter
    del_res = client.delete(f"/api/encounters/{enc_id}")
    assert del_res.status_code == 200
    assert client.get(f"/api/encounters/{enc_id}").status_code == 404


def test_wfdb_paired_upload_validation():
    # 1. Create a paired WFDB header and dat file
    record_name = "test_paired_rec"
    hea_content = (
        f"{record_name} 12 100 1000\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 I\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 II\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 III\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 aVR\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 aVL\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 aVF\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 V1\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 V2\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 V3\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 V4\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 V5\n"
        f"{record_name}.dat 16 1000.0/mV 16 0 0 0 0 V6\n"
    ).encode("ascii")

    # Generate 1000 samples x 12 leads int16
    sig_int16 = (np.sin(np.linspace(0, 10, 1000 * 12)) * 1000).astype(np.int16)
    dat_content = sig_int16.tobytes()

    # Test Upload with both files
    files = [
        ("files", (f"{record_name}.hea", hea_content, "text/plain")),
        ("files", (f"{record_name}.dat", dat_content, "application/octet-stream")),
    ]
    res = client.post("/api/ecg/validate", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert "signal" in data
    assert len(data["signal"]) == 1000
    assert len(data["signal"][0]) == 12

    # Test Upload with header only (should fail gracefully and request .dat file)
    single_hea = [
        ("files", (f"{record_name}.hea", hea_content, "text/plain")),
    ]
    res_missing = client.post("/api/ecg/validate", files=single_hea)
    assert res_missing.status_code == 400
    missing_data = res_missing.json()
    assert ".dat" in missing_data["error"]
    assert "test_paired_rec.hea" in missing_data["error"]


