# Limitations and Clinical Scope

## 1. Regulatory Status
> **RESEARCH PROTOTYPE — NOT A MEDICAL DEVICE**
> 
> This software is an engineering student project and academic research prototype. It has not received clearance or approval from the U.S. Food and Drug Administration (FDA 510(k)), European CE Mark regulatory bodies, or any health authority. It is **strictly prohibited** from being used in direct patient care, clinical diagnosis, bedside monitoring, triage, or therapy planning.

## 2. Technical and Methodological Limitations
1. **Sampling Frequency**: Experiments utilize the 100 Hz records (`filename_lr`). High-frequency details such as subtle pacemaker spikes, high-frequency QRS notches, or micro-volt T-wave alternans are attenuated at this rate compared to 500 Hz records.
2. **Interpretability Faithfulness vs. Clinical Ground Truth**:
   - Integrated Gradients attributions reflect **computational sensitivity of the mathematical model**.
   - A high attribution score in a specific lead or interval confirms that the model's logits depend on that region; it does **not** prove that the feature represents genuine electrophysiological pathology.
3. **Cohort Demographics**: PTB-XL represents recordings acquired primarily within German healthcare centers. Model generalization to external populations, differing electrode placements, or ambulatory Holter devices has not been clinically established.
4. **Multi-label Co-occurrence**: Certain diagnostic categories (e.g., MI and STTC) exhibit significant clinical co-occurrence. Binary cross-entropy models each class independently and does not explicitly constrain conditional label dependencies.
