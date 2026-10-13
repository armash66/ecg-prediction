"""
Lead-wise attribution ranking and extraction.
"""

from typing import Tuple, List
import numpy as np
import torch
from .. import LEADS


def compute_lead_attributions(attribution_map: np.ndarray) -> Tuple[int, List[float]]:
    """
    Computes total absolute attribution magnitude per lead.
    attribution_map: (12, T)
    Returns:
        top_lead_idx: Index of lead with highest overall attribution.
        lead_scores: List of 12 attribution magnitudes.
    """
    lead_mags = np.abs(attribution_map).sum(axis=1)
    top_lead = int(np.argmax(lead_mags))
    return top_lead, lead_mags.tolist()
