"""Train the category classifier on the synthetic dataset and persist it.

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
    pipe = build_pipeline()
    pipe.fit(texts, labels)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_PATH)
    print(f"Trained on {len(texts)} samples -> saved to {MODEL_PATH}")
    print(f"Classes: {pipe.classes_.tolist()}")


if __name__ == "__main__":
    main()
