import pytest
import numpy as np
from ecg_intelligence.data.splits import get_fold_masks


def test_fold_splits_disjoint():
    # 100 samples distributed uniformly across folds 1 to 10
    strat_folds = np.tile(np.arange(1, 11), 10)
    tr_mask, va_mask, te_mask = get_fold_masks(strat_folds)

    # Verify patient disjointness / no leakage
    assert not np.any(tr_mask & va_mask)
    assert not np.any(tr_mask & te_mask)
    assert not np.any(va_mask & te_mask)

    # Verify split membership
    assert np.all(strat_folds[tr_mask] <= 8)
    assert np.all(strat_folds[va_mask] == 9)
    assert np.all(strat_folds[te_mask] == 10)

    # Verify complete coverage
    assert (tr_mask.sum() + va_mask.sum() + te_mask.sum()) == len(strat_folds)
