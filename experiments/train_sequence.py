"""
Experiment entrypoint: 1D ResNet + BiGRU + Temporal Attention.
"""

import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, '..'))
SRC_DIR = os.path.join(PROJECT_ROOT, 'src')
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

import os
import argparse
from ecg_intelligence.training.experiment_runner import run_experiment


def main():
    parser = argparse.ArgumentParser(description="Train Sequence model (ResNet + BiGRU + Attention)")
    parser.add_argument("--root", default="data/ptbxl", help="Path to raw PTB-XL dataset")
    parser.add_argument("--cache", default="artifacts/cache", help="Path to preprocessed cache directory")
    parser.add_argument("--epochs", type=int, default=30, help="Number of training epochs")
    parser.add_argument("--bs", type=int, default=128, help="Batch size")
    args = parser.parse_args()

    result_file = os.path.join(args.cache, "result_seq.json")
    if os.path.exists(result_file):
        print(f"Skipping Seq experiment: {result_file} already exists.")
        return

    print("Running Sequence model experiment...")
    run_experiment(mode="seq", root=args.root, cache_dir=args.cache, epochs=args.epochs, batch_size=args.bs)


if __name__ == "__main__":
    main()
