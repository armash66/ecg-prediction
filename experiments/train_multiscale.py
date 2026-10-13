"""
Experiment entrypoint: Multi-Scale 1D Residual CNN with temporal branches (k=7, 15, 31)
and optional channel attention.
"""

import os
import sys
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, '..'))
SRC_DIR = os.path.join(PROJECT_ROOT, 'src')
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from ecg_intelligence.training.experiment_runner import run_experiment


def main():
    parser = argparse.ArgumentParser(description="Train Multi-Scale Residual CNN")
    parser.add_argument("--root", default="data/ptbxl", help="Path to raw PTB-XL dataset")
    parser.add_argument("--cache", default="artifacts/cache", help="Path to preprocessed cache directory")
    parser.add_argument("--epochs", type=int, default=30, help="Maximum training epochs")
    parser.add_argument("--bs", type=int, default=128, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Base learning rate")
    parser.add_argument("--max_lr", type=float, default=1e-3, help="Max learning rate for OneCycleLR")
    parser.add_argument("--weight_decay", type=float, default=0.01, help="AdamW weight decay")
    parser.add_argument(
        "--aug_mode",
        default="current",
        choices=["current", "none", "noise_only", "nonwrapping_shift"],
        help="Augmentation mode"
    )
    parser.add_argument("--patience", type=int, default=6, help="Early stopping patience (epochs)")
    parser.add_argument("--name", default=None, help="Custom identifier for saved model/results")
    parser.add_argument("--no_se", action="store_true", help="Disable Squeeze-and-Excitation channel attention")
    parser.add_argument("--dropout", type=float, default=0.3, help="Head dropout rate")
    args = parser.parse_args()

    model_name = args.name or f"multiscale_{args.aug_mode}"
    result_file = os.path.join(args.cache, f"result_{model_name}.json")

    if os.path.exists(result_file):
        print(f"Skipping {model_name} experiment: {result_file} already exists.")
        return

    print(f"Running Multi-Scale Residual CNN ({model_name}) | Aug: {args.aug_mode} | LR: {args.lr} | Patience: {args.patience}...")
    run_experiment(
        mode="multiscale",
        root=args.root,
        cache_dir=args.cache,
        epochs=args.epochs,
        batch_size=args.bs,
        lr=args.lr,
        max_lr=args.max_lr,
        weight_decay=args.weight_decay,
        aug_mode=args.aug_mode,
        early_stopping_patience=args.patience,
        model_name=model_name,
        use_se=not args.no_se,
        dropout=args.dropout
    )


if __name__ == "__main__":
    main()
