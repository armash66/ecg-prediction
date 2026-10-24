"""
Complete PyTorch training loop with OneCycleLR, pos_weight BCE, early stopping, and evaluation.
"""

import os
import time
from typing import Tuple, Optional, Dict, Any, List
import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import roc_auc_score, average_precision_score

from ..logging_config import get_logger
from ..preprocessing.normalization import compute_norm_stats, normalize_signals, normalize_features
from ..preprocessing.augmentation import apply_ecg_augmentation
from ..models.classifier import build_torch_model
from ..evaluation.metrics import evaluate_test_metrics
from .losses import compute_positive_weights, MultiLabelBCEWithLogitsLoss
from .checkpoint import ModelCheckpoint

logger = get_logger(__name__)


class PyTorchTrainer:
    """
    Standardized trainer for Deep and Hybrid PTB-XL architectures.
    """
    def __init__(
        self,
        mode: str = 'gated',
        epochs: int = 30,
        batch_size: int = 128,
        cache_dir: str = 'artifacts/cache',
        lr: float = 2e-3,
        max_lr: Optional[float] = None,
        weight_decay: float = 1e-2,
        seed: int = 42,
        aug_mode: str = 'current',
        early_stopping_patience: int = 6,
        model_name: Optional[str] = None,
        use_se: bool = True,
        dropout: float = 0.3
    ):
        self.mode = mode
        self.epochs = epochs
        self.batch_size = batch_size
        self.cache_dir = cache_dir
        self.lr = lr
        # If max_lr not specified, maintain backwards compatible 3e-3 default, or lr if max_lr given
        self.max_lr = max_lr if max_lr is not None else max(lr, 3e-3)
        self.weight_decay = weight_decay
        self.seed = seed
        self.aug_mode = aug_mode
        self.early_stopping_patience = early_stopping_patience
        self.model_name = model_name or mode
        self.use_se = use_se
        self.dropout = dropout
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'

    def train_and_evaluate(
        self,
        X: np.ndarray,
        F: np.ndarray,
        Y: np.ndarray,
        fold: np.ndarray,
        save_samples: bool = True
    ) -> Dict[str, Any]:
        """
        Executes full training protocol:
        - Folds 1-8: Training (normalisation stats computed here ONLY).
        - Fold 9: Validation (threshold selection).
        - Fold 10: Testing (strictly independent evaluation).
        """
        torch.manual_seed(self.seed)
        np.random.seed(self.seed)
        os.makedirs(self.cache_dir, exist_ok=True)

        tr, va, te = (fold <= 8), (fold == 9), (fold == 10)
        logger.info(
            f"Split sizes: Train={tr.sum()}, Val={va.sum()}, Test={te.sum()} on device={self.device} "
            f"| Model={self.model_name} (mode={self.mode}) | AugMode={self.aug_mode}"
        )

        # Compute normalisation statistics strictly on folds 1-8
        ns = compute_norm_stats(X, F, tr)
        # Only overwrite norm.npz if not already existing, or preserve existing
        norm_path = os.path.join(self.cache_dir, 'norm.npz')
        if not os.path.exists(norm_path):
            np.savez(norm_path, mu=ns['mu'], sd=ns['sd'], fm=ns['fm'], fs=ns['fs'])

        # Standardise and format tensors
        Xn = normalize_signals(X, ns['mu'], ns['sd'])  # (N, 12, 1000)
        Fn = normalize_features(F, ns['fm'], ns['fs']) # (N, 139)

        Xt = torch.from_numpy(Xn)
        Ft = torch.from_numpy(Fn)
        Yt = torch.from_numpy(Y)

        net = build_torch_model(
            num_features=F.shape[1],
            mode=self.mode,
            use_se=self.use_se,
            dropout=self.dropout
        ).to(self.device)

        param_count = sum(p.numel() for p in net.parameters() if p.requires_grad)
        logger.info(f"Model {self.model_name} initialized with {param_count:,} trainable parameters.")

        # Imbalance weighting
        pw = compute_positive_weights(Y[tr]).to(self.device)
        crit = MultiLabelBCEWithLogitsLoss(pos_weight=pw)

        opt = torch.optim.AdamW(net.parameters(), lr=self.lr, weight_decay=self.weight_decay)
        train_idx = np.where(tr)[0]
        total_steps = self.epochs * int(np.ceil(len(train_idx) / self.batch_size))
        sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=self.max_lr, total_steps=total_steps)

        ckpt_path = os.path.join(self.cache_dir, f'model_{self.model_name}.pt')
        checkpoint = ModelCheckpoint(ckpt_path, mode='max')

        def predict_subset(mask: np.ndarray):
            net.eval()
            out, gates = [], []
            indices = np.where(mask)[0]
            with torch.no_grad():
                for k in range(0, len(indices), 512):
                    b = indices[k:k + 512]
                    xb = Xt[b].to(self.device)
                    fb = Ft[b].to(self.device)
                    logits = net(xb, fb)
                    out.append(torch.sigmoid(logits).cpu().numpy())
                    if self.mode == 'gated' and net.gate_val is not None:
                        gates.append(net.gate_val.cpu().numpy())
            p_arr = np.concatenate(out) if out else np.empty((0, 5))
            g_arr = np.concatenate(gates) if gates else None
            return p_arr, g_arr

        logger.info(f"Starting {self.model_name} training for up to {self.epochs} epochs (patience={self.early_stopping_patience})...")
        t_start_train = time.time()
        best_val_auc = -1.0
        best_epoch = 0
        epochs_no_improve = 0
        history: List[Dict[str, Any]] = []

        for ep in range(self.epochs):
            net.train()
            np.random.shuffle(train_idx)
            running_loss = 0.0

            for k in range(0, len(train_idx), self.batch_size):
                b = train_idx[k:k + self.batch_size]
                xb = Xt[b].to(self.device)
                fb = Ft[b].to(self.device)
                yb = Yt[b].to(self.device)

                # Configurable ECG augmentation during training
                xb_aug = apply_ecg_augmentation(xb, mode=self.aug_mode)

                opt.zero_grad()
                logits = net(xb_aug, fb)
                loss = crit(logits, yb)
                loss.backward()
                opt.step()
                sched.step()

                running_loss += loss.item() * len(b)

            pv, _ = predict_subset(va)
            val_aucs = [roc_auc_score(Y[va][:, i], pv[:, i]) for i in range(5)]
            val_macro_auc = float(np.mean(np.asarray(val_aucs, dtype=float)))
            val_auprcs = [average_precision_score(Y[va][:, i], pv[:, i]) for i in range(5)]
            val_macro_auprc = float(np.mean(np.asarray(val_auprcs, dtype=float)))
            epoch_loss = running_loss / len(train_idx)

            ep_record = {
                'epoch': ep + 1,
                'train_loss': float(epoch_loss),
                'val_macro_auc': float(val_macro_auc),
                'val_macro_auprc': float(val_macro_auprc),
            }
            history.append(ep_record)

            improved = checkpoint.update(val_macro_auc, net)
            if improved:
                best_val_auc = val_macro_auc
                best_epoch = ep + 1
                epochs_no_improve = 0
                logger.info(
                    f"Epoch {ep + 1:02d}/{self.epochs:02d} - Loss: {epoch_loss:.4f} - "
                    f"Val Macro-AUC: {val_macro_auc:.4f} (*) - Val Macro-AUPRC: {val_macro_auprc:.4f}"
                )
            else:
                epochs_no_improve += 1
                logger.info(
                    f"Epoch {ep + 1:02d}/{self.epochs:02d} - Loss: {epoch_loss:.4f} - "
                    f"Val Macro-AUC: {val_macro_auc:.4f} - Val Macro-AUPRC: {val_macro_auprc:.4f}"
                )

            if self.early_stopping_patience > 0 and epochs_no_improve >= self.early_stopping_patience:
                logger.info(
                    f"Early stopping triggered at epoch {ep + 1}. No improvement in {epochs_no_improve} epochs. "
                    f"Restoring best checkpoint from epoch {best_epoch}."
                )
                break

        training_duration_sec = time.time() - t_start_train

        # Restore best model
        checkpoint.load_best(net, device=self.device)

        # Inference latency measurement
        net.eval()
        t_lat_start = time.time()
        pv, _ = predict_subset(va)
        pt, gt = predict_subset(te)
        inference_latency_ms = float((time.time() - t_lat_start) / (len(pv) + len(pt)) * 1000.0)

        extra_info = {
            'param_count': param_count,
            'training_duration_sec': float(round(training_duration_sec, 2)),
            'inference_latency_ms': float(round(inference_latency_ms, 3)),
            'best_epoch': best_epoch,
            'aug_mode': self.aug_mode,
            'max_lr': float(self.max_lr),
            'weight_decay': float(self.weight_decay),
            'history': history,
        }

        if gt is not None:
            extra_info['gate_mean_deep_weight'] = float(gt.mean())
            extra_info['gate_std_across_ecgs'] = float(gt.mean(axis=1).std())

        # Calculate metrics with thresholds tuned strictly on val fold 9
        report_data = evaluate_test_metrics(
            model_name=self.model_name,
            y_val=Y[va],
            p_val=pv,
            y_test=Y[te],
            p_test=pt,
            output_dir=self.cache_dir,
            extra=extra_info
        )

        if save_samples:
            samples_path = os.path.join(self.cache_dir, 'samples.npz')
            if not os.path.exists(samples_path):
                test_indices = np.where(te)[0][:40]
                np.savez(samples_path, X=X[test_indices], Y=Y[test_indices])
                logger.info(f"Saved 40 test samples for demo to {samples_path}")

        return report_data

