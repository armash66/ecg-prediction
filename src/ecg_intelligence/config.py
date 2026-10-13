"""
Configuration manager for loading and validating experiment configs.
"""

import os
import json
import time
from typing import Any, Dict, Optional, Tuple
import yaml


def load_yaml(path: str) -> Dict[str, Any]:
    """Safely loads a YAML configuration file."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Configuration file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data or {}


class ProjectConfig:
    """Consolidated configuration object combining all configuration files."""

    def __init__(
        self,
        config_dir: Optional[str] = None,
        root_path: Optional[str] = None,
        cache_path: Optional[str] = None,
    ):
        if config_dir is None:
            # Look relative to current file or working directory
            cur_dir = os.path.dirname(os.path.abspath(__file__))
            cand = os.path.abspath(os.path.join(cur_dir, "..", "..", "configs"))
            if os.path.exists(cand):
                config_dir = cand
            else:
                config_dir = "configs"

        self.config_dir = config_dir
        self.data = load_yaml(os.path.join(config_dir, "data.yaml")) if os.path.exists(os.path.join(config_dir, "data.yaml")) else {}
        self.preprocessing = load_yaml(os.path.join(config_dir, "preprocessing.yaml")) if os.path.exists(os.path.join(config_dir, "preprocessing.yaml")) else {}
        self.model = load_yaml(os.path.join(config_dir, "model.yaml")) if os.path.exists(os.path.join(config_dir, "model.yaml")) else {}
        self.training = load_yaml(os.path.join(config_dir, "training.yaml")) if os.path.exists(os.path.join(config_dir, "training.yaml")) else {}
        self.evaluation = load_yaml(os.path.join(config_dir, "evaluation.yaml")) if os.path.exists(os.path.join(config_dir, "evaluation.yaml")) else {}

        # Precedence: Explicit constructor arg > PTBXL_ROOT env var > YAML root_path
        env_root = os.environ.get("PTBXL_ROOT")
        if root_path:
            self.data["root_path"] = root_path
        elif env_root:
            self.data["root_path"] = env_root

        env_cache = os.environ.get("PTBXL_CACHE")
        if cache_path:
            self.data["cache_path"] = cache_path
        elif env_cache:
            self.data["cache_path"] = env_cache

    @property
    def root_path(self) -> str:
        return self.data.get("root_path", "data/ptbxl")

    @property
    def cache_path(self) -> str:
        return self.data.get("cache_path", "artifacts/cache")

    def validate_dataset_paths(self) -> Tuple[bool, str]:
        """
        Validates that root_path exists and contains ptbxl_database.csv and scp_statements.csv.
        Never silently falls back to an empty or invalid directory.
        """
        root = self.root_path
        if not os.path.exists(root):
            raise FileNotFoundError(
                f"PTB-XL root directory does not exist: '{root}'. "
                f"Please check your path or set the PTBXL_ROOT environment variable."
            )
        db_path = os.path.join(root, "ptbxl_database.csv")
        scp_path = os.path.join(root, "scp_statements.csv")
        if not os.path.isfile(db_path):
            raise FileNotFoundError(f"Missing required database file: '{db_path}'")
        if not os.path.isfile(scp_path):
            raise FileNotFoundError(f"Missing required statements file: '{scp_path}'")
        return True, "Dataset paths are valid."

    def create_run_directory(self, run_id: Optional[str] = None, base_dir: str = "artifacts/runs") -> str:
        """
        Creates a structured run directory under artifacts/runs/<run_id>/
        saving config.yaml and initial run_manifest.json.
        """
        if run_id is None:
            run_id = f"run_{int(time.time())}"
        run_dir = os.path.join(base_dir, run_id)
        os.makedirs(os.path.join(run_dir, "logs"), exist_ok=True)
        os.makedirs(os.path.join(run_dir, "checkpoints"), exist_ok=True)
        os.makedirs(os.path.join(run_dir, "figures"), exist_ok=True)

        # Save merged config.yaml
        merged_cfg = {
            "data": self.data,
            "preprocessing": self.preprocessing,
            "model": self.model,
            "training": self.training,
            "evaluation": self.evaluation,
        }
        with open(os.path.join(run_dir, "config.yaml"), "w", encoding="utf-8") as f:
            yaml.safe_dump(merged_cfg, f, default_flow_style=False)

        # Save initial run_manifest.json
        manifest = {
            "run_id": run_id,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "dataset_root": self.root_path,
            "cache_path": self.cache_path,
            "status": "INITIALIZED",
        }
        with open(os.path.join(run_dir, "run_manifest.json"), "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        return run_dir

