from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from datetime import datetime
from pathlib import Path
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
import io
import uuid
import numpy as np

from app.services.model_service import model_service
from app.config import DISEASE_UPLOAD_DIR
from app.database import (
    users_collection,
    disease_history_collection
)


router = APIRouter(
    prefix="/disease",
    tags=["Disease Prediction"]
)


# =====================================
# UPLOAD FOLDER
# =====================================

UPLOAD_DIR = DISEASE_UPLOAD_DIR
UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# =====================================
# DISEASE PREDICTION API
# =====================================

@router.post("/predict")
async def predict_disease(
    user_id: str = Form(...),
    file: UploadFile = File(...),
    confirmed_symptoms: bool = Form(False)
):

    # ---------------------------------
    # VALIDATE USER ID
    # ---------------------------------

    object_id = None
    if user_id in ("guest", "demo"):
        user = {"name": "Demo Guest"}
    else:
        from app.routers.crop import find_user
        user, object_id = find_user(user_id)

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found."
            )

    # ---------------------------------
    # VALIDATE IMAGE
    # ---------------------------------

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file."
        )

    # Read uploaded image bytes
    image_bytes = await file.read()

    # Validate file size limits (100 B to 10 MB)
    if len(image_bytes) < 100:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty or too small to be a valid image."
        )

    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image file exceeds maximum allowable size of 10MB."
        )

    # Decode and verify image integrity
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file could not be decoded as a valid image."
        )

    # Validate minimum image resolution
    if image.width < 64 or image.height < 64:
        raise HTTPException(
            status_code=400,
            detail="Image resolution is too low (minimum 64x64 required). Please upload a clear photo of a plant leaf."
        )

    # Validate image visual variance (reject solid/blank/uniform non-photographic inputs)
    img_rgb = image.convert("RGB")
    img_arr = np.array(img_rgb, dtype=np.float32)
    if float(np.std(img_arr)) < 12.0:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image appears blank, uniform, or lacks visual detail. Please upload a clear photo of a plant leaf."
        )

    try:
        # ---------------------------------
        # CREATE UNIQUE IMAGE NAME
        # ---------------------------------

        file_extension = Path(
            file.filename
        ).suffix or ".jpg"

        unique_filename = (
            f"{uuid.uuid4()}"
            f"{file_extension}"
        )

        image_path = (
            UPLOAD_DIR
            / unique_filename
        )

        # ---------------------------------
        # SAVE IMAGE
        # ---------------------------------

        with open(image_path, "wb") as image_file:
            image_file.write(image_bytes)

        # ---------------------------------
        # GET ML PREDICTION
        # ---------------------------------

        prediction_result = (
            model_service.predict_disease(
                image,
                confirmed_symptoms=confirmed_symptoms
            )
        )

        # ---------------------------------
        # IMAGE URL
        # ---------------------------------

        image_url = (
            f"/uploads/disease_images/"
            f"{unique_filename}"
        )

        # ---------------------------------
        # SAVE TO MONGODB
        # ---------------------------------

        history_data = {
            "user_id": object_id,
            "prediction": prediction_result["prediction"],
            "confidence": prediction_result["confidence"],
            "confidence_level": prediction_result.get("confidence_level", "high"),
            "is_uncertain": prediction_result.get("is_uncertain", False),
            "reliability_note": prediction_result.get("reliability_note", ""),
            "image_url": image_url,
            "created_at": datetime.now(),
            "status": prediction_result.get("status", "accepted"),
            "plant_species": prediction_result.get("plant_species", "Unknown"),
            "species_confidence": prediction_result.get("species_confidence", 0.0),
            "is_potato_screening": prediction_result.get("is_potato_screening", False),
            "requires_symptom_confirmation": prediction_result.get("requires_symptom_confirmation", False),
            "symptoms_confirmed": prediction_result.get("symptoms_confirmed", False),
            "safety_warning": prediction_result.get("safety_warning", ""),
            "treatment_available": prediction_result.get("treatment_available", False)
        }

        if object_id:
            result = disease_history_collection.insert_one(
                history_data
            )
            history_id = str(result.inserted_id)
        else:
            history_id = "demo_guest"

        # ---------------------------------
        # RETURN RESULT
        # ---------------------------------

        return {
            "message": (
                "Disease screening candidate "
                "generated and saved successfully!"
            ),
            "history_id": history_id,
            "prediction": prediction_result["prediction"],
            "confidence": prediction_result["confidence"],
            "confidence_level": prediction_result.get("confidence_level", "high"),
            "is_uncertain": prediction_result.get("is_uncertain", False),
            "reliability_note": prediction_result.get("reliability_note", ""),
            "second_prediction": prediction_result.get("second_prediction"),
            "confidence_margin": prediction_result.get("confidence_margin"),
            "supported_crops": prediction_result.get("supported_crops", []),
            "disclaimer": prediction_result.get("disclaimer", ""),
            "image_url": image_url,
            "status": prediction_result.get("status", "accepted"),
            "plant_species": prediction_result.get("plant_species", "Unknown"),
            "species_confidence": prediction_result.get("species_confidence", 0.0),
            "is_potato_screening": prediction_result.get("is_potato_screening", False),
            "requires_symptom_confirmation": prediction_result.get("requires_symptom_confirmation", False),
            "symptoms_confirmed": prediction_result.get("symptoms_confirmed", False),
            "safety_warning": prediction_result.get("safety_warning", ""),
            "treatment_available": prediction_result.get("treatment_available", False)
        }

    except HTTPException:
        raise

    except Exception as error:
        # Prevent exposing internal filesystem paths or stack traces
        err_str = str(error)
        if ":" in err_str and ("\\" in err_str or "/" in err_str):
            safe_msg = "An internal processing error occurred during prediction."
        else:
            safe_msg = f"Prediction failed: {err_str}"

        raise HTTPException(
            status_code=500,
            detail=safe_msg
        )


