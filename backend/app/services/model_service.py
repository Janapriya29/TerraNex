import os
import json
import hashlib
import joblib
import pandas as pd
import numpy as np
import tensorflow as tf

from app.config import (
    DISEASE_MODEL_PATH,
    SPECIES_MODEL_PATH,
    SPECIES_MAPPING_PATH,
    SPECIES_META_PATH,
    CROP_MODEL_PATH,
    SCALER_PATH,
    LABEL_ENCODER_PATH,
    FEATURE_PATH,
    MARKET_DATA_PATH
)


class ModelService:

    def __init__(self):

        print("Loading TerraNex models...")

        # =====================================
        # LOAD DISEASE PREDICTION MODEL (STAGE 2)
        # =====================================
        self.disease_model = tf.keras.models.load_model(
            DISEASE_MODEL_PATH
        )

        # Exact class order used during training (8 classes)
        self.disease_classes = [
            "Tomato___Bacterial_spot",
            "Tomato___Early_blight",
            "Tomato___Late_blight",
            "Tomato___healthy",
            "Potato___Early_blight",
            "Potato___Late_blight",
            "Pepper,_bell___Bacterial_spot",
            "Pepper,_bell___healthy"
        ]

        # Genus mapping for Stage 2 pathology classes
        self.stage2_genus_map = {
            "Tomato___Bacterial_spot": "Tomato",
            "Tomato___Early_blight": "Tomato",
            "Tomato___Late_blight": "Tomato",
            "Tomato___healthy": "Tomato",
            "Potato___Early_blight": "Potato",
            "Potato___Late_blight": "Potato",
            "Pepper,_bell___Bacterial_spot": "Bell Pepper",
            "Pepper,_bell___healthy": "Bell Pepper"
        }

        # =====================================
        # LOAD STAGE 1 SPECIES GATEKEEPER MODEL
        # =====================================
        self.enable_stage1 = os.getenv("ENABLE_STAGE1_SPECIES", "true").lower() == "true"
        self.species_model = None
        self.species_mapping = {0: "Tomato", 1: "Potato", 2: "Bell Pepper", 3: "Unsupported"}
        self.tau_species = 0.60
        self.tau_other = 0.20
        self.delta_margin = 0.10
        self.stage1_status = "disabled" if not self.enable_stage1 else "unloaded"

        if self.enable_stage1:
            try:
                self._load_and_verify_stage1()
            except Exception as e:
                print(f"Warning: Failed to load Stage 1 species model ({e}). Gracefully falling back to safe single-stage mode.")
                self.stage1_status = f"failed_to_load: {str(e)}"

        # =====================================
        # LOAD CROP RECOMMENDATION MODEL
        # =====================================
        self.crop_model = joblib.load(
            CROP_MODEL_PATH
        )

        self.scaler = joblib.load(
            SCALER_PATH
        )

        self.label_encoder = joblib.load(
            LABEL_ENCODER_PATH
        )

        self.features = joblib.load(
            FEATURE_PATH
        )

        # =====================================
        # LOAD MARKET PRICE DATA
        # =====================================
        self.market_prices = joblib.load(
            MARKET_DATA_PATH
        )

        print("All models loaded successfully!")

    @staticmethod
    def _compute_sha256(filepath):
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                h.update(chunk)
        return h.hexdigest()

    def _load_and_verify_stage1(self):
        if not SPECIES_MODEL_PATH.exists():
            raise FileNotFoundError(f"Species model not found: {SPECIES_MODEL_PATH}")

        # Check metadata and verify checksum
        if SPECIES_META_PATH.exists():
            with open(SPECIES_META_PATH, "r", encoding="utf-8") as f:
                meta = json.load(f)
            expected_hash = meta.get("model_sha256")
            if expected_hash:
                actual_hash = self._compute_sha256(SPECIES_MODEL_PATH)
                if actual_hash.lower() != expected_hash.lower():
                    raise ValueError(f"Checksum mismatch for Stage 1 model! Expected {expected_hash}, got {actual_hash}")

            # Calibrated thresholds from metadata
            thresholds = meta.get("selected_thresholds", {})
            self.tau_species = float(thresholds.get("tau_species", 0.60))
            self.tau_other = float(thresholds.get("tau_other", 0.20))
            self.delta_margin = float(thresholds.get("delta_margin", 0.10))

        if SPECIES_MAPPING_PATH.exists():
            with open(SPECIES_MAPPING_PATH, "r", encoding="utf-8") as f:
                raw_mapping = json.load(f)
            self.species_mapping = {int(k): v for k, v in raw_mapping.items()}

        self.species_model = tf.keras.models.load_model(str(SPECIES_MODEL_PATH))
        self.stage1_status = "active"
        print(f"Stage 1 species gatekeeper active (tau_sp={self.tau_species}, tau_oth={self.tau_other}, delta={self.delta_margin})")

    # =====================================
    # PLANT DISEASE PREDICTION (TWO-STAGE)
    # =====================================

    def predict_disease(self, image, confirmed_symptoms: bool = False):

        # Convert image to RGB
        image = image.convert("RGB")

        # Resize image to model input size
        image = image.resize((224, 224))

        # Convert to NumPy array
        image_array = np.array(image, dtype="float32")

        if not np.isfinite(image_array).all():
            raise ValueError("Input image contains non-finite pixel values.")

        # Add batch dimension
        image_batch = np.expand_dims(image_array, axis=0)

        # -------------------------------------------------------------
        # STEP 1: STAGE 1 BOTANICAL GATEKEEPER (If Active)
        # -------------------------------------------------------------
        top1_species = "Unknown"
        species_conf = 0.0

        if self.stage1_status == "active" and self.species_model is not None:
            p_species = self.species_model.predict(image_batch, verbose=0)[0]

            if not np.isfinite(p_species).all():
                # Non-finite species probabilities -> abstain safely
                return {
                    "status": "abstained_uncertain_species",
                    "prediction": "Uncertain Plant Foliage (Abstained)",
                    "confidence": 0.0,
                    "confidence_level": "uncertain",
                    "is_uncertain": True,
                    "plant_species": "Unknown",
                    "species_confidence": 0.0,
                    "is_potato_screening": False,
                    "requires_symptom_confirmation": False,
                    "symptoms_confirmed": False,
                    "treatment_available": False,
                    "safety_warning": "Inference uncertainty: non-finite output probabilities detected.",
                    "reliability_note": "Numerical instability detected in model output. Diagnosis safely abstained.",
                    "second_prediction": None,
                    "confidence_margin": 0.0,
                    "supported_crops": ["Tomato", "Potato", "Bell Pepper"],
                    "disclaimer": "Diagnostic abstention: numerical anomaly in output."
                }

            sorted_sp_idx = np.argsort(p_species)[::-1]
            top1_sp_idx = int(sorted_sp_idx[0])
            top2_sp_idx = int(sorted_sp_idx[1])
            top1_sp_p = float(p_species[top1_sp_idx])
            top2_sp_p = float(p_species[top2_sp_idx])
            margin_sp = top1_sp_p - top2_sp_p
            p_unsupported = float(p_species[3])

            top1_species = self.species_mapping.get(top1_sp_idx, "Unsupported")
            species_conf = round(top1_sp_p * 100, 2)

            # BRANCH 1: REJECT UNSUPPORTED SPECIES
            if top1_sp_idx == 3 or p_unsupported >= self.tau_other:
                return {
                    "status": "rejected_unsupported_species",
                    "prediction": "Unsupported Plant Species",
                    "confidence": round(p_unsupported * 100, 2),
                    "confidence_level": "high" if p_unsupported >= 0.70 else "moderate",
                    "is_uncertain": False,
                    "plant_species": "Unsupported / Other",
                    "species_confidence": round(p_unsupported * 100, 2),
                    "is_potato_screening": False,
                    "requires_symptom_confirmation": False,
                    "symptoms_confirmed": False,
                    "treatment_available": False,
                    "safety_warning": "TerraNex disease screening only supports Tomato, Potato, and Bell Pepper crops.",
                    "reliability_note": (
                        "The species gatekeeper detected that this leaf belongs to an unsupported or unfamiliar crop. "
                        "Disease screening was stopped to prevent inappropriate chemical treatments."
                    ),
                    "second_prediction": None,
                    "confidence_margin": round(margin_sp * 100, 2),
                    "supported_crops": ["Tomato", "Potato", "Bell Pepper"],
                    "disclaimer": (
                        "Automated screening is restricted to supported crops. "
                        "Consult a certified agronomist for crops outside the supported categories."
                    )
                }

            # BRANCH 2: ABSTAIN UNCERTAIN SPECIES
            elif top1_sp_p < self.tau_species or margin_sp < self.delta_margin:
                return {
                    "status": "abstained_uncertain_species",
                    "prediction": "Uncertain Plant Species (Abstained)",
                    "confidence": round(top1_sp_p * 100, 2),
                    "confidence_level": "uncertain",
                    "is_uncertain": True,
                    "plant_species": top1_species,
                    "species_confidence": round(top1_sp_p * 100, 2),
                    "is_potato_screening": (top1_species == "Potato"),
                    "requires_symptom_confirmation": False,
                    "symptoms_confirmed": False,
                    "treatment_available": False,
                    "safety_warning": "Species identity is uncertain. Disease screening abstained to prevent false treatments.",
                    "reliability_note": (
                        f"Gatekeeper confidence for {top1_species} ({round(top1_sp_p * 100, 1)}%, margin {round(margin_sp * 100, 1)}%) "
                        "is below statistical threshold. Symptoms or lighting may be ambiguous."
                    ),
                    "second_prediction": None,
                    "confidence_margin": round(margin_sp * 100, 2),
                    "supported_crops": ["Tomato", "Potato", "Bell Pepper"],
                    "disclaimer": (
                        "Diagnostic abstention: please provide a clearer, centered leaf photograph "
                        "or consult an agronomist before taking chemical action."
                    )
                }

        # -------------------------------------------------------------
        # STEP 2: STAGE 2 PATHOLOGY MODEL INFERENCE
        # -------------------------------------------------------------
        predictions = self.disease_model.predict(image_batch, verbose=0)

        if not np.isfinite(predictions).all():
            raise ValueError("Stage 2 pathology model produced non-finite output probabilities.")

        sorted_indices = np.argsort(predictions[0])[::-1]
        top_idx = int(sorted_indices[0])
        second_idx = int(sorted_indices[1])

        top_confidence = float(predictions[0][top_idx] * 100)
        second_confidence = float(predictions[0][second_idx] * 100)
        margin = float(top_confidence - second_confidence)

        predicted_class = self.disease_classes[top_idx]
        stage2_genus = self.stage2_genus_map.get(predicted_class, "Unknown")

        readable_name = (
            predicted_class
            .replace("___", " - ")
            .replace("_", " ")
            .replace(",", "")
        )

        second_class = self.disease_classes[second_idx]
        readable_second = (
            second_class
            .replace("___", " - ")
            .replace("_", " ")
            .replace(",", "")
        )

        # -------------------------------------------------------------
        # STEP 3: CROSS-STAGE CONSISTENCY CHECK
        # -------------------------------------------------------------
        if self.stage1_status == "active" and top1_species != "Unknown":
            if top1_species != stage2_genus:
                return {
                    "status": "cross_stage_discrepancy",
                    "prediction": f"Botanical Discrepancy ({top1_species} vs {stage2_genus})",
                    "confidence": round(top_confidence, 2),
                    "confidence_level": "uncertain",
                    "is_uncertain": True,
                    "plant_species": top1_species,
                    "species_confidence": species_conf,
                    "is_potato_screening": (top1_species == "Potato"),
                    "requires_symptom_confirmation": False,
                    "symptoms_confirmed": False,
                    "treatment_available": False,
                    "safety_warning": "Contradiction detected between plant species and pathology model. Chemical guidance suppressed.",
                    "reliability_note": (
                        f"Gatekeeper identified plant genus '{top1_species}', but pathology model "
                        f"diagnosed '{readable_name}' ({stage2_genus}). Diagnosis aborted due to contradiction."
                    ),
                    "second_prediction": {
                        "prediction": readable_second,
                        "confidence": round(second_confidence, 2)
                    },
                    "confidence_margin": round(margin, 2),
                    "supported_crops": ["Tomato", "Potato", "Bell Pepper"],
                    "disclaimer": "AI contradiction detected. Treatment recommendations suppressed."
                }

        # -------------------------------------------------------------
        # STEP 4: POTATO SAFEGUARDS & ACTIONABLE OUTCOMES
        # -------------------------------------------------------------
        effective_species = top1_species if top1_species != "Unknown" else stage2_genus
        is_potato = (effective_species == "Potato")
        is_healthy = "healthy" in predicted_class.lower()

        # Confidence level categorization
        if top_confidence >= 85.0:
            confidence_level = "high"
            is_uncertain = False
            reliability_note = (
                f"Statistical match within supported categories for {effective_species}. "
                "Confidence indicates model certainty within its training domain, not calibrated probability of disease."
            )
        elif top_confidence >= 70.0:
            confidence_level = "moderate"
            is_uncertain = False
            reliability_note = (
                f"Moderate confidence ({round(top_confidence, 1)}%). Symptoms may be early-stage "
                f"or visually ambiguous with {readable_second} ({round(second_confidence, 1)}%)."
            )
        else:
            confidence_level = "uncertain"
            is_uncertain = True
            reliability_note = (
                f"Low confidence ({round(top_confidence, 1)}%). Symptoms are ambiguous or blurry. "
                "Visual agronomist confirmation required before taking action."
            )

        if is_potato:
            # Stage 2 lacks Potato___healthy class: mandatory safeguards
            status = "potato_screening" if self.stage1_status == "active" else "model_unavailable"
            is_potato_screening = True
            requires_symptom_confirmation = True
            treatment_available = False  # Suppressed by default!
            safety_warning = (
                "Diagnostic Safety Notice: The pathology model only screens for Early Blight and Late Blight on potato foliage. "
                "Healthy potato foliage cannot be diagnosed by the model and may trigger false blight warnings. "
                "If this leaf shows no dark concentric rings or water-soaked necrotic lesions, the plant is likely healthy. "
                "DO NOT apply fungicide treatments to lesion-free leaves. A positive symptom checklist is supporting information only; "
                "consult a certified agronomist before applying chemical treatments."
            )
            if self.stage1_status != "active":
                safety_warning = (
                    "Gatekeeper is unavailable; crop species was not verified by Stage 1. "
                    + safety_warning
                )
        else:
            status = "accepted" if self.stage1_status == "active" else "model_unavailable"
            is_potato_screening = False
            requires_symptom_confirmation = False
            if self.stage1_status != "active":
                treatment_available = False
                safety_warning = "Gatekeeper is unavailable; crop species was not verified by Stage 1. Automated treatments are suppressed."
            else:
                treatment_available = not is_healthy and not is_uncertain
                safety_warning = ""

        return {
            "status": status,
            "prediction": readable_name,
            "confidence": round(top_confidence, 2),
            "confidence_level": confidence_level,
            "is_uncertain": is_uncertain,
            "plant_species": effective_species,
            "species_confidence": species_conf if species_conf > 0 else round(top_confidence, 2),
            "is_potato_screening": is_potato_screening,
            "requires_symptom_confirmation": requires_symptom_confirmation,
            "symptoms_confirmed": confirmed_symptoms if is_potato else False,
            "treatment_available": treatment_available,
            "safety_warning": safety_warning,
            "reliability_note": reliability_note,
            "second_prediction": {
                "prediction": readable_second,
                "confidence": round(second_confidence, 2)
            },
            "confidence_margin": round(margin, 2),
            "supported_crops": ["Tomato", "Potato", "Bell Pepper"],
            "disclaimer": (
                "AI foliar screening provides indicative diagnostic suggestions only. "
                "Consult a certified agricultural extension specialist before applying chemical fungicides or pesticides."
            )
        }

    # =====================================
    # CROP RECOMMENDATION
    # =====================================

    def recommend_crops(
        self,
        N,
        P,
        K,
        temperature,
        humidity,
        ph,
        rainfall
    ):

        input_data = pd.DataFrame(
            [
                [
                    N,
                    P,
                    K,
                    temperature,
                    humidity,
                    ph,
                    rainfall
                ]
            ],
            columns=self.features
        )

        probabilities = self.crop_model.predict_proba(
            input_data
        )[0]

        top_indices = np.argsort(probabilities)[::-1]

        recommendations = []

        for index in top_indices:

            confidence = float(
                probabilities[index] * 100
            )

            # Skip crops with zero probability unless no crops found yet
            if confidence <= 0 and len(recommendations) > 0:
                continue

            crop = self.label_encoder.inverse_transform(
                [index]
            )[0]

            recommendations.append({
                "crop": crop,
                "confidence": round(confidence, 2)
            })

        return recommendations

    # =====================================
    # MARKET ANALYSIS
    # =====================================

    def analyze_market(self, recommendations):

        results = []

        max_market_price = max(
            float(data["modal_price"])
            for data in self.market_prices.values()
        )

        for item in recommendations:

            crop = item["crop"].lower().strip()
            confidence = float(item["confidence"])

            # Skip crops without market data or with zero ML confidence
            if crop not in self.market_prices or confidence <= 0:
                continue

            price_info = self.market_prices[crop]

            modal_price = float(
                price_info["modal_price"]
            )

            markets_available = int(
                price_info["markets"]
            )

            price_score = (
                modal_price / max_market_price
            ) * 100

            combined_score = (
                0.70 * confidence
                + 0.30 * price_score
            )

            estimated_cost = (
                modal_price * 0.60
            )

            estimated_profit = (
                modal_price - estimated_cost
            )

            results.append({
                "crop": crop,
                "ml_confidence": round(confidence, 2),
                "average_modal_price": round(
                    modal_price, 2
                ),
                "markets_available": markets_available,
                "price_score": round(
                    price_score, 2
                ),
                "combined_score": round(
                    combined_score, 2
                ),
                "estimated_cost": round(
                    estimated_cost, 2
                ),
                "estimated_profit": round(
                    estimated_profit, 2
                )
            })

        results.sort(
            key=lambda x: x["combined_score"],
            reverse=True
        )

        return results


# =====================================
# SHARED MODEL SERVICE
# =====================================

model_service = ModelService()