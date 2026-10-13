"""
FastAPI Server for PTB-XL ECG Intelligence Platform.
Implements the comprehensive REST API for model evaluation, multi-lead inference,
wavelet feature extraction, Integrated Gradients explainability, and faithfulness testing.
"""

import os
import io
import sys
import glob
import json
import time
import tempfile
from typing import Optional, List, Dict, Any, Union
import numpy as np
import torch
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure src/ is in sys.path
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, ".."))
SRC_DIR = os.path.join(PROJECT_ROOT, "src")
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from ecg_intelligence import CLASSES, LEADS, CLASS_NAMES, FS
from ecg_intelligence.models.classifier import build_torch_model
from ecg_intelligence.explainability.integrated_gradients import compute_integrated_gradients
from ecg_intelligence.explainability.attribution import compute_lead_attributions
from ecg_intelligence.explainability.lead_ablation import compute_lead_ablation
from ecg_intelligence.explainability.time_regions import extract_top_time_regions
from ecg_intelligence.explainability.deletion_test import compute_faithfulness_curves
from ecg_intelligence.features.extractor import extract_handcrafted_features
from ecg_intelligence.preprocessing.resampling import ensure_1000x12
from ecg_intelligence.data.parser import parse_csv_ecg, parse_numpy_ecg, parse_wfdb_record

