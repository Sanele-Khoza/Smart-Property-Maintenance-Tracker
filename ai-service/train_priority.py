"""Train an IMPROVED priority classifier (LOW/MEDIUM/HIGH/EMERGENCY).

Same procedure as train_category.py but for the priority task:
  - data: priorityDataset18750.csv
  - existing TF-IDF ngram_range = (1, 3) (mirror of app/priority_model.py)
  - labels: LOW, MEDIUM, HIGH, EMERGENCY
  - same CV tuning, same calibrated final format, saved to
    models_improved/priority_model_improved.joblib

Usage:
    python train_priority.py
"""

import random
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import f1_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

DATA_DIR = Path(__file__).resolve().parent / "data"
MODELS_OUT = Path(__file__).resolve().parent / "models_improved"

SEED = 42
N_SPLITS = 5
TEST_SIZE = 0.2
LABELS = ["EMERGENCY", "HIGH", "LOW", "MEDIUM"]
CSV = DATA_DIR / "priorityDataset18750.csv"

# The EXISTING recipe settings (mirror of app/priority_model.py).
TFIDF_COMMON = {
    "lowercase": True,
    "strip_accents": "unicode",
    "sublinear_tf": True,
}
EXISTING = {
    "name": "existing",
    "C": 1.0,
    "min_df": 1,
    "ngram": (1, 3),
    "max_features": 20000,
}

# Small, safe candidate changes around the existing recipe, evaluated by CV.
CANDIDATES = [
    EXISTING,
    {"name": "C=2.0", "C": 2.0, "min_df": 1, "ngram": (1, 3), "max_features": 20000},
    {"name": "min_df=2", "C": 1.0, "min_df": 2, "ngram": (1, 3), "max_features": 20000},
    {"name": "ngram=(1,2)", "C": 1.0, "min_df": 1, "ngram": (1, 2), "max_features": 20000},
    {"name": "max_features=30000", "C": 1.0, "min_df": 1, "ngram": (1, 3), "max_features": 30000},
]

random.seed(SEED)
np.random.seed(SEED)


def load_and_split():
    """Load, clean, dedup and make the stratified 80/20 split (seed 42)."""
    df = pd.read_csv(CSV)
    text_col = df.columns[0]
    before = len(df)
    df[text_col] = df[text_col].astype(str).str.strip()
    df = df[df[text_col].str.len() > 0]
    after_nonempty = len(df)
    df = df.drop_duplicates(subset=text_col, keep="first")
    after_dedup = len(df)
    print(f"[load] priority rows: {before} -> after empty-drop: {after_nonempty} "
          f"-> after dedup: {after_dedup}")

    X = df[text_col].to_numpy()
    y = df["priority"].to_numpy()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=SEED,
    )
    print(f"[split] train={len(X_train)} ({int((1 - TEST_SIZE) * 100)}%), "
          f"final test={len(X_test)} ({int(TEST_SIZE * 100)}%, untouched)")
    return X_train, X_test, y_train, y_test


def build_tfidf(cfg: dict) -> TfidfVectorizer:
    """TfidfVectorizer with the common settings overridden by this config."""
    return TfidfVectorizer(
        **TFIDF_COMMON,
        ngram_range=cfg["ngram"],
        min_df=cfg["min_df"],
        max_features=cfg["max_features"],
    )


def cv_macro_f1(cfg: dict, X_train, y_train) -> tuple[float, list[float]]:
    """Mean 5-fold CV macro F1 for a candidate config on the 80% training part."""
    skf = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=SEED)
    scores = []
    for fold, (tr, va) in enumerate(skf.split(X_train, y_train), start=1):
        pipe = Pipeline([("tfidf", build_tfidf(cfg)),
                         ("clf", LinearSVC(C=cfg["C"], class_weight="balanced"))])
        pipe.fit(X_train[tr], y_train[tr])
        pred = pipe.predict(X_train[va])
        scores.append(f1_score(y_train[va], pred, labels=LABELS,
                               average="macro", zero_division=0))
        print(f"      fold {fold}: macro F1 = {scores[-1]:.4f}")
    return float(np.mean(scores)), scores


def main() -> None:
    X_train, X_test, y_train, y_test = load_and_split()

    print("\n[CV tuning] evaluating candidate configs on the 80% training portion...")
    results = []
    for cfg in CANDIDATES:
        print(f"\n  config '{cfg['name']}': C={cfg['C']}, min_df={cfg['min_df']}, "
              f"ngram={cfg['ngram']}, max_features={cfg['max_features']}")
        mean, per_fold = cv_macro_f1(cfg, X_train, y_train)
        results.append((cfg, mean, per_fold))
        print(f"    => mean CV macro F1 = {mean:.4f}")

    results.sort(key=lambda r: r[1], reverse=True)
    best_cfg, best_mean, _ = results[0]
    existing_mean = next(r[1] for r in results if r[0]["name"] == "existing")
    if best_mean - existing_mean >= 0.005:
        final_cfg = best_cfg
        print(f"\n[winner] '{best_cfg['name']}' (mean CV macro F1 {best_mean:.4f}) beats "
              f"existing ({existing_mean:.4f}) by >= 0.5 pp -> using it.")
    else:
        final_cfg = EXISTING
        print(f"\n[winner] gain of '{best_cfg['name']}' ({best_mean:.4f}) vs existing "
              f"({existing_mean:.4f}) is < 0.5 pp -> keeping the existing recipe.")

    print("\n[final] fitting improved calibrated model on the 80% train set...")
    final_pipe = Pipeline([
        ("tfidf", build_tfidf(final_cfg)),
        ("clf", CalibratedClassifierCV(
            LinearSVC(C=final_cfg["C"], class_weight="balanced"), cv=3)),
    ])
    final_pipe.fit(X_train, y_train)

    MODELS_OUT.mkdir(parents=True, exist_ok=True)
    out_path = MODELS_OUT / "priority_model_improved.joblib"
    joblib.dump(final_pipe, out_path)
    print(f"Saved improved priority model -> {out_path}")
    print(f"Final config: { {k: v for k, v in final_cfg.items() if k != 'name'} }")


if __name__ == "__main__":
    main()