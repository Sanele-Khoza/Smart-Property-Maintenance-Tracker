"""Score and pick the best provider for a ticket.

Python port of the Node routing-score logic. Weights mirror the existing
backend so behaviour is consistent:

    specialisation  0.25   (hard filter for require_specialisation=True)
    rating          0.30
    proximity       0.25
    workload        0.20

`score_providers()` is a pure function operating on dicts, making it easy
to unit-test without a database. Persistence / DB reads happen in the
FastAPI routes, which pass in the candidate providers.
"""

SPECIALISATION_WEIGHT = 0.25
RATING_WEIGHT = 0.30
PROXIMITY_WEIGHT = 0.25
WORKLOAD_WEIGHT = 0.20

CATEGORIES = [
    "Plumbing",
    "Electrical",
    "HVAC",
    "Appliances",
    "Structural",
    "Security",
    "Landscaping",
    "Pest Control",
    "Other",
]


def haversine_km(lat1, lng1, lat2, lng2):
    import math

    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _matches(spec: str, category: str) -> bool:
    s = spec.lower().strip()
    c = (category or "").lower().strip()
    if not c:
        return True
    return s == c or s in c or c in s


def _specs_of(provider: dict) -> list[str]:
    raw = provider.get("specialisations") or []
    if isinstance(raw, str):
        import json

        try:
            raw = json.loads(raw)
        except Exception:
            raw = []
    return [str(s) for s in raw]


def score_providers(
    providers: list[dict],
    category: str = "Other",
    *,
    require_specialisation: bool = True,
    top_n: int = 1,
    ticket_lat=None,
    ticket_lng=None,
) -> list[dict]:
    """Score candidate providers and return the top_n, best first.

    Each provider dict may contain: id, name, company_name, rating,
    current_workload, current_jobs, max_concurrent_jobs, status,
    preferred_radius_km, auto_accept, specialisations, gps_lat, gps_lng.
    """
    if require_specialisation:
        providers = [
            p
            for p in providers
            if any(_matches(s, category) for s in _specs_of(p))
        ]

    if not providers:
        return []

    ratings = [float(p.get("rating") or 0) for p in providers]
    max_rating = max([max(ratings, default=0), 1.0])

    workloads = [
        float(p.get("current_workload") or 0) + float(p.get("current_jobs") or 0)
        for p in providers
    ]
    max_workload = max([max(workloads, default=0), 1.0])

    scored = []
    for p, workload in zip(providers, workloads):
        specs = _specs_of(p)
        spec_score = SPECIALISATION_WEIGHT * (
            1.0 if any(_matches(s, category) for s in specs) else 0.0
        )
        rating_score = RATING_WEIGHT * (float(p.get("rating") or 0) / max_rating)

        proximity_score = PROXIMITY_WEIGHT * 0.5
        if (
            ticket_lat is not None
            and ticket_lng is not None
            and p.get("gps_lat") is not None
            and p.get("gps_lng") is not None
        ):
            dist = haversine_km(
                ticket_lat, ticket_lng, float(p["gps_lat"]), float(p["gps_lng"])
            )
            radius = float(p.get("preferred_radius_km") or 50)
            prox = max(0.0, 1.0 - dist / radius)
            proximity_score = PROXIMITY_WEIGHT * prox

        workload_score = WORKLOAD_WEIGHT * (1.0 - workload / max_workload)

        total = spec_score + rating_score + proximity_score + workload_score
        scored.append(
            {
                "id": p.get("id"),
                "name": p.get("name"),
                "company_name": p.get("company_name"),
                "specialisations": specs,
                "rating": p.get("rating"),
                "workload": workload,
                "status": p.get("status"),
                "auto_accept": p.get("auto_accept", False),
                "total_score": round(total, 2),
                "spec_score": round(spec_score, 2),
                "rating_score": round(rating_score, 2),
                "proximity_score": round(proximity_score, 2),
                "workload_score": round(workload_score, 2),
            }
        )

    scored.sort(key=lambda x: x["total_score"], reverse=True)
    return scored[:top_n]


if __name__ == "__main__":
    sample = [
        {"id": 1, "name": "FixIt Plumbing", "specialisations": ["Plumbing"], "rating": 4.8, "current_workload": 2, "status": "AVAILABLE", "auto_accept": True, "gps_lat": -33.92, "gps_lng": 18.42},
        {"id": 2, "name": "Spark Electrics", "specialisations": ["Electrical"], "rating": 4.5, "current_workload": 5, "status": "AVAILABLE", "auto_accept": False},
        {"id": 3, "name": "AllTrades", "specialisations": ["Plumbing", "Electrical", "Structural"], "rating": 4.0, "current_workload": 1, "status": "AVAILABLE", "auto_accept": True},
    ]
    import json

    print(json.dumps(score_providers(sample, category="Plumbing", ticket_lat=-33.9249, ticket_lng=18.4241, top_n=3), indent=2))