app = FastAPI(
    title="PTB-XL ECG Intelligence API",
    description="Clinical research intelligence engine for 12-lead ECG analysis and explainability",
    version="1.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache discovery: look in ECG_CACHE, artifacts/cache, or cache/
def resolve_cache_dir() -> str:
    env_cache = os.environ.get("ECG_CACHE")
    if env_cache and os.path.exists(env_cache):
        return env_cache
    art_cache = os.path.join(PROJECT_ROOT, "artifacts", "cache")
    if os.path.exists(art_cache):
        return art_cache
    root_cache = os.path.join(PROJECT_ROOT, "cache")
    if os.path.exists(root_cache):
        return root_cache
    return art_cache

CACHE_DIR = resolve_cache_dir()
DIST_DIR = os.path.join(PROJECT_ROOT, "frontend", "dist")
UI_DIR = os.path.join(PROJECT_ROOT, "ui")

# Global ML State
_LOADED_MODELS: Dict[str, Any] = {}
_NORM_STATS: Optional[Dict[str, np.ndarray]] = None
_SAMPLES_DATA: Optional[Dict[str, Any]] = None
_THRESHOLDS_CACHE: Dict[str, Dict[str, float]] = {}
_ACTIVE_MODEL: str = "seq"  # Default to best macro AUROC model
_SERVER_START_TIME = time.time()
_INFERENCE_COUNT = 0
_LAST_INFERENCE_META: Optional[Dict[str, Any]] = None


# Architecture metadata catalog
MODEL_METADATA: Dict[str, Dict[str, Any]] = {
    "seq": {
        "name": "seq",
        "display_name": "Sequence Model (ResNet1D + BiGRU + Attn)",
        "arch_mode": "seq",
        "checkpoint": "model_seq.pt",
        "description": "1D ResNet convolutional stem paired with a bidirectional GRU and temporal soft attention pooling. Ranked #1 overall.",
        "input_type": "Raw ECG (12x1000)",
        "features_used": "Raw signals only",
    },
    "cnn": {
        "name": "cnn",
        "display_name": "ResNet1D Baseline (GAP)",
        "arch_mode": "cnn",
        "checkpoint": "model_cnn.pt",
        "description": "Deep 1D residual convolutional neural network with global average pooling (GAP).",
        "input_type": "Raw ECG (12x1000)",
        "features_used": "Raw signals only",
    },
    "hybrid": {
        "name": "hybrid",
        "display_name": "Concatenation Hybrid",
        "arch_mode": "hybrid",
        "checkpoint": "model_hybrid.pt",
        "description": "Deep ResNet + BiGRU features concatenated directly with 139 handcrafted wavelet and statistical features.",
        "input_type": "Raw ECG + 139 Handcrafted Features",
        "features_used": "Wavelet subband energies, statistical moments, Lead II HRV",
    },
    "gated": {
        "name": "gated",
        "display_name": "Adaptive Gated Fusion (Proposed)",
        "arch_mode": "gated",
        "checkpoint": "model_gated.pt",
        "description": "Proposed multimodal architecture featuring a learnable 96-D gating mechanism dynamically arbitrating between deep and handcrafted representations.",
        "input_type": "Raw ECG + 139 Handcrafted Features",
        "features_used": "Wavelet subband energies, statistical moments, Lead II HRV",
    },
    "multiscale_current": {
        "name": "multiscale_current",
        "display_name": "Multi-Scale ResNet (Current)",
        "arch_mode": "multiscale",
        "checkpoint": "model_multiscale_current.pt",
        "description": "Multi-branch 1D ResNet with parallel kernel sizes (7, 15, 31) and Squeeze-and-Excitation channel attention.",
        "input_type": "Raw ECG (12x1000)",
        "features_used": "Raw signals only",
    },
    "multiscale_reg2": {
        "name": "multiscale_reg2",
        "display_name": "Multi-Scale ResNet (Reg-2)",
        "arch_mode": "multiscale",
        "checkpoint": "model_multiscale_reg2.pt",
        "description": "Multi-Scale ResNet with regularized training and non-wrapping temporal shift data augmentation.",
        "input_type": "Raw ECG (12x1000)",
        "features_used": "Raw signals only",
    },
    "multiscale_shift": {
        "name": "multiscale_shift",
        "display_name": "Multi-Scale ResNet (Shift)",
        "arch_mode": "multiscale",
        "checkpoint": "model_multiscale_shift.pt",
        "description": "Multi-Scale ResNet with non-wrapping shift augmentation.",
        "input_type": "Raw ECG (12x1000)",
        "features_used": "Raw signals only",
    },
    "multiscale_noise": {
        "name": "multiscale_noise",
        "display_name": "Multi-Scale ResNet (Noise)",
        "arch_mode": "multiscale",
        "checkpoint": "model_multiscale_noise.pt",
        "description": "Multi-Scale ResNet trained with Gaussian noise augmentation only.",
        "input_type": "Raw ECG (12x1000)",
        "features_used": "Raw signals only",
    },
    "multiscale_none": {
        "name": "multiscale_none",
        "display_name": "Multi-Scale ResNet (No Aug)",
        "arch_mode": "multiscale",
        "checkpoint": "model_multiscale_none.pt",
        "description": "Multi-Scale ResNet trained without data augmentation.",
        "input_type": "Raw ECG (12x1000)",
        "features_used": "Raw signals only",
    },
    "ens_gated": {
        "name": "ens_gated",
        "display_name": "Probability Ensemble (Gated)",
        "arch_mode": "ensemble",
        "checkpoint": None,
        "description": "Probability-level ensemble blending outputs across deep sequence and gated architectures.",
        "input_type": "Ensemble",
        "features_used": "Blended probabilities",
    },
    "xgb": {
        "name": "xgb",
        "display_name": "XGBoost Handcrafted Baseline",
        "arch_mode": "xgboost",
        "checkpoint": None,
        "description": "Gradient boosted decision trees trained on 139 clinical handcrafted features.",
        "input_type": "139 Handcrafted Features",
        "features_used": "Wavelet subband energies, statistical moments, Lead II HRV",
    },
}


def load_norm_stats() -> Dict[str, np.ndarray]:
    global _NORM_STATS
    if _NORM_STATS is not None:
        return _NORM_STATS
    norm_path = os.path.join(CACHE_DIR, "norm.npz")
    if not os.path.exists(norm_path):
        raise FileNotFoundError(f"Missing normalization statistics at '{norm_path}'.")
    ns = np.load(norm_path)
    _NORM_STATS = {k: ns[k] for k in ns.files}
    return _NORM_STATS


def load_samples() -> Optional[Dict[str, Any]]:
    global _SAMPLES_DATA
    if _SAMPLES_DATA is not None:
        return _SAMPLES_DATA
    samples_path = os.path.join(CACHE_DIR, "samples.npz")
    if os.path.exists(samples_path):
        try:
            _SAMPLES_DATA = np.load(samples_path)
        except Exception as e:
            print(f"Warning: Failed to load samples.npz: {e}")
    return _SAMPLES_DATA


def get_thresholds_for_model(model_name: str) -> Dict[str, float]:
    if model_name in _THRESHOLDS_CACHE:
        return _THRESHOLDS_CACHE[model_name]

    result_path = os.path.join(CACHE_DIR, f"result_{model_name}.json")
    thresholds = {c: 0.5 for c in CLASSES}
    if os.path.exists(result_path):
        try:
            with open(result_path, "r", encoding="utf-8") as f:
                r = json.load(f)
                loaded_t = r.get("thresholds", {})
                for c in CLASSES:
                    if c in loaded_t:
                        thresholds[c] = float(loaded_t[c])
        except Exception:
            pass
    elif model_name == "gated":
        # Fallback to validation CSV if result json missing
        csv_path = os.path.join(CACHE_DIR, "gated_thresholds_validation.csv")
        if os.path.exists(csv_path):
            try:
                import pandas as pd
                df = pd.read_csv(csv_path)
                for _, row in df.iterrows():
                    cls_name = str(row["Class"]).strip()
                    if cls_name in thresholds:
                        thresholds[cls_name] = float(row["Threshold"])
            except Exception:
                pass

    _THRESHOLDS_CACHE[model_name] = thresholds
    return thresholds


def get_model(model_name: str):
    """
    Retrieves or lazily loads a PyTorch model into memory.
    """
    if model_name in _LOADED_MODELS:
        return _LOADED_MODELS[model_name]

    if model_name not in MODEL_METADATA:
        raise HTTPException(status_code=400, detail=f"Unknown model identifier '{model_name}'.")

    meta = MODEL_METADATA[model_name]
    ckpt_name = meta.get("checkpoint")
    if not ckpt_name:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{model_name}' has evaluation metrics only (checkpoint not available for live inference)."
        )

    ckpt_path = os.path.join(CACHE_DIR, ckpt_name)
    if not os.path.exists(ckpt_path):
        raise HTTPException(
            status_code=404,
            detail=f"Checkpoint file '{ckpt_name}' not found in cache '{CACHE_DIR}'."
        )

    ns = load_norm_stats()
    num_features = len(ns["fm"])
    arch_mode = meta["arch_mode"]

    try:
        net = build_torch_model(num_features=num_features, mode=arch_mode, num_classes=5)
        state_dict = torch.load(ckpt_path, map_location="cpu", weights_only=True)
        net.load_state_dict(state_dict)
        net.eval()
        _LOADED_MODELS[model_name] = net
        return net
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize model '{model_name}' from checkpoint '{ckpt_name}': {str(e)}"
        )


