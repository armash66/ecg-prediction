"""
Evaluation metrics, threshold search, confusion matrices, and ablation reporting.
"""

from .metrics import evaluate_test_metrics
from .thresholds import optimize_thresholds_on_val
from .confusion import compute_multilabel_confusion
from .calibration import compute_expected_calibration_error
from .ablation import format_ablation_markdown_table

__all__ = [
    "evaluate_test_metrics",
    "optimize_thresholds_on_val",
    "compute_multilabel_confusion",
    "compute_expected_calibration_error",
    "format_ablation_markdown_table"
]
