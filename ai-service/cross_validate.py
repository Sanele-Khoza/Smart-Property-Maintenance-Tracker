"""5-fold stratified cross-validation over FIVE text classifiers.

All algorithms share the SAME TF-IDF pipeline; only the classifier differs:
  - complementnb   ComplementNB                  (fast, designed for imbalanced text)
  - logistic       Logistic Regression           (base / simplest)
  - linearsvc      LinearSVC                     (the production-recipe classifier)
  - sgd            SGDClassifier modified_huber  (gradient descent, probability estimates)
  - randomforest   Random Forest                 (non-linear diversity)

Single source of truth: the ALGORITHMS dictionary. Add or remove one line to
include/exclude an algorithm everywhere in this script.

Procedure (unchanged from the previous version):
  1. Load each CSV, strip whitespace, drop empty rows,
     DROP DUPLICATE TEXTS (prints before/after counts).
  2. Stratified 80/20 split first (random_state=42). The 20% test set is
     NEVER touched in this script.
  3. StratifiedKFold(n_splits=5, shuffle=True, random_state=42) on the 80%
     training portion only.
  4. TF-IDF + classifier in a single sklearn Pipeline so the vectoriser is
     fitted only on each fold's training part (no leakage).
  5. Per fold: accuracy, macro F1, per-class F1, priority EMERGENCY/HIGH
     recall, and the algorithm's training time.
  6. Report mean +/- std plus every individual fold score, and the average
     training time per algorithm in the summary table.
  7. Winner per task:
       - priority first DISQUALIFIES any algorithm whose mean EMERGENCY recall
         is more than 1 percentage point below the best;
       - then the highest mean macro F1 wins; if several are within 0.5 pp of
         the best, pick the simplest (order: CNB, LR, SVC, SGD, RF).
  8. Save every per-fold value to reports/cross_validation_results.csv.

Usage:
    python cross_validate.py
"""

import csv
import random
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.metrics import accuracy_score, f1_score, recall_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

DATA_DIR = Path(__file__).resolve().parent / "data"
REPORTS_DIR = Path(__file__).resolve().parent / "reports"

SEED = 42           # global reproducibility seed
N_SPLITS = 5        # standard 5-fold stratified CV
TEST_SIZE = 0.2     # held-out split size (never used by CV)

# TF-IDF settings shared by ALL algorithms (mirrors app/model.py and
# app/priority_model.py). ngram_range is task-specific: (1,2) category, (1,3) priority.
TFIDF_COMMON = {
    "lowercase": True,
    "strip_accents": "unicode",
    "sublinear_tf": True,
    "max_features": 20000,
}
NGRAM_RANGE = {"category": (1, 2), "priority": (1, 3)}

CATEGORY_LABELS = [
    "Appliances", "Electrical", "HVAC", "Landscaping",
    "Pest Control", "Plumbing", "Security", "Structural",
]
PRIORITY_LABELS = ["EMERGENCY", "HIGH", "LOW", "MEDIUM"]

# (task, csv filename, label column, label list)
TASKS = [
    ("category", "categoryDataset18750.csv", "category", CATEGORY_LABELS),
    ("priority", "priorityDataset18750.csv", "priority", PRIORITY_LABELS),
]

# ---- ONE dictionary. Add/remove an algorithm on a single line. ----
ALGORITHMS = {
    "complementnb": lambda: ComplementNB(alpha=1.0),
    "logistic": lambda: LogisticRegression(class_weight="balanced", max_iter=1000, solver="lbfgs"),
    "linearsvc": lambda: LinearSVC(class_weight="balanced"),
    "sgd": lambda: SGDClassifier(loss="modified_huber", class_weight="balanced", random_state=SEED),
    "randomforest": lambda: RandomForestClassifier(n_estimators=200, class_weight="balanced",
                                                   n_jobs=-1, random_state=SEED),
}
# Simplicity order, simplest first (used for tie-breaking).
SIMPLICITY_ORDER = ["complementnb", "logistic", "linearsvc", "sgd", "randomforest"]

# Seeds everywhere for reproducibility.
random.seed(SEED)
np.random.seed(SEED)


