from fastapi import APIRouter
from pydantic import BaseModel

from app.services.model_service import model_service


router = APIRouter(
    prefix="/market",
    tags=["Market Analysis"]
)


class RecommendationItem(BaseModel):
    crop: str
    confidence: float


class MarketRequest(BaseModel):
    recommendations: list[RecommendationItem]


@router.post("/analyze")
def analyze_market(data: MarketRequest):

    recommendations = [
        {
            "crop": item.crop,
            "confidence": item.confidence
        }
        for item in data.recommendations
    ]

    results = model_service.analyze_market(
        recommendations
    )

    if not results:
        return {
            "message": "No market data available for the recommended crops.",
            "analysis": []
        }

    market_score_map = {
        item["crop"].lower().strip(): float(item.get("combined_score", 0))
        for item in results
    }

    best_overall_crop = None
    best_score = -1.0
    for item in recommendations:
        crop_name = item["crop"].lower().strip()
        confidence = float(item.get("confidence", 0))
        score = market_score_map.get(crop_name, round(0.70 * confidence, 2))
        if score > best_score:
            best_score = score
            best_overall_crop = item["crop"]

    return {
        "message": "Market analysis completed successfully!",
        "analysis": results,
        "best_overall_crop": best_overall_crop or (results[0]["crop"] if results else None)
    }


@router.get("/test")
def test_market():
    return {
        "message": "Market analysis API is working!"
    }