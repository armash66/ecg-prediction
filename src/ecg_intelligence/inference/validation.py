"""
Input validation utilities for inference requests.
"""

from typing import Tuple
import numpy as np


def validate_inference_input(sig: np.ndarray) -> np.ndarray:
    """
    Validates input signal type, dimensions, and numerical validity.
    """
    if not isinstance(sig, np.ndarray):
        raise TypeError(f"Expected numpy ndarray, got {type(sig)}")

    if sig.ndim != 2:
        raise ValueError(f"Expected 2D array, got ndim={sig.ndim}")

    if 12 not in sig.shape:
        raise ValueError(f"Signal must contain 12 leads, got shape {sig.shape}")

    if np.isnan(sig).any() or np.isinf(sig).any():
        raise ValueError("Input signal contains NaN or Inf values")

    return sig
