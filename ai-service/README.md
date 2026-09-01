# SPMT Python AI Service

A standalone Python microservice that **auto-detects the category** of a maintenance
ticket from its text and **auto-selects the best service provider** to assign it to.

The existing Node.js backend talks to this service over HTTP. When the service is
unavailable or disabled, the backend transparently falls back to its existing
keyword classifier — nothing breaks.

## Features

- **Category detection** — scikit-learn `TfidfVectorizer` + `LinearSVC`
  (calibrated for confidence scores). Trained on a synthetic labelled dataset
  covering the 9 SPMT categories.
- **Provider auto-assignment** — a weighted scoring model (specialisation 0.25,
  rating 0.30, proximity 0.25, workload 0.20). Specialisation is a **hard filter**:
  providers without the matching skill never enter the candidate pool.
- **Graceful degradation** — keyword fallback until the model is trained, so the
  service runs even the first time.

## Project layout

```
ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py             # FastAPI app + /health, /classify, /auto-assign
│   ├── model.py            # sklearn pipeline (tfidf + calibrated LinearSVC)
│   ├── train.py            # trains + persists the model
│   ├── classifier.py       # loads model, predict() with keyword fallback
│   ├── provider_matcher.py # provider scoring + ranking
│   └── data_generator.py   # builds the synthetic labelled dataset
├── data/tickets_dataset.csv
├── models/category_model.joblib
├── requirements.txt
└── .venv/                  # virtual environment (created locally)
```

## Setup

```bash
cd ai-service
python -m venv .venv
.\.venv\Scripts\activate          # Windows (PowerShell)
pip install -r requirements.txt

# train the model (creates models/category_model.joblib)
python -m app.train

# run the service
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

## API

| Method | Path            | Body                                                        |
|--------|-----------------|-------------------------------------------------------------|
| GET    | `/health`       | model status + available categories                          |
| POST   | `/classify`     | `{ "text": "..." }` → `{ category, confidence, method }`    |
| POST   | `/auto-assign`  | `{ category, providers[], top_n, ... }` → ranked matches     |
| POST   | `/classify-assign` | `{ text, providers[] }` → classification + best match     |

## Wiring into the Node backend

1. Add to the backend `.env`:
   ```env
   PYTHON_AI_ENABLED=true
   PYTHON_AI_URL=http://127.0.0.1:8001
   ```
2. Start the Python service (above) alongside `npm run dev`.
3. When `PYTHON_AI_ENABLED=true`, ticket text classification uses the Python
   sklearn model. A dedicated endpoint also exposes the combined flow:

   ```
   GET /api/ai/python/classify-assign/:ticketId
   ```

   This runs Python classification and returns a ranked provider list (preview only,
   does not persist).

## Retraining on real data

Drop your own labelled CSV (columns `text,category`) at
`data/tickets_dataset.csv` and re-run `python -m app.train`.