# Pre-load default model on startup
try:
    load_norm_stats()
    load_samples()
    get_model(_ACTIVE_MODEL)
    print(f"Loaded default inference model: {_ACTIVE_MODEL}")
except Exception as err:
    print(f"Warning: Initial startup model load notice: {err}")


# Request Models
class AnalyzeRequest(BaseModel):
    signal: List[List[float]] = Field(..., description="ECG signal array, shape (1000, 12)")
    model: Optional[str] = Field(None, description="Optional model to run, defaults to active model")
    explain: Optional[str] = Field(None, description="Diagnostic superclass to explain (CD, HYP, MI, NORM, STTC)")
    explain_steps: Optional[int] = Field(40, description="Riemann steps for Integrated Gradients")


class ExplainRequest(BaseModel):
    signal: List[List[float]]
    model: Optional[str] = None
    target_class: str
    steps: Optional[int] = 40


class FaithfulnessRequest(BaseModel):
    signal: List[List[float]]
    model: Optional[str] = None
    target_class: str
    top_fraction: Optional[float] = 0.10


class LeadAblationRequest(BaseModel):
    signal: List[List[float]]
    model: Optional[str] = None
    target_class: str


class SelectModelRequest(BaseModel):
    model: str


# ==========================================
# API Routes
# ==========================================

@app.get("/api/health")
def get_health():
    """
    Health check returning backend status, active model, cache discovery,
    device info, and session statistics.
    """
    norm_exists = os.path.exists(os.path.join(CACHE_DIR, "norm.npz"))
    active_ckpt = os.path.join(CACHE_DIR, f"model_{_ACTIVE_MODEL}.pt")
    ckpt_exists = os.path.exists(active_ckpt)

    status = "healthy" if (norm_exists and ckpt_exists) else "degraded"

    return {
        "status": status,
        "active_model": _ACTIVE_MODEL,
        "device": "cpu",
        "cache_dir": CACHE_DIR,
        "norm_loaded": _NORM_STATS is not None,
        "active_model_loaded": _ACTIVE_MODEL in _LOADED_MODELS,
        "loaded_models": list(_LOADED_MODELS.keys()),
        "uptime_sec": round(time.time() - _SERVER_START_TIME, 1),
        "session_inferences": _INFERENCE_COUNT,
        "last_inference": _LAST_INFERENCE_META,
        "classes": CLASSES,
        "leads": LEADS,
        "sampling_rate": FS,
    }


@app.get("/api/models")
def get_models():
    """
    Returns full model registry with architecture specs, checkpoint availability,
    inference readiness, parameter counts, and saved evaluation metrics.
    """
    models_list = []

    # Read comparison.json for recorded metrics
    comparison_data = {}
    comp_json_path = os.path.join(CACHE_DIR, "comparison.json")
    if os.path.exists(comp_json_path):
        try:
            with open(comp_json_path, "r", encoding="utf-8") as f:
                raw_comp = json.load(f)
                for item in raw_comp:
                    comparison_data[item.get("model")] = item
        except Exception:
            pass

    for key, meta in MODEL_METADATA.items():
        ckpt_name = meta.get("checkpoint")
        ckpt_exists = False
        ckpt_size_bytes = None
        if ckpt_name:
            p = os.path.join(CACHE_DIR, ckpt_name)
            if os.path.exists(p):
                ckpt_exists = True
                ckpt_size_bytes = os.path.getsize(p)

        inference_ready = ckpt_exists and (meta["arch_mode"] in ("cnn", "multiscale", "seq", "hybrid", "gated"))
        comp_item = comparison_data.get(key, {})
        thresholds = get_thresholds_for_model(key)

        models_list.append({
            "id": key,
            "name": key,
            "display_name": meta["display_name"],
            "description": meta["description"],
            "architecture": meta["arch_mode"],
            "input_type": meta["input_type"],
            "features_used": meta["features_used"],
            "checkpoint_name": ckpt_name,
            "checkpoint_size_bytes": ckpt_size_bytes,
            "checkpoint_exists": ckpt_exists,
            "inference_ready": inference_ready,
            "is_active": (key == _ACTIVE_MODEL),
            "param_count": comp_item.get("param_count"),
            "macro_auc": comp_item.get("macro_auc"),
            "macro_auprc": comp_item.get("macro_auprc"),
            "macro_f1": comp_item.get("macro_f1"),
            "macro_sensitivity": comp_item.get("macro_sensitivity"),
            "macro_specificity": comp_item.get("macro_specificity"),
            "training_duration_sec": comp_item.get("training_duration_sec"),
            "inference_latency_ms": comp_item.get("inference_latency_ms"),
            "aug_mode": comp_item.get("aug_mode"),
            "best_epoch": comp_item.get("best_epoch"),
            "thresholds": thresholds,
        })

    return {
        "active_model": _ACTIVE_MODEL,
        "models": models_list
    }


