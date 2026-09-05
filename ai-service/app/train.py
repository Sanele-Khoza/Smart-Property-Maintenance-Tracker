"""Train the category classifier and persist it.

Trains on the merged dataset: the curated AWS comprehend training CSV
(existing real ticket descriptions) combined with synthetic rows so every
SPMT category is represented.

Usage:
    python -m app.train
"""

from pathlib import Path
import csv

import joblib

from app.model import build_pipeline, MODEL_PATH
from app.data_generator import generate_dataset

CSV_PATH = Path(__file__).resolve().parents[1] / "data" / "tickets_dataset.csv"


def load_or_generate(path: Path, n_per_category: int = 150) -> tuple[list[str], list[str]]:
    if path.exists():
        texts, labels = [], []
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                texts.append(row["text"])
                labels.append(row["category"])
        if texts:
            return texts, labels
    rows = generate_dataset(n_per_category)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "category"])
        writer.writeheader()
        writer.writerows(rows)
    return [r["text"] for r in rows], [r["category"] for r in rows]


def main() -> None:
    texts, labels = load_or_generate(CSV_PATH)
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
