.PHONY: install test lint audit ui xgb cnn seq hybrid gated ensemble table clean

install:
	pip install -e .
	pip install -r requirements-dev.txt

test:
	pytest tests -v

lint:
	flake8 src tests experiments server

audit:
	python scripts/audit_dataset.py --root data/ptbxl

xgb:
	python experiments/train_xgb.py --root data/ptbxl --cache artifacts/cache

cnn:
	python experiments/train_resnet.py --root data/ptbxl --cache artifacts/cache

seq:
	python experiments/train_sequence.py --root data/ptbxl --cache artifacts/cache

hybrid:
	python experiments/train_hybrid.py --root data/ptbxl --cache artifacts/cache

gated:
	python experiments/train_gated.py --root data/ptbxl --cache artifacts/cache

ensemble:
	python experiments/train_ensemble.py --cache artifacts/cache --ens_with gated

ablations:
	python experiments/run_ablations.py --root data/ptbxl --cache artifacts/cache

ui:
	uvicorn server.server:app --reload --host 0.0.0.0 --port 8000

clean:
	rm -rf build dist *.egg-info .pytest_cache
