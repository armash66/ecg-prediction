"""
Model architectures: ResNet1D, BiGRU, Temporal Attention, Gated Fusion, and XGBoost.
"""

from .resnet1d import ResNet1DBlock, ResNet1DBackbone
from .bigru import BiGRUSoftAttention
from .attention import TemporalAttention
from .feature_encoder import HandcraftedFeatureEncoder
from .fusion import GatedFusionModule, ConcatenationFusionModule
from .classifier import HybridNet
from .xgboost_model import MultiLabelXGBoost
from .ensemble import EnsemblePredictor

__all__ = [
    "ResNet1DBlock",
    "ResNet1DBackbone",
    "BiGRUSoftAttention",
    "TemporalAttention",
    "HandcraftedFeatureEncoder",
    "GatedFusionModule",
    "ConcatenationFusionModule",
    "HybridNet",
    "MultiLabelXGBoost",
    "EnsemblePredictor"
]
