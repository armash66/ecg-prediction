"""
Model checkpoint manager for tracking best validation metrics and weights saving.
"""

import os
from typing import Dict, Any, Optional
import torch
from ..logging_config import get_logger

logger = get_logger(__name__)


class ModelCheckpoint:
    """
    Saves and loads PyTorch model state_dict based on best validation score.
    """
    def __init__(self, filepath: str, mode: str = 'max'):
        self.filepath = filepath
        self.mode = mode
        self.best_score = -float('inf') if mode == 'max' else float('inf')
        self.best_state: Optional[Dict[str, Any]] = None

    def update(self, current_score: float, model: torch.nn.Module) -> bool:
        """
        Returns True if model improved and was saved.
        """
        improved = (current_score > self.best_score) if self.mode == 'max' else (current_score < self.best_score)
        if improved:
            self.best_score = current_score
            self.best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
            torch.save(self.best_state, self.filepath)
            logger.info(f"Model improved ({self.best_score:.4f}). Saved checkpoint to {self.filepath}")
            return True
        return False

    def load_best(self, model: torch.nn.Module, device: str = 'cpu') -> torch.nn.Module:
        """Loads best weights into the provided model."""
        if self.best_state is not None:
            model.load_state_dict({k: v.to(device) for k, v in self.best_state.items()})
        elif os.path.exists(self.filepath):
            state = torch.load(self.filepath, map_location=device)
            model.load_state_dict(state)
        return model
