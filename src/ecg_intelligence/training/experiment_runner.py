"""
High-level experiment dispatcher supporting xgb, cnn, seq, hybrid, gated, ensemble.
"""

import os
from typing import Optional, Dict, Any
import numpy as np

from ..logging_config import get_logger
from ..data.cache import load_or_build_cache
from ..models.xgboost_model import MultiLabelXGBoost
from ..models.ensemble import EnsemblePredictor
from ..evaluation.metrics import evaluate_test_metrics
from .trainer import PyTorchTrainer

logger = get_logger(__name__)


def run_xgb_experiment(
    F: np.ndarray,
    Y: np.ndarray,
    fold: np.ndarray,
    cache_dir: str
) -> Dict[str, Any]:
    """Runs XGBoost benchmark on handcrafted features."""
    tr, va, te = (fold <= 8), (fold == 9), (fold == 10)
    xgb_classifier = MultiLabelXGBoost()
    xgb_classifier.fit(F[tr], Y[tr])

    p_val = xgb_classifier.predict_proba(F[va])
    p_test = xgb_classifier.predict_proba(F[te])

    return evaluate_test_metrics('xgb', Y[va], p_val, Y[te], p_test, cache_dir)


def run_ensemble_experiment(
    Y: np.ndarray,
    fold: np.ndarray,
    cache_dir: str,
    ens_with: str = 'gated'
) -> Dict[str, Any]:
    """Combines predictions from deep model and XGBoost."""
    va, te = (fold == 9), (fold == 10)
    deep_probs = np.load(os.path.join(cache_dir, f'probs_{ens_with}.npy'), allow_pickle=True).item()
    xgb_probs = np.load(os.path.join(cache_dir, 'probs_xgb.npy'), allow_pickle=True).item()

    ensemble = EnsemblePredictor(deep_weight=0.6, xgb_weight=0.4)
    p_val_blend = ensemble.blend(deep_probs['val'], xgb_probs['val'])
    p_test_blend = ensemble.blend(deep_probs['test'], xgb_probs['test'])

    name = f'ens_{ens_with}'
    return evaluate_test_metrics(name, Y[va], p_val_blend, Y[te], p_test_blend, cache_dir)


def run_experiment(
    mode: str,
    root: str,
    cache_dir: str,
    epochs: int = 30,
    batch_size: int = 128,
    ens_with: str = 'gated',
    lr: float = 2e-3,
    max_lr: Optional[float] = None,
    weight_decay: float = 1e-2,
    aug_mode: str = 'current',
    early_stopping_patience: int = 6,
    model_name: Optional[str] = None,
    use_se: bool = True,
    dropout: float = 0.3
) -> Dict[str, Any]:
    """
    Unified entrypoint for all training modes, including multiscale and ablation variants.
    """
    X, F, Y, fold = load_or_build_cache(root, cache_dir)

    if mode == 'xgb':
        return run_xgb_experiment(F, Y, fold, cache_dir)
    elif mode == 'ensemble':
        return run_ensemble_experiment(Y, fold, cache_dir, ens_with=ens_with)
    else:
        trainer = PyTorchTrainer(
            mode=mode,
            epochs=epochs,
            batch_size=batch_size,
            cache_dir=cache_dir,
            lr=lr,
            max_lr=max_lr,
            weight_decay=weight_decay,
            aug_mode=aug_mode,
            early_stopping_patience=early_stopping_patience,
            model_name=model_name,
            use_se=use_se,
            dropout=dropout
        )
        return trainer.train_and_evaluate(X, F, Y, fold)

