"""
Environment and dependency validation script.
Checks Python version, PyTorch with GPU availability, and key analytical packages.
"""

import sys
import importlib

REQUIRED_PACKAGES = [
    ("numpy", "numpy"),
    ("pandas", "pandas"),
    ("scipy", "scipy"),
    ("sklearn", "scikit-learn"),
    ("torch", "torch"),
    ("xgboost", "xgboost"),
    ("yaml", "PyYAML"),
    ("streamlit", "streamlit"),
    ("joblib", "joblib"),
    ("matplotlib", "matplotlib"),
    ("pywt", "PyWavelets"),
    ("wfdb", "wfdb"),
    ("pytest", "pytest")
]


def check_environment():
    print("=" * 60)
    print("      PTB-XL ECG Intelligence - Environment Validation       ")
    print("=" * 60)
    print(f"Python Version: {sys.version.split()[0]} ({sys.platform})")

    missing = []
    available = []

    for mod_name, pkg_name in REQUIRED_PACKAGES:
        try:
            mod = importlib.import_module(mod_name)
            ver = getattr(mod, "__version__", "installed")
            available.append((pkg_name, ver))
        except ImportError:
            missing.append(pkg_name)

    print("\nInstalled Packages:")
    for pkg, ver in available:
        print(f"  [+] {pkg:<18}: {ver}")

    if missing:
        print("\nMissing / Optional Packages:")
        for pkg in missing:
            print(f"  [-] {pkg:<18} (Required for full training pipeline: pip install {pkg})")
    else:
        print("\nAll dependencies verified successfully!")

    # PyTorch GPU check
    try:
        import torch
        cuda_avail = torch.cuda.is_available()
        print(f"\nPyTorch CUDA Available: {cuda_avail}")
        if cuda_avail:
            print(f"  Device Name: {torch.cuda.get_device_name(0)}")
            print(f"  Device Count: {torch.cuda.device_count()}")
    except ImportError:
        pass

    print("=" * 60)


if __name__ == "__main__":
    check_environment()
