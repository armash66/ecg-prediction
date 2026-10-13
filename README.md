# PTB-XL ECG Intelligence: Hybrid Deep Learning with Adaptive Gated Fusion

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-ee4c2c.svg)](https://pytorch.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **RESEARCH PROTOTYPE — NOT A MEDICAL DEVICE**  
> This software is an engineering student research prototype. It is strictly not certified for clinical diagnostic use, triage, or healthcare decision-making.

---

## 1. Project Overview

This repository houses the complete engineering and research codebase for **PTB-XL ECG Intelligence**, a final-year engineering research project investigating **Adaptive Gated Fusion** for 12-lead Electrocardiogram (ECG) multi-label diagnosis.

The system performs multi-label classification over the five official diagnostic superclasses of the PTB-XL benchmark dataset:
- **NORM**: Normal ECG
- **MI**: Myocardial Infarction
- **STTC**: ST/T Change
- **CD**: Conduction Disturbance
- **HYP**: Hypertrophy

### The Core Research Contribution: Adaptive Gated Fusion
Prior multimodal deep learning approaches rely on static feature concatenation, forcing classification heads to arbitrarily resolve conflicts between deep representations and clinical heuristics. 

Our proposed architecture introduces a learnable gating unit $g \in (0, 1)^{96}$ that evaluates deep representations ($128$-D) from a 1D ResNet + BiGRU + Temporal Attention branch alongside clinical handcrafted features ($64$-D) from wavelet decompositions, statistical moments, and rhythm metrics:

$$g = \sigma(W_g [h_{\text{deep}} \,\|\, h_{\text{feat}}] + b_g)$$
$$z = g \odot \tanh(W_d h_{\text{deep}} + b_d) + (1 - g) \odot \tanh(W_f h_{\text{feat}} + b_f)$$

The gate dynamically arbitrates information flow on a per-ECG basis, outputting interpretable mean gate weights and cross-recording variance.

---

## 2. Directory Structure

```text
ptbxl-ecg-intelligence/
├── README.md                     # Comprehensive research documentation
├── pyproject.toml                # Build system & package specification
├── requirements.txt              # Production/training dependencies
├── requirements-dev.txt          # Development & testing dependencies
├── .gitignore                    # Data, cache, and artifact exclusions
├── .env.example                  # Environment configuration template
├── Makefile                      # Standardized development tasks
├── configs/                      # Modular YAML configuration specifications
│   ├── data.yaml
│   ├── preprocessing.yaml
│   ├── model.yaml
│   ├── training.yaml
│   └── evaluation.yaml
├── src/                          # Core reusable library package
│   └── ecg_intelligence/
│       ├── __init__.py
│       ├── config.py
│       ├── logging_config.py
│       ├── data/                 # PTB-XL loader, metadata, splits, validation, caching
│       ├── preprocessing/        # Filtering, normalisation, resampling, augmentation
│       ├── features/             # Wavelets, moments, morphology, HRV, extractor
│       ├── models/               # ResNet1D, BiGRU, Attention, Gated Fusion, XGBoost
│       ├── training/             # Loss, trainer, callbacks, checkpointing, runner
│       ├── evaluation/           # Metrics, threshold search, confusion, calibration
│       ├── explainability/       # Integrated Gradients, faithfulness deletion tests
│       └── inference/            # Prediction engine, postprocessing
├── server/                       # FastAPI Backend Server
│   └── server.py                 # Serves ui/ and implements /api contract
├── ui/                           # Minimal Pale Web Interface (HTML, CSS, JS)
│   ├── index.html                # Single-page application
│   ├── styles.css                # Pale design system
│   ├── app.js                    # Interactive canvas waveform and API bindings
│   └── README.md                 # UI specification & API contract
├── reference/                    # Read-only legacy reference implementations
│   └── ptbxl_ecg_project/
├── experiments/                  # CLI experiment scripts (XGB, CNN, Seq, Gated, etc.)
├── notebooks/                    # Analytical Jupyter notebooks (01-04)
├── colab/                        # End-to-end Google Colab training suite
├── tests/                        # Comprehensive synthetic unit test suite
├── docs/                         # Theoretical documentation & architecture guides
├── scripts/                      # Environment and dataset audit scripts
└── artifacts/                    # Checkpoint, cache, and metrics storage
```

---

## 3. Installation & Environment Setup

### 3.1 Local Environment
Clone the repository and install in editable mode:
```bash
git clone <repo-url>
cd ptbxl-ecg-intelligence
pip install -r requirements.txt
pip install -r requirements-dev.txt
pip install -e .
```

Verify your local environment:
```bash
python scripts/validate_environment.py
```

### 3.2 Running Unit Tests
Unit tests run entirely on synthetic signals and mock metadata. They **do not require downloading PTB-XL or training models**:
```bash
pytest tests -v
```

---

## 4. Dataset Setup & Auditing

1. Download PTB-XL (version 1.0.3) from [PhysioNet](https://physionet.org/content/ptb-xl/1.0.3/).
2. Extract into `data/ptbxl/`:
   ```text
   data/ptbxl/
   ├── ptbxl_database.csv
   ├── scp_statements.csv
   └── records100/
   ```
3. Run the dataset audit script:
   ```bash
   python scripts/audit_dataset.py --root data/ptbxl
   ```

---

## 5. Experimental Protocol & Ablation Study

Experiments are fully modular, resumable, and can be run independently or orchestrated in sequence.

### 5.1 Run Individual Experiments
```bash
# E1: XGBoost Baseline on 139 Handcrafted Features
python experiments/train_xgb.py --root data/ptbxl --cache artifacts/cache

# E2: 1D ResNet Baseline (Global Average Pooling)
python experiments/train_resnet.py --root data/ptbxl --cache artifacts/cache --epochs 30

# E3: ResNet + BiGRU + Temporal Attention
python experiments/train_sequence.py --root data/ptbxl --cache artifacts/cache --epochs 30

# E4: Feature Concatenation Hybrid
python experiments/train_hybrid.py --root data/ptbxl --cache artifacts/cache --epochs 30

# E5: Proposed Adaptive Gated Fusion
python experiments/train_gated.py --root data/ptbxl --cache artifacts/cache --epochs 30

# E6: Probability-Level Ensemble
python experiments/train_ensemble.py --cache artifacts/cache --ens_with gated
```

### 5.2 Automated Ablation Pipeline
Run all ablations with automatic resumption of completed experiments:
```bash
python experiments/run_ablations.py --root data/ptbxl --cache artifacts/cache
```

### 5.3 Quick Smoke Test
Verify the end-to-end training and caching loop in minutes with a 2-epoch run:
```bash
python experiments/train_gated.py --root data/ptbxl --cache artifacts/cache --epochs 2
```

---

## 6. Training on Google Colab

The project is fully pre-configured for Google Colab GPU training:
1. Open [`colab/training.ipynb`](colab/training.ipynb) in Google Colab.
2. Select a GPU runtime (Runtime $\to$ Change runtime type $\to$ T4 GPU).
3. Connect your Google Drive containing PTB-XL.
4. Execute all cells. Trained checkpoints, normalisation statistics, and evaluation JSON files are saved directly to Google Drive.
5. Download the resulting `cache/` folder into your local `artifacts/cache/` to run the UI locally.

---

## 7. Custom Pale UI & FastAPI Server

To launch the pale, minimal research interface:
```bash
make ui
```
or directly via Uvicorn:
```bash
uvicorn server.server:app --reload --host 0.0.0.0 --port 8000
```
Then navigate to `http://localhost:8000/`.

### Design & Features:
- **Pale, Minimal Aesthetic**: Curated pale palette (Background `#F6F5F1`, Cards `#FFFFFF`, Text `#33363B`, Muted `#8D918F`, Border `#E8E6E0`, Sage `#CFE0D5`/`#86AB93`, Blush `#EBCFD1`/`#CF8F97`, Sky `#DCE9F0`, Amber `#F4EAD0`).
- **Interactive Waveform Viewer**: 10-second 12-lead signal visualizer with real-time cursor inspection (time and mV).
- **Integrated Gradients Overlay**: Dynamic attribution heatmap highlighting model attention across selected diagnostic classes and leads.
- **Multi-Label Detection**: Calibrated decision threshold markers and probability indicators.
- **Adaptive Gate Allocation**: Visual breakdown of model reliance on the deep signal branch vs handcrafted features.
- **Live Demo Mode**: If checkpoints have not yet been trained or placed in `artifacts/cache/`, the UI gracefully opens in demo mode with synthetic data and a clear notification banner.
- **Model Insights Tab**: Experiment ablation tables and per-class AUROC, AUPRC, F1, and Sensitivity metrics directly from `result_*.json`.

---

## 8. Research Integrity & Leakage Prevention

- **Patient-Independent Splits**: Folds 1–8 for training, Fold 9 for validation, and Fold 10 for testing. No records from the same patient appear across splits.
- **Frozen Normalisation**: Normalisation parameters ($\mu, \sigma, \mu_F, \sigma_F$) are computed **strictly on folds 1–8** and saved with model weights.
- **Validation-Only Threshold Calibration**: Decision thresholds ($t \in [0.05, 0.95]$) are selected strictly on Fold 9. **Test fold 10 is never used for tuning.**
- **Faithfulness Verification**: Integrated Gradients attributions are tested against random deletion baselines to confirm model faithfulness.