@app.post("/api/models/select")
def select_active_model(req: SelectModelRequest):
    """
    Switches the active inference model among loadable models.
    """
    global _ACTIVE_MODEL
    target = req.model.strip()

    if target not in MODEL_METADATA:
        raise HTTPException(status_code=400, detail=f"Unknown model identifier '{target}'.")

    meta = MODEL_METADATA[target]
    if not meta.get("checkpoint"):
        raise HTTPException(
            status_code=400,
            detail=f"Model '{target}' does not have a checkpoint and cannot be selected for live inference."
        )

    # Validate that checkpoint loads
    try:
        get_model(target)
        _ACTIVE_MODEL = target
        return {
            "status": "success",
            "active_model": _ACTIVE_MODEL,
            "message": f"Active model set to '{target}'."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load requested model '{target}': {str(e)}"
        )


@app.get("/api/metrics")
def get_metrics():
    """
    Returns comparative evaluation results, research summary figures,
    and per-class performance tables from saved artifacts.
    """
    comp_json_path = os.path.join(CACHE_DIR, "comparison.json")
    comparison = []
    if os.path.exists(comp_json_path):
        try:
            with open(comp_json_path, "r", encoding="utf-8") as f:
                comparison = json.load(f)
        except Exception:
            pass

    # Per-class metrics for all models
    per_class_results = {}
    result_files = glob.glob(os.path.join(CACHE_DIR, "result_*.json"))
    for rf in result_files:
        m_name = os.path.basename(rf)[7:-5]
        try:
            with open(rf, "r", encoding="utf-8") as f:
                data = json.load(f)
                per_class_results[m_name] = {
                    "auc": data.get("auc", {}),
                    "auprc": data.get("auprc", {}),
                    "f1": data.get("f1", {}),
                    "sensitivity": data.get("sensitivity", {}),
                    "specificity": data.get("specificity", {}),
                    "confusion": data.get("confusion_[[TN,FP],[FN,TP]]", {}),
                    "thresholds": data.get("thresholds", {}),
                }
        except Exception:
            pass

    # Research dataset and protocol statistics
    research_summary = {
        "dataset_name": "PTB-XL (PhysioNet)",
        "dataset_version": "1.0.3",
        "labelled_records": 21388,
        "unique_patients": 18617,
        "categories": CLASSES,
        "category_names": CLASS_NAMES,
        "split_protocol": "10-Fold Patient-Separated (Folds 1-8 Train, Fold 9 Val, Fold 10 Test)",
        "test_fold": 10,
        "test_record_count": 2158,
        "validation_record_count": 2146,
        "sampling_rate_hz": 100,
        "signal_duration_sec": 10.0,
        "lead_count": 12,
        "best_model": "seq",
        "best_macro_auroc": 0.925374,
        "best_bootstrap_ci_95": [0.9184, 0.9317],
        "best_macro_auprc": 0.815719,
        "best_macro_f1": 0.735471,
    }

    return {
        "research_summary": research_summary,
        "comparison": comparison,
        "per_class": per_class_results,
    }


@app.get("/api/samples")
def list_samples():
    """
    Returns catalogue of the 40 preloaded test-set records from samples.npz.
    """
    samples_data = load_samples()
    if samples_data is None:
        return {"samples": [], "total": 0}

    X = samples_data["X"]
    Y = samples_data.get("Y")

    items = []
    for i in range(len(X)):
        labels = []
        if Y is not None:
            labels = [CLASSES[idx] for idx, val in enumerate(Y[i]) if val == 1]
        items.append({
            "index": i,
            "leads": 12,
            "samples": 1000,
            "duration_sec": 10.0,
            "labels": labels,
            "label_names": [CLASS_NAMES.get(l, l) for l in labels]
        })

    return {
        "total": len(items),
        "samples": items
    }


