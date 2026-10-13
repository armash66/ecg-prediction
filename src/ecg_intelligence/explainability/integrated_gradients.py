"""
Integrated Gradients implementation with cuDNN disabled for GRU backward in eval mode.
"""

from typing import Optional
import torch
import torch.nn as nn


def compute_integrated_gradients(
    net: nn.Module,
    x: torch.Tensor,
    f: torch.Tensor,
    target_class: int,
    steps: int = 40
) -> torch.Tensor:
    """
    Computes Integrated Gradients attribution map with baseline = 0.
    Args:
        net: Evaluation-mode PyTorch model.
        x: (1, 12, T) normalised ECG signal tensor.
        f: (1, nf) normalised handcrafted feature tensor.
        target_class: Integer class index to explain.
        steps: Riemann approximation steps.

    Returns:
        attributions: (12, T) tensor of input-gradient attributions.
    """
    alphas = torch.linspace(0.0, 1.0, steps, device=x.device).view(-1, 1, 1)
    xs = (alphas * x).requires_grad_(True)  # (steps, 12, T)

    # Disable cuDNN because PyTorch GRU backward fails in eval mode with cuDNN enabled
    with torch.backends.cudnn.flags(enabled=False):
        f_expanded = f.expand(steps, -1) if f is not None else None
        out = net(xs, f_expanded)[:, target_class]
        grads = torch.autograd.grad(out.sum(), xs)[0]

    ig = (x[0] * grads.mean(dim=0)).detach()
    return ig
