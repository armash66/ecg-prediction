import pytest
import os
from ecg_intelligence.config import ProjectConfig, load_yaml


def test_project_config_defaults():
    # Test loading with defaults
    cfg = ProjectConfig()
    assert isinstance(cfg.data, dict)
    assert isinstance(cfg.preprocessing, dict)
    assert isinstance(cfg.model, dict)
    assert isinstance(cfg.training, dict)
    assert isinstance(cfg.evaluation, dict)


def test_project_config_overrides():
    cfg = ProjectConfig(root_path="custom/data", cache_path="custom/cache")
    assert cfg.root_path == "custom/data"
    assert cfg.cache_path == "custom/cache"


def test_project_config_env_var(monkeypatch):
    monkeypatch.setenv("PTBXL_ROOT", "/custom/env/ptbxl")
    monkeypatch.setenv("PTBXL_CACHE", "/custom/env/cache")
    cfg = ProjectConfig()
    assert cfg.root_path == "/custom/env/ptbxl"
    assert cfg.cache_path == "/custom/env/cache"


def test_project_config_validate_dataset_paths_missing(tmp_path):
    cfg = ProjectConfig(root_path=str(tmp_path / "nonexistent"))
    with pytest.raises(FileNotFoundError):
        cfg.validate_dataset_paths()

    # Create root directory but miss files
    empty_dir = tmp_path / "empty_ptbxl"
    empty_dir.mkdir()
    cfg_empty = ProjectConfig(root_path=str(empty_dir))
    with pytest.raises(FileNotFoundError, match="Missing required database file"):
        cfg_empty.validate_dataset_paths()


def test_project_config_validate_dataset_paths_valid(tmp_path):
    root = tmp_path / "ptbxl_valid"
    root.mkdir()
    (root / "ptbxl_database.csv").write_text("ecg_id,strat_fold\n1,1")
    (root / "scp_statements.csv").write_text("code,diagnostic\nNORM,1")
    cfg = ProjectConfig(root_path=str(root))
    valid, msg = cfg.validate_dataset_paths()
    assert valid is True


def test_project_config_create_run_directory(tmp_path):
    cfg = ProjectConfig()
    run_dir = cfg.create_run_directory(run_id="test_run_123", base_dir=str(tmp_path))
    assert os.path.exists(os.path.join(run_dir, "config.yaml"))
    assert os.path.exists(os.path.join(run_dir, "run_manifest.json"))
    assert os.path.isdir(os.path.join(run_dir, "logs"))
    assert os.path.isdir(os.path.join(run_dir, "checkpoints"))
    assert os.path.isdir(os.path.join(run_dir, "figures"))