@app.get("/api/sample/{index}")
def get_sample_by_index(index: int):
    """
    Retrieves the raw signal array and genuine PTB-XL labels for sample i.
    """
    samples_data = load_samples()
    if samples_data is None:
        raise HTTPException(status_code=404, detail="Preloaded samples archive 'samples.npz' not found.")

    X = samples_data["X"]
    Y = samples_data.get("Y")

    if index < 0 or index >= len(X):
        raise HTTPException(status_code=404, detail=f"Sample index {index} out of bounds (0 to {len(X) - 1}).")

    sig = X[index].astype(float)
    labels = []
    if Y is not None:
        labels = [CLASSES[idx] for idx, val in enumerate(Y[index]) if val == 1]

    return {
        "index": index,
        "signal": sig.tolist(),
        "labels": labels,
        "label_names": [CLASS_NAMES.get(l, l) for l in labels],
        "leads": LEADS,
        "sampling_rate": FS,
        "duration_sec": 10.0,
        "units": "mV"
    }


@app.post("/api/ecg/validate")
async def validate_ecg_upload(request: Request):
    """
    Validates uploaded ECG data from CSV, NPY, NPZ, WFDB records, or JSON body.
    Returns signal metadata and validated array preview.
    """
    content_type = request.headers.get("content-type", "").lower()
    try:
        if "application/json" in content_type:
            body = await request.json()
            if not isinstance(body, dict) or "signal" not in body:
                raise ValueError("JSON request body must contain 'signal' array.")
            raw_sig = np.array(body["signal"], dtype=np.float32)
            arr = ensure_1000x12(raw_sig)
            if np.isnan(arr).any() or np.isinf(arr).any():
                raise ValueError("Signal contains NaN or Inf values.")

            meta = {
                "format": "json",
                "filename": body.get("filename", "raw_signal.json"),
                "original_samples": raw_sig.shape[0],
                "n_samples": 1000,
                "n_leads": 12,
                "leads": LEADS,
                "resampled": (raw_sig.shape[0] != 1000),
                "duration_sec": 10.0,
                "sampling_rate": FS,
                "units": "mV",
                "min_val": float(arr.min()),
                "max_val": float(arr.max()),
                "mean_val": float(arr.mean()),
                "std_val": float(arr.std()),
                "validation_status": "valid"
            }
            return {
                "valid": True,
                "metadata": meta,
                "signal": arr.tolist()
            }

        elif "multipart/form-data" in content_type:
            form = await request.form()
            file = form.get("file")
            dat_file = form.get("dat_file")

            if file is None or not hasattr(file, "read"):
                raise ValueError("No file uploaded in form field 'file'.")

            filename = getattr(file, "filename", "upload") or "upload"
            ext = os.path.splitext(filename)[1].lower()
            content = await file.read()

            if ext == ".csv":
                arr, meta = parse_csv_ecg(content)
            elif ext == ".npy":
                arr, meta = parse_numpy_ecg(content, is_npz=False)
            elif ext == ".npz":
                arr, meta = parse_numpy_ecg(content, is_npz=True)
            elif ext == ".hea":
                if dat_file is None or not hasattr(dat_file, "read"):
                    raise ValueError("WFDB .hea header upload requires matching .dat signal file in 'dat_file'.")
                dat_content = await dat_file.read()
                record_base = os.path.splitext(filename)[0]
                arr, meta = parse_wfdb_record(content, dat_content, record_name=record_base)
            else:
                raise ValueError(f"Unsupported file format '{ext}'. Supported formats: .csv, .npy, .npz, .hea/.dat")

            meta["filename"] = filename
            meta["validation_status"] = "valid"
            return {
                "valid": True,
                "metadata": meta,
                "signal": arr.tolist()
            }
        else:
            # Fallback attempt: try parsing as json
            try:
                body = await request.json()
                if "signal" in body:
                    arr = ensure_1000x12(np.array(body["signal"], dtype=np.float32))
                    meta = {
                        "format": "json",
                        "filename": "raw_signal.json",
                        "original_samples": arr.shape[0],
                        "n_samples": 1000,
                        "n_leads": 12,
                        "leads": LEADS,
                        "resampled": False,
                        "duration_sec": 10.0,
                        "sampling_rate": FS,
                        "units": "mV",
                        "min_val": float(arr.min()),
                        "max_val": float(arr.max()),
                        "mean_val": float(arr.mean()),
                        "std_val": float(arr.std()),
                        "validation_status": "valid"
                    }
                    return {"valid": True, "metadata": meta, "signal": arr.tolist()}
            except Exception:
                pass
            raise ValueError(f"Unsupported content-type: '{content_type}'. Must be application/json or multipart/form-data.")

    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={
                "valid": False,
                "error": str(e),
                "validation_status": "rejected"
            }
        )


