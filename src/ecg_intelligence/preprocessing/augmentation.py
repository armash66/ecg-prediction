"""
ECG-safe data augmentation: cyclic temporal roll, non-wrapping shift, and gentle Gaussian noise.
"""

from typing import Optional
import numpy as np
import torch


def apply_ecg_augmentation(
    x: torch.Tensor,
    mode: str = 'current',
    max_roll: int = 50,
    noise_std: float = 0.03
) -> torch.Tensor:
    """
    Applies ECG-safe augmentation to a batch of signals of shape (B, 12, T).

    Supported modes:
    1. 'current': Cyclic temporal rolling + additive Gaussian noise (reference configuration).
    2. 'none': Identity / no augmentation.
    3. 'noise_only': Additive Gaussian noise without temporal shift.
    4. 'nonwrapping_shift': Temporal shift without circular wraparound. Vacated boundary
       regions are padded with the boundary edge value (nearest value padding) to avoid
       abrupt step discontinuities, followed by gentle additive Gaussian noise.
    """
    if mode == 'none':
        return x

    if mode == 'noise_only':
        noise = noise_std * torch.randn_like(x)
        return x + noise

    if mode == 'nonwrapping_shift':
        # Shift without circular wraparound
        shift = int(np.random.randint(-max_roll, max_roll + 1))
        if shift == 0:
            x_shifted = x
        elif shift > 0:
            # Shift forward: pad beginning with first time-step values (or zeros)
            pad_vals = x[:, :, :1].expand(-1, -1, shift)
            x_shifted = torch.cat([pad_vals, x[:, :, :-shift]], dim=2)
        else:
            # Shift backward: pad end with last time-step values
            s = -shift
            pad_vals = x[:, :, -1:].expand(-1, -1, s)
            x_shifted = torch.cat([x[:, :, s:], pad_vals], dim=2)

        noise = noise_std * torch.randn_like(x_shifted)
        return x_shifted + noise

    # Default: 'current' (cyclic roll + Gaussian noise)
    shift = int(np.random.randint(-max_roll, max_roll + 1))
    x_rolled = torch.roll(x, shifts=shift, dims=2)
    noise = noise_std * torch.randn_like(x_rolled)
    return x_rolled + noise