# =====================================
# GET DISEASE PREDICTION HISTORY
# =====================================

@router.get("/history/{user_id}")
def get_disease_history(user_id: str):

    # ---------------------------------
    # VALIDATE USER ID
    # ---------------------------------

    from app.routers.crop import find_user
    user, object_id = find_user(user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # ---------------------------------
    # GET PREDICTION HISTORY
    # ---------------------------------

    history = list(
        disease_history_collection
        .find({"user_id": object_id})
        .sort("created_at", -1)
    )

    # ---------------------------------
    # CONVERT MONGODB DATA TO JSON
    # ---------------------------------

    for item in history:

        item["_id"] = str(item["_id"])
        item["user_id"] = str(item["user_id"])

        # Ensure safe fallback defaults for legacy records
        if "status" not in item:
            item["status"] = "legacy_record"
        if "treatment_available" not in item:
            pred = str(item.get("prediction", "")).lower()
            if "potato" in pred or item.get("is_uncertain", False):
                item["treatment_available"] = False
            elif "healthy" in pred:
                item["treatment_available"] = False
            else:
                item["treatment_available"] = True
        if "is_potato_screening" not in item:
            item["is_potato_screening"] = "potato" in str(item.get("prediction", "")).lower()
        if "requires_symptom_confirmation" not in item:
            item["requires_symptom_confirmation"] = item["is_potato_screening"]

        # ---------------------------------
        # CLEAN IMAGE URL FOR FRONTEND
        # ---------------------------------

        if "image_url" in item and item["image_url"]:
            url_val = str(item["image_url"])
            if url_val.startswith("http://") or url_val.startswith("https://"):
                try:
                    from urllib.parse import urlparse
                    item["image_url"] = urlparse(url_val).path
                except Exception:
                    pass

    # ---------------------------------
    # RETURN HISTORY
    # ---------------------------------

    return {
        "user_id": user_id,
        "total_predictions": len(history),
        "history": history
    }


# =====================================
# TEST API
# =====================================

@router.get("/test")
def test_disease():

    return {
        "message": "Disease prediction API is working!"
    }