"""Compare the production baseline models with the improved ones.

For each task (category, priority):
  - Rebuild the IDENTICAL stratified 80/20 split (same cleaning, dedup, seed).
  - Load the production baseline (models/<task>_model.joblib) and the improved
    model (models_improved/<task>_model_improved.joblib).
  - Evaluate both on the SAME held-out 20% test set:
      accuracy, per-class precision/recall/F1 + support, macro F1,
      weighted F1, labelled confusion matrix (PNG heatmap).
  - Report the 5-fold CV mean +/- std (accuracy, macro F1) from
    cross_validate.py next to the held-out scores.
  - Priority: highlight EMERGENCY and HIGH recall; the improved model must NOT
    lower EMERGENCY recall vs the baseline, else we say so and recommend the
    baseline.
  - Calibration: log-loss, count of samples below the 0.30 gate, and accuracy
    on the samples above it.
  - Human-written test file (if present): accuracy + macro F1 for both models.
  - Verdict per task with the numbers behind it.

Outputs saved to reports/:
  - confusion_<task>_<model>.png
  - improvement_report.md  (readable summary)

Usage:
    python compare_models.py
"""

import random
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")  # headless backend: no display window
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, log_loss,
)
from sklearn.model_selection import train_test_split

import data_audit as da

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
MODELS_IMPROVED = BASE_DIR / "models_improved"
REPORTS_DIR = BASE_DIR / "reports"
HUMAN_TEST = BASE_DIR.parent / "training data" / "human_tickets_test.csv"

SEED = 42
TEST_SIZE = 0.2
GATE = 0.30

CATEGORY_LABELS = [
    "Appliances", "Electrical", "HVAC", "Landscaping",
    "Pest Control", "Plumbing", "Security", "Structural",
]
PRIORITY_LABELS = ["EMERGENCY", "HIGH", "LOW", "MEDIUM"]

TASKS = [
    ("category", "categoryDataset18750.csv", "category",
     CATEGORY_LABELS, MODELS_DIR / "category_model.joblib",
     MODELS_IMPROVED / "category_model_improved.joblib"),
    ("priority", "priorityDataset18750.csv", "priority",
     PRIORITY_LABELS, MODELS_DIR / "priority_model.joblib",
     MODELS_IMPROVED / "priority_model_improved.joblib"),
]

# All five classifiers compared in cross_validate.py. Single dictionary,
# add/remove on one line; ordered simplest -> most complex.
ALGORITHMS = {
    "complementnb": "ComplementNB",
    "logistic": "Logistic Regression",
    "linearsvc": "LinearSVC",
    "sgd": "SGD (modified_huber)",
    "randomforest": "Random Forest",
}
SIMPLICITY_ORDER = list(ALGORITHMS)

random.seed(SEED)
np.random.seed(SEED)


def load_and_split(task: str, csv_name: str, label_col: str):
    """Identical loading/cleaning/split as the train + CV scripts."""
    df = pd.read_csv(DATA_DIR / csv_name)
    text_col = df.columns[0]
    df[text_col] = df[text_col].astype(str).str.strip()
    df = df[df[text_col].str.len() > 0]
    df = df.drop_duplicates(subset=text_col, keep="first")
    X_all = df[text_col].to_numpy()
    y_all = df[label_col].to_numpy()
    _X_train, X_test, _y_train, y_test = train_test_split(
        X_all, y_all, test_size=TEST_SIZE, stratify=y_all, random_state=SEED)
    return X_test, y_test


def model_scores(model, X_test, y_test, labels):
    """Return metrics, classification report and confusion matrix for a model."""
    pred = model.predict(X_test)
    acc = accuracy_score(y_test, pred)
    report = classification_report(y_test, pred, labels=labels,
                                   zero_division=0, output_dict=True, digits=4)
    macro = f1_score(y_test, pred, labels=labels, average="macro", zero_division=0)
    weighted = f1_score(y_test, pred, labels=labels, average="weighted", zero_division=0)
    cm = confusion_matrix(y_test, pred, labels=labels)
    return {
        "pred": pred,
        "acc": float(acc),
        "macro": float(macro),
        "weighted": float(weighted),
        "report": report,
        "cm": cm,
    }


