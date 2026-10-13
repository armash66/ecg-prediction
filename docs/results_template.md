# Experimental Results Template

This document provides the standard template for recording test set metrics on PTB-XL (Fold 10).

## 1. Overall Architectural Comparison

| Model | Macro AUROC | Macro AUPRC | Macro F1 | Macro Sens | Gate Deep Mean | Notes |
|---|---|---|---|---|---|---|
| E1: XGBoost (Handcrafted) | — | — | — | — | N/A | 139 features |
| E2: 1D ResNet (GAP) | — | — | — | — | N/A | Raw ECG |
| E3: ResNet + BiGRU + Attention | — | — | — | — | N/A | Temporal attention |
| E4: Concat Hybrid | — | — | — | — | N/A | Direct vector concat |
| **E5: Gated Fusion (Proposed)** | — | — | — | — | — | **Adaptive gating** |
| E6: Ensemble (Gated + XGB) | — | — | — | — | — | 0.6 / 0.4 blend |

---

## 2. Per-Class Performance Breakdown (E5: Proposed Gated Fusion)

| Class | AUROC | AUPRC | F1 Score | Sensitivity | Calibrated Threshold (Fold 9) |
|---|---|---|---|---|---|
| **NORM** (Normal ECG) | — | — | — | — | — |
| **MI** (Myocardial Infarction) | — | — | — | — | — |
| **STTC** (ST/T Change) | — | — | — | — | — |
| **CD** (Conduction Disturbance) | — | — | — | — | — |
| **HYP** (Hypertrophy) | — | — | — | — | — |

---

## 3. Faithfulness Deletion Test (10% Top Attributed vs Random Removal)

| Class | Mean Probability Drop (Top IG) | Mean Probability Drop (Random) | Ratio (Top / Random) |
|---|---|---|---|
| **MI** | — | — | — |
| **NORM** | — | — | — |
| **STTC** | — | — | — |
| **CD** | — | — | — |
| **HYP** | — | — | — |
