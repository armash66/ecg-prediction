"""
Ablation table formatting for comparing research architectures.
"""

import os
import glob
import json
from typing import Dict, Any, List, Optional
import pandas as pd


def format_ablation_markdown_table(
    cache_dir: str,
    save_csv_path: Optional[str] = None,
    save_json_path: Optional[str] = None
) -> str:
    """
    Scans result_*.json in cache_dir and prints/returns formatted markdown table.
    Optionally saves comparison.csv and comparison.json if paths are specified.
    """
    order = [
        'xgb', 'cnn', 'seq', 'hybrid', 'gated', 'ens_gated',
        'multiscale_current', 'multiscale_none', 'multiscale_noise',
        'multiscale_shift', 'multiscale_reg2'
    ]
    files = {os.path.basename(f)[7:-5]: f for f in glob.glob(os.path.join(cache_dir, 'result_*.json'))}
    names = [n for n in order if n in files] + sorted(n for n in files if n not in order)

    lines: List[str] = [
        "| Model | Macro AUROC | Macro AUPRC | Macro F1 | Macro Sens | Macro Spec | Params | Dur (s) | Lat (ms) |",
        "|---|---|---|---|---|---|---|---|---|"
    ]

    records = []
    for n in names:
        with open(files[n], 'r', encoding='utf-8') as f:
            r = json.load(f)

        params_str = f"{r.get('param_count', 0):,}" if 'param_count' in r else "-"
        dur_str = f"{r.get('training_duration_sec', 0.0):.1f}" if 'training_duration_sec' in r else "-"
        lat_str = f"{r.get('inference_latency_ms', 0.0):.2f}" if 'inference_latency_ms' in r else "-"
        spec_val = r.get('macro_specificity', 0.0)
        spec_str = f"{spec_val:.4f}" if spec_val > 0 else "-"

        lines.append(
            f"| {n} | {r.get('macro_auc', 0):.4f} | {r.get('macro_auprc', 0):.4f} | {r.get('macro_f1', 0):.4f} | "
            f"{r.get('macro_sensitivity', 0):.4f} | {spec_str} | {params_str} | {dur_str} | {lat_str} |"
        )
        record_dict = {
            'model': n,
            'macro_auc': r.get('macro_auc', 0.0),
            'macro_auprc': r.get('macro_auprc', 0.0),
            'macro_f1': r.get('macro_f1', 0.0),
            'macro_sensitivity': r.get('macro_sensitivity', 0.0),
            'macro_specificity': r.get('macro_specificity', 0.0),
            'param_count': r.get('param_count', None),
            'training_duration_sec': r.get('training_duration_sec', None),
            'inference_latency_ms': r.get('inference_latency_ms', None),
            'aug_mode': r.get('aug_mode', None),
            'best_epoch': r.get('best_epoch', None),
        }
        records.append(record_dict)

    if save_csv_path and records:
        df = pd.DataFrame(records)
        df.to_csv(save_csv_path, index=False)

    if save_json_path and records:
        with open(save_json_path, 'w', encoding='utf-8') as f:
            json.dump(records, f, indent=2)

    return "\n".join(lines)


