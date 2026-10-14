"""
Clinical Database and Service Layer for ECG Intelligence.
Manages relational persistence for Patients, Encounters, ECG Studies,
Structured Clinical Notes, and Longitudinal Clinical Reports.
"""

import os
import json
import time
import uuid
import sqlite3
from datetime import datetime, date
from typing import Optional, List, Dict, Any, Tuple
import numpy as np

from ecg_intelligence import CLASSES, LEADS, CLASS_NAMES, FS

def get_db_path(cache_dir: str) -> str:
    return os.path.join(cache_dir, "analyses_history.db")


def get_db_connection(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def calculate_age_from_dob(dob_str: Optional[str], ref_date: Optional[date] = None) -> Optional[int]:
    """
    Calculates exact integer age from a YYYY-MM-DD DOB string using calendar birthday logic.
    Returns None if dob_str is empty, null, or invalid.
    """
    if not dob_str or not isinstance(dob_str, str):
        return None
    dob_clean = dob_str.strip()
    if not dob_clean:
        return None
    try:
        if "T" in dob_clean:
            dob_clean = dob_clean.split("T")[0]
        dob_d = datetime.strptime(dob_clean, "%Y-%m-%d").date()
    except Exception:
        return None

    if ref_date is None:
        ref_date = date.today()

    if dob_d > ref_date:
        return None  # Future DOB is invalid

    has_had_birthday = (ref_date.month, ref_date.day) >= (dob_d.month, dob_d.day)
    age = ref_date.year - dob_d.year - (0 if has_had_birthday else 1)
    return age


def validate_and_resolve_dob_and_age(
    dob: Optional[str],
    age: Optional[int],
    ref_date: Optional[date] = None
) -> Tuple[str, Optional[int]]:
    """
    Enforces strict patient DOB and age source-of-truth rules:
    - If DOB is entered:
        * Calculate age automatically using exact calendar birthday logic.
        * DOB is the single source of truth; any client-provided age is overridden by derived age.
        * Rejects impossible future DOBs.
        * Validates that derived age is within realistic human lifespan [0, 130].
    - If DOB is not entered (empty/null):
        * If age is entered, validate age is an integer in [0, 130].
        * DOB is stored as empty string (unknown). We NEVER invent a fake DOB.
    - If neither is entered:
        * Returns ("", None).
    """
    if ref_date is None:
        ref_date = date.today()

    dob_clean = (dob or "").strip()
    if dob_clean:
        if "T" in dob_clean:
            dob_clean = dob_clean.split("T")[0]
        try:
            dob_d = datetime.strptime(dob_clean, "%Y-%m-%d").date()
        except Exception:
            raise ValueError(f"Invalid Date of Birth format: '{dob}'. Expected YYYY-MM-DD.")

        if dob_d > ref_date:
            raise ValueError(f"Date of Birth '{dob_clean}' is in the future. Future birth dates are impossible.")

        has_had_birthday = (ref_date.month, ref_date.day) >= (dob_d.month, dob_d.day)
        derived_age = ref_date.year - dob_d.year - (0 if has_had_birthday else 1)

        if derived_age < 0 or derived_age > 130:
            raise ValueError(f"Calculated age {derived_age} is unreasonable. Must be between 0 and 130 years.")

        return dob_d.strftime("%Y-%m-%d"), derived_age

    # DOB is empty/not provided
    if age is not None and str(age).strip() != "":
        try:
            age_int = int(age)
        except (ValueError, TypeError):
            raise ValueError(f"Age must be a valid integer, got '{age}'.")

        if age_int < 0 or age_int > 130:
            raise ValueError(f"Age {age_int} is unreasonable. Must be between 0 and 130 years.")

        # Age-only entry: DOB is unknown (never invent an exact DOB!)
        return "", age_int

    return "", None



def init_clinical_db(db_path: str, samples_path: Optional[str] = None):
    """
    Initializes SQLite tables for clinical entities and seeds de-identified prototype
    records if no patients currently exist.
    """
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        patient_id TEXT UNIQUE NOT NULL,
        mrn TEXT,
        name TEXT NOT NULL,
        dob TEXT,
        age INTEGER,
        sex TEXT,
        contact TEXT,
        clinical_history TEXT,
        allergies TEXT,
        medications TEXT,
        notes TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS encounters (
        id TEXT PRIMARY KEY,
        encounter_id TEXT UNIQUE NOT NULL,
        patient_id TEXT NOT NULL,
        encounter_date TEXT NOT NULL,
        encounter_type TEXT,
        department TEXT,
        attending_clinician TEXT,
        reason_for_visit TEXT,
        status TEXT DEFAULT 'in_progress',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS ecg_studies (
        id TEXT PRIMARY KEY,
        study_id TEXT UNIQUE NOT NULL,
        patient_id TEXT NOT NULL,
        encounter_id TEXT,
        recorded_at TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        filename TEXT,
        signal_data TEXT NOT NULL,
        metadata_json TEXT,
        quality_status TEXT DEFAULT 'optimal',
        quality_score REAL DEFAULT 1.0,
        quality_warnings_json TEXT DEFAULT '[]',
        status TEXT DEFAULT 'awaiting_review',
        assigned_clinician TEXT DEFAULT '',
        selected_model TEXT DEFAULT 'seq',
        latest_analysis_id TEXT DEFAULT '',
        probabilities_json TEXT DEFAULT '{}',
        thresholds_json TEXT DEFAULT '{}',
        flags_json TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY(encounter_id) REFERENCES encounters(id) ON DELETE SET NULL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS clinical_notes (
        id TEXT PRIMARY KEY,
        note_id TEXT UNIQUE NOT NULL,
        study_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        encounter_id TEXT,
        author TEXT DEFAULT 'Attending Clinician',
        reason_for_ecg TEXT DEFAULT '',
        presenting_symptoms TEXT DEFAULT '',
        relevant_history TEXT DEFAULT '',
        medications_allergies TEXT DEFAULT '',
        clinician_observations TEXT DEFAULT '',
        clinician_assessment TEXT DEFAULT '',
        plan_followup TEXT DEFAULT '',
        additional_comments TEXT DEFAULT '',
        ai_draft_generated INTEGER DEFAULT 0,
        ai_draft_timestamp TEXT DEFAULT '',
        status TEXT DEFAULT 'draft',
        finalized_by TEXT DEFAULT '',
        finalized_at TEXT DEFAULT '',
        revision INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(study_id) REFERENCES ecg_studies(id) ON DELETE CASCADE,
        FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS clinical_reports (
        id TEXT PRIMARY KEY,
        report_id TEXT UNIQUE NOT NULL,
        study_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        encounter_id TEXT,
        summary_json TEXT NOT NULL,
        report_html TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        version INTEGER DEFAULT 1,
        signed_by TEXT DEFAULT '',
        finalized_at TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(study_id) REFERENCES ecg_studies(id) ON DELETE CASCADE,
        FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
    """)

    conn.commit()

    # Seed de-identified prototype fixture records if patient table is empty
    cur.execute("SELECT COUNT(*) AS cnt FROM patients;")
    count = cur.fetchone()["cnt"]

    if count == 0 and samples_path and os.path.exists(samples_path):
        try:
            _seed_deidentified_fixtures(conn, samples_path)
        except Exception as e:
            print(f"Notice: Failed to seed fixtures: {e}")

    conn.close()


def _seed_deidentified_fixtures(conn: sqlite3.Connection, samples_path: str):
    """Seeds 3 de-identified prototype patient charts linked to genuine PTB-XL sample signals."""
    samples = np.load(samples_path)
    X = samples["X"]

    # Candidate samples: index 5 (MI pattern), index 14 (STTC pattern), index 0 (NORM pattern)
    fixtures = [
        {
            "pat_id": "pat_fixture_001",
            "patient_id": "PAT-2026-0001",
            "mrn": "MRN-90421",
            "name": "De-identified Patient A",
            "dob": "1960-05-14",
            "age": 64,
            "sex": "Male",
            "contact": "De-identified Prototype / Cardiology Clinic A",
            "history": "Prior anterior myocardial infarction (2024), essential hypertension.",
            "allergies": "Penicillin (cutaneous urticaria)",
            "medications": "Lisinopril 10mg daily, Aspirin 81mg daily, Atorvastatin 40mg daily",
            "notes": "Stable functional capacity NYHA Class I. Routine periodic outpatient evaluation.",
            "enc_id": "enc_fixture_001",
            "encounter_id": "ENC-2026-0001",
            "enc_type": "Cardiology Outpatient Clinic",
            "dept": "Cardiovascular Medicine",
            "clinician": "Dr. Vance, MD",
            "reason": "Scheduled post-infarction evaluation and interval ECG",
            "study_id": "stu_fixture_001",
            "study_code": "STU-2026-0001",
            "sample_idx": 5,
            "study_status": "awaiting_review",
            "probs": {"CD": 0.069, "HYP": 0.003, "MI": 0.856, "NORM": 0.508, "STTC": 0.004},
            "thresholds": {"CD": 0.28, "HYP": 0.32, "MI": 0.33, "NORM": 0.60, "STTC": 0.34},
            "flags": ["MI"],
        },
        {
            "pat_id": "pat_fixture_002",
            "patient_id": "PAT-2026-0002",
            "mrn": "MRN-81204",
            "name": "De-identified Patient B",
            "dob": "1968-11-20",
            "age": 56,
            "sex": "Female",
            "contact": "De-identified Prototype / Cardiology Clinic B",
            "history": "Atypical retrosternal chest tightness on exertion, dyslipidemia.",
            "allergies": "No known drug allergies (NKDA)",
            "medications": "Rosuvastatin 20mg daily, Metoprolol succinate 25mg daily",
            "notes": "Referred for baseline resting 12-lead ECG prior to outpatient exercise stress testing.",
            "enc_id": "enc_fixture_002",
            "encounter_id": "ENC-2026-0002",
            "enc_type": "Emergency Assessment Unit",
            "dept": "Emergency Medicine",
            "clinician": "Dr. Patel, MD",
            "reason": "Evaluation of recurrent exertional chest tightness",
            "study_id": "stu_fixture_002",
            "study_code": "STU-2026-0002",
            "sample_idx": 14,
            "study_status": "in_progress",
            "probs": {"CD": 0.011, "HYP": 0.001, "MI": 0.052, "NORM": 0.613, "STTC": 0.749},
            "thresholds": {"CD": 0.28, "HYP": 0.32, "MI": 0.33, "NORM": 0.60, "STTC": 0.34},
            "flags": ["NORM", "STTC"],
        },
        {
            "pat_id": "pat_fixture_003",
            "patient_id": "PAT-2026-0003",
            "mrn": "MRN-33519",
            "name": "De-identified Patient C",
            "dob": "1994-03-08",
            "age": 30,
            "sex": "Male",
            "contact": "De-identified Prototype / Occupational Health",
            "history": "None. Asymptomatic marathon athlete.",
            "allergies": "NKDA",
            "medications": "None",
            "notes": "Baseline occupational health certification. Normal physical examination.",
            "enc_id": "enc_fixture_003",
            "encounter_id": "ENC-2026-0003",
            "enc_type": "Occupational Health Clinic",
            "dept": "Preventive Cardiology",
            "clinician": "Dr. Chen, MD",
            "reason": "Annual athletic health screening and clearance",
            "study_id": "stu_fixture_003",
            "study_code": "STU-2026-0003",
            "sample_idx": 0,
            "study_status": "finalized",
            "probs": {"CD": 0.043, "HYP": 0.005, "MI": 0.007, "NORM": 0.990, "STTC": 0.009},
            "thresholds": {"CD": 0.28, "HYP": 0.32, "MI": 0.33, "NORM": 0.60, "STTC": 0.34},
            "flags": ["NORM"],
        },
    ]

    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
    cur = conn.cursor()

    for item in fixtures:
        # Patient
        cur.execute("""
        INSERT INTO patients (
            id, patient_id, mrn, name, dob, age, sex, contact,
            clinical_history, allergies, medications, notes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        """, (
            item["pat_id"], item["patient_id"], item["mrn"], item["name"],
            item["dob"], item["age"], item["sex"], item["contact"],
            item["history"], item["allergies"], item["medications"], item["notes"],
            now, now
        ))

        # Encounter
        enc_status = 'completed' if item['study_status'] == 'finalized' else 'in_progress'
        cur.execute("""
        INSERT INTO encounters (
            id, encounter_id, patient_id, encounter_date, encounter_type,
            department, attending_clinician, reason_for_visit, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item["enc_id"], item["encounter_id"], item["pat_id"],
            now[:10], item["enc_type"], item["dept"], item["clinician"],
            item["reason"], enc_status, now, now
        ))

        # Signal array (1000, 12)
        sig_data = X[item["sample_idx"]].astype(float).tolist()
        meta = {
            "format": "ptbxl_100hz",
            "leads": LEADS,
            "sampling_rate": 100,
            "duration_sec": 10.0,
            "units": "mV",
            "fixture_sample_idx": item["sample_idx"]
        }

        # Study
        cur.execute("""
        INSERT INTO ecg_studies (
            id, study_id, patient_id, encounter_id, recorded_at, uploaded_at,
            filename, signal_data, metadata_json, quality_status, quality_score,
            quality_warnings_json, status, assigned_clinician, selected_model,
            latest_analysis_id, probabilities_json, thresholds_json, flags_json,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'optimal', 1.0, '[]', ?, ?, 'seq', ?, ?, ?, ?, ?, ?)
        """, (
            item["study_id"], item["study_code"], item["pat_id"], item["enc_id"],
            now, now, f"sample_{item['sample_idx']}.npz",
            json.dumps(sig_data), json.dumps(meta),
            item["study_status"], item["clinician"], f"anal_{item['study_code']}",
            json.dumps(item["probs"]), json.dumps(item["thresholds"]), json.dumps(item["flags"]),
            now, now
        ))

        # Clinical note
        obs = (
            f"12-lead ECG tracing acquired under standard resting protocol.\n"
            f"Regular sinus rhythm at ~72 bpm. PR interval 158 ms, QRS duration 92 ms, QTc 418 ms.\n"
            f"Automated AI Model Evaluation (seq): Model Flags: {', '.join(item['flags']) if item['flags'] else 'None'}."
        )
        assess = (
            f"Clinical review concurs with findings. Primary pattern reflects: {', '.join(item['flags'])}."
            if item["flags"] else "Normal electrocardiographic limits."
        )
        plan = "Continue clinical surveillance and risk factor optimization. Follow-up as scheduled."

        cur.execute("""
        INSERT INTO clinical_notes (
            id, note_id, study_id, patient_id, encounter_id, author,
            reason_for_ecg, presenting_symptoms, relevant_history,
            medications_allergies, clinician_observations, clinician_assessment,
            plan_followup, additional_comments, ai_draft_generated, ai_draft_timestamp,
            status, finalized_by, finalized_at, revision, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 1, ?, ?)
        """, (
            f"note_{item['pat_id']}", f"NOTE-{item['patient_id'][-4:]}",
            item["study_id"], item["pat_id"], item["enc_id"], item["clinician"],
            item["reason"], "Stable, reports no acute angina at rest.", item["history"],
            f"{item['medications']}; Allergies: {item['allergies']}",
            obs, assess, plan, "De-identified verified entry.", now,
            "finalized" if item["study_status"] == "finalized" else "reviewed",
            item["clinician"] if item["study_status"] == "finalized" else "",
            now if item["study_status"] == "finalized" else "",
            now, now
        ))

    conn.commit()


# ==============================================================================
# PATIENT MANAGEMENT SERVICE
# ==============================================================================

def list_patients(
    db_path: str,
    query: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "updated_at",
    order: str = "desc"
) -> List[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    valid_sorts = {"name": "p.name", "patient_id": "p.patient_id", "updated_at": "p.updated_at", "created_at": "p.created_at"}
    sort_col = valid_sorts.get(sort_by, "p.updated_at")
    sort_dir = "ASC" if order.lower() == "asc" else "DESC"

    sql = """
    SELECT 
        p.*,
        COUNT(DISTINCT s.id) AS study_count,
        COUNT(DISTINCT e.id) AS encounter_count,
        MAX(s.recorded_at) AS latest_study_date
    FROM patients p
    LEFT JOIN ecg_studies s ON p.id = s.patient_id
    LEFT JOIN encounters e ON p.id = e.patient_id
    WHERE 1=1
    """
    params = []

    if query:
        q_term = f"%{query.strip()}%"
        sql += " AND (p.name LIKE ? OR p.patient_id LIKE ? OR p.mrn LIKE ?)"
        params.extend([q_term, q_term, q_term])

    if status and status != "all":
        sql += " AND p.status = ?"
        params.append(status)

    sql += f" GROUP BY p.id ORDER BY {sort_col} {sort_dir}"

    cur.execute(sql, params)
    rows = cur.fetchall()
    results = [dict(row) for row in rows]
    for r in results:
        if r.get("dob"):
            derived = calculate_age_from_dob(r["dob"])
            if derived is not None:
                r["age"] = derived
    conn.close()
    return results


def get_patient_detail(db_path: str, patient_id_or_uid: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("""
    SELECT * FROM patients WHERE id = ? OR patient_id = ?
    """, (patient_id_or_uid, patient_id_or_uid))
    pat_row = cur.fetchone()
    if not pat_row:
        conn.close()
        return None

    pat = dict(pat_row)
    if pat.get("dob"):
        derived = calculate_age_from_dob(pat["dob"])
        if derived is not None:
            pat["age"] = derived

    # Encounters
    cur.execute("""
    SELECT * FROM encounters WHERE patient_id = ? ORDER BY encounter_date DESC
    """, (pat["id"],))
    pat["encounters"] = [dict(r) for r in cur.fetchall()]

    # Studies
    cur.execute("""
    SELECT id, study_id, patient_id, encounter_id, recorded_at, uploaded_at,
           filename, quality_status, quality_score, quality_warnings_json,
           status, assigned_clinician, selected_model, probabilities_json,
           thresholds_json, flags_json, created_at, updated_at
    FROM ecg_studies WHERE patient_id = ? ORDER BY recorded_at DESC
    """, (pat["id"],))
    studies_rows = cur.fetchall()
    studies = []
    for sr in studies_rows:
        sd = dict(sr)
        sd["quality_warnings"] = json.loads(sd.get("quality_warnings_json") or "[]")
        sd["probabilities"] = json.loads(sd.get("probabilities_json") or "{}")
        sd["thresholds"] = json.loads(sd.get("thresholds_json") or "{}")
        sd["flags"] = json.loads(sd.get("flags_json") or "[]")
        studies.append(sd)
    pat["studies"] = studies

    # Clinical Notes
    cur.execute("""
    SELECT * FROM clinical_notes WHERE patient_id = ? ORDER BY created_at DESC
    """, (pat["id"],))
    pat["clinical_notes"] = [dict(r) for r in cur.fetchall()]

    # Reports
    cur.execute("""
    SELECT id, report_id, study_id, patient_id, status, version, signed_by, finalized_at, created_at
    FROM clinical_reports WHERE patient_id = ? ORDER BY created_at DESC
    """, (pat["id"],))
    pat["reports"] = [dict(r) for r in cur.fetchall()]

    conn.close()
    return pat


def create_patient(db_path: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    uid = str(uuid.uuid4())
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())

    # Source of truth DOB / Age validation
    dob_val, age_val = validate_and_resolve_dob_and_age(data.get("dob"), data.get("age"))

    # Generate sequential or unique patient_id code
    patient_id_code = data.get("patient_id")
    if not patient_id_code:
        cur.execute("SELECT COUNT(*) AS cnt FROM patients;")
        next_seq = cur.fetchone()["cnt"] + 1
        while True:
            cand = f"PAT-2026-{next_seq:04d}"
            cur.execute("SELECT id FROM patients WHERE patient_id = ?", (cand,))
            if not cur.fetchone():
                patient_id_code = cand
                break
            next_seq += 1
    else:
        # Check for duplicate patient_id
        cur.execute("SELECT id FROM patients WHERE patient_id = ?", (patient_id_code,))
        if cur.fetchone():
            conn.close()
            raise ValueError(f"Patient with identifier '{patient_id_code}' already exists.")

    cur.execute("""
    INSERT INTO patients (
        id, patient_id, mrn, name, dob, age, sex, contact,
        clinical_history, allergies, medications, notes, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        uid,
        patient_id_code,
        data.get("mrn", "").strip(),
        data["name"].strip(),
        dob_val,
        age_val,
        data.get("sex", "Unknown"),
        data.get("contact", "").strip(),
        data.get("clinical_history", "").strip(),
        data.get("allergies", "").strip(),
        data.get("medications", "").strip(),
        data.get("notes", "").strip(),
        data.get("status", "active"),
        now,
        now
    ))
    conn.commit()
    conn.close()
    return get_patient_detail(db_path, uid)


def update_patient(db_path: str, patient_id_or_uid: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("SELECT * FROM patients WHERE id = ? OR patient_id = ?", (patient_id_or_uid, patient_id_or_uid))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None
    uid = row["id"]

    # If updating DOB or Age, enforce validation & single source-of-truth rules
    if "dob" in updates or "age" in updates:
        cand_dob = updates.get("dob") if "dob" in updates else row["dob"]
        cand_age = updates.get("age") if "age" in updates else row["age"]
        dob_val, age_val = validate_and_resolve_dob_and_age(cand_dob, cand_age)
        updates["dob"] = dob_val
        updates["age"] = age_val

    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
    fields = []
    params = []

    allowed = ["name", "mrn", "dob", "age", "sex", "contact", "clinical_history", "allergies", "medications", "notes", "status"]
    for k in allowed:
        if k in updates and updates[k] is not None:
            fields.append(f"{k} = ?")
            params.append(updates[k])

    if not fields:
        conn.close()
        return get_patient_detail(db_path, uid)

    fields.append("updated_at = ?")
    params.append(now)
    params.append(uid)

    cur.execute(f"UPDATE patients SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    return get_patient_detail(db_path, uid)



def delete_patient(db_path: str, patient_id_or_uid: str) -> bool:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("SELECT id FROM patients WHERE id = ? OR patient_id = ?", (patient_id_or_uid, patient_id_or_uid))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False
    uid = row["id"]

    # Cascade deletes via foreign keys
    cur.execute("DELETE FROM patients WHERE id = ?", (uid,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


# ==============================================================================
# ENCOUNTERS MANAGEMENT SERVICE
# ==============================================================================

def list_encounters(db_path: str, patient_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    sql = """
    SELECT e.*, p.name AS patient_name, p.patient_id AS patient_display_id, p.mrn AS patient_mrn
    FROM encounters e
    JOIN patients p ON e.patient_id = p.id
    WHERE 1=1
    """
    params = []
    if patient_id:
        sql += " AND (e.patient_id = ? OR p.patient_id = ?)"
        params.extend([patient_id, patient_id])

    sql += " ORDER BY e.encounter_date DESC, e.created_at DESC"
    cur.execute(sql, params)
    encounters = [dict(r) for r in cur.fetchall()]
    conn.close()
    return encounters


def get_encounter_detail(db_path: str, encounter_id_or_uid: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("""
    SELECT e.*, p.name AS patient_name, p.patient_id AS patient_display_id, p.mrn AS patient_mrn
    FROM encounters e
    JOIN patients p ON e.patient_id = p.id
    WHERE e.id = ? OR e.encounter_id = ?
    """, (encounter_id_or_uid, encounter_id_or_uid))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None

    enc = dict(row)
    cur.execute("""
    SELECT id, study_id, recorded_at, status, selected_model, flags_json
    FROM ecg_studies WHERE encounter_id = ? ORDER BY recorded_at DESC
    """, (enc["id"],))
    studies_rows = cur.fetchall()
    enc["studies"] = []
    for s in studies_rows:
        sd = dict(s)
        sd["flags"] = json.loads(sd.get("flags_json") or "[]")
        enc["studies"].append(sd)

    conn.close()
    return enc


def create_encounter(db_path: str, patient_id_or_uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("SELECT id, patient_id FROM patients WHERE id = ? OR patient_id = ?", (patient_id_or_uid, patient_id_or_uid))
    pat = cur.fetchone()
    if not pat:
        conn.close()
        raise ValueError(f"Patient '{patient_id_or_uid}' not found.")

    pat_uid = pat["id"]
    uid = str(uuid.uuid4())
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
    today_str = time.strftime("%Y-%m-%d", time.gmtime())

    cur.execute("SELECT COUNT(*) AS cnt FROM encounters;")
    next_seq = cur.fetchone()["cnt"] + 1
    while True:
        enc_code = f"ENC-2026-{next_seq:04d}"
        cur.execute("SELECT id FROM encounters WHERE encounter_id = ?", (enc_code,))
        if not cur.fetchone():
            break
        next_seq += 1

    enc_date = (data.get("encounter_date") or "").strip() or today_str
    enc_type = (data.get("encounter_type") or "").strip() or "Outpatient Cardiology"
    dept = (data.get("department") or "").strip() or "Cardiovascular Medicine"
    clinician = (data.get("attending_clinician") or "").strip() or "Attending Clinician"
    reason = (data.get("reason_for_visit") or "").strip() or "Cardiac assessment and ECG evaluation"
    status = (data.get("status") or "").strip() or "in_progress"

    cur.execute("""
    INSERT INTO encounters (
        id, encounter_id, patient_id, encounter_date, encounter_type,
        department, attending_clinician, reason_for_visit, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (uid, enc_code, pat_uid, enc_date, enc_type, dept, clinician, reason, status, now, now))

    conn.commit()
    conn.close()
    detail = get_encounter_detail(db_path, uid)
    if not detail:
        raise ValueError("Failed to retrieve created encounter.")
    return detail


def update_encounter(db_path: str, encounter_id_or_uid: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("SELECT id FROM encounters WHERE id = ? OR encounter_id = ?", (encounter_id_or_uid, encounter_id_or_uid))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None
    uid = row["id"]

    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
    fields = []
    params = []
    allowed = ["encounter_date", "encounter_type", "department", "attending_clinician", "reason_for_visit", "status"]
    for k in allowed:
        if k in updates and updates[k] is not None:
            fields.append(f"{k} = ?")
            params.append(updates[k])

    if not fields:
        conn.close()
        return get_encounter_detail(db_path, uid)

    fields.append("updated_at = ?")
    params.append(now)
    params.append(uid)

    cur.execute(f"UPDATE encounters SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    return get_encounter_detail(db_path, uid)


def delete_encounter(db_path: str, encounter_id_or_uid: str) -> bool:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("SELECT id FROM encounters WHERE id = ? OR encounter_id = ?", (encounter_id_or_uid, encounter_id_or_uid))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False
    uid = row["id"]

    cur.execute("DELETE FROM encounters WHERE id = ?", (uid,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


# ==============================================================================
# ECG STUDIES & WORKLIST SERVICE
# ==============================================================================

def list_ecg_studies(
    db_path: str,
    status: Optional[str] = None,
    patient_id: Optional[str] = None,
    query: Optional[str] = None
) -> List[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    sql = """
    SELECT 
        s.id, s.study_id, s.patient_id, s.encounter_id, s.recorded_at,
        s.uploaded_at, s.filename, s.quality_status, s.quality_score,
        s.quality_warnings_json, s.status, s.assigned_clinician,
        s.selected_model, s.latest_analysis_id, s.probabilities_json,
        s.thresholds_json, s.flags_json, s.created_at, s.updated_at,
        p.name AS patient_name,
        p.patient_id AS patient_display_id,
        p.age AS patient_age,
        p.sex AS patient_sex,
        p.mrn AS patient_mrn,
        e.encounter_type,
        e.department
    FROM ecg_studies s
    JOIN patients p ON s.patient_id = p.id
    LEFT JOIN encounters e ON s.encounter_id = e.id
    WHERE 1=1
    """
    params = []

    if status and status != "all":
        sql += " AND s.status = ?"
        params.append(status)

    if patient_id:
        sql += " AND (s.patient_id = ? OR p.patient_id = ?)"
        params.extend([patient_id, patient_id])

    if query:
        q_term = f"%{query.strip()}%"
        sql += " AND (p.name LIKE ? OR s.study_id LIKE ? OR p.patient_id LIKE ?)"
        params.extend([q_term, q_term, q_term])

    sql += " ORDER BY s.recorded_at DESC"

    cur.execute(sql, params)
    rows = cur.fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["quality_warnings"] = json.loads(d.get("quality_warnings_json") or "[]")
        d["probabilities"] = json.loads(d.get("probabilities_json") or "{}")
        d["thresholds"] = json.loads(d.get("thresholds_json") or "{}")
        d["flags"] = json.loads(d.get("flags_json") or "[]")
        results.append(d)

    conn.close()
    return results


def get_ecg_study_detail(db_path: str, study_id_or_uid: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("""
    SELECT 
        s.*,
        p.name AS patient_name,
        p.patient_id AS patient_display_id,
        p.age AS patient_age,
        p.sex AS patient_sex,
        p.dob AS patient_dob,
        p.mrn AS patient_mrn,
        p.clinical_history AS patient_history,
        p.allergies AS patient_allergies,
        p.medications AS patient_medications,
        e.encounter_id AS encounter_display_id,
        e.encounter_type,
        e.department,
        e.reason_for_visit
    FROM ecg_studies s
    JOIN patients p ON s.patient_id = p.id
    LEFT JOIN encounters e ON s.encounter_id = e.id
    WHERE s.id = ? OR s.study_id = ?
    """, (study_id_or_uid, study_id_or_uid))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None

    data = dict(row)
    data["signal"] = json.loads(data["signal_data"]) if data.get("signal_data") else None
    data["metadata"] = json.loads(data.get("metadata_json") or "{}")
    data["quality_warnings"] = json.loads(data.get("quality_warnings_json") or "[]")
    data["probabilities"] = json.loads(data.get("probabilities_json") or "{}")
    data["thresholds"] = json.loads(data.get("thresholds_json") or "{}")
    data["flags"] = json.loads(data.get("flags_json") or "[]")

    # Fetch notes for this study
    cur.execute("SELECT * FROM clinical_notes WHERE study_id = ? ORDER BY revision DESC LIMIT 1", (data["id"],))
    note_row = cur.fetchone()
    data["clinical_notes"] = dict(note_row) if note_row else None

    # Fetch latest report for this study
    cur.execute("SELECT * FROM clinical_reports WHERE study_id = ? ORDER BY version DESC LIMIT 1", (data["id"],))
    rep_row = cur.fetchone()
    data["clinical_report"] = dict(rep_row) if rep_row else None

    conn.close()
    return data


def create_ecg_study(
    db_path: str,
    patient_id_or_uid: str,
    signal_arr: np.ndarray,
    metadata: Dict[str, Any],
    quality_analysis: Dict[str, Any],
    encounter_id: Optional[str] = None,
    filename: Optional[str] = None,
    assigned_clinician: Optional[str] = "Attending Clinician"
) -> Dict[str, Any]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    # Find patient
    cur.execute("SELECT id, patient_id FROM patients WHERE id = ? OR patient_id = ?", (patient_id_or_uid, patient_id_or_uid))
    pat = cur.fetchone()
    if not pat:
        conn.close()
        raise ValueError(f"Patient '{patient_id_or_uid}' not found. An ECG study must be linked to an existing patient.")

    pat_uid = pat["id"]

    # Generate sequential study code
    cur.execute("SELECT COUNT(*) AS cnt FROM ecg_studies;")
    next_seq = cur.fetchone()["cnt"] + 1
    while True:
        study_code = f"STU-2026-{next_seq:04d}"
        cur.execute("SELECT id FROM ecg_studies WHERE study_id = ?", (study_code,))
        if not cur.fetchone():
            break
        next_seq += 1

    uid = str(uuid.uuid4())
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())

    # Create default encounter if none provided
    enc_uid = encounter_id
    if not enc_uid:
        cur.execute("SELECT id FROM encounters WHERE patient_id = ? ORDER BY encounter_date DESC LIMIT 1", (pat_uid,))
        last_enc = cur.fetchone()
        if last_enc:
            enc_uid = last_enc["id"]
        else:
            enc_uid = str(uuid.uuid4())
            cur.execute("SELECT COUNT(*) AS cnt FROM encounters;")
            enc_seq = cur.fetchone()["cnt"] + 1
            while True:
                enc_code = f"ENC-2026-{enc_seq:04d}"
                cur.execute("SELECT id FROM encounters WHERE encounter_id = ?", (enc_code,))
                if not cur.fetchone():
                    break
                enc_seq += 1

            cur.execute("""
            INSERT INTO encounters (
                id, encounter_id, patient_id, encounter_date, encounter_type,
                department, attending_clinician, reason_for_visit, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'Outpatient Cardiology', 'Cardiovascular Medicine', ?, 'Diagnostic ECG Assessment', 'in_progress', ?, ?)
            """, (enc_uid, enc_code, pat_uid, now[:10], assigned_clinician, now, now))

    # Signal serialization
    signal_json = json.dumps(signal_arr.tolist())
    meta_json = json.dumps(metadata)
    warnings_json = json.dumps(quality_analysis.get("warnings", []))

    cur.execute("""
    INSERT INTO ecg_studies (
        id, study_id, patient_id, encounter_id, recorded_at, uploaded_at,
        filename, signal_data, metadata_json, quality_status, quality_score,
        quality_warnings_json, status, assigned_clinician, selected_model,
        latest_analysis_id, probabilities_json, thresholds_json, flags_json,
        created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_review', ?, 'seq', '', '{}', '{}', '[]', ?, ?)
    """, (
        uid, study_code, pat_uid, enc_uid, now, now,
        filename or f"{study_code}.json",
        signal_json, meta_json,
        quality_analysis.get("status", "optimal"),
        quality_analysis.get("quality_score", 1.0),
        warnings_json,
        assigned_clinician,
        now, now
    ))

    # Create initial blank draft clinical note with unique note_id
    cur.execute("SELECT COUNT(*) AS cnt FROM clinical_notes;")
    note_seq = cur.fetchone()["cnt"] + 1
    while True:
        note_code = f"NOTE-2026-{note_seq:04d}"
        cur.execute("SELECT id FROM clinical_notes WHERE note_id = ?", (note_code,))
        if not cur.fetchone():
            break
        note_seq += 1

    cur.execute("""
    INSERT INTO clinical_notes (
        id, note_id, study_id, patient_id, encounter_id, author,
        reason_for_ecg, presenting_symptoms, relevant_history,
        medications_allergies, clinician_observations, clinician_assessment,
        plan_followup, additional_comments, ai_draft_generated, ai_draft_timestamp,
        status, finalized_by, finalized_at, revision, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'Routine Diagnostic 12-Lead ECG Evaluation', '', '', '', '', '', '', '', 0, '', 'draft', '', '', 1, ?, ?)
    """, (
        str(uuid.uuid4()), note_code,
        uid, pat_uid, enc_uid, assigned_clinician, now, now
    ))


    conn.commit()
    conn.close()
    return get_ecg_study_detail(db_path, uid)


def update_study_status(db_path: str, study_id_or_uid: str, status: str, clinician: Optional[str] = None) -> bool:
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())

    params = [status, now]
    sql = "UPDATE ecg_studies SET status = ?, updated_at = ?"
    if clinician:
        sql += ", assigned_clinician = ?"
        params.append(clinician)
    sql += " WHERE id = ? OR study_id = ?"
    params.extend([study_id_or_uid, study_id_or_uid])

    cur.execute(sql, params)
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def delete_ecg_study(db_path: str, study_id_or_uid: str) -> bool:
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT id FROM ecg_studies WHERE id = ? OR study_id = ?", (study_id_or_uid, study_id_or_uid))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False
    uid = row["id"]
    cur.execute("DELETE FROM ecg_studies WHERE id = ?", (uid,))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def update_study_analysis_result(
    db_path: str,
    study_id_or_uid: str,
    model_name: str,
    probs: Dict[str, float],
    thresholds: Dict[str, float],
    flags: List[str],
    analysis_id: str
):
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())

    cur.execute("""
    UPDATE ecg_studies
    SET selected_model = ?,
        probabilities_json = ?,
        thresholds_json = ?,
        flags_json = ?,
        latest_analysis_id = ?,
        updated_at = ?
    WHERE id = ? OR study_id = ?
    """, (
        model_name,
        json.dumps(probs),
        json.dumps(thresholds),
        json.dumps(flags),
        analysis_id,
        now,
        study_id_or_uid,
        study_id_or_uid
    ))
    conn.commit()
    conn.close()


# ==============================================================================
# CLINICAL NOTES & DETERMINISTIC AI DRAFTING
# ==============================================================================

def get_study_notes(db_path: str, study_id_or_uid: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    cur.execute("""
    SELECT n.* FROM clinical_notes n
    JOIN ecg_studies s ON n.study_id = s.id
    WHERE s.id = ? OR s.study_id = ?
    ORDER BY n.revision DESC LIMIT 1
    """, (study_id_or_uid, study_id_or_uid))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def save_study_notes(db_path: str, study_id_or_uid: str, note_data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("SELECT id, patient_id, encounter_id, study_id FROM ecg_studies WHERE id = ? OR study_id = ?", (study_id_or_uid, study_id_or_uid))
    study = cur.fetchone()
    if not study:
        conn.close()
        raise ValueError("ECG Study not found.")

    study_uid = study["id"]
    pat_uid = study["patient_id"]
    enc_uid = study["encounter_id"]

    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())

    # Check existing note
    cur.execute("SELECT id, revision FROM clinical_notes WHERE study_id = ? ORDER BY revision DESC LIMIT 1", (study_uid,))
    existing = cur.fetchone()

    if existing:
        cur.execute("""
        UPDATE clinical_notes
        SET reason_for_ecg = ?,
            presenting_symptoms = ?,
            relevant_history = ?,
            medications_allergies = ?,
            clinician_observations = ?,
            clinician_assessment = ?,
            plan_followup = ?,
            additional_comments = ?,
            author = ?,
            status = ?,
            updated_at = ?
        WHERE id = ?
        """, (
            note_data.get("reason_for_ecg", ""),
            note_data.get("presenting_symptoms", ""),
            note_data.get("relevant_history", ""),
            note_data.get("medications_allergies", ""),
            note_data.get("clinician_observations", ""),
            note_data.get("clinician_assessment", ""),
            note_data.get("plan_followup", ""),
            note_data.get("additional_comments", ""),
            note_data.get("author", "Attending Clinician"),
            note_data.get("status", "draft"),
            now,
            existing["id"]
        ))
        note_id = existing["id"]
    else:
        note_id = str(uuid.uuid4())
        cur.execute("""
        INSERT INTO clinical_notes (
            id, note_id, study_id, patient_id, encounter_id, author,
            reason_for_ecg, presenting_symptoms, relevant_history,
            medications_allergies, clinician_observations, clinician_assessment,
            plan_followup, additional_comments, ai_draft_generated, ai_draft_timestamp,
            status, revision, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, 1, ?, ?)
        """, (
            note_id, f"NOTE-{study['study_id'][-4:]}", study_uid, pat_uid, enc_uid,
            note_data.get("author", "Attending Clinician"),
            note_data.get("reason_for_ecg", ""),
            note_data.get("presenting_symptoms", ""),
            note_data.get("relevant_history", ""),
            note_data.get("medications_allergies", ""),
            note_data.get("clinician_observations", ""),
            note_data.get("clinician_assessment", ""),
            note_data.get("plan_followup", ""),
            note_data.get("additional_comments", ""),
            note_data.get("status", "draft"),
            now, now
        ))

    conn.commit()
    conn.close()
    return get_study_notes(db_path, study_uid)


def generate_deterministic_ai_draft(study_detail: Dict[str, Any]) -> Dict[str, str]:
    """
    Synthesizes a structured, transparent clinical note draft strictly from recorded signal metrics,
    patient history, and verified model scores. Watermarks all sections prominently.
    """
    pat_name = study_detail.get("patient_name", "Patient")
    pat_age = study_detail.get("patient_age")
    pat_sex = study_detail.get("patient_sex", "Unknown")
    pat_history = study_detail.get("patient_history") or "No prior documented cardiovascular conditions in record."
    pat_meds = study_detail.get("patient_medications") or "None documented"
    pat_allergies = study_detail.get("patient_allergies") or "NKDA"

    q_status = study_detail.get("quality_status", "optimal").replace("_", " ").title()
    q_score = study_detail.get("quality_score", 1.0)
    q_warnings = study_detail.get("quality_warnings", [])

    probs = study_detail.get("probabilities", {})
    thresholds = study_detail.get("thresholds", {})
    model_name = study_detail.get("selected_model", "seq")

    # Format model score summary
    detected_classes = []
    score_lines = []
    for c in ["NORM", "MI", "STTC", "CD", "HYP"]:
        if c in probs:
            p = float(probs[c])
            th = float(thresholds.get(c, 0.5))
            flagged = p >= th
            if flagged:
                detected_classes.append(f"{c} ({CLASS_NAMES.get(c, c)})")
            status_tag = "[THRESHOLD FLAGGED]" if flagged else "[Non-significant]"
            score_lines.append(f"  \u2022 {c} ({CLASS_NAMES.get(c, c)}): Score {p:.3f} | Threshold {th:.3f} \u2192 {status_tag}")

    q_summary = f"Signal Quality: {q_status} (Quality Index: {q_score:.2f})."
    if q_warnings:
        q_summary += " Validation warnings: " + "; ".join(q_warnings)
    else:
        q_summary += " 12-lead baseline stable without severe electrode motion or clipping."

    ai_disclaimer = "[AI-ASSISTED DRAFT TEMPLATE \u2014 REQUIRES CLINICIAN VERIFICATION & SIGN-OFF]"

    obs_text = (
        f"{ai_disclaimer}\n"
        f"12-Lead Electrocardiogram recorded on {study_detail.get('recorded_at', 'standard protocol')}.\n"
        f"{q_summary}\n\n"
        f"Machine Learning Pattern Recognition Summary (Model: {model_name}):\n"
        + ("\n".join(score_lines) if score_lines else "  \u2022 Inference pending or not executed.")
        + "\n\nNotice: Model scores represent independent non-diagnostic pattern detections."
    )

    if detected_classes:
        assess_text = (
            f"{ai_disclaimer}\n"
            f"Experimental multi-label model triggered diagnostic thresholds for: {', '.join(detected_classes)}.\n"
            f"Waveform morphology requires clinician inspection to confirm rhythm, axis, and ischemia localization.\n"
            f"Clinical correlation with symptoms and cardiac biomarkers is mandatory."
        )
        plan_text = (
            f"{ai_disclaimer}\n"
            f"1. Conduct visual waveform verification across 12 standard leads in ECG Viewer.\n"
            f"2. Inspect Class \u00D7 Lead attribution heatmaps in Research Lab if etiology requires verification.\n"
            f"3. Obtain serial ECGs and cardiac enzyme profile if acute coronary syndrome is clinically suspected.\n"
            f"4. Document final clinician interpretation and sign encounter report."
        )
    else:
        assess_text = (
            f"{ai_disclaimer}\n"
            f"Automated pattern analysis demonstrated predominantly normal limits without elevated pathological flags.\n"
            f"Model scores remained below decision thresholds across CD, HYP, MI, and STTC."
        )
        plan_text = (
            f"{ai_disclaimer}\n"
            f"1. Verify baseline sinus rhythm and PR/QRS/QTc intervals clinically.\n"
            f"2. Continue standard clinical care per primary admitting complaint."
        )

    return {
        "reason_for_ecg": study_detail.get("reason_for_visit") or "Diagnostic 12-lead electrocardiographic evaluation.",
        "presenting_symptoms": "Clinician to document presenting symptomatology (e.g. chest tightness, palpitations, dyspnea, syncope).",
        "relevant_history": pat_history,
        "medications_allergies": f"Medications: {pat_meds} | Allergies: {pat_allergies}",
        "clinician_observations": obs_text,
        "clinician_assessment": assess_text,
        "plan_followup": plan_text,
        "additional_comments": f"Deterministic template drafted at {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}.",
    }


# ==============================================================================
# CLINICAL REPORT BUILDER & EXPORT
# ==============================================================================

def render_clinical_report_html(study_detail: Dict[str, Any], notes: Dict[str, Any], finalized: bool = False, signed_by: str = "") -> str:
    pat_id = study_detail.get("patient_display_id", "PAT-XXXX")
    pat_name = study_detail.get("patient_name", "Unknown Patient")
    pat_age = study_detail.get("patient_age", "N/A")
    pat_sex = study_detail.get("patient_sex", "N/A")
    pat_mrn = study_detail.get("patient_mrn", "N/A")
    study_id = study_detail.get("study_id", "STU-XXXX")
    rec_at = study_detail.get("recorded_at", "N/A")
    q_score = study_detail.get("quality_score", 1.0)
    q_status = study_detail.get("quality_status", "optimal").replace("_", " ").title()
    probs = study_detail.get("probabilities", {})
    thresholds = study_detail.get("thresholds", {})
    model_name = study_detail.get("selected_model", "seq")

    table_rows = []
    for c in ["NORM", "MI", "STTC", "CD", "HYP"]:
        if c in probs:
            p = float(probs[c])
            th = float(thresholds.get(c, 0.5))
            flagged = p >= th
            badge_class = "badge-flagged" if flagged else "badge-normal"
            badge_text = "FLAGGED" if flagged else "NEGATIVE"
            table_rows.append(f"""
            <tr>
                <td><b>{CLASS_NAMES.get(c, c)}</b></td>
                <td><code>{c}</code></td>
                <td>{p:.4f}</td>
                <td>{th:.4f}</td>
                <td><span class="{badge_class}">{badge_text}</span></td>
            </tr>
            """)

    status_stamp = f"""
    <div class="stamp-finalized">
        \u2713 FINALIZED & SIGNED CLINICAL ENCOUNTER<br>
        <span style="font-size:12px; font-weight:normal;">Sign-off Attending: {signed_by or 'Attending Physician'} | Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}</span>
    </div>
    """ if finalized else """
    <div class="stamp-draft">
        \u26A0 CLINICAL DRAFT \u2014 REQUIRES CLINICIAN VERIFICATION & SIGN-OFF
    </div>
    """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ECG Clinical Documentation Report \u2014 {study_id}</title>
<style>
    body {{
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #252525;
        background: #FFFFFF;
        margin: 40px auto;
        max-width: 900px;
        line-height: 1.5;
    }}
    .header {{
        border-bottom: 3px solid #A83245;
        padding-bottom: 16px;
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
    }}
    .brand-title {{
        color: #A83245;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.5px;
        margin: 0;
    }}
    .brand-sub {{
        color: #777773;
        font-size: 13px;
        margin-top: 4px;
    }}
    .patient-grid {{
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        background: #F7F7F5;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #E8E6E1;
        margin-bottom: 24px;
    }}
    .patient-grid .item b {{
        display: block;
        color: #777773;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}
    .patient-grid .item span {{
        font-size: 14px;
        font-weight: 600;
        color: #252525;
    }}
    h3 {{
        font-size: 15px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #A83245;
        border-bottom: 1px solid #E8E6E1;
        padding-bottom: 6px;
        margin-top: 24px;
        margin-bottom: 12px;
    }}
    table {{
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 13px;
    }}
    th, td {{
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid #E8E6E1;
    }}
    th {{
        background: #FAFAF8;
        color: #777773;
        font-weight: 600;
    }}
    .badge-flagged {{
        background: #FDEEEE;
        color: #B33A3A;
        padding: 3px 8px;
        border-radius: 4px;
        font-weight: 700;
        font-size: 11px;
    }}
    .badge-normal {{
        background: #E8F4EE;
        color: #34765A;
        padding: 3px 8px;
        border-radius: 4px;
        font-weight: 700;
        font-size: 11px;
    }}
    .text-box {{
        background: #FAFAF8;
        border: 1px solid #E8E6E1;
        border-radius: 6px;
        padding: 12px 16px;
        font-size: 13px;
        white-space: pre-wrap;
        margin-bottom: 16px;
    }}
    .stamp-finalized {{
        background: #E8F4EE;
        border: 1px solid #34765A;
        color: #34765A;
        font-weight: 700;
        padding: 12px 16px;
        border-radius: 6px;
        margin-bottom: 24px;
        text-align: center;
    }}
    .stamp-draft {{
        background: #FDF4E7;
        border: 1px solid #B77925;
        color: #634212;
        font-weight: 700;
        padding: 12px 16px;
        border-radius: 6px;
        margin-bottom: 24px;
        text-align: center;
    }}
    .disclaimer {{
        background: #FDF4E7;
        border-left: 4px solid #B77925;
        padding: 12px 16px;
        font-size: 11px;
        color: #634212;
        margin-top: 36px;
        border-radius: 0 4px 4px 0;
    }}
    @media print {{
        body {{ margin: 0; max-width: 100%; }}
        .header {{ border-bottom-color: #000; }}
    }}
</style>
</head>
<body>
    <div class="header">
        <div>
            <div class="brand-title">ECG Intelligence</div>
            <div class="brand-sub">Clinician Review, Waveform Analysis & Encounter Documentation</div>
        </div>
        <div style="text-align:right;">
            <div style="font-size:12px; color:#777773;">Study ID: <b>{study_id}</b></div>
            <div style="font-size:12px; color:#777773;">Acquisition: {rec_at}</div>
        </div>
    </div>

    {status_stamp}

    <div class="patient-grid">
        <div class="item">
            <b>Patient Identifier</b>
            <span>{pat_id}</span>
        </div>
        <div class="item">
            <b>Patient Name</b>
            <span>{pat_name}</span>
        </div>
        <div class="item">
            <b>Demographics</b>
            <span>{pat_age} yrs / {pat_sex}</span>
        </div>
        <div class="item">
            <b>Medical Record #</b>
            <span>{pat_mrn}</span>
        </div>
        <div class="item">
            <b>Lead Configuration</b>
            <span>12 Standard Leads</span>
        </div>
        <div class="item">
            <b>Sampling Rate / Duration</b>
            <span>100 Hz / 10.0 sec</span>
        </div>
        <div class="item">
            <b>Signal Quality</b>
            <span>{q_status} ({q_score:.2f})</span>
        </div>
        <div class="item">
            <b>Inference Architecture</b>
            <span>{model_name}</span>
        </div>
    </div>

    <h3>1. Machine Learning Multi-Label Pattern Analysis</h3>
    <table>
        <thead>
            <tr>
                <th>Diagnostic Superclass</th>
                <th>Code</th>
                <th>Model Score</th>
                <th>Verified Threshold</th>
                <th>Classification Decision</th>
            </tr>
        </thead>
        <tbody>
            {"".join(table_rows)}
        </tbody>
    </table>

    <h3>2. Reason for ECG & Clinical Context</h3>
    <div class="text-box">{notes.get("reason_for_ecg", "Diagnostic evaluation.")}</div>

    <h3>3. Clinician Observations & Waveform Findings</h3>
    <div class="text-box">{notes.get("clinician_observations", "No observations documented.")}</div>

    <h3>4. Clinical Assessment & Diagnostic Impression</h3>
    <div class="text-box">{notes.get("clinician_assessment", "Pending review.")}</div>

    <h3>5. Treatment Plan & Recommended Follow-up</h3>
    <div class="text-box">{notes.get("plan_followup", "No follow-up plan documented.")}</div>

    <div class="disclaimer">
        <b>CLINICAL RESEARCH PROTOTYPE DISCLAIMER:</b> This report is generated by a decision-support research system.
        Machine learning model predictions, attribution heatmaps, and threshold-based flags are experimental decision-support
        outputs only and DO NOT constitute an autonomous or certified medical diagnosis. All findings must be independently
        reviewed, clinically correlated, and signed off by a qualified, licensed healthcare clinician.
    </div>
</body>
</html>"""
    return html


def finalize_study_report(db_path: str, study_id_or_uid: str, signed_by: str) -> Dict[str, Any]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    study = get_ecg_study_detail(db_path, study_id_or_uid)
    if not study:
        conn.close()
        raise ValueError("ECG Study not found.")

    notes = get_study_notes(db_path, study["id"]) or {}
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())

    # Build report snapshot JSON
    summary_data = {
        "patient": {
            "id": study["patient_id"],
            "patient_id": study["patient_display_id"],
            "name": study["patient_name"],
            "age": study["patient_age"],
            "sex": study["patient_sex"],
            "mrn": study["patient_mrn"]
        },
        "study": {
            "id": study["id"],
            "study_id": study["study_id"],
            "recorded_at": study["recorded_at"],
            "selected_model": study["selected_model"],
            "probabilities": study["probabilities"],
            "thresholds": study["thresholds"],
            "flags": study["flags"],
            "quality_status": study["quality_status"],
            "quality_score": study["quality_score"]
        },
        "notes": notes,
        "finalized_at": now,
        "signed_by": signed_by
    }

    report_html = render_clinical_report_html(study, notes, finalized=True, signed_by=signed_by)
    rep_uid = str(uuid.uuid4())

    cur.execute("SELECT id, version FROM clinical_reports WHERE study_id = ? ORDER BY version DESC LIMIT 1", (study["id"],))
    existing_rep = cur.fetchone()
    if existing_rep:
        version = existing_rep["version"] + 1
    else:
        version = 1
    rep_code = f"REP-{study['study_id'][-4:]}-v{version}"

    cur.execute("""
    INSERT INTO clinical_reports (
        id, report_id, study_id, patient_id, encounter_id,
        summary_json, report_html, status, version, signed_by, finalized_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'finalized', ?, ?, ?, ?, ?)
    """, (
        rep_uid, rep_code, study["id"], study["patient_id"], study.get("encounter_id"),
        json.dumps(summary_data), report_html, version, signed_by, now, now, now
    ))

    # Update study status to finalized
    cur.execute("UPDATE ecg_studies SET status = 'finalized', updated_at = ? WHERE id = ?", (now, study["id"]))

    # Update notes status to finalized
    cur.execute("UPDATE clinical_notes SET status = 'finalized', finalized_by = ?, finalized_at = ?, updated_at = ? WHERE study_id = ?", (signed_by, now, now, study["id"]))

    conn.commit()
    conn.close()

    return {
        "report_id": rep_code,
        "study_id": study["study_id"],
        "status": "finalized",
        "finalized_at": now,
        "signed_by": signed_by,
        "report_html": report_html,
        "summary": summary_data
    }


# ==============================================================================
# LONGITUDINAL COMPARISON SERVICE
# ==============================================================================

def compare_longitudinal_studies(db_path: str, study_a_id: str, study_b_id: str) -> Dict[str, Any]:
    study_a = get_ecg_study_detail(db_path, study_a_id)
    study_b = get_ecg_study_detail(db_path, study_b_id)

    if not study_a or not study_b:
        raise ValueError("One or both studies specified for longitudinal comparison do not exist.")

    probs_a = study_a.get("probabilities", {})
    probs_b = study_b.get("probabilities", {})

    compatible = (study_a.get("selected_model") == study_b.get("selected_model"))

    delta_probs = {}
    for c in CLASSES:
        if c in probs_a and c in probs_b:
            delta_probs[c] = round(float(probs_b[c]) - float(probs_a[c]), 4)

    return {
        "compatible": compatible,
        "model_a": study_a.get("selected_model"),
        "model_b": study_b.get("selected_model"),
        "patient_id_a": study_a.get("patient_display_id"),
        "patient_id_b": study_b.get("patient_display_id"),
        "same_patient": (study_a.get("patient_id") == study_b.get("patient_id")),
        "study_a": {
            "id": study_a["id"],
            "study_id": study_a["study_id"],
            "recorded_at": study_a["recorded_at"],
            "status": study_a["status"],
            "probabilities": probs_a,
            "flags": study_a.get("flags", []),
            "quality_status": study_a.get("quality_status"),
            "quality_score": study_a.get("quality_score"),
            "notes": study_a.get("clinical_notes")
        },
        "study_b": {
            "id": study_b["id"],
            "study_id": study_b["study_id"],
            "recorded_at": study_b["recorded_at"],
            "status": study_b["status"],
            "probabilities": probs_b,
            "flags": study_b.get("flags", []),
            "quality_status": study_b.get("quality_status"),
            "quality_score": study_b.get("quality_score"),
            "notes": study_b.get("clinical_notes")
        },
        "delta_probabilities": delta_probs,
        "delta_recorded_days": None
    }


# ==============================================================================
# CLINICAL OVERVIEW SERVICE
# ==============================================================================

def get_clinical_overview(db_path: str) -> Dict[str, Any]:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    # Counts
    cur.execute("SELECT COUNT(*) AS cnt FROM patients WHERE status = 'active';")
    total_patients = cur.fetchone()["cnt"]

    cur.execute("SELECT COUNT(*) AS cnt FROM ecg_studies;")
    total_studies = cur.fetchone()["cnt"]

    cur.execute("SELECT COUNT(*) AS cnt FROM ecg_studies WHERE status = 'awaiting_review';")
    awaiting_count = cur.fetchone()["cnt"]

    cur.execute("SELECT COUNT(*) AS cnt FROM ecg_studies WHERE status = 'in_progress';")
    in_progress_count = cur.fetchone()["cnt"]

    cur.execute("SELECT COUNT(*) AS cnt FROM ecg_studies WHERE status IN ('reviewed', 'finalized');")
    reviewed_count = cur.fetchone()["cnt"]

    # Recent patients
    cur.execute("""
    SELECT p.id, p.patient_id, p.name, p.dob, p.age, p.sex, p.clinical_history, p.updated_at,
           COUNT(s.id) AS study_count
    FROM patients p
    LEFT JOIN ecg_studies s ON p.id = s.patient_id
    GROUP BY p.id
    ORDER BY p.updated_at DESC LIMIT 5;
    """)
    recent_patients = [dict(r) for r in cur.fetchall()]
    for rp in recent_patients:
        if rp.get("dob"):
            derived = calculate_age_from_dob(rp["dob"])
            if derived is not None:
                rp["age"] = derived

    # Recent studies
    cur.execute("""
    SELECT s.id, s.study_id, s.patient_id, s.recorded_at, s.status, s.flags_json,
           s.quality_status, s.quality_score,
           p.name AS patient_name, p.patient_id AS patient_display_id
    FROM ecg_studies s
    JOIN patients p ON s.patient_id = p.id
    ORDER BY s.recorded_at DESC LIMIT 6;
    """)
    recent_studies_rows = cur.fetchall()
    recent_studies = []
    for sr in recent_studies_rows:
        sd = dict(sr)
        sd["flags"] = json.loads(sd.get("flags_json") or "[]")
        recent_studies.append(sd)

    # Recent notes
    cur.execute("""
    SELECT n.id, n.note_id, n.study_id, n.patient_id, n.author, n.status, n.updated_at,
           p.name AS patient_name, s.study_id AS study_display_id
    FROM clinical_notes n
    JOIN patients p ON n.patient_id = p.id
    JOIN ecg_studies s ON n.study_id = s.id
    ORDER BY n.updated_at DESC LIMIT 5;
    """)
    recent_notes = [dict(r) for r in cur.fetchall()]

    conn.close()

    return {
        "total_patients": total_patients,
        "total_studies": total_studies,
        "awaiting_review_count": awaiting_count,
        "in_progress_count": in_progress_count,
        "reviewed_finalized_count": reviewed_count,
        "recent_patients": recent_patients,
        "recent_studies": recent_studies,
        "recent_notes": recent_notes,
        "quick_actions": [
            {"id": "register_patient", "label": "Register Patient", "icon": "UserPlus"},
            {"id": "worklist", "label": "Review ECG Worklist", "icon": "ClipboardList"},
            {"id": "upload_ecg", "label": "Upload ECG Study", "icon": "Upload"},
            {"id": "continue_study", "label": "Continue Pending Study", "icon": "PlayCircle"},
        ]
    }
