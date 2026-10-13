"""
Training callbacks for logging, early stopping, and lr scheduling.
"""

from typing import Dict, Any, Optional
from ..logging_config import get_logger

logger = get_logger(__name__)


class TrainingCallback:
    """Base callback interface."""
    def on_epoch_end(self, epoch: int, logs: Dict[str, Any]) -> None:
        pass


class EarlyStoppingCallback(TrainingCallback):
    """Stops training if validation score does not improve after patience epochs."""
    def __init__(self, patience: int = 7, mode: str = 'max'):
        self.patience = patience
        self.mode = mode
        self.counter = 0
        self.best_score = -float('inf') if mode == 'max' else float('inf')
        self.stop_training = False

    def on_epoch_end(self, epoch: int, logs: Dict[str, Any]) -> None:
        val_score = logs.get('val_metric')
        if val_score is None:
            return

        improved = (val_score > self.best_score) if self.mode == 'max' else (val_score < self.best_score)
        if improved:
            self.best_score = val_score
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                logger.info(f"Early stopping triggered at epoch {epoch} (no improvement in {self.patience} epochs).")
                self.stop_training = True
