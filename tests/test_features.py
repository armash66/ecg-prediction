import pytest
import numpy as np
from ecg_intelligence.features.statistics import extract_lead_statistics
from ecg_intelligence.features.hrv import extract_hrv_features
from ecg_intelligence.features.wavelets import extract_wavelet_energies
from ecg_intelligence.features.extractor import extract_handcrafted_features


def test_extract_lead_statistics():
    sig = np.sin(np.linspace(0, 10, 1000)).astype(np.float32)
    stats = extract_lead_statistics(sig)
    assert len(stats) == 6
    assert not any(np.isnan(stats))


def test_extract_hrv_features_normal_and_flatline():
    # Normal synthetic rhythm: periodic spikes
    sig = np.zeros(1000, dtype=np.float32)
    sig[100::100] = 1.5  # Peaks every 100 samples (1.0 sec)
    hrv = extract_hrv_features(sig)
    assert len(hrv) == 7
    assert hrv[0] > 0  # detected peaks

    # Flatline failure fallback
    flat = np.zeros(1000, dtype=np.float32)
    hrv_flat = extract_hrv_features(flat)
    assert len(hrv_flat) == 7
    assert hrv_flat[0] == 0.0  # 0 peaks


def test_extract_wavelet_energies():
    sig = np.random.randn(1000).astype(np.float32)
    energies = extract_wavelet_energies(sig, level=4)
    assert len(energies) == 5
    assert not any(np.isnan(energies))


def test_extract_handcrafted_features_total_dim():
    x = np.random.randn(1000, 12).astype(np.float32)
    feat = extract_handcrafted_features(x)
    assert feat.shape == (139,)
    assert not np.isnan(feat).any()
    assert not np.isinf(feat).any()
