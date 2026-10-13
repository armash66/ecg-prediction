"""
Experiment entrypoint: XGBoost on handcrafted features.
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
    parser = argparse.ArgumentParser(description="Train XGBoost baseline on handcrafted features")
    parser.add_argument("--root", default="data/ptbxl", help="Path to raw PTB-XL dataset")
    parser.add_argument("--cache", default="artifacts/cache", help="Path to preprocessed cache directory")
    args = parser.parse_args()

    result_file = os.path.join(args.cache, "result_xgb.json")
    if os.path.exists(result_file):
        print(f"Skipping XGBoost experiment: {result_file} already exists.")
        return

    print("Running XGBoost baseline experiment...")
    run_experiment(mode="xgb", root=args.root, cache_dir=args.cache)


if __name__ == "__main__":
    main()
