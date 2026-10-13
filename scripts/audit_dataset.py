"""
PTB-XL Dataset integrity and distribution auditing script.
"""

import os
import sys
import argparse
import numpy as np
import pandas as pd

from ecg_intelligence import CLASSES
from ecg_intelligence.config import ProjectConfig
from ecg_intelligence.data.metadata import load_meta
from ecg_intelligence.data.validation import validate_metadata_integrity
from ecg_intelligence.data.ptbxl_loader import audit_sample_records


def audit_dataset(root_path: str, n_samples: int = 5):
    print("=" * 65)
    print(f"Auditing PTB-XL Dataset at: {root_path}")
    print("=" * 65)

    if not os.path.exists(root_path):
        print(f"[!] Path does not exist: {root_path}")
        print("Please check your path or set the PTBXL_ROOT environment variable.")
        sys.exit(1)

    try:
        # 1. Metadata loading & validation
        df, Y = load_meta(root_path)
        validate_metadata_integrity(df)
        print(f"[+] Metadata integrity verified successfully.")
        print(f"    Total labelled ECG records : {len(df):,}")
        print(f"    Unique patients            : {df['patient_id'].nunique():,}")

        # 2. Check patient overlap between folds (folds 1-8 train, 9 val, 10 test)
        train_patients = set(df[df['strat_fold'] <= 8]['patient_id'])
        val_patients = set(df[df['strat_fold'] == 9]['patient_id'])
        test_patients = set(df[df['strat_fold'] == 10]['patient_id'])

        leak_train_val = train_patients.intersection(val_patients)
        leak_train_test = train_patients.intersection(test_patients)
        leak_val_test = val_patients.intersection(test_patients)

        if leak_train_val or leak_train_test or leak_val_test:
            print(f"[!] WARNING: Patient leakage detected across folds!")
            if leak_train_val:
                print(f"    Train/Val overlap : {len(leak_train_val)} patients")
            if leak_train_test:
                print(f"    Train/Test overlap: {len(leak_train_test)} patients")
            if leak_val_test:
                print(f"    Val/Test overlap  : {len(leak_val_test)} patients")
        else:
            print(f"[+] Patient fold isolation verified: 0 patient overlap across train/val/test.")

        # 3. Diagnostic Superclass Prevalences (Multi-label)
        print("\nDiagnostic Superclass Prevalences (Multi-label):")
        for i, c in enumerate(CLASSES):
            count = int(Y[:, i].sum())
            prev = float(Y[:, i].mean())
            print(f"  {c:<6}: {count:>6} cases ({prev * 100:>5.1f}%)")

        # Multi-label co-occurrence info
        num_labels_per_record = Y.sum(axis=1)
        multi_label_count = int((num_labels_per_record > 1).sum())
        print(f"  Records with >1 diagnostic superclass: {multi_label_count:,} ({multi_label_count / len(Y) * 100:.1f}%)")

        # 4. Patient Stratified Fold Distribution
        print("\nPatient Stratified Fold Distribution:")
        fold_counts = df['strat_fold'].value_counts().sort_index()
        for f, cnt in fold_counts.items():
            split_role = "Train (1-8)" if f <= 8 else ("Val (9)" if f == 9 else "Test (10)")
            print(f"  Fold {f:>2}: {cnt:>5} records  [{split_role}]")

        # 5. Sample record signal audit (Requirement B.11)
        print(f"\nAuditing {n_samples} random WFDB records from signal directories...")
        sample_audit = audit_sample_records(root_path, df['filename_lr'].tolist(), n_samples=n_samples)
        if sample_audit["all_passed"]:
            print(f"[+] All {n_samples} sample records loaded successfully:")
            for item in sample_audit["details"]:
                print(f"    {item['record']} -> shape {item['shape']}, finite={item['finite']}")
        else:
            print(f"[!] Some sample records failed validation:")
            for item in sample_audit["details"]:
                status = "PASS" if item["valid"] else f"FAIL ({item['error']})"
                print(f"    {item['record']} -> {status}")
            sys.exit(1)

        print("\n" + "=" * 65)
        print("[+] DATASET AUDIT PASSED: Dataset is ready for processing.")
        print("=" * 65)

    except Exception as e:
        print(f"[!] Audit failed with error: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Audit PTB-XL dataset directory")
    parser.add_argument(
        "--root",
        default=os.environ.get("PTBXL_ROOT", "data/ptbxl"),
        help="Path to PTB-XL dataset directory (defaults to PTBXL_ROOT env var or data/ptbxl)"
    )
    parser.add_argument("--samples", type=int, default=5, help="Number of random records to audit")
    args = parser.parse_args()
    audit_dataset(args.root, n_samples=args.samples)


if __name__ == "__main__":
    main()

