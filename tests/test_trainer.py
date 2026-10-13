"""
Unit tests for PyTorch training loop enhancements:
- Early stopping & best checkpoint restoration
- Augmentation modes passed to trainer
- History metric logging
- Training synthetic smoke test
"""

import os
import pytest
import numpy as np
import torch
from ecg_intelligence.training.trainer import PyTorchTrainer
from ecg_intelligence.training.checkpoint import ModelCheckpoint


def test_checkpoint_isolation_and_restoration(tmp_path):
    ckpt_path = str(tmp_path / "test_model.pt")
    ckpt = ModelCheckpoint(ckpt_path, mode='max')

    net = torch.nn.Linear(10, 5)

    # Initial score
    improved = ckpt.update(0.75, net)
    assert improved is True
    assert os.path.exists(ckpt_path)

    # Lower score does not overwrite
    improved2 = ckpt.update(0.70, net)
    assert improved2 is False

    # Higher score updates
    improved3 = ckpt.update(0.85, net)
    assert improved3 is True
    assert ckpt.best_score == 0.85


def test_synthetic_trainer_smoke_test(tmp_path):
    """
    Executes a 2-epoch synthetic training smoke test with early stopping,
    custom max_lr, and isolated checkpoint directory.
    """
    np.random.seed(42)
    N = 30
    X = np.random.randn(N, 1000, 12).astype(np.float32)
    F = np.random.randn(N, 139).astype(np.float32)
    Y = (np.random.rand(N, 5) > 0.5).astype(np.float32)
    # Ensure both classes present in each fold for valid AUROC computation
    Y[20, :] = 1.0
    Y[21, :] = 0.0
    Y[25, :] = 1.0
    Y[26, :] = 0.0
    # Folds 1-8 (train): 20 samples; Fold 9 (val): 5 samples; Fold 10 (test): 5 samples
    fold = np.array([1]*10 + [2]*10 + [9]*5 + [10]*5, dtype=np.int64)

    cache_dir = str(tmp_path / "experiment_cache")

    trainer = PyTorchTrainer(
        mode='multiscale',
        epochs=2,
        batch_size=8,
        cache_dir=cache_dir,
        lr=1e-3,
        max_lr=1e-3,
        weight_decay=0.01,
        aug_mode='nonwrapping_shift',
        early_stopping_patience=2,
        model_name='multiscale_shift_test'
    )

    res = trainer.train_and_evaluate(X, F, Y, fold, save_samples=False)

    assert "macro_auc" in res
    assert "macro_f1" in res
    assert "thresholds" in res
    assert "training_duration_sec" in res
    assert "inference_latency_ms" in res
    assert "history" in res
    assert len(res["history"]) == 2
    assert os.path.exists(os.path.join(cache_dir, "model_multiscale_shift_test.pt"))
    assert os.path.exists(os.path.join(cache_dir, "result_multiscale_shift_test.json"))
