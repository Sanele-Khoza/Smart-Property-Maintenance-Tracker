Here's the full walkthrough, run from the repo root in PowerShell.
0. One-time setup
cd "ai-service"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install pandas matplotlib     # only if not already in requirements.txt
python -c "import sklearn,pandas,matplotlib,joblib"   # verify
(Deactivate/activate so python = the venv's.)


1. Inspect the data (read-only, no changes)
python data_audit.py
Expect: no missing values, no conflicting duplicates; category 8×2344 balanced, priority imbalanced; dedup → 17,259 / 15,164 rows.


2. Cross-validate LR vs LinearSVC (20% test split is reserved, only the 80% is CV'd)
python cross_validate.py
Output: per-fold + mean±std for both algorithms/tasks, winner per task, and reports/cross_validation_results.csv. (On this template data both are 1.0000.)


3. Train the improved category model
python train_category.py
Loads data/categoryDataset18750.csv, dedups, 80/20 split (seed 42), tunes 5 small configs with 5-fold CV on the 80%, keeps the winner (your <0.5pp rule), fits the calibrated pipeline, saves models_improved/category_model_improved.joblib.


4. Train the improved priority model
python train_priority.py
Same flow for priorityDataset18750.csv; saves models_improved/priority_model_improved.joblib.


5. Compare against the production baseline
python compare_models.py
Rebuilds the identical 20% split, scores baseline (models/*.joblib) vs improved on it, computes calibration (log-loss, 0.30 gate), confusion-matrix PNGs, human-test results, verdicts → reports/improvement_report.md.


6. Verify the improved model is drop-in
python -c "import joblib; m=joblib.load('models_improved/category_model_improved.joblib'); print(m.classes_); print(m.predict_proba(['Tap is leaking in the kitchen'])[0])"
Same interface (predict/predict_proba/classes_, calibrated 0–1) as the production models.


7. (Optional) swap it into production
Back up models/category_model.joblib and models/priority_model.joblib, then copy models_improved/*.joblib over them (or point classifier.py/emergency_detector.py at models_improved/). The 0.30 gate behavior is unchanged.
Key rules baked in: identical cleaning + dedup + seed in every script so all splits match; the vectorizer is inside the Pipeline (fitted per fold, no leakage); 20% is never used for fitting/tuning; existing scripts and models are untouched.
Want me to add this as a TRAINING.md in ai-service/?