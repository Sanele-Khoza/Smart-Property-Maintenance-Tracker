
## Category — held-out comparison (20% test, seed 42)

| Metric | Baseline | Improved |
|---|---|---|
| Accuracy | 1.0000 | 1.0000 |
| Macro F1 | 1.0000 | 1.0000 |
| Weighted F1 | 1.0000 | 1.0000 |
| 5-fold CV (5 algorithms) | see CV table below | — |
| Confusion matrix | reports/confusion_category_baseline.png | reports/confusion_category_improved.png |

### 5-fold CV on the 80% train (mean ± std, 5 algorithms)
| Algorithm | CV accuracy | CV macro F1 | avg fit (s) | result |
|---|---|---|---|---|
| ComplementNB | 1.0000±0.0000 | 1.0000±0.0000 | 0.222 | winner |
| Logistic Regression | 1.0000±0.0000 | 1.0000±0.0000 | 0.330 |  |
| LinearSVC | 1.0000±0.0000 | 1.0000±0.0000 | 0.464 |  |
| SGD (modified_huber) | 1.0000±0.0000 | 1.0000±0.0000 | 0.284 |  |
| Random Forest | 1.0000±0.0000 | 1.0000±0.0000 | 0.928 |  |

Per-class precision / recall / F1:
| Class | P-base | R-base | F1-base | P-impr | R-impr | F1-impr |
|---|---|---|---|---|---|---|
| Appliances | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| Electrical | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| HVAC | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| Landscaping | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| Pest Control | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| Plumbing | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| Security | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| Structural | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |

**Verdict: no meaningful difference** (improved macro F1 1.0000 vs baseline 1.0000, delta +0.0000)

## Priority — held-out comparison (20% test, seed 42)

| Metric | Baseline | Improved |
|---|---|---|
| Accuracy | 1.0000 | 1.0000 |
| Macro F1 | 1.0000 | 1.0000 |
| Weighted F1 | 1.0000 | 1.0000 |
| 5-fold CV (5 algorithms) | see CV table below | — |
| Confusion matrix | reports/confusion_priority_baseline.png | reports/confusion_priority_improved.png |

### 5-fold CV on the 80% train (mean ± std, 5 algorithms)
| Algorithm | CV accuracy | CV macro F1 | avg fit (s) | result |
|---|---|---|---|---|
| ComplementNB | 1.0000±0.0000 | 1.0000±0.0000 | 0.305 | winner |
| Logistic Regression | 1.0000±0.0000 | 1.0000±0.0000 | 0.418 |  |
| LinearSVC | 1.0000±0.0000 | 1.0000±0.0000 | 0.781 |  |
| SGD (modified_huber) | 1.0000±0.0000 | 1.0000±0.0000 | 0.415 |  |
| Random Forest | 1.0000±0.0000 | 1.0000±0.0000 | 2.140 |  |

Per-class precision / recall / F1:
| Class | P-base | R-base | F1-base | P-impr | R-impr | F1-impr |
|---|---|---|---|---|---|---|
| EMERGENCY **←** | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| HIGH | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| LOW | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| MEDIUM | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |

**Verdict: no meaningful difference** (improved macro F1 1.0000 vs baseline 1.0000, delta +0.0000)

## Human-written test set (category only)

Samples in supported classes: 39 of 41 (other labels excluded).

| Model | Accuracy | Macro F1 |
|---|---|---|
| baseline | 0.5385 | 0.4250 |
| improved | 0.8718 | 0.8553 |

## Final verdicts

- **category**: no meaningful difference (improved macro F1 1.0000 vs baseline 1.0000, delta +0.0000).
- **priority**: no meaningful difference (improved macro F1 1.0000 vs baseline 1.0000, delta +0.0000).
  - EMERGENCY recall: baseline 1.0000 vs improved 1.0000.
  - HIGH recall: baseline 1.0000 vs improved 1.0000.

Human-written set evidence (category only): improved accuracy 0.8718 / macro F1 0.8553 vs baseline 0.5385 / 0.4250 - the human set is the more honest generalisation signal, so the improved model is preferred in practice.

## Caveat

The training data is **template-generated (synthetic)** — descriptions are built from fixed keyword/template pools, so train and test splits over this data are easy to separate and produce **high synthetic scores** that are expected. The human-written test set is therefore the **more honest number** for real-world performance; the synthetic held-out scores overstate how well the model will do on genuinely novel phrasing.