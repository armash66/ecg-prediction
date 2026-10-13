"""
ECG Predictor class encapsulating feature extraction, model forward pass,
and gated interpretation.
"""

import os
import json
from typing import Dict, Any, Tuple, Optional
import numpy as np
import torch

from .. import CLASSES
from ..logging_config import get_logger
from ..preprocessing.resampling import ensure_1000x12
from ..features.extractor import extract_handcrafted_features
from ..models.classifier import build_torch_model
from .validation import validate_inference_input
from .postprocessing import apply_thresholds_and_format

logger = get_logger(__name__)


class ECGPredictor:
    """
    Inference engine that loads trained weights, normalisation statistics,
    and validation-tuned thresholds.
    """
    def __init__(self, cache_dir: str = 'artifacts/cache', mode: str = 'gated', device: Optional[str] = None):
        self.cache_dir = cache_dir
        self.mode = mode
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')

        norm_path = os.path.join(cache_dir, 'norm.npz')
        model_path = os.path.join(cache_dir, f'model_{mode}.pt')
        result_path = os.path.join(cache_dir, f'result_{mode}.json')

        if not os.path.exists(norm_path):
            raise FileNotFoundError(f"Missing normalisation stats: {norm_path}")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Missing model weights: {model_path}")

        ns = np.load(norm_path)
        self.mu = ns['mu']
        self.sd = ns['sd']
        self.fm = ns['fm']
        self.fs = ns['fs']

        if os.path.exists(result_path):
            with open(result_path, 'r', encoding='utf-8') as f:
                self.thresholds = json.load(f).get('thresholds', {c: 0.5 for c in CLASSES})
        else:
            self.thresholds = {c: 0.5 for c in CLASSES}

        self.model = build_torch_model(num_features=len(self.fm), mode=mode, num_classes=5).to(self.device)
        self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.model.eval()

    def predict(self, raw_signal: np.ndarray) -> Dict[str, Any]:
        """
        Runs complete inference pipeline on a single 12-lead ECG.
        raw_signal: shape (1000, 12) or (12, 1000).
        """
        validate_inference_input(raw_signal)
        sig = ensure_1000x12(raw_signal)

        # Standardise signal & extract/standardise handcrafted features
        x_norm = ((sig - self.mu) / self.sd).T[None].astype(np.float32)  # (1, 12, 1000)
        feat = extract_handcrafted_features(sig)
        f_norm = ((feat - self.fm) / self.fs)[None].astype(np.float32)   # (1, nf)

        x_tensor = torch.from_numpy(x_norm).to(self.device)
        f_tensor = torch.from_numpy(f_norm).to(self.device)

        with torch.no_grad():
            logits = self.model(x_tensor, f_tensor)
            probs = torch.sigmoid(logits)[0].cpu().numpy()

        gate_weight = None
        if self.mode == 'gated' and self.model.gate_val is not None:
            gate_weight = float(self.model.gate_val.mean().item())

        formatted_predictions = apply_thresholds_and_format(probs, self.thresholds)

        return {
            'signal_clean': sig,
            'x_tensor': x_tensor,
            'f_tensor': f_tensor,
            'probabilities': probs,
            'predictions': formatted_predictions,
            'gate_weight_deep': gate_weight
        }
