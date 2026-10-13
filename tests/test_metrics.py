import pytest
import numpy as np
from ecg_intelligence import CLASSES
from ecg_intelligence.evaluation.thresholds import optimize_thresholds_on_val
from ecg_intelligence.evaluation.metrics import evaluate_test_metrics
from ecg_intelligence.evaluation.confusion import compute_multilabel_confusion
from ecg_intelligence.evaluation.calibration import compute_expected_calibration_error


def test_threshold_selection_on_val():
    N = 100
    y_val = (np.random.rand(N, 5) > 0.7).astype(np.float32)
    p_val = np.random.rand(N, 5).astype(np.float32)

    thrs = optimize_thresholds_on_val(y_val, p_val)
    assert len(thrs) == len(CLASSES)
    for c in CLASSES:
        assert 0.05 <= thrs[c] <= 0.95


def test_evaluate_test_metrics_calculation(tmp_path):
    N_val, N_test = 50, 50
    y_val = (np.random.rand(N_val, 5) > 0.5).astype(np.float32)
    p_val = np.random.rand(N_val, 5).astype(np.float32)
    y_test = (np.random.rand(N_test, 5) > 0.5).astype(np.float32)
    p_test = np.random.rand(N_test, 5).astype(np.float32)

    res = evaluate_test_metrics(
        model_name="mock_test",
        y_val=y_val,
        p_val=p_val,
        y_test=y_test,
        p_test=p_test,
        output_dir=str(tmp_path)
    )

    assert "macro_auc" in res
    assert "micro_auc" in res
    assert "macro_f1" in res
    assert "micro_f1" in res
    assert "macro_specificity" in res
    assert "thresholds" in res
    assert 0.0 <= res["macro_auc"] <= 1.0
    assert 0.0 <= res["macro_specificity"] <= 1.0
    assert (tmp_path / "predictions.npz").is_file()



def test_calibration_and_confusion():
    N = 40
    y_true = (np.random.rand(N, 5) > 0.5).astype(np.float32)
    p_pred = np.random.rand(N, 5).astype(np.float32)
    b_pred = (p_pred > 0.5).astype(int)

    ece = compute_expected_calibration_error(y_true, p_pred)
    assert len(ece) == 5
    for c in CLASSES:
        assert 0.0 <= ece[c] <= 1.0

    cms = compute_multilabel_confusion(y_true, b_pred)
    assert len(cms) == 5
    for c in CLASSES:
        assert len(cms[c]) == 2
        assert len(cms[c][0]) == 2
