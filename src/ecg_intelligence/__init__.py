"""
PTB-XL ECG Intelligence: Hybrid Deep Learning with Adaptive Gated Fusion.
"""

__version__ = "0.1.0"
__author__ = "Research Team"

CLASSES = ['CD', 'HYP', 'MI', 'NORM', 'STTC']
LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']
CLASS_NAMES = {
    'NORM': 'Normal ECG',
    'MI': 'Myocardial infarction',
    'STTC': 'ST/T change',
    'CD': 'Conduction disturbance',
    'HYP': 'Hypertrophy'
}
FS = 100
