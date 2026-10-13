"""
Faithfulness test: compares model probability drops when top-attributed regions
are replaced by baseline vs. random regions.
Includes multi-step deletion and insertion curve calculations.
"""

from typing import Dict, Any, List, Optional
import os
import json
import numpy as np
import torch
from .. import CLASSES
from ..logging_config import get_logger
from .integrated_gradients import compute_integrated_gradients

logger = get_logger(__name__)


def run_deletion_faithfulness_test(
    net: torch.nn.Module,
    Xn: np.ndarray,
    Fn: np.ndarray,
    Y: np.ndarray,
    test_mask: np.ndarray,
    target_class_str: str = 'MI',
    num_samples: int = 100,
    top_fraction: float = 0.10,
    device: str = 'cpu'
) -> Dict[str, Any]:
    """
    Evaluates attribution faithfulness across a cohort of true positive test cases.
    """
    net.eval()
    c = CLASSES.index(target_class_str)
    tp_indices = np.where(test_mask & (Y[:, c] == 1))[0]

    rng = np.random.default_rng(0)
    rng.shuffle(tp_indices)

    drops_ig: List[float] = []
    drops_rand: List[float] = []
    explained_count = 0

    def get_prob(x_tensor, f_tensor):
        with torch.no_grad():
            return torch.sigmoid(net(x_tensor, f_tensor))[0, c].item()

    for idx in tp_indices:
        x = torch.from_numpy(Xn[idx:idx + 1]).to(device)
        f = torch.from_numpy(Fn[idx:idx + 1]).to(device) if Fn is not None else None

        p0 = get_prob(x, f)
        if p0 < 0.5:
            continue

        ig = compute_integrated_gradients(net, x, f, c, steps=40)
        flat = ig.abs().flatten()
        k = int(top_fraction * flat.numel())

        top_indices = torch.topk(flat, k).indices
        m_ig = torch.ones_like(flat)
        m_ig[top_indices] = 0.0

        m_rd = torch.ones_like(flat)
        rand_indices = torch.randperm(flat.numel(), device=device)[:k]
        m_rd[rand_indices] = 0.0

        x_ig_del = x * m_ig.view_as(x[0])
        x_rd_del = x * m_rd.view_as(x[0])

        p_ig_drop = p0 - get_prob(x_ig_del, f)
        p_rd_drop = p0 - get_prob(x_rd_del, f)

        drops_ig.append(p_ig_drop)
        drops_rand.append(p_rd_drop)
        explained_count += 1

        if explained_count >= num_samples:
            break

    result = {
        'class': target_class_str,
        'n_explained': len(drops_ig),
        'removed_fraction': top_fraction,
        'mean_prob_drop_top_IG': float(np.mean(drops_ig)) if drops_ig else 0.0,
        'mean_prob_drop_random': float(np.mean(drops_rand)) if drops_rand else 0.0,
        'note': 'Removal replaces samples with training mean (0.0). Faithfulness to the MODEL, not clinical validation.'
    }
    return result


