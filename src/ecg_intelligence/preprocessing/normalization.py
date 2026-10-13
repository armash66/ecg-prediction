"""
Signal and feature normalisation statistics computed exclusively on training folds.
"""

from typing import Dict
import numpy as np


def compute_norm_stats(
    X: np.ndarray,
    F: np.ndarray,
    train_mask: np.ndarray,
    eps: float = 1e-6
) -> Dict[str, np.ndarray]:
    """
    Computes normalisation statistics strictly on training folds 1-8.
    Ensures zero data leakage into validation or testing sets.

    Returns:
        mu: Mean of X on training folds across time and samples, shape (12,)
        sd: Standard deviation of X on training folds across time and samples, shape (12,)
        fm: Mean of handcrafted features on training folds, shape (139,)
        fs: Standard deviation of handcrafted features on training folds, shape (139,)
    """
    X_tr = X[train_mask]
    F_tr = F[train_mask]

    mu = X_tr.mean(axis=(0, 1))
    sd = X_tr.std(axis=(0, 1)) + eps

    fm = F_tr.mean(axis=0)
    fs = F_tr.std(axis=0) + eps

    return {
        'mu': mu.astype(np.float32),
        'sd': sd.astype(np.float32),
        'fm': fm.astype(np.float32),
        'fs': fs.astype(np.float32)
    }


def normalize_signals(X: np.ndarray, mu: np.ndarray, sd: np.ndarray) -> np.ndarray:
    """
    Standardises raw signals and transposes to PyTorch convention:
    (N, 1000, 12) -> (N, 12, 1000).
    """
    X_norm = (X - mu) / sd
    # Transpose from (N, T, C) to (N, C, T)
    return np.ascontiguousarray(X_norm.transpose(0, 2, 1).astype(np.float32))


def normalize_features(F: np.ndarray, fm: np.ndarray, fs: np.ndarray) -> np.ndarray:
    """
    Standardises handcrafted feature vector: (N, 139).
    """
    return np.ascontiguousarray(((F - fm) / fs).astype(np.float32))
