"""
Integrated Gradients implementation with cuDNN disabled for GRU backward in eval mode.
"""

from typing import Optional
import torch
import torch.nn as nn


def compute_integrated_gradients(
    net: nn.Module,
    x: torch.Tensor,
    f: Optional[torch.Tensor],
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


def compute_integrated_gradients_with_diagnostics(
    net: nn.Module,
    x: torch.Tensor,
    f: Optional[torch.Tensor],
    target_class: int,
    steps: int = 40
):
    """
    Computes Integrated Gradients and calculates the Axiom of Completeness error:
    |sum(attributions) - (F(x) - F(0))|
    """
    with torch.no_grad():
        f_0 = f if f is not None else None
        fx = float(net(x, f_0)[0, target_class].item())
        x_base = torch.zeros_like(x)
        f_base = torch.zeros_like(f) if f is not None else None
        f0 = float(net(x_base, f_base)[0, target_class].item())

    ig = compute_integrated_gradients(net, x, f, target_class, steps=steps)
    sum_attr = float(ig.sum().item())
    delta_f = fx - f0
    completeness_error = abs(sum_attr - delta_f)

    diagnostics = {
        "steps": steps,
        "fx": round(fx, 4),
        "f0": round(f0, 4),
        "delta_fx": round(delta_f, 4),
        "sum_attributions": round(sum_attr, 4),
        "completeness_error": round(completeness_error, 4),
        "finite_check": bool(torch.isfinite(ig).all().item()),
        "tensor_shape": list(ig.shape),
        "baseline_description": "Zero tensor (corresponds to training fold empirical mean)"
    }
    return ig, diagnostics


def compute_gradient_x_input(
    net: nn.Module,
    x: torch.Tensor,
    f: Optional[torch.Tensor],
    target_class: int
) -> torch.Tensor:
    """
    Computes first-order Gradient x Input saliency map.
    """
    x_in = x.clone().requires_grad_(True)
    with torch.backends.cudnn.flags(enabled=False):
        out = net(x_in, f)[:, target_class]
        grad = torch.autograd.grad(out.sum(), x_in)[0]
    return (x_in[0] * grad[0]).detach()


def compute_smoothgrad(
    net: nn.Module,
    x: torch.Tensor,
    f: Optional[torch.Tensor],
    target_class: int,
    num_samples: int = 15,
    stdev_spread: float = 0.15
) -> torch.Tensor:
    """
    Computes SmoothGrad by averaging gradients with Gaussian noise.
    """
    stdev = float(stdev_spread * (x.max() - x.min()).item())
    if stdev < 1e-6:
        stdev = 0.1
    grads = []

    with torch.backends.cudnn.flags(enabled=False):
        for _ in range(num_samples):
            noise = torch.randn_like(x) * stdev
            x_noisy = (x + noise).requires_grad_(True)
            f_in = f if f is not None else None
            out = net(x_noisy, f_in)[:, target_class]
            g = torch.autograd.grad(out.sum(), x_noisy)[0]
            grads.append(g)

    avg_grad = torch.stack(grads).mean(dim=0)
    return (x[0] * avg_grad[0]).detach()

