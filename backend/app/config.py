import os
from pathlib import Path

# Main TerraNex project folder
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Models folder (configurable via MODEL_DIR, defaults to BASE_DIR / "models")
_env_model_dir = os.getenv("MODEL_DIR")
MODEL_DIR = Path(_env_model_dir).resolve() if _env_model_dir else BASE_DIR / "models"

# Disease prediction models (Two-Stage Pipeline)
DISEASE_MODEL_PATH = MODEL_DIR / "crop_disease_model.keras"
SPECIES_MODEL_PATH = MODEL_DIR / "crop_species_model_v1.0.keras"
SPECIES_MAPPING_PATH = MODEL_DIR / "species_mapping.json"
SPECIES_META_PATH = MODEL_DIR / "crop_species_model_v1.0.meta.json"

# Crop recommendation model
CROP_MODEL_PATH = MODEL_DIR / "crop_recommendation_model.pkl"

# Preprocessing files
SCALER_PATH = MODEL_DIR / "crop_scaler.pkl"
LABEL_ENCODER_PATH = MODEL_DIR / "crop_label_encoder.pkl"
FEATURE_PATH = MODEL_DIR / "crop_features.pkl"

# Market price data
MARKET_DATA_PATH = MODEL_DIR / "crop_market_prices.pkl"

# Upload folders (configurable via UPLOAD_DIR, defaults to BASE_DIR / "uploads")
_env_upload_dir = os.getenv("UPLOAD_DIR")
UPLOAD_DIR = Path(_env_upload_dir).resolve() if _env_upload_dir else BASE_DIR / "uploads"
DISEASE_UPLOAD_DIR = UPLOAD_DIR / "disease_images"
DISEASE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)