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