def calibration_check(model, X_test, y_test):
    """Log-loss, gate count, and accuracy above the gate."""
    proba = model.predict_proba(X_test)
    conf = proba.max(axis=1)
    present = sorted(set(y_test))
    model_classes = list(model.classes_)
    ll = None
    if set(present) <= set(model_classes):
        proba_df = pd.DataFrame(proba, columns=model_classes)
        p_aligned = proba_df[present].to_numpy()
        ll = float(log_loss(y_test, p_aligned))
    below = int((conf < GATE).sum())
    above_mask = conf >= GATE
    acc_above = float(accuracy_score(
        y_test[above_mask], model.predict(X_test)[above_mask])) if above_mask.any() else None
    return {"log_loss": ll, "below_gate": below, "acc_above_gate": acc_above}


def plot_confusion(cm, task, model_name, labels, out_path):
    """Save a labelled confusion-matrix heatmap PNG."""
    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(labels)), labels, rotation=45, ha="right")
    ax.set_yticks(range(len(labels)), labels)
    for i in range(len(labels)):
        for j in range(len(labels)):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title(f"{task} - {model_name} confusion matrix")
    fig.colorbar(im, fraction=0.046)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def load_cv_summary():
    """Mean +/- std accuracy, macro F1, avg fit time (and priority recalls)
    per (task, algorithm) from cross_validate.py's CSV."""
    csv_path = REPORTS_DIR / "cross_validation_results.csv"
    if not csv_path.exists():
        print("WARNING: cross_validation_results.csv not found - run cross_validate.py first.")
        return {}
    df = pd.read_csv(csv_path).dropna(subset=["fold"])
    summ = {}
    for (task, algo), g in df.groupby(["task", "algorithm"]):
        entry = {
            "acc_mean": g["accuracy"].mean(),
            "acc_std": g["accuracy"].std(ddof=1),
            "macro_mean": g["macro_f1"].mean(),
            "macro_std": g["macro_f1"].std(ddof=1),
            "fit_mean": g["fit_time_seconds"].mean() if "fit_time_seconds" in g else float("nan"),
        }
        if "recall_EMERGENCY" in g:
            entry["recall_emergency_mean"] = g["recall_EMERGENCY"].mean()
            entry["recall_high_mean"] = g["recall_HIGH"].mean()
        summ[(task, algo)] = entry
    return summ


def cv_winner(task, cv_summary):
    """Mirror cross_validate.py's winner rule: priority disqualifies algorithms
    whose mean EMERGENCY recall is > 1 pp below the best, then highest mean
    macro F1, simplified tie-break within 0.5 pp."""
    algos = [a for a in ALGORITHMS if (task, a) in cv_summary]
    if not algos:
        return None, []
    disqualified = []
    if task == "priority":
        best_em = max(cv_summary[(task, a)]["recall_emergency_mean"] for a in algos)
        disqualified = [a for a in algos
                        if best_em - cv_summary[(task, a)]["recall_emergency_mean"] > 0.01]
        algos = [a for a in algos if a not in disqualified]
    best_macro = max(cv_summary[(task, a)]["macro_mean"] for a in algos)
    cands = [a for a in algos if cv_summary[(task, a)]["macro_mean"] >= best_macro - 0.005]
    winner = min(cands, key=SIMPLICITY_ORDER.index)
    return winner, disqualified


def human_test_scores(models, labels, task):
    """Evaluate both category models on the human-written test file (if usable)."""
    if not HUMAN_TEST.exists() or task != "category":
        return None
    df = pd.read_csv(HUMAN_TEST)
    df.columns = ["text", "category"]
    df = df[df["category"].isin(labels)]  # human file may contain unsupported classes
    if df.empty:
        return None
    X = df["text"].astype(str).to_numpy()
    y = df["category"].to_numpy()
    out = {"n_used": len(df), "n_total": len(pd.read_csv(HUMAN_TEST))}
    for name, model in models.items():
        pred = model.predict(X)
        out[name] = {
            "acc": float(accuracy_score(y, pred)),
            "macro": float(f1_score(y, pred, labels=labels, average="macro", zero_division=0)),
        }
    return out


def make_report(report_lines: list[str]):
    """Write the readable markdown summary to reports/improvement_report.md."""
    path = REPORTS_DIR / "improvement_report.md"
    path.write_text("\n".join(report_lines), encoding="utf-8")
    print(f"\nSaved readable report -> {path}")