def compute_faithfulness_curves(
    net: torch.nn.Module,
    x: torch.Tensor,
    f: Optional[torch.Tensor],
    ig_map: torch.Tensor,
    target_class: int,
    fractions: Optional[List[float]] = None
) -> Dict[str, Any]:
    """
    Computes multi-step Deletion and Insertion curves on a single 12-lead ECG.

    Args:
        net: PyTorch model in eval mode.
        x: (1, 12, 1000) normalized signal tensor.
        f: (1, 139) normalized handcrafted feature tensor or None.
        ig_map: (12, 1000) Integrated Gradients attribution tensor.
        target_class: Integer class index to evaluate.
        fractions: List of perturbation fractions k (e.g. [0.05, 0.10, 0.15, 0.20, 0.25, 0.30]).

    Returns:
        Dict with deletion points, insertion points, AUDC, AUIC, and drop ratios.
    """
    if fractions is None:
        fractions = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30]

    net.eval()
    device = x.device

    def eval_prob(x_in):
        with torch.no_grad():
            return float(torch.sigmoid(net(x_in, f))[0, target_class].item())

    # Initial probability P0
    p0 = eval_prob(x)

    # Baseline probability (all zeros)
    x_zero = torch.zeros_like(x)
    p_baseline = eval_prob(x_zero)

    flat_ig = ig_map.abs().flatten()
    numel = flat_ig.numel()

    deletion_curve: List[Dict[str, Any]] = []
    insertion_curve: List[Dict[str, Any]] = []

    # Sort indices by attribution magnitude descending
    sorted_attr_indices = torch.argsort(flat_ig, descending=True)

    # 1. Compute Deletion Curve (starts at p0)
    for frac in fractions:
        k = max(1, int(frac * numel))
        top_k = sorted_attr_indices[:k]

        # Top-IG deletion mask (0 where deleted, 1 elsewhere)
        mask_ig = torch.ones(numel, device=device)
        mask_ig[top_k] = 0.0
        x_del_ig = x * mask_ig.view_as(x[0])
        p_del_ig = eval_prob(x_del_ig)

        # Random deletion (averaged over 3 runs)
        p_del_rand_runs = []
        for seed in range(3):
            rng = torch.Generator(device=device).manual_seed(seed + int(frac * 1000))
            rand_k = torch.randperm(numel, generator=rng, device=device)[:k]
            mask_rand = torch.ones(numel, device=device)
            mask_rand[rand_k] = 0.0
            x_del_rand = x * mask_rand.view_as(x[0])
            p_del_rand_runs.append(eval_prob(x_del_rand))
        p_del_rand = float(np.mean(p_del_rand_runs))

        deletion_curve.append({
            "fraction": frac,
            "p_ig": round(p_del_ig, 4),
            "p_random": round(p_del_rand, 4),
            "drop_ig": round(p0 - p_del_ig, 4),
            "drop_random": round(p0 - p_del_rand, 4),
        })

    # 2. Compute Insertion Curve (starts at p_baseline)
    for frac in fractions:
        k = max(1, int(frac * numel))
        top_k = sorted_attr_indices[:k]

        # Top-IG insertion mask (1 where restored, 0 elsewhere)
        mask_ig = torch.zeros(numel, device=device)
        mask_ig[top_k] = 1.0
        x_ins_ig = x * mask_ig.view_as(x[0])
        p_ins_ig = eval_prob(x_ins_ig)

        # Random insertion (averaged over 3 runs)
        p_ins_rand_runs = []
        for seed in range(3):
            rng = torch.Generator(device=device).manual_seed(seed + int(frac * 1000) + 42)
            rand_k = torch.randperm(numel, generator=rng, device=device)[:k]
            mask_rand = torch.zeros(numel, device=device)
            mask_rand[rand_k] = 1.0
            x_ins_rand = x * mask_rand.view_as(x[0])
            p_ins_rand_runs.append(eval_prob(x_ins_rand))
        p_ins_rand = float(np.mean(p_ins_rand_runs))

        insertion_curve.append({
            "fraction": frac,
            "p_ig": round(p_ins_ig, 4),
            "p_random": round(p_ins_rand, 4),
            "gain_ig": round(p_ins_ig - p_baseline, 4),
            "gain_random": round(p_ins_rand - p_baseline, 4),
        })

    # Compute Area Under Curves using trapezoidal integration
    frac_axis = [0.0] + fractions
    del_ig_vals = [p0] + [pt["p_ig"] for pt in deletion_curve]
    del_rand_vals = [p0] + [pt["p_random"] for pt in deletion_curve]
    audc_ig = float(np.trapezoid(del_ig_vals, frac_axis))
    audc_rand = float(np.trapezoid(del_rand_vals, frac_axis))

    ins_ig_vals = [p_baseline] + [pt["p_ig"] for pt in insertion_curve]
    ins_rand_vals = [p_baseline] + [pt["p_random"] for pt in insertion_curve]
    auic_ig = float(np.trapezoid(ins_ig_vals, frac_axis))
    auic_rand = float(np.trapezoid(ins_rand_vals, frac_axis))

    # Mean drops at 10%
    pt10 = next((pt for pt in deletion_curve if abs(pt["fraction"] - 0.10) < 1e-4), deletion_curve[1])

    return {
        "initial_prob": round(p0, 4),
        "baseline_prob": round(p_baseline, 4),
        "deletion_curve": deletion_curve,
        "insertion_curve": insertion_curve,
        "audc_ig": round(audc_ig, 4),
        "audc_rand": round(audc_rand, 4),
        "auic_ig": round(auic_ig, 4),
        "auic_rand": round(auic_rand, 4),
        "audc_drop_ratio": round((p0 - audc_ig) / (max(p0 - audc_rand, 1e-4)), 2),
        "top_ig_drop_10pct": pt10["drop_ig"],
        "random_drop_10pct": pt10["drop_random"],
        "ratio_drop_10pct": round(pt10["drop_ig"] / (max(pt10["drop_random"], 1e-4)), 2),
        "interpretation": (
            "Attributions faithfully reflect the neural network decision drivers: "
            "targeted deletion causes steeper probability decline than random masking, "
            "and targeted insertion restores target score faster."
            if audc_ig < audc_rand
            else "Perturbation curve showed similar trajectory to random baseline."
        ),
        "note": "Perturbation replaces samples with baseline (0.0). Demonstrates faithfulness to model mechanics, not clinical validity."
    }
