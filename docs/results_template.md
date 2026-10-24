# Experimental Results Template

This document provides the standard template for recording test set metrics on PTB-XL (Fold 10).

## 1. Overall Architectural Comparison

| Model | Macro AUROC | Macro AUPRC | Macro F1 | Macro Sens | Gate Deep Mean | Notes |
|---|---|---|---|---|---|---|
| E1: XGBoost (Handcrafted) | 0.8678 | 0.7253 | 0.6661 | 0.6887 | N/A | 139 features |
| E2: 1D ResNet (GAP) | 0.9252 | 0.8156 | 0.7401 | 0.7612 | N/A | Raw ECG |
| E3: ResNet + BiGRU + Attention | 0.9254 | 0.8157 | 0.7355 | 0.7651 | N/A | Temporal attention (Rank #1 Macro AUROC) |
| E4: Concat Hybrid | 0.9240 | 0.8138 | 0.7375 | 0.7722 | N/A | Direct vector concat |
| **E5: Gated Fusion (Proposed)** | 0.9216 | 0.8133 | 0.7396 | 0.7644 | 0.5601 | **Adaptive gating (std = 0.0910)** |
| E6: Ensemble (Gated + XGB) | 0.9203 | 0.8069 | 0.7415 | 0.7768 | — | 0.6 / 0.4 probability blend |

---

## 2. Per-Class Performance Breakdown (E5: Proposed Gated Fusion)

| Class | AUROC | AUPRC | F1 Score | Sensitivity | Calibrated Threshold (Fold 9) |
|---|---|---|---|---|---|
| **NORM** (Normal ECG) | 0.9449 | 0.9248 | 0.8605 | 0.9159 | 0.60 |
| **MI** (Myocardial Infarction) | 0.9157 | 0.8018 | 0.7258 | 0.7364 | 0.55 |
| **STTC** (ST/T Change) | 0.9292 | 0.8206 | 0.7496 | 0.8157 | 0.50 |
| **CD** (Conduction Disturbance) | 0.9128 | 0.8428 | 0.7650 | 0.7319 | 0.75 |
| **HYP** (Hypertrophy) | 0.9055 | 0.6767 | 0.5971 | 0.6221 | 0.70 |

---

## 3. Faithfulness Deletion Test (10% Top Attributed vs Random Removal)

| Class | Mean Probability Drop (Top IG) | Mean Probability Drop (Random) | Ratio (Top / Random) |
|---|---|---|---|
| **MI** | 0.0724 | -0.0073 | Significant Drop (Faithful) |
| **NORM** | 0.4643 | 0.0013 | High Sensitivity |
| **STTC** | 0.1190 | -0.0098 | High Faithfulness |
| **CD** | 0.0018 | 0.0231 | Diffuse Conduction Distribution |
| **HYP** | 0.6767 | 0.0642 | Voltage-Dependent Collapse |