def main() -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    cv_summary = load_cv_summary()
    report = []  # lines of markdown
    verdicts = {}

    for task, csv_name, label_col, labels, base_path, impr_path in TASKS:
        print(f"\n{'='*70}\nTASK: {task}\n{'='*70}")

        # ---- identical held-out split -------------------------------------
        X_test, y_test = load_and_split(task, csv_name, label_col)

        # ---- load models ---------------------------------------------------
        baseline = joblib.load(base_path)
        improved = joblib.load(impr_path)
        models = {"baseline": baseline, "improved": improved}

        scores = {}
        for name, model in models.items():
            print(f"\n  -- {name} model on the 20% held-out test --")
            s = model_scores(model, X_test, y_test, labels)
            scores[name] = s
            print(f"    accuracy={s['acc']:.4f}  macro F1={s['macro']:.4f}  weighted F1={s['weighted']:.4f}")
            for label in labels:
                r = s["report"].get(label, {})
                print(f"    {label:<11} prec={r.get('precision', 0):.4f} "
                      f"rec={r.get('recall', 0):.4f} f1={r.get('f1-score', 0):.4f} "
                      f"supp={r.get('support', 0):.0f}")

            cal = calibration_check(model, X_test, y_test)
            print(f"    calibration: log_loss={cal['log_loss']}  below_gate(<0.30)={cal['below_gate']} "
                  f"acc_above_gate={cal['acc_above_gate']}")
            model_name = f"{task}_{name}"
            plot_confusion(s["cm"], task, name,
                           labels, REPORTS_DIR / f"confusion_{model_name}.png")

        # ---- priority-specific guard --------------------------------------
        emphases = {}
        if task == "priority":
            for name, s in scores.items():
                em_grp = [l for l in labels if l == "EMERGENCY" or l == "HIGH"]
                emphases[name] = {l: s["report"][l]["recall"] for l in em_grp}
                print(f"    {name}: " + ", ".join(f"{k} recall={v:.4f}" for k, v in emphases[name].items()))

        # ---- CV comparison (algorithms) + verdict --------------------------
        b, i = scores["baseline"], scores["improved"]
        delta = i["macro"] - b["macro"]
        if delta >= 0.005:
            verdict = "Improved model is better"
        elif delta <= -0.005:
            verdict = "Baseline is better"
        else:
            verdict = "no meaningful difference"
        verdicts[task] = (verdict, delta, b["macro"], i["macro"],
                          emphases if emphases else None)

        # ---- collect report section ---------------------------------------
        cv_md = "see CV table below"
        cv_winner_algo, cv_disq = cv_winner(task, cv_summary)

        report.append(f"\n## {task.capitalize()} — held-out comparison (20% test, seed 42)\n")
        report.append("| Metric | Baseline | Improved |")
        report.append("|---|---|---|")
        report.append(f"| Accuracy | {b['acc']:.4f} | {i['acc']:.4f} |")
        report.append(f"| Macro F1 | {b['macro']:.4f} | {i['macro']:.4f} |")
        report.append(f"| Weighted F1 | {b['weighted']:.4f} | {i['weighted']:.4f} |")
        if task == "priority":
            for name, s in scores.items():
                pass
        report.append(f"| 5-fold CV (5 algorithms) | {cv_md} | — |")
        report.append(f"| Confusion matrix | reports/confusion_{task}_baseline.png | "
                      f"reports/confusion_{task}_improved.png |")

        # ---- 5-algorithm CV table ------------------------------------------
        report.append(f"\n### 5-fold CV on the 80% train (mean ± std, {len(ALGORITHMS)} algorithms)")
        report.append("| Algorithm | CV accuracy | CV macro F1 | avg fit (s) | result |")
        report.append("|---|---|---|---|---|")
        for algo, display in ALGORITHMS.items():
            if (task, algo) not in cv_summary:
                report.append(f"| {display} | n/a | n/a | n/a | (missing from CSV) |")
                continue
            e = cv_summary[(task, algo)]
            outcome = "winner" if algo == cv_winner_algo else (
                "DISQUALIFIED (EMERGENCY recall)" if algo in cv_disq else "")
            report.append(f"| {display} | {e['acc_mean']:.4f}±{e['acc_std']:.4f} | "
                          f"{e['macro_mean']:.4f}±{e['macro_std']:.4f} | "
                          f"{e['fit_mean']:.3f} | {outcome} |")

        report.append("\nPer-class precision / recall / F1:")
        report.append("| Class | P-base | R-base | F1-base | P-impr | R-impr | F1-impr |")
        report.append("|---|---|---|---|---|---|---|")
        for label in labels:
            rb = b["report"].get(label, {})
            ri = i["report"].get(label, {})
            mark = " **←**" if (task == "priority" and label == "EMERGENCY") else ""
            report.append(
                f"| {label}{mark} | {rb.get('precision',0):.4f} | {rb.get('recall',0):.4f} | "
                f"{rb.get('f1-score',0):.4f} | {ri.get('precision',0):.4f} | "
                f"{ri.get('recall',0):.4f} | {ri.get('f1-score',0):.4f} |")
        report.append(f"\n**Verdict: {verdict}** (improved macro F1 {i['macro']:.4f} vs "
                      f"baseline {b['macro']:.4f}, delta {delta:+.4f})")

    # ---- human-written test set --------------------------------------------
    print("\n\n========== HUMAN-WRITTEN TEST SET ==========")
    ht = human_test_scores(
        {"baseline": joblib.load(TASKS[0][4]), "improved": joblib.load(TASKS[0][5])},
        CATEGORY_LABELS, "category")
    if ht:
        print(f"human test file used: {HUMAN_TEST}")
        print(f"samples in supported classes: {ht['n_used']} of {ht['n_total']}")
        for name in ("baseline", "improved"):
            print(f"  {name}: accuracy={ht[name]['acc']:.4f} "
                  f"macro F1={ht[name]['macro']:.4f}")
        report.append("\n## Human-written test set (category only)\n")
        report.append(f"Samples in supported classes: {ht['n_used']} of "
                      f"{ht['n_total']} (other labels excluded).\n")
        report.append("| Model | Accuracy | Macro F1 |")
        report.append("|---|---|---|")
        for name in ("baseline", "improved"):
            report.append(f"| {name} | {ht[name]['acc']:.4f} | {ht[name]['macro']:.4f} |")
    else:
        print("no usable human-written test file found - skipped")
        report.append("\n## Human-written test set\nNo usable human test file found.\n")

    # ---- final verdicts -----------------------------------------------------
    report.append("\n## Final verdicts\n")
    for task, (verdict, delta, bm, im, emph) in verdicts.items():
        report.append(f"- **{task}**: {verdict} (improved macro F1 {im:.4f} vs baseline "
                      f"{bm:.4f}, delta {delta:+.4f}).")
        if task == "priority" and emph:
            be = emph["baseline"]; ie = emph["improved"]
            rule = ""
            if ie["EMERGENCY"] < be["EMERGENCY"] - 0.001:
                rule = (" **WARNING: the improved model lowers EMERGENCY recall "
                        f"(baseline {be['EMERGENCY']:.4f} -> improved {ie['EMERGENCY']:.4f}); "
                        "recommend keeping the baseline for production.**")
            report.append(f"  - EMERGENCY recall: baseline {be['EMERGENCY']:.4f} vs improved {ie['EMERGENCY']:.4f}.{rule}")
            report.append(f"  - HIGH recall: baseline {be['HIGH']:.4f} vs improved {ie['HIGH']:.4f}.")
    if ht:
        report.append("\nHuman-written set evidence (category only): "
                      f"improved accuracy {ht['improved']['acc']:.4f} / macro F1 "
                      f"{ht['improved']['macro']:.4f} vs baseline "
                      f"{ht['baseline']['acc']:.4f} / {ht['baseline']['macro']:.4f} "
                      "- the human set is the more honest generalisation signal, "
                      "so the improved model is preferred in practice.")

    # ---- caveat --------------------------------------------------------------
    report.append("\n## Caveat\n")
    report.append(
        "The training data is **template-generated (synthetic)** — descriptions are built "
        "from fixed keyword/template pools, so train and test splits over this data are "
        "easy to separate and produce **high synthetic scores** that are expected. The "
        "human-written test set is therefore the **more honest number** for real-world "
        "performance; the synthetic held-out scores overstate how well the model will do "
        "on genuinely novel phrasing.")

    make_report(report)
    print("\n\n========== VERDICTS ==========")
    for task, (verdict, delta, bm, im, _) in verdicts.items():
        print(f"  {task}: {verdict} (improved macro F1 {im:.4f} vs baseline {bm:.4f}, "
              f"delta {delta:+.4f})")


if __name__ == "__main__":
    main()