def load_and_clean(task: str) -> tuple[np.ndarray, np.ndarray]:
    """Load the CSV, strip text, drop empty rows, drop duplicate texts.

    Returns (texts, labels) as numpy arrays. Prints before/after counts.
    """
    index = [t for t, *_ in TASKS].index(task)
    path = DATA_DIR / TASKS[index][1]
    label_col = TASKS[index][2]
    df = pd.read_csv(path)
    text_col = df.columns[0]

    before = len(df)
    df[text_col] = df[text_col].astype(str).str.strip()
    df = df[df[text_col].str.len() > 0]
    after_nonempty = len(df)
    df = df.drop_duplicates(subset=text_col, keep="first")
    after_dedup = len(df)

    print(f"  [{task}] rows before: {before} | after dropping empty: {after_nonempty} | "
          f"after dropping duplicate texts: {after_dedup}")
    return df[text_col].to_numpy(), df[label_col].to_numpy()


def make_pipeline(task: str, algo: str) -> Pipeline:
    """Build Pipeline(TfidfVectorizer -> classifier) for one algorithm."""
    tfidf = TfidfVectorizer(**TFIDF_COMMON, ngram_range=NGRAM_RANGE[task])
    clf = ALGORITHMS[algo]()
    return Pipeline([("tfidf", tfidf), ("clf", clf)])


def run_cv(task: str, algo: str, X: np.ndarray, y: np.ndarray,
           labels: list[str]) -> list[dict]:
    """Run the 5-fold stratified CV and return one row-dict per fold.

    X/y here are ALREADY the 80% training portion (test set untouched).
    Includes the classifier training time per fold.
    """
    skf = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=SEED)
    rows: list[dict] = []

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y), start=1):
        pipe = make_pipeline(task, algo)
        t0 = time.perf_counter()
        pipe.fit(X[train_idx], y[train_idx])
        fit_time = time.perf_counter() - t0
        pred = pipe.predict(X[val_idx])
        y_val = y[val_idx]

        acc = accuracy_score(y_val, pred)
        macro = f1_score(y_val, pred, labels=labels, average="macro", zero_division=0)
        per_class = f1_score(y_val, pred, labels=labels, average=None, zero_division=0)

        row = {
            "task": task,
            "algorithm": algo,
            "fold": fold,
            "accuracy": round(acc, 4),
            "macro_f1": round(macro, 4),
            "fit_time_seconds": round(fit_time, 3),
        }
        for label, f1 in zip(labels, per_class):
            row[f"f1_{label}"] = round(float(f1), 4)
        if task == "priority":
            row["recall_EMERGENCY"] = round(float(recall_score(
                y_val, pred, labels=["EMERGENCY"], average="micro", zero_division=0)), 4)
            row["recall_HIGH"] = round(float(recall_score(
                y_val, pred, labels=["HIGH"], average="micro", zero_division=0)), 4)
        rows.append(row)
    return rows


def mean_std(col: list[float]) -> str:
    """Format a column as 'mean +/- std'."""
    arr = np.asarray(col, dtype=float)
    return f"{arr.mean():.4f} +/- {arr.std(ddof=1):.4f}" if len(arr) > 1 else f"{arr.mean():.4f}"


def pick_winner(task: str, summary: dict) -> tuple[str, list[str], float]:
    """Apply the winner rules; returns (winner, disqualified, best_macro_f1).

    Priority first disqualifies algorithms whose mean EMERGENCY recall is more
    than 1 pp below the best. Then: highest mean macro F1 wins; within 0.5 pp
    of the best, pick the simplest per SIMPLICITY_ORDER.
    """
    algos = list(ALGORITHMS)
    disqualified = []

    if task == "priority":
        best_emergency = max(summary[(task, a)]["recall_emergency_mean"] for a in algos)
        for a in algos:
            if best_emergency - summary[(task, a)]["recall_emergency_mean"] > 0.01:
                disqualified.append(a)
        algos = [a for a in algos if a not in disqualified]

    best_macro = max(summary[(task, a)]["macro_mean"] for a in algos)
    candidates = [a for a in algos if summary[(task, a)]["macro_mean"] >= best_macro - 0.005]
    winner = min(candidates, key=SIMPLICITY_ORDER.index)
    return winner, disqualified, best_macro


