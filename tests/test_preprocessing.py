import pytest
import numpy as np
import torch
from ecg_intelligence.preprocessing.resampling import ensure_1000x12, resample_signal
from ecg_intelligence.preprocessing.normalization import compute_norm_stats, normalize_signals, normalize_features
from ecg_intelligence.preprocessing.augmentation import apply_ecg_augmentation


def test_ensure_1000x12():
    # Correct shape
    x = np.zeros((1000, 12), dtype=np.float32)
    assert ensure_1000x12(x).shape == (1000, 12)

    # Transposed shape (12, 1000)
    x_t = np.zeros((12, 1000), dtype=np.float32)
    assert ensure_1000x12(x_t).shape == (1000, 12)

    # Resampling from 5000 to 1000
    x_long = np.zeros((5000, 12), dtype=np.float32)
    res = ensure_1000x12(x_long)
    assert res.shape == (1000, 12)


def test_normalization_train_only():
    # 20 samples: 16 train (folds 1-8), 4 val/test (folds 9-10)
    N = 20
    X = np.random.randn(N, 1000, 12).astype(np.float32) + 5.0
    F = np.random.randn(N, 139).astype(np.float32) + 2.0
    train_mask = np.array([True] * 16 + [False] * 4)

    stats = compute_norm_stats(X, F, train_mask)

    assert stats['mu'].shape == (12,)
    assert stats['sd'].shape == (12,)
    assert stats['fm'].shape == (139,)
    assert stats['fs'].shape == (139,)

    X_norm = normalize_signals(X, stats['mu'], stats['sd'])
    assert X_norm.shape == (N, 12, 1000)
    # Check normalized train set mean is approximately zero
    train_norm_mean = X_norm[:16].mean()
    assert abs(train_norm_mean) < 0.1


def test_augmentation_shape_and_range():
    x = torch.randn(4, 12, 1000)
    # Mode 1: current (cyclic roll + noise)
    aug_curr = apply_ecg_augmentation(x, mode='current', max_roll=50, noise_std=0.03)
    assert aug_curr.shape == (4, 12, 1000)
    assert not torch.equal(x, aug_curr)

    # Mode 2: none (exact identity)
    aug_none = apply_ecg_augmentation(x, mode='none')
    assert torch.equal(x, aug_none)

    # Mode 3: noise_only
    aug_noise = apply_ecg_augmentation(x, mode='noise_only', noise_std=0.03)
    assert aug_noise.shape == (4, 12, 1000)
    assert not torch.equal(x, aug_noise)

    # Mode 4: nonwrapping_shift
    aug_shift = apply_ecg_augmentation(x, mode='nonwrapping_shift', max_roll=50, noise_std=0.03)
    assert aug_shift.shape == (4, 12, 1000)
    assert not torch.equal(x, aug_shift)

