# Evaluation Plan

## 1. Metric Suite
Because PTB-XL multi-label classification exhibits pronounced class imbalance, evaluation must not rely on simple accuracy. The following metrics are computed:

- **Macro AUROC**: Area under the Receiver Operating Characteristic curve averaged unweighted across the 5 superclasses.
- **Macro AUPRC (Average Precision)**: Area under the Precision-Recall curve, providing sensitivity to minority diagnostic classes.
- **Macro F1 Score**: Harmonic mean of precision and recall using calibrated decision thresholds.
- **Macro Sensitivity (Recall)**: Critical clinical indicator of false negative reduction.
- **Per-Class $2 \times 2$ Confusion Matrices**: $[[\text{TN}, \text{FP}], [\text{FN}, \text{TP}]]$.
- **Expected Calibration Error (ECE)**: Measures statistical alignment between predicted confidence scores and empirical diagnostic frequencies.

## 2. Validation-Only Threshold Tuning Protocol
Standard fixed thresholding ($0.5$) is sub-optimal in multi-label clinical settings.
1. A grid of 19 candidate thresholds $t \in [0.05, 0.95]$ with step $0.05$ is evaluated.
2. The threshold maximizing the F1 score on **Validation Fold 9** is selected for each class:
   $$t_c^* = \arg\max_{t} F_1(\mathbf{y}_{\text{val}, c}, \mathbf{p}_{\text{val}, c} > t)$$
3. **Test Fold 10 is NEVER accessed during threshold search.**
4. All reported test metrics are calculated strictly on Test Fold 10 using $t_c^*$.

## 3. Interpretability & Faithfulness Protocol
- **Integrated Gradients**: Riemann approximation with 40 steps from zero baseline ($\mu$-normalized signal).
- **Faithfulness Deletion Test**:
  - Top 10% attributed waveform regions are replaced by baseline (zero).
  - The resulting drop in predicted probability is compared against the drop from replacing 10% randomly selected regions.
  - Faithful attribution requires $\Delta P_{\text{top}} \gg \Delta P_{\text{rand}}$.