def main() -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    all_rows: list[dict] = []
    summary = {}  # (task, algo) -> metrics dict incl. fit time

    for task, fname, _label, labels in TASKS:
        print(f"\n========== TASK: {task} ({fname}) ==========")
        X_all, y_all = load_and_clean(task)

        # Stratified 80/20 split FIRST; only the 80% part is cross-validated.
        X_train, _X_test, y_train, _y_test = train_test_split(
            X_all, y_all, test_size=TEST_SIZE, stratify=y_all, random_state=SEED,
        )
        print(f"  [{task}] split sizes: train={len(X_train)} (80%), held-out test={len(_X_test)} (20%, untouched)")

        for algo in ALGORITHMS:
            print(f"\n  -- algorithm: {algo} --")
            rows = run_cv(task, algo, X_train, y_train, labels)
            for row in rows:
                print(f"    fold {row['fold']}: accuracy={row['accuracy']} "
                      f"macro_f1={row['macro_f1']} fit_time={row['fit_time_seconds']}s")
                if task == "priority":
                    print(f"        EMERGENCY recall={row['recall_EMERGENCY']} "
                          f"HIGH recall={row['recall_HIGH']}")

            accs = [r["accuracy"] for r in rows]
            macs = [r["macro_f1"] for r in rows]
            fits = [r["fit_time_seconds"] for r in rows]
            entry = {
                "acc_mean": float(np.mean(accs)),
                "acc_std": float(np.std(accs, ddof=1)),
                "macro_mean": float(np.mean(macs)),
                "macro_std": float(np.std(macs, ddof=1)),
                "fit_mean": float(np.mean(fits)),
            }
            if task == "priority":
                entry["recall_emergency_mean"] = float(np.mean([r["recall_EMERGENCY"] for r in rows]))
                entry["recall_high_mean"] = float(np.mean([r["recall_HIGH"] for r in rows]))
            summary[(task, algo)] = entry

            print(f"    => accuracy {mean_std(accs)} | macro_f1 {mean_std(macs)} "
                  f"| avg fit_time {np.mean(fits):.3f}s")
            all_rows.extend(rows)

    # ---- side-by-side summary table + winner ------------------------------
    print("\n\n========== CROSS-VALIDATION SUMMARY (5-fold, on the 80% training portion) ==========")
    print(f"{'task':<10}{'algorithm':<14}{'CV accuracy':<22}{'CV macro F1':<22}{'avg fit (s)':<12}")
    for task, *_ in TASKS:
        for algo in ALGORITHMS:
            e = summary[(task, algo)]
            print(f"{task:<10}{algo:<14}{e['acc_mean']:.4f} +/- {e['acc_std']:.4f}   "
                  f"{e['macro_mean']:.4f} +/- {e['macro_std']:.4f}   {e['fit_mean']:.3f}")

    print()
    for task, *_ in TASKS:
        winner, disqualified, best_macro = pick_winner(task, summary)
        if disqualified:
            print(f"  {task}: DISQUALIFIED on EMERGENCY recall (priority rule): {disqualified}")
        print(f"  {task}: WINNER = {winner}  (best mean macro F1 = {best_macro:.4f})")

    # ---- save long-format CSV ----------------------------------------------
    csv_path = REPORTS_DIR / "cross_validation_results.csv"
    key_metrics = ["accuracy", "macro_f1", "fit_time_seconds",
                   "f1_EMERGENCY", "f1_HIGH", "f1_LOW", "f1_MEDIUM",
                   "f1_Appliances", "f1_Electrical", "f1_HVAC", "f1_Landscaping",
                   "f1_Pest Control", "f1_Plumbing", "f1_Security", "f1_Structural",
                   "recall_EMERGENCY", "recall_HIGH"]
    present = [m for m in key_metrics if any(m in r for r in all_rows)]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["task", "algorithm", "fold"] + present)
        for row in all_rows:
            writer.writerow([row.get(h, "") for h in ["task", "algorithm", "fold"] + present])
    print(f"\nSaved per-fold results -> {csv_path}")


if __name__ == "__main__":
    main()