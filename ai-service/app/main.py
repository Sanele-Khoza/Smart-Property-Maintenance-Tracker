"""FastAPI application exposing the SPMT auto-classify + auto-assign AI.

Endpoints:
    GET  /health               liveness + model status
    POST /classify             detect category from ticket text
    POST /auto-assign          choose best provider for a ticket
    POST /classify-assign      do both in one call
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.classifier import predict
from app.provider_matcher import score_providers, CATEGORIES

app = FastAPI(title="SPMT AI Service", version="1.0.0")


class ClassifyRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Ticket title + description")


class AssignRequest(BaseModel):
    category: str = Field(..., description="Detected ticket category")
    providers: list[dict] = Field(
        default_factory=list, description="Candidate service providers"
    )
    ticket_lat: float | None = None
    ticket_lng: float | None = None
    require_specialisation: bool = True
    top_n: int = 1
    priority: str | None = None


class ClassifyAssignRequest(ClassifyRequest):
    providers: list[dict] = Field(
        default_factory=list, description="Candidate service providers"
    )
    ticket_lat: float | None = None
    ticket_lng: float | None = None
    require_specialisation: bool = True


@app.get("/health")
def health():
    from app.classifier import _load_model

    return {
        "status": "ok",
        "model_loaded": _load_model() is not None,
        "categories": CATEGORIES,
    }


@app.post("/classify")
def classify(req: ClassifyRequest):
    result = predict(req.text)
    if not result["category"] or (
        result["category"] == "Other" and result["confidence"] < 0.3
    ):
        raise HTTPException(
            status_code=422,
            detail="Could not confidently classify ticket category.",
        )
    return {"success": True, "data": result}


@app.post("/auto-assign")
def auto_assign(req: AssignRequest):
    if req.category not in CATEGORIES and req.category not in ("Other",):
        raise HTTPException(status_code=422, detail=f"Unknown category: {req.category}")
    if not req.providers:
        return {"success": True, "data": {"matches": []}}

    top = score_providers(
        req.providers,
        category=req.category,
        require_specialisation=req.require_specialisation,
        top_n=req.top_n,
        ticket_lat=req.ticket_lat,
        ticket_lng=req.ticket_lng,
    )
    return {
        "success": True,
        "data": {
            "category": req.category,
            "creator": "sklearn",
            "matches": top,
            "provider_count": len(req.providers),
        },
    }


@app.post("/classify-assign")
def classify_assign(req: ClassifyAssignRequest):
    classification = predict(req.text)
    category = classification["category"]
    top = score_providers(
        req.providers,
        category=category,
        require_specialisation=req.require_specialisation,
        top_n=1,
        ticket_lat=req.ticket_lat,
        ticket_lng=req.ticket_lng,
    ) if req.providers else []
    return {
        "success": True,
        "data": {
            "classification": classification,
            "review": {"category": category, "confidence": classification["confidence"]},
            "match": top[0] if top else None,
        },
    }
