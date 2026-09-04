"""Train the category classifier and persist it.

Trains on the merged dataset: the curated AWS comprehend training CSV
(existing real ticket descriptions) combined with synthetic rows so every
SPMT category is represented.

Usage:
    python -m app.train
"""

from pathlib import Path

import joblib

from app.model import build_pipeline, MODEL_PATH
from app.comprehend_loader import build_merged_dataset

# Curated real-labelled tickets live in <repo-root>/training data/
REPO_ROOT = Path(__file__).resolve().parents[2]
COMPREHEND_CSV = REPO_ROOT / "training data" / "comprehend_training_data.csv"


def main() -> None:
    texts, labels = build_merged_dataset(COMPREHEND_CSV, synthetic_n_per_category=120)
    pipe = build_pipeline()
    pipe.fit(texts, labels)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_PATH)
    print(f"Trained on {len(texts)} samples -> saved to {MODEL_PATH}")
    print(f"Classes: {pipe.classes_.tolist()}")


if __name__ == "__main__":
    main()
