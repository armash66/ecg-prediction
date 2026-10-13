"""
Digital filtering for baseline wander reduction and rhythm extraction.
"""

from typing import Tuple
import numpy as np
from scipy import signal as sps
from .. import FS


def bandpass_filter_lead2(
    signal_lead2: np.ndarray,
    lowcut: float = 5.0,
    highcut: float = 15.0,
    order: int = 2,
    fs: int = FS
) -> np.ndarray:
    """
    Applies Butterworth 2nd-order bandpass filter [5, 15] Hz for Pan-Tompkins QRS energy enhancement.
    Returns squared filtered signal y = filtfilt(b, a, s)**2.
    """
    b, a = sps.butter(order, [lowcut, highcut], btype='band', fs=fs)
    y = sps.filtfilt(b, a, signal_lead2) ** 2
    return y


def filter_signal(
    signal: np.ndarray,
    lowcut: float = 0.5,
    highcut: float = 40.0,
    order: int = 3,
    fs: int = FS
) -> np.ndarray:
    """
    Standard diagnostic ECG bandpass filtering (0.5 to 40 Hz).
    """
    b, a = sps.butter(order, [lowcut, highcut], btype='band', fs=fs)
    return sps.filtfilt(b, a, signal, axis=0)
