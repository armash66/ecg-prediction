"""
Automated ablation study orchestrator and summary table generator.
"""

import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, '..'))
SRC_DIR = os.path.join(PROJECT_ROOT, 'src')
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

import os
import sys
import glob
import argparse
import subprocess
from ecg_intelligence.evaluation.ablation import format_ablation_markdown_table


def main():
    parser = argparse.ArgumentParser(description="Run complete ablation study sequence")
    parser.add_argument("--root", default="data/ptbxl", help="Path to raw PTB-XL dataset")
    parser.add_argument("--cache", default="artifacts/cache", help="Path to preprocessed cache directory")
    parser.add_argument("--epochs", type=int, default=30, help="Epochs for neural training")
    parser.add_argument("--smoke_test", action="store_true", help="Run quick 2-epoch validation check")
    args = parser.parse_args()

    os.makedirs(args.cache, exist_ok=True)
    here = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(here, ".."))

    def run_cmd(script_name: str, extra_args=None):
        cmd = [sys.executable, os.path.join(here, script_name)] + (extra_args or [])
        print(f"\n>> Executing: {' '.join(cmd)}")
        res = subprocess.run(cmd, cwd=root_dir)
        if res.returncode != 0:
            print(f"Warning: Step {script_name} returned non-zero code {res.returncode}")

    # Smoke test if requested
    if args.smoke_test:
        print("\n--- Running 2-epoch Smoke Test ---")
        run_cmd("train_gated.py", ["--root", args.root, "--cache", args.cache, "--epochs", "2"])

    # Sequentially run experiments
    experiments = [
        ("train_xgb.py", ["--root", args.root, "--cache", args.cache]),
        ("train_resnet.py", ["--root", args.root, "--cache", args.cache, "--epochs", str(args.epochs)]),
        ("train_sequence.py", ["--root", args.root, "--cache", args.cache, "--epochs", str(args.epochs)]),
        ("train_hybrid.py", ["--root", args.root, "--cache", args.cache, "--epochs", str(args.epochs)]),
        ("train_gated.py", ["--root", args.root, "--cache", args.cache, "--epochs", str(args.epochs)]),
        ("train_ensemble.py", ["--cache", args.cache, "--ens_with", "gated"]),
    ]

    for script, script_args in experiments:
        run_cmd(script, script_args)

    print("\n=======================================================")
    print("               FINAL ABLATION TABLE                    ")
    print("=======================================================")
    csv_path = os.path.join(args.cache, "comparison.csv")
    table_str = format_ablation_markdown_table(args.cache, save_csv_path=csv_path)
    print(table_str)
    print(f"\n[+] Saved comparison metrics table to: {csv_path}")



if __name__ == "__main__":
    main()
