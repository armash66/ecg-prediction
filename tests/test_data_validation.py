import pytest
import numpy as np
import pandas as pd
from ecg_intelligence.data.validation import validate_raw_signal, validate_metadata_integrity


def test_validate_raw_signal_valid():
    sig = np.random.randn(1000, 12).astype(np.float32)
    assert validate_raw_signal(sig, expected_shape=(1000, 12)) is True


def test_validate_raw_signal_invalid_shape():
    sig = np.random.randn(500, 12).astype(np.float32)
    with pytest.raises(ValueError, match="Expected signal shape"):
        validate_raw_signal(sig, expected_shape=(1000, 12))


def test_validate_raw_signal_nan():
    sig = np.random.randn(1000, 12).astype(np.float32)
    sig[10, 2] = np.nan
    with pytest.raises(ValueError, match="NaN or Inf"):
        validate_raw_signal(sig)


def test_validate_metadata_integrity_valid():
    df = pd.DataFrame({
        'strat_fold': list(range(1, 11)),
        'filename_lr': [f"records100/rec_{i}" for i in range(1, 11)],
        'scp_codes': ["{'NORM': 100.0}"] * 10
    })
    assert validate_metadata_integrity(df) is True


def test_validate_metadata_integrity_missing_column():
    df = pd.DataFrame({
        'strat_fold': list(range(1, 11)),
        'filename_lr': [f"records100/rec_{i}" for i in range(1, 11)]
    })
    with pytest.raises(KeyError):
        validate_metadata_integrity(df)