@app.post("/api/ecg/analyze")
def analyze_ecg(req: AnalyzeRequest):
    """
    Executes actual model inference on validated 1000x12 ECG signal.
    Returns:
    - Five diagnostic superclass probabilities
    - Validation-derived classification thresholds
    - Binary threshold flags
    - Inference execution latency in milliseconds
    - Gate allocation weights (for gated model)
    - Optional Integrated Gradients attribution and lead ranking
    """
    global _INFERENCE_COUNT, _LAST_INFERENCE_META

    model_name = req.model or _ACTIVE_MODEL
    net = get_model(model_name)
    ns = load_norm_stats()
    thresholds = get_thresholds_for_model(model_name)

    # 1. Shape validation & resampling
    try:
        raw_sig = np.array(req.signal, dtype=np.float32)
        sig = ensure_1000x12(raw_sig)  # (1000, 12)
        if np.isnan(sig).any() or np.isinf(sig).any():
            raise ValueError("Signal contains NaN or Inf values.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid signal shape or values: {str(e)}")

    # 2. Standardize signal using frozen training fold statistics
    # Transpose to PyTorch (1, 12, 1000)
    x_norm = ((sig - ns["mu"]) / ns["sd"]).T[None].astype(np.float32)

    # 3. Handcrafted feature extraction (if model requires it)
    f_tensor = None
    meta = MODEL_METADATA.get(model_name, {})
    arch_mode = meta.get("arch_mode", "seq")

    if arch_mode in ("hybrid", "gated", "feat"):
        feat = extract_handcrafted_features(sig)
        f_norm = ((feat - ns["fm"]) / ns["fs"])[None].astype(np.float32)
        f_tensor = torch.from_numpy(f_norm)

    x_tensor = torch.from_numpy(x_norm)

    # 4. Run model inference with latency measurement
    t_start = time.perf_counter()
    with torch.no_grad():
        logits = net(x_tensor, f_tensor)
        probs_arr = torch.sigmoid(logits)[0].numpy()
    latency_ms = round((time.perf_counter() - t_start) * 1000.0, 2)

    # Update session counters
    _INFERENCE_COUNT += 1
    _LAST_INFERENCE_META = {
        "timestamp": time.time(),
        "model": model_name,
        "latency_ms": latency_ms,
    }

    # 5. Format results with validation thresholds
    predictions = []
    probs_dict = {}
    for idx, c in enumerate(CLASSES):
        prob = float(probs_arr[idx])
        probs_dict[c] = prob
        t = thresholds.get(c, 0.5)
        predictions.append({
            "class": c,
            "name": CLASS_NAMES.get(c, c),
            "probability": prob,
            "threshold": t,
            "detected": bool(prob >= t),
        })

    # Sort descending by probability
    predictions.sort(key=lambda x: x["probability"], reverse=True)

    # 6. Extract gate weights for gated fusion
    gate_val = None
    if arch_mode == "gated" and hasattr(net, "gate_val") and net.gate_val is not None:
        gate_val = float(net.gate_val.mean().item())

    # 7. Optional Integrated Gradients attribution
    attribution = None
    lead_importance = None
    target_class = req.explain
    if not target_class or target_class not in CLASSES:
        top_idx = int(np.argmax(probs_arr))
        target_class = CLASSES[top_idx]

    try:
        t_idx = CLASSES.index(target_class)
        ig_tensor = compute_integrated_gradients(
            net, x_tensor, f_tensor, t_idx, steps=req.explain_steps or 40
        )
        # ig_tensor is (12, 1000)
        ig_arr = ig_tensor.cpu().numpy()
        attribution = ig_arr.tolist()

        # Compute lead importance
        top_lead_idx, lead_mags = compute_lead_attributions(ig_arr)
        total_mag = sum(lead_mags) + 1e-9
        lead_importance = [
            {
                "lead": LEADS[l_idx],
                "score": float(lead_mags[l_idx]),
                "normalized": float(lead_mags[l_idx] / total_mag),
            }
            for l_idx in range(12)
        ]
        lead_importance.sort(key=lambda x: x["score"], reverse=True)

        # Extract top temporal attribution regions
        try:
            time_regions = extract_top_time_regions(ig_arr, window_size=15, num_regions=5)
        except Exception as te:
            time_regions = None
    except Exception as e:
        print(f"Attribution notice: {e}")
        time_regions = None

    return {
        "model": model_name,
        "model_display_name": meta.get("display_name", model_name),
        "latency_ms": latency_ms,
        "probabilities": probs_dict,
        "thresholds": thresholds,
        "predictions": predictions,
        "gate_weight_deep": gate_val,
        "explain_class": target_class,
        "attribution": attribution,
        "lead_importance": lead_importance,
        "time_regions": time_regions,
        "disclaimer": "Research use only. Model outputs are experimental and are not a clinical diagnosis. ECG interpretation and medical decisions require qualified healthcare professionals."
    }


