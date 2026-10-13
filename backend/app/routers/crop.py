
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime

try:
    from bson import ObjectId
except ImportError:
    class ObjectId:
        def __init__(self, val=None):
            if val is not None:
                s = str(val)
                if len(s) != 24 or not all(c in "0123456789abcdefABCDEF" for c in s):
                    raise ValueError(f"'{val}' is not a valid ObjectId")
                self._str = s
            else:
                import uuid
                self._str = uuid.uuid4().hex[:24]

        def __str__(self):
            return self._str

        def __repr__(self):
            return f"ObjectId('{self._str}')"

        def __eq__(self, other):
            return str(self) == str(other)

from app.services.model_service import model_service
from app.database import (
    users_collection,
    crop_history_collection
)


router = APIRouter(
    prefix="/crop",
    tags=["Crop Recommendation"]
)


# =====================================
# INPUT MODEL
# =====================================

class CropInput(BaseModel):
    N: float
    P: float
    K: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float


# =====================================
# USER CROP INPUT
# Used for saving history
# =====================================

class UserCropInput(CropInput):
    user_id: str


# =====================================
# HELPER: FIND USER
# Accepts MongoDB ObjectId OR email
# =====================================

def find_user(user_id: str):

    # First try MongoDB ObjectId
    try:
        object_id = ObjectId(user_id)

        user = users_collection.find_one(
            {"_id": object_id}
        )

        if user:
            return user, object_id

    except Exception:
        pass

    # If it is not an ObjectId, try email
    norm_email = str(user_id).strip().lower()
    user = users_collection.find_one(
        {"email": norm_email}
    )

    if not user:
        try:
            import re
            user = users_collection.find_one({
                "email": {"$regex": f"^{re.escape(norm_email)}$", "$options": "i"}
            })
        except Exception:
            pass

    if user:
        return user, user["_id"]

    return None, None


# =====================================
# CROP RECOMMENDATION API
# =====================================

@router.post("/recommend")
def recommend_crop(data: CropInput):

    recommendations = model_service.recommend_crops(
        N=data.N,
        P=data.P,
        K=data.K,
        temperature=data.temperature,
        humidity=data.humidity,
        ph=data.ph,
        rainfall=data.rainfall
    )

    return {
        "recommendations": recommendations
    }


# =====================================
# CROP + MARKET ANALYSIS API
# WITH DATABASE HISTORY
# =====================================

@router.post("/recommend-with-market")
def recommend_with_market(data: UserCropInput):

    # Find user
    object_id = None
    if data.user_id in ("guest", "demo"):
        user = {"name": "Demo Guest"}
    else:
        user, object_id = find_user(data.user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # STEP 1: CROP RECOMMENDATION
    recommendations = model_service.recommend_crops(
        N=data.N,
        P=data.P,
        K=data.K,
        temperature=data.temperature,
        humidity=data.humidity,
        ph=data.ph,
        rainfall=data.rainfall
    )

    # STEP 2: MARKET ANALYSIS
    market_analysis = model_service.analyze_market(
        recommendations
    )

    # STEP 3: FIND BEST CROP
    # Select the best crop balancing agronomic suitability and market viability.
    # If market data exists for a candidate, use its combined_score (0.70 * conf + 0.30 * price_score).
    # If market data is absent, score is based on agronomic suitability (0.70 * conf).
    # This prevents a low-confidence or trace crop with market data from silently displacing
    # the model's top agronomic recommendation.

    best_overall_crop = None

    if recommendations:
        market_score_map = {
            item["crop"].lower().strip(): float(item.get("combined_score", 0))
            for item in market_analysis
        }

        best_score = -1.0
        for item in recommendations:
            crop_name = item["crop"].lower().strip()
            confidence = float(item.get("confidence", 0))

            score = market_score_map.get(
                crop_name,
                round(0.70 * confidence, 2)
            )

            if score > best_score:
                best_score = score
                best_overall_crop = item["crop"]

    # STEP 4: SAVE HISTORY
    history_data = {
        "user_id": object_id,

        "input": {
            "N": data.N,
            "P": data.P,
            "K": data.K,
            "temperature": data.temperature,
            "humidity": data.humidity,
            "ph": data.ph,
            "rainfall": data.rainfall
        },

        "recommendations": recommendations,
        "market_analysis": market_analysis,
        "best_overall_crop": best_overall_crop,
        "created_at": datetime.now()
    }

    if object_id:
        result = crop_history_collection.insert_one(
            history_data
        )
        history_id = str(result.inserted_id)
    else:
        history_id = "demo_guest"

    # STEP 5: RETURN RESULT
    return {
        "message": (
            "Crop recommendation and market analysis "
            "completed and saved successfully!"
        ),

        "history_id": history_id,
        "recommendations": recommendations,
        "market_analysis": market_analysis,
        "best_overall_crop": best_overall_crop
    }


# =====================================
# GET CROP RECOMMENDATION HISTORY
# =====================================

@router.get("/history/{user_id}")
def get_crop_history(user_id: str):

    # Find user using ObjectId OR email
    user, object_id = find_user(user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # Get crop history
    history = list(
        crop_history_collection
        .find({"user_id": object_id})
        .sort("created_at", -1)
    )

    # Convert MongoDB ObjectIds to strings
    for item in history:
        item["_id"] = str(item["_id"])

        if "user_id" in item:
            item["user_id"] = str(item["user_id"])

    return {
        "user_id": str(object_id),
        "total_recommendations": len(history),
        "history": history
    }


# =====================================
# TEST API
# =====================================

@router.get("/test")
def test_crop():

    return {
        "message": "Crop recommendation API is working!"
    }
