"""
Interventional lead ablation testing:
Removes one lead at a time to baseline (0.0) and measures the actual change in model score.
Distinct from first-order gradient attribution.
"""

from typing import List, Dict, Any, Optional
import torch
import numpy as np
from .. import LEADS


def compute_lead_ablation(
    net: torch.nn.Module,
    x: torch.Tensor,
    f: Optional[torch.Tensor],
    target_class: int
) -> List[Dict[str, Any]]:
    """
    Measures the direct interventional effect of masking each lead individually.

    Args:
        net: PyTorch model in eval mode.
        x: (1, 12, 1000) normalized signal tensor.
        f: (1, 139) normalized handcrafted feature tensor (or None).
        target_class: Target class index to evaluate.

    Returns:
        List of dicts containing baseline probability, ablated probability,
        score drop (Delta P), and normalized impact percentage for each of the 12 leads.
    """
    net.eval()
    with torch.no_grad():
        # Baseline probability with all leads intact
        logits_orig = net(x, f)
        p_orig = float(torch.sigmoid(logits_orig)[0, target_class].item())

        results = []
        delta_list = []

        for lead_idx in range(12):
            # Mask selected lead to baseline 0.0 (corresponds to training fold mean)
            x_ablated = x.clone()
            x_ablated[0, lead_idx, :] = 0.0

            logits_ablated = net(x_ablated, f)
            p_ablated = float(torch.sigmoid(logits_ablated)[0, target_class].item())
            delta_p = p_orig - p_ablated
            delta_list.append(delta_p)

            results.append({
                "lead": LEADS[lead_idx],
                "lead_idx": lead_idx,
                "p_original": round(p_orig, 4),
                "p_ablated": round(p_ablated, 4),
                "delta_p": round(delta_p, 4),
            })

        # Calculate relative impact percentage
        total_abs_delta = sum(abs(d) for d in delta_list) + 1e-6
        for r, delta in zip(results, delta_list):
            r["impact_pct"] = round((abs(delta) / total_abs_delta) * 100, 1)

        # Sort descending by impact magnitude
        results.sort(key=lambda item: abs(item["delta_p"]), reverse=True)

    return results
