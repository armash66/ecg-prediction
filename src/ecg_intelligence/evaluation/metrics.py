"""
Comprehensive multi-label metrics calculation matching reference behavior.
"""

import os
import json
from typing import Dict, Any, Optional
import numpy as np
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    f1_score,
    recall_score,
    confusion_matrix
)
from .. import CLASSES
from ..logging_config import get_logger
from .thresholds import optimize_thresholds_on_val

logger = get_logger(__name__)


def evaluate_test_metrics(
    model_name: str,
    y_val: np.ndarray,
    p_val: np.ndarray,
    y_test: np.ndarray,
    p_test: np.ndarray,
    output_dir: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Computes all test metrics strictly on fold 10 using decision thresholds
    calibrated strictly on fold 9.

    Saves result_<model_name>.json and probs_<model_name>.npy to output_dir if specified.
    """
    thresholds = optimize_thresholds_on_val(y_val, p_val)

    aucs, aps, f1s, sens, specs, cms = [], [], [], [], [], {}

    # Binary test predictions across all classes
    pred_bin_all = np.zeros_like(p_test, dtype=int)

    for i, c in enumerate(CLASSES):
        t = thresholds[c]
        pred_bin = (p_test[:, i] > t).astype(int)
        pred_bin_all[:, i] = pred_bin

        # Handle edge cases where class is unrepresented
        try:
            auc = float(roc_auc_score(y_test[:, i], p_test[:, i]))
        except ValueError:
            auc = 0.5
        try:
            ap = float(average_precision_score(y_test[:, i], p_test[:, i]))
        except ValueError:
            ap = 0.0

        f1 = float(f1_score(y_test[:, i], pred_bin, zero_division=0))
        sn = float(recall_score(y_test[:, i], pred_bin, zero_division=0))
        cm = confusion_matrix(y_test[:, i], pred_bin, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        sp = float(tn / (tn + fp)) if (tn + fp) > 0 else 1.0

        aucs.append(auc)
        aps.append(ap)
        f1s.append(f1)
        sens.append(sn)
        specs.append(sp)
        cms[c] = cm.tolist()

    micro_f1 = float(f1_score(y_test, pred_bin_all, average="micro", zero_division=0))
    try:
        micro_auc = float(roc_auc_score(y_test, p_test, average="micro"))
    except ValueError:
        micro_auc = 0.5

    res = {
        'model': model_name,
        'macro_auc': float(np.mean(aucs)),
        'micro_auc': micro_auc,
        'macro_auprc': float(np.mean(aps)),
        'macro_f1': float(np.mean(f1s)),
        'micro_f1': micro_f1,
        'macro_sensitivity': float(np.mean(sens)),
        'macro_specificity': float(np.mean(specs)),
        'auc': dict(zip(CLASSES, aucs)),
        'auprc': dict(zip(CLASSES, aps)),
        'f1': dict(zip(CLASSES, f1s)),
        'sensitivity': dict(zip(CLASSES, sens)),
        'specificity': dict(zip(CLASSES, specs)),
        'confusion_[[TN,FP],[FN,TP]]': cms,
        'thresholds': thresholds
    }

    if extra:
        res.update(extra)

    logger.info(
        f"== {model_name} == AUROC: {res['macro_auc']:.4f} | AUPRC: {res['macro_auprc']:.4f} | "
        f"F1: {res['macro_f1']:.4f} | Sens: {res['macro_sensitivity']:.4f} | Spec: {res['macro_specificity']:.4f}"
    )

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        res_file = os.path.join(output_dir, f'result_{model_name}.json')
        probs_file = os.path.join(output_dir, f'probs_{model_name}.npy')
        preds_npz = os.path.join(output_dir, 'predictions.npz')

        with open(res_file, 'w', encoding='utf-8') as f:
            json.dump(res, f, indent=1)

        np.save(probs_file, {'val': p_val, 'test': p_test}, allow_pickle=True)
        # Save standard predictions.npz
        np.savez(preds_npz, y_val=y_val, p_val=p_val, y_test=y_test, p_test=p_test, p_test_bin=pred_bin_all)
        logger.info(f"Saved evaluation metrics to {res_file} and probabilities to {probs_file}")

    return res

