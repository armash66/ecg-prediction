"""
Signal shape verification and resampling to 1000 samples (100 Hz x 10 s).
"""

from typing import Optional, Callable
import numpy as np
from scipy import signal as sps


def resample_signal(sig: np.ndarray, target_length: int = 1000) -> np.ndarray:
    """
    Resamples a multi-channel signal to the target sequence length along axis 0.
    """
    return sps.resample(sig, target_length, axis=0).astype(np.float32)


def ensure_1000x12(sig: np.ndarray, warning_callback: Optional[Callable[[str], None]] = None) -> np.ndarray:
    """
    Validates that signal is 12 leads and 1000 samples.
    Transposes (12, 1000) to (1000, 12) if necessary.
    Resamples signals differing in length to exactly 1000 samples.
    """
    sig = np.asarray(sig, dtype=np.float32)
    if sig.ndim != 2 or 12 not in sig.shape:
        raise ValueError(f"Expected 12-channel 2D ECG array, got shape {sig.shape}")

    if sig.shape[0] == 12 and sig.shape[1] != 12:
        sig = sig.T

    if sig.shape[0] != 1000:
        msg = f"Resampling from {sig.shape[0]} samples to 1000 (assumes standard 10s recording)."
        if warning_callback:
            warning_callback(msg)
        sig = resample_signal(sig, 1000)

    return sig
