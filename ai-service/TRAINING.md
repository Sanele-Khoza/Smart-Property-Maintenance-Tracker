# SPMT AI Service — Training Guide

End-to-end procedure for auditing the data, cross-validating five classifiers,
training the improved category and priority models, and comparing them against
the production baselines. Everything below is run in PowerShell from the
repository root. Commands assume the Python virtual environment lives at
`ai-service\.venv`.

> The production baseline models (`ai-service/models/*.joblib`) and the training
> scripts inside this folder are never modified by this pipeline. All new output
> goes to `ai-service/models_improved/` and `ai-service/reports/`.

---

## 0. One-time setup

```powershell
cd "ai-service"

# (optional) true clean slate: delete generated artifacts only, never source data
# git clean -fdx data models models_improved reports

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install pandas matplotlib

# verify the environment
python -c "import sklearn, pandas, matplotlib, joblib"
```

If `python` does not resolve to the venv, re-run the `Activate.ps1` line or call
`.\.venv\Scripts\python.exe` explicitly in every command below.

## 1. Verify the data files

```powershell
Get-ChildItem data
```

Required files:

| File | Purpose |
|---|---|
| `data/categoryDataset18750.csv` | 18,750 category rows (`text,category`) |
| `data/priorityDataset18750.csv` | 18,750 priority rows (`text,priority`) |
| `../training data/human_tickets_test.csv` | human-written test set (used only in the final report) |

## 2. Audit the data (read-only)

```powershell
python data_audit.py
```

Prints, per CSV: row count, columns, missing values (count + %), empty /
whitespace-only texts, exact + conflicting duplicate texts, class counts and
percentages, and the row count after de-duplication. It never modifies the CSVs.

## 3. Cross-validate the five algorithms

```powershell
python cross_validate.py
```

Compares **ComplementNB, Logistic Regression, LinearSVC, SGD (modified_huber),
Random Forest** — all on the same TF-IDF pipeline stored in the `ALGORITHMS`
dictionary at the top of the file (add/remove one algorithm in one line).

- Strips text, drops empty rows, drops duplicate texts (before/after counts are
  printed).
- Stratified 80/20 split first (`random_state=42`); the 20% is **never** used here.
- `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` on the 80% only.
- Per fold: accuracy, macro F1, per-class F1, EMERGENCY/HIGH recall (priority),
  and training time.
- Winner rule: priority first disqualifies algorithms whose mean EMERGENCY
  recall is > 1 pt below the best; then highest mean macro F1, 0.5-pt tie-break
  to the simplest (order: CNB, LR, SVC, SGD, RF).

Writes per-fold values to `reports/cross_validation_results.csv`.

## 4. Train the improved category model

```powershell
python train_category.py
```

- Same cleaning + dedup + stratified 80/20 split (seed 42); trains on the 80% only.
- Starts from the existing recipe (TF-IDF + `LinearSVC(class_weight="balanced")`
  + `CalibratedClassifierCV(cv=3)`) and tunes a small set of safe config changes
  (C, ngram range, min_df, max_features) with the same 5-fold CV on the 80%.
- Keeps the winner on mean CV macro F1; if the gain is < 0.5 pt it keeps the
  existing setting.
- Saves `models_improved/category_model_improved.joblib` (same format as the
  production model, swap-in compatible).

## 5. Train the improved priority model

```powershell
python train_priority.py
```

Identical procedure for the priority task (LOW / MEDIUM / HIGH / EMERGENCY).
Saves `models_improved/priority_model_improved.joblib`.

## 6. Compare against the production baselines

```powershell
python compare_models.py
```

- Rebuilds the identical 20% held-out split.
- Scores the baseline (`models/*.joblib`) and improved model on it: accuracy,
  per-class precision/recall/F1 + support, macro/weighted F1, and a labelled
  confusion matrix (PNG per model per task).
- Reports the 5-fold CV table (all five algorithms, incl. average fit time and
  winner/disqualified markers) from `cross_validation_results.csv`.
- Priority: highlights EMERGENCY and HIGH recall; if the improved model lowers
  EMERGENCY recall below the baseline, it says so and recommends the baseline.
- Calibration: log-loss, count of samples below the 0.30 gate, accuracy above it.
- Human-written test file (category): accuracy + macro F1 for both models.
- Verdict per task and a caveat about template-generated data.

Writes `reports/improvement_report.md` (+ the confusion-matrix PNGs).

## 7. Sanity-check the trained model

```powershell
python -c "import joblib; m=joblib.load('models_improved/category_model_improved.joblib'); print(m.classes_); print(m.predict_proba(['The tap is leaking in the kitchen'])[0])"
```

Verifies the interface the app uses: `predict`, `predict_proba`, `classes_`,
with calibrated 0–1 confidence.

## 8. (Optional) Put the improved model into production

1. Back up the current models:
   ```powershell
   Copy-Item models/category_model.joblib models/category_model.joblib.bak
   Copy-Item models/priority_model.joblib models/priority_model.joblib.bak
   ```
2. Copy the improved models over them, or point `app/classifier.py` and
   `app/emergency_detector.py` at `models_improved/`.
3. The behaviour (predicted label + calibrated confidence + the 0.30 classify
   gate) is unchanged.

---

## Run order summary

```
data_audit.py  ->  cross_validate.py  ->  train_category.py
                 ->  train_priority.py ->  compare_models.py   (writes the report)
```

`cross_validate.py` must run before `compare_models.py` (it reads the CV CSV).
`data_audit.py` can run at any point before `compare_models.py`.

## Constraints honoured by every script

- Random seeds set everywhere (`random_state=42`).
- Identical cleaning, de-duplication and split logic so all scripts use the
  same training/test partitions.
- Vectoriser and classifier live in one `Pipeline`, so TF-IDF is fitted only on
  the training part of each fold (no leakage).
- The 20% held-out set is never used for fitting or tuning.
- Existing training scripts and saved models are left untouched.