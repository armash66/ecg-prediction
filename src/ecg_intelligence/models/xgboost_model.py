"""
Multi-label XGBoost classifier on handcrafted feature vectors.
"""

from typing import List, Dict, Any, Optional
import numpy as np
from ..logging_config import get_logger

logger = get_logger(__name__)


class MultiLabelXGBoost:
    """
    Independent XGBoost binary classifiers for each of the 5 diagnostic classes.
    """
    def __init__(self, params: Optional[Dict[str, Any]] = None, num_classes: int = 5):
        self.num_classes = num_classes
        self.params = params or {
            'n_estimators': 400,
            'max_depth': 6,
            'learning_rate': 0.05,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'tree_method': 'hist',
            'n_jobs': -1
        }
        self.models: List[Any] = []

    def fit(self, F_train: np.ndarray, Y_train: np.ndarray):
        """
        Trains 1 binary classifier per class on handcrafted feature matrix.
        """
        from xgboost import XGBClassifier
        self.models = []
        for i in range(self.num_classes):
            logger.info(f"Fitting XGBoost model for class index {i}...")
            m = XGBClassifier(**self.params)
            m.fit(F_train, Y_train[:, i])
            self.models.append(m)

    def predict_proba(self, F: np.ndarray) -> np.ndarray:
        """
        Predicts probabilities for each class: returns (N, num_classes).
        """
        if not self.models:
            raise RuntimeError("XGBoost models have not been fitted yet.")
        probs = np.zeros((len(F), self.num_classes), dtype=np.float32)
        for i, m in enumerate(self.models):
            probs[:, i] = m.predict_proba(F)[:, 1]
        return probs
