# Research Gap and Motivation

## 1. Limitations of Pure End-to-End Deep Learning in ECG
End-to-end deep convolutional and recurrent neural networks frequently achieve competitive benchmark scores on standardized ECG datasets. However, they suffer from fundamental practical and scientific limitations in clinical electrophysiology:
1. **Black-box Decision Boundaries**: Convolutional filters extract unconstrained spatial features that often fail to conform to clinically recognized waves (P-wave, QRS-complex, T-wave).
2. **Frequency Dispersion**: High-frequency QRS details and low-frequency baseline drifts can be conflated during aggressive temporal pooling.
3. **Overreliance on Spurious Correlations**: Deep models can overfit to background hospital recording artifacts or baseline drift instead of true electrophysiological dynamics.

## 2. Limitations of Handcrafted Feature Classifiers
Traditional feature engineering workflows (extracting interval timings and wave amplitudes):
1. **Peak Detection Brittleness**: R-peak detection fails in noisy, low-voltage, or tachycardic signals.
2. **Loss of Global Temporal Context**: Handcrafted summary metrics discard beat-to-beat morphology transitions and lead cross-talk.
3. **Inability to Learn Novel Morphologies**: Rigid heuristic formulas cannot adapt to atypical pathologies.

## 3. The Proposed Bridge: Adaptive Gated Fusion
Prior multimodal fusion methods rely on static concatenation ($z = [h_{\text{deep}} \,\|\, h_{\text{feat}}]$), which forces the classification head to resolve conflicting representations across different numerical scales.

This project addresses this research gap by introducing an **adaptive gated fusion unit** where the network dynamically assesses its own certainty:
- When raw signals exhibit high noise or ambiguous morphology, the gate can prioritize stable handcrafted wavelet and rhythm features.
- When signals contain complex global patterns, the gate adaptively increases the weighting of the deep representation branch.
- Gate allocation statistics ($g$) provide an interpretable metric of model dependence.
