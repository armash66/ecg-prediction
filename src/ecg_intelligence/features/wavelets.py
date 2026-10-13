"""
Discrete Wavelet Transform (DWT) subband energy extraction.
"""

from typing import List
import numpy as np


def extract_wavelet_energies(
    lead_signal: np.ndarray,
    wavelet_name: str = 'db4',
    level: int = 4,
    eps: float = 1e-8
) -> List[float]:
    """
    Computes DWT subband relative energy distribution across 4 decomposition levels.
    Total features: level + 1 = 5 subband energies per lead.
    Fallback to zero vector if PyWavelets is unavailable.
    """
    try:
        import pywt
        coeffs = pywt.wavedec(lead_signal, wavelet_name, level=level)
        energies = np.array([np.sum(ci ** 2) for ci in coeffs], dtype=np.float64)
        total_energy = energies.sum() + eps
        rel_energies = energies / total_energy
        return list(rel_energies)
    except ImportError:
        # Fallback if pywt is not installed
        return [0.0] * (level + 1)
