# Experimental Protocol and Execution Guidelines

## 1. Sequential Experiment Progression
To ensure systematic scientific ablation, experiments should be conducted in the following sequential order:

1. **E1 (XGBoost Baseline)**: `experiments/train_xgb.py`
   - Evaluates pure handcrafted feature predictive power (139 features).
2. **E2 (1D ResNet Baseline)**: `experiments/train_resnet.py`
   - Evaluates deep convolutional feature extraction with global average pooling.
3. **E3 (Sequence Recurrent Model)**: `experiments/train_sequence.py`
   - Adds Bidirectional GRU and Soft Temporal Attention to the ResNet backbone.
4. **E4 (Concatenation Hybrid)**: `experiments/train_hybrid.py`
   - Combines deep and handcrafted representations via simple vector concatenation.
5. **E5 (Proposed Adaptive Gated Fusion)**: `experiments/train_gated.py`
   - Introduces learnable per-ECG gating mechanism.
6. **E6 (Ensemble Model)**: `experiments/train_ensemble.py`
   - Probability-level weighted blend: $0.6 \times p_{\text{gated}} + 0.4 \times p_{\text{xgb}}$.

## 2. Resumability & Idempotence
- Each experiment logs its metrics to `result_<mode>.json` and predicted probabilities to `probs_<mode>.npy` inside `artifacts/cache/`.
- If a result file already exists, the entrypoint skips computation, preventing accidental overwrites and conserving GPU resources.
- Deleting an individual `result_<name>.json` triggers recomputation of that specific experiment.

## 3. Smoke Test Protocol
Before running full 30-epoch training, run a 2-epoch smoke test to verify gradient computation, data loading, and metric formatting:
```bash
python experiments/run_ablations.py --smoke_test
```
