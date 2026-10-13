"""
Experiment entrypoint: Probability-level Ensemble (Deep model + XGBoost).
"""

import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, '..'))
SRC_DIR = os.path.join(PROJECT_ROOT, 'src')
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

import os
import argparse
import numpy as np
from ecg_intelligence.training.experiment_runner import run_ensemble_experiment


def main():
    parser = argparse.ArgumentParser(description="Run Probability-level Ensemble experiment")
    parser.add_argument("--cache", default="artifacts/cache", help="Path to preprocessed cache directory")
    parser.add_argument("--ens_with", default="gated", choices=["seq", "hybrid", "gated"], help="Deep model to pair with XGBoost")
    args = parser.parse_args()

    result_file = os.path.join(args.cache, f"result_ens_{args.ens_with}.json")
    if os.path.exists(result_file):
        print(f"Skipping Ensemble experiment: {result_file} already exists.")
        return

    fold_file = os.path.join(args.cache, "fold.npy")
    y_file = os.path.join(args.cache, "Y.npy")

    if not os.path.exists(fold_file) or not os.path.exists(y_file):
        raise FileNotFoundError(f"Missing fold.npy or Y.npy in {args.cache}. Run data preprocessing first.")

    fold = np.load(fold_file)
    Y = np.load(y_file)

    print(f"Running Ensemble ({args.ens_with} + XGBoost) experiment...")
    run_ensemble_experiment(Y=Y, fold=fold, cache_dir=args.cache, ens_with=args.ens_with)


if __name__ == "__main__":
    main()