@app.post("/api/explain")
def explain_ecg(req: ExplainRequest):
    """
    Computes Integrated Gradients attribution map and per-lead importance.
    """
    model_name = req.model or _ACTIVE_MODEL
    net = get_model(model_name)
    ns = load_norm_stats()

    if req.target_class not in CLASSES:
        raise HTTPException(status_code=400, detail=f"Target class must be one of {CLASSES}")

    try:
        sig = ensure_1000x12(np.array(req.signal, dtype=np.float32))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid signal: {str(e)}")

    x_norm = ((sig - ns["mu"]) / ns["sd"]).T[None].astype(np.float32)
    x_tensor = torch.from_numpy(x_norm)

    f_tensor = None
    meta = MODEL_METADATA.get(model_name, {})
    if meta.get("arch_mode") in ("hybrid", "gated", "feat"):
        feat = extract_handcrafted_features(sig)
        f_norm = ((feat - ns["fm"]) / ns["fs"])[None].astype(np.float32)
        f_tensor = torch.from_numpy(f_norm)

    t_idx = CLASSES.index(req.target_class)
    try:
        ig_tensor = compute_integrated_gradients(
            net, x_tensor, f_tensor, t_idx, steps=req.steps or 40
        )
        ig_arr = ig_tensor.cpu().numpy()
        top_lead_idx, lead_mags = compute_lead_attributions(ig_arr)
        total_mag = sum(lead_mags) + 1e-9

        lead_importance = [
            {
                "lead": LEADS[l_idx],
                "score": float(lead_mags[l_idx]),
                "normalized": float(lead_mags[l_idx] / total_mag),
            }
            for l_idx in range(12)
        ]
        lead_importance.sort(key=lambda x: x["score"], reverse=True)

        # Extract top temporal regions
        time_regions = extract_top_time_regions(ig_arr, window_size=15, num_regions=5)

        return {
            "model": model_name,
            "target_class": req.target_class,
            "steps": req.steps or 40,
            "attribution": ig_arr.tolist(),
            "lead_importance": lead_importance,
            "time_regions": time_regions,
            "top_lead": LEADS[top_lead_idx],
            "baseline": "zero (corresponds to training fold mean)"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Integrated Gradients computation failed: {str(e)}")


@app.post("/api/explain/lead_ablation")
def explain_lead_ablation(req: LeadAblationRequest):
    """
    Performs interventional lead ablation: masks each lead to 0.0 (baseline)
    and measures the actual score drop (Delta P) for the target diagnostic class.
    """
    model_name = req.model or _ACTIVE_MODEL
    net = get_model(model_name)
    ns = load_norm_stats()

    if req.target_class not in CLASSES:
        raise HTTPException(status_code=400, detail=f"Target class must be one of {CLASSES}")

    try:
        sig = ensure_1000x12(np.array(req.signal, dtype=np.float32))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid signal: {str(e)}")

    x_norm = ((sig - ns["mu"]) / ns["sd"]).T[None].astype(np.float32)
    x_tensor = torch.from_numpy(x_norm)

    f_tensor = None
    meta = MODEL_METADATA.get(model_name, {})
    if meta.get("arch_mode") in ("hybrid", "gated", "feat"):
        feat = extract_handcrafted_features(sig)
        f_norm = ((feat - ns["fm"]) / ns["fs"])[None].astype(np.float32)
        f_tensor = torch.from_numpy(f_norm)

    t_idx = CLASSES.index(req.target_class)
    try:
        ablation_results = compute_lead_ablation(net, x_tensor, f_tensor, t_idx)
        return {
            "model": model_name,
            "target_class": req.target_class,
            "leads": ablation_results,
            "baseline": "0.0 (training fold mean)",
            "method": "Interventional Zero-Masking",
            "interpretation": "Interventional score drop (Delta P) when zeroing out each lead independently. Independent from first-order gradient attribution."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lead ablation computation failed: {str(e)}")


@app.post("/api/explain/faithfulness")
def explain_faithfulness(req: FaithfulnessRequest):
    """
    Performs comprehensive deletion and insertion faithfulness experiments:
    Computes multi-step Deletion and Insertion curves comparing top-attributed
    regions against random baselines across multiple perturbation fractions.
    """
    model_name = req.model or _ACTIVE_MODEL
    net = get_model(model_name)
    ns = load_norm_stats()

    if req.target_class not in CLASSES:
        raise HTTPException(status_code=400, detail=f"Target class must be one of {CLASSES}")

    try:
        sig = ensure_1000x12(np.array(req.signal, dtype=np.float32))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid signal: {str(e)}")

    x_norm = ((sig - ns["mu"]) / ns["sd"]).T[None].astype(np.float32)
    x_tensor = torch.from_numpy(x_norm)

    f_tensor = None
    meta = MODEL_METADATA.get(model_name, {})
    if meta.get("arch_mode") in ("hybrid", "gated", "feat"):
        feat = extract_handcrafted_features(sig)
        f_norm = ((feat - ns["fm"]) / ns["fs"])[None].astype(np.float32)
        f_tensor = torch.from_numpy(f_norm)

    c_idx = CLASSES.index(req.target_class)

    try:
        # Compute Integrated Gradients
        ig = compute_integrated_gradients(net, x_tensor, f_tensor, c_idx, steps=40)

        # Multi-step Deletion and Insertion curves
        curves = compute_faithfulness_curves(
            net, x_tensor, f_tensor, ig, c_idx, fractions=[0.05, 0.10, 0.15, 0.20, 0.25, 0.30]
        )

        return {
            "model": model_name,
            "target_class": req.target_class,
            "initial_prob": curves["initial_prob"],
            "baseline_prob": curves["baseline_prob"],
            "removed_fraction": req.top_fraction or 0.10,
            "top_ig_prob_after_deletion": round(curves["initial_prob"] - curves["top_ig_drop_10pct"], 4),
            "top_ig_prob_drop": curves["top_ig_drop_10pct"],
            "random_prob_after_deletion": round(curves["initial_prob"] - curves["random_drop_10pct"], 4),
            "random_prob_drop": curves["random_drop_10pct"],
            "ratio_drop": curves["ratio_drop_10pct"],
            "deletion_curve": curves["deletion_curve"],
            "insertion_curve": curves["insertion_curve"],
            "audc_ig": curves["audc_ig"],
            "audc_rand": curves["audc_rand"],
            "auic_ig": curves["auic_ig"],
            "auic_rand": curves["auic_rand"],
            "audc_drop_ratio": curves.get("audc_drop_ratio", 1.0),
            "interpretation": curves["interpretation"],
            "note": curves["note"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Faithfulness perturbation test failed: {str(e)}")


# ==========================================
# Backward Compatibility Endpoints
# ==========================================

@app.get("/api/info")
def get_info_compat():
    """Backward compatibility for legacy UI /api/info"""
    n_samples = 0
    samples_data = load_samples()
    if samples_data is not None and "X" in samples_data:
        n_samples = len(samples_data["X"])

    # Load comparison.json
    comp_json_path = os.path.join(CACHE_DIR, "comparison.json")
    experiments = []
    if os.path.exists(comp_json_path):
        try:
            with open(comp_json_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
                for item in raw:
                    experiments.append({
                        "name": item.get("model"),
                        "macro_auc": float(item.get("macro_auc", 0.0)),
                        "macro_auprc": float(item.get("macro_auprc", 0.0)),
                        "macro_f1": float(item.get("macro_f1", 0.0)),
                        "macro_sensitivity": float(item.get("macro_sensitivity", 0.0)),
                    })
        except Exception:
            pass

    per_class = None
    active_result_path = os.path.join(CACHE_DIR, f"result_{_ACTIVE_MODEL}.json")
    if os.path.exists(active_result_path):
        try:
            with open(active_result_path, "r", encoding="utf-8") as f:
                r = json.load(f)
                per_class = {
                    "auc": r.get("auc", {}),
                    "auprc": r.get("auprc", {}),
                    "f1": r.get("f1", {}),
                    "sensitivity": r.get("sensitivity", {}),
                }
        except Exception:
            pass

    return {
        "model": _ACTIVE_MODEL,
        "n_samples": n_samples,
        "experiments": experiments,
        "per_class": per_class,
        "checkpoint_loaded": _ACTIVE_MODEL in _LOADED_MODELS,
        "notice": None
    }


@app.get("/api/sample/{i}")
def get_sample_compat(i: int):
    return get_sample_by_index(i)


class PredictRequestCompat(BaseModel):
    signal: List[List[float]]
    explain: Optional[str] = None


@app.post("/api/predict")
def predict_compat(req: PredictRequestCompat):
    """Backward compatibility for legacy UI POST /api/predict"""
    analysis = analyze_ecg(AnalyzeRequest(signal=req.signal, explain=req.explain))
    return {
        "probs": analysis["probabilities"],
        "thresholds": analysis["thresholds"],
        "gate": analysis["gate_weight_deep"],
        "explain_class": analysis["explain_class"],
        "attribution": analysis["attribution"],
    }


# ==========================================
# Static Frontend Serving
# ==========================================

# First check if frontend dist exists
if os.path.exists(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_react_app(full_path: str):
        target = os.path.join(DIST_DIR, full_path)
        if full_path and os.path.exists(target) and os.path.isfile(target):
            return FileResponse(target)
        index_file = os.path.join(DIST_DIR, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend build index not found")

elif os.path.exists(UI_DIR):
    # Fallback to legacy UI if react app not built yet
    app.mount("/static", StaticFiles(directory=UI_DIR), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(UI_DIR, "index.html"))

    @app.get("/{filename}")
    def serve_ui_file(filename: str):
        filepath = os.path.join(UI_DIR, filename)
        if os.path.exists(filepath):
            return FileResponse(filepath)
        raise HTTPException(status_code=404, detail="File not found")
