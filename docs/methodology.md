# Methodology

## 1. Dataset & Clinical Target Space
- **PTB-XL Dataset**: 21,837 12-lead ECGs of 10-second duration sampled at 100 Hz ($1000 \times 12$).
- **Target Selection**: Rows in `scp_statements.csv` with `diagnostic == 1` mapped to five diagnostic superclasses:
  - `NORM`: Normal ECG
  - `MI`: Myocardial Infarction
  - `STTC`: ST/T Change
  - `CD`: Conduction Disturbance
  - `HYP`: Hypertrophy
- ECG recordings without diagnostic superclass associations are excluded.

## 2. Leakage-Free Preprocessing Protocol
1. **Stratified Split**: Official PTB-XL patient-stratified folds:
   - Folds 1–8: Training set
   - Fold 9: Validation set (used exclusively for threshold calibration and checkpoint selection)
   - Fold 10: Test set (strictly isolated until final evaluation)
2. **Normalisation Statistics**:
   - Signal mean $\mu \in \mathbb{R}^{12}$ and standard deviation $\sigma \in \mathbb{R}^{12}$ are calculated strictly on folds 1–8.
   - Handcrafted feature mean $\mu_F \in \mathbb{R}^{139}$ and standard deviation $\sigma_F \in \mathbb{R}^{139}$ are calculated strictly on folds 1–8.
   - Zero data leakage into validation or testing sets.

## 3. Data Augmentation
During training, raw signals undergo realistic augmentations:
- **Temporal Roll**: Random cyclic shift $\Delta t \in [-50, 50]$ samples ($\pm 0.5$ s), simulating arbitrary acquisition start times without altering cardiac cycle frequencies.
- **Additive Gaussian Noise**: $\mathcal{N}(0, 0.03^2)$, simulating mild baseline electrode contact variations.

## 4. Multi-Label Optimization
- **Loss**: Binary Cross-Entropy with Logits:
  $$\mathcal{L} = -\sum_{c=1}^5 \left[ w_c \cdot y_c \log \sigma(\hat{y}_c) + (1 - y_c) \log (1 - \sigma(\hat{y}_c)) \right]$$
- **Positive Class Weights**:
  $$w_c = \text{clamp}\left(\frac{1 - p_c}{p_c}, 0.1, 5.0\right)$$
- **Optimizer**: AdamW ($\text{lr} = 2 \times 10^{-3}$, weight decay $= 10^{-2}$).
- **Scheduler**: OneCycleLR with $\text{max\_lr} = 3 \times 10^{-3}$.
