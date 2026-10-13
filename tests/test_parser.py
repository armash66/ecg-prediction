import io
import pytest
import numpy as np
import pandas as pd
from ecg_intelligence import LEADS
from ecg_intelligence.data.parser import parse_csv_ecg, parse_numpy_ecg


def test_parse_numpy_ecg():
    # Valid (1000, 12)
    sig = np.random.randn(1000, 12).astype(np.float32)
    buf = io.BytesIO()
    np.save(buf, sig)
    arr, meta = parse_numpy_ecg(buf.getvalue())
    assert arr.shape == (1000, 12)
    assert meta["n_leads"] == 12
    assert meta["n_samples"] == 1000
    assert meta["resampled"] is False

    # Transposed (12, 1000)
    buf2 = io.BytesIO()
    np.save(buf2, sig.T)
    arr2, meta2 = parse_numpy_ecg(buf2.getvalue())
    assert arr2.shape == (1000, 12)

    # Needs resampling (800, 12)
    sig3 = np.random.randn(800, 12).astype(np.float32)
    buf3 = io.BytesIO()
    np.save(buf3, sig3)
    arr3, meta3 = parse_numpy_ecg(buf3.getvalue())
    assert arr3.shape == (1000, 12)
    assert meta3["resampled"] is True
    assert meta3["original_samples"] == 800


def test_parse_numpy_nan_error():
    sig = np.random.randn(1000, 12).astype(np.float32)
    sig[10, 2] = np.nan
    buf = io.BytesIO()
    np.save(buf, sig)
    with pytest.raises(ValueError, match="NaN"):
        parse_numpy_ecg(buf.getvalue())


def test_parse_csv_ecg():
    # CSV with standard lead headers
    sig = np.random.randn(1000, 12).astype(np.float32)
    df = pd.DataFrame(sig, columns=LEADS)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    arr, meta = parse_csv_ecg(buf.getvalue().encode("utf-8"))
    assert arr.shape == (1000, 12)
    assert meta["n_leads"] == 12
    assert meta["resampled"] is False

    # CSV without header (12 numeric columns)
    df2 = pd.DataFrame(sig)
    buf2 = io.StringIO()
    df2.to_csv(buf2, index=False, header=False)
    arr2, meta2 = parse_csv_ecg(buf2.getvalue().encode("utf-8"))
    assert arr2.shape == (1000, 12)
