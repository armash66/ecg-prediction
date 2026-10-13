"""
Unified multi-modal neural network supporting:
- cnn: 1D ResNet with global average pooling
- multiscale: Multi-Scale 1D ResNet (k=7, 15, 31) with SE channel attention & global average pooling
- seq: ResNet + BiGRU + temporal attention
- feat: Handcrafted feature MLP only
- hybrid: ResNet + BiGRU + attention concatenated with handcrafted MLP
- gated: ResNet + BiGRU + attention with Adaptive Gated Fusion
"""

from typing import Optional, Tuple
import torch
import torch.nn as nn
from .resnet1d import ResNet1DBackbone
from .multiscale_resnet import MultiScaleResNetBackbone
from .bigru import BiGRUSoftAttention
from .feature_encoder import HandcraftedFeatureEncoder
from .fusion import GatedFusionModule, ConcatenationFusionModule

DEEP_MODES = ('cnn', 'multiscale', 'seq', 'hybrid', 'gated')
FEAT_MODES = ('feat', 'hybrid', 'gated')


class HybridNet(nn.Module):
    """
    Modular ECG classification architecture.
    """
    def __init__(
        self,
        num_features: int = 139,
        mode: str = 'gated',
        num_classes: int = 5,
        use_se: bool = True,
        dropout: float = 0.3
    ):
        super().__init__()
        valid_modes = ('cnn', 'multiscale', 'seq', 'feat', 'hybrid', 'gated')
        if mode not in valid_modes:
            raise ValueError(f"Unknown architecture mode: {mode}. Must be one of {valid_modes}")

        self.mode = mode
        self.num_classes = num_classes
        self.gate_val: Optional[torch.Tensor] = None

        # Deep branch components
        if mode == 'multiscale':
            self.backbone = MultiScaleResNetBackbone(in_channels=12, stem_channels=32, use_se=use_se, dropout=0.1)
        else:
            self.backbone = ResNet1DBackbone(in_channels=12, stem_channels=32)

        if mode not in ('cnn', 'multiscale', 'feat'):
            self.seq_module = BiGRUSoftAttention(in_dim=128, hidden_dim=64)

        # Handcrafted feature branch
        if mode in FEAT_MODES:
            self.feature_encoder = HandcraftedFeatureEncoder(in_features=num_features, hidden_dim=128, out_dim=64)

        # Fusion & Classification Head
        if mode == 'gated':
            self.fusion = GatedFusionModule(deep_dim=128, feat_dim=64, proj_dim=96)
            head_in_dim = 96
        elif mode == 'hybrid':
            self.fusion = ConcatenationFusionModule()
            head_in_dim = 128 + 64
        elif mode in ('cnn', 'multiscale', 'seq'):
            head_in_dim = 128
        elif mode == 'feat':
            head_in_dim = 64

        self.head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(head_in_dim, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, num_classes)
        )

    def deep_embed(self, x: torch.Tensor) -> torch.Tensor:
        """
        Extracts deep representation from raw ECG signals of shape (B, 12, T).
        Returns tensor of shape (B, 128).
        """
        feat_maps = self.backbone(x)  # (B, 128, T)
        if self.mode in ('cnn', 'multiscale'):
            return feat_maps.mean(dim=2)  # Global average pooling
        return self.seq_module(feat_maps)

    def forward(self, x: Optional[torch.Tensor], f: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Forward pass.
        Args:
            x: (B, 12, T) raw ECG signal tensor.
            f: (B, num_features) handcrafted feature tensor.
        Returns:
            logits: (B, num_classes) raw unnormalized logits.
        """
        if self.mode == 'feat':
            if f is None:
                raise ValueError("Handcrafted feature tensor f required for mode 'feat'")
            z = self.feature_encoder(f)
        elif self.mode in ('cnn', 'multiscale', 'seq'):
            if x is None:
                raise ValueError("Raw signal tensor x required for deep modes")
            z = self.deep_embed(x)
        elif self.mode == 'hybrid':
            if x is None or f is None:
                raise ValueError("Both x and f required for hybrid mode")
            ed = self.deep_embed(x)
            ef = self.feature_encoder(f)
            z = self.fusion(ed, ef)
        else:  # gated
            if x is None or f is None:
                raise ValueError("Both x and f required for gated mode")
            ed = self.deep_embed(x)
            ef = self.feature_encoder(f)
            z, g = self.fusion(ed, ef)
            self.gate_val = g.detach()

        return self.head(z)


def build_torch_model(
    num_features: int = 139,
    mode: str = 'gated',
    num_classes: int = 5,
    use_se: bool = True,
    dropout: float = 0.3
) -> HybridNet:
    """Factory function for instantiating HybridNet."""
    return HybridNet(
        num_features=num_features,
        mode=mode,
        num_classes=num_classes,
        use_se=use_se,
        dropout=dropout
    )

