"""
Explainability package: Integrated Gradients, Attribution, Deletion tests, Visualizations.
"""

from .integrated_gradients import (
    compute_integrated_gradients,
    compute_integrated_gradients_with_diagnostics,
    compute_gradient_x_input,
    compute_smoothgrad,
)
from .attribution import compute_lead_attributions
from .deletion_test import run_deletion_faithfulness_test
from .visualization import plot_attribution_lead, plot_12_lead_ecg

__all__ = [
    "compute_integrated_gradients",
    "compute_integrated_gradients_with_diagnostics",
    "compute_gradient_x_input",
    "compute_smoothgrad",
    "compute_lead_attributions",
    "run_deletion_faithfulness_test",
    "plot_attribution_lead",
    "plot_12_lead_ecg"
]

