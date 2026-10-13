"""
Automated Test Suite for All 22 Supported Crop Classes in TerraNex.
Verifies model prediction fidelity, market analysis integration, and
transparent handling of crops without APMC market price coverage.
"""

import sys
import unittest
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.model_service import model_service
from app.routers.crop import recommend_with_market, UserCropInput
from app.database import users_collection


# 22 Representative agronomic profiles derived from median dataset values
CROP_TEST_PROFILES = {
    "apple": {"N": 24.0, "P": 136.5, "K": 200.0, "temperature": 22.6, "humidity": 92.4, "ph": 5.89, "rainfall": 113.0, "has_market": True},
    "banana": {"N": 100.5, "P": 81.0, "K": 50.0, "temperature": 27.4, "humidity": 80.2, "ph": 5.99, "rainfall": 105.0, "has_market": True},
    "blackgram": {"N": 41.0, "P": 67.0, "K": 19.0, "temperature": 29.7, "humidity": 65.0, "ph": 7.17, "rainfall": 68.3, "has_market": True},
    "chickpea": {"N": 39.0, "P": 68.0, "K": 79.0, "temperature": 18.9, "humidity": 16.7, "ph": 7.36, "rainfall": 79.7, "has_market": True},
    "coconut": {"N": 24.0, "P": 15.5, "K": 31.0, "temperature": 27.4, "humidity": 95.0, "ph": 5.99, "rainfall": 172.0, "has_market": True},
    "coffee": {"N": 103.0, "P": 29.0, "K": 30.0, "temperature": 25.7, "humidity": 57.6, "ph": 6.80, "rainfall": 157.8, "has_market": False},
    "cotton": {"N": 117.0, "P": 46.0, "K": 19.0, "temperature": 24.0, "humidity": 80.0, "ph": 6.84, "rainfall": 80.2, "has_market": True},
    "grapes": {"N": 24.0, "P": 133.0, "K": 201.0, "temperature": 23.0, "humidity": 81.7, "ph": 6.00, "rainfall": 69.5, "has_market": True},
    "jute": {"N": 78.0, "P": 46.0, "K": 40.0, "temperature": 25.0, "humidity": 79.5, "ph": 6.71, "rainfall": 175.6, "has_market": True},
    "kidneybeans": {"N": 22.0, "P": 67.0, "K": 20.0, "temperature": 19.9, "humidity": 21.3, "ph": 5.75, "rainfall": 107.4, "has_market": False},
    "lentil": {"N": 16.5, "P": 68.0, "K": 19.0, "temperature": 24.9, "humidity": 64.1, "ph": 6.95, "rainfall": 46.6, "has_market": True},
    "maize": {"N": 76.0, "P": 48.5, "K": 20.0, "temperature": 22.8, "humidity": 65.3, "ph": 6.26, "rainfall": 83.5, "has_market": True},
    "mango": {"N": 21.0, "P": 27.5, "K": 30.0, "temperature": 31.3, "humidity": 50.3, "ph": 5.74, "rainfall": 94.9, "has_market": True},
    "mothbeans": {"N": 22.0, "P": 48.5, "K": 20.0, "temperature": 28.4, "humidity": 53.7, "ph": 7.22, "rainfall": 51.2, "has_market": False},
    "mungbean": {"N": 22.0, "P": 47.0, "K": 20.0, "temperature": 28.4, "humidity": 86.0, "ph": 6.70, "rainfall": 49.0, "has_market": True},
    "muskmelon": {"N": 100.0, "P": 18.0, "K": 50.0, "temperature": 28.9, "humidity": 92.1, "ph": 6.35, "rainfall": 24.7, "has_market": False},
    "orange": {"N": 19.0, "P": 16.0, "K": 10.0, "temperature": 22.9, "humidity": 92.0, "ph": 7.02, "rainfall": 110.7, "has_market": True},
    "papaya": {"N": 49.0, "P": 60.0, "K": 50.0, "temperature": 33.3, "humidity": 92.7, "ph": 6.74, "rainfall": 139.0, "has_market": True},
    "pigeonpeas": {"N": 20.0, "P": 69.5, "K": 20.0, "temperature": 28.9, "humidity": 47.2, "ph": 5.69, "rainfall": 154.3, "has_market": True},
    "pomegranate": {"N": 18.0, "P": 20.0, "K": 40.0, "temperature": 22.4, "humidity": 89.9, "ph": 6.43, "rainfall": 107.6, "has_market": False},
    "rice": {"N": 80.0, "P": 47.0, "K": 40.0, "temperature": 23.7, "humidity": 82.2, "ph": 6.36, "rainfall": 233.1, "has_market": True},
    "watermelon": {"N": 99.0, "P": 17.5, "K": 50.5, "temperature": 25.6, "humidity": 85.0, "ph": 6.47, "rainfall": 50.7, "has_market": True},
}


class TestAll22Crops(unittest.TestCase):
    """Test suite executing all 22 supported crop classes through prediction and market analysis."""

    @classmethod
    def setUpClass(cls):
        # Set up a test user in database
        cls.test_email = "test_22_suite@example.com"
        user = users_collection.find_one({"email": cls.test_email})
        if not user:
            res = users_collection.insert_one({
                "name": "Suite Tester 22",
                "email": cls.test_email,
                "password": "hashed_pw"
            })
            cls.user_id = str(res.inserted_id)
        else:
            cls.user_id = str(user["_id"])

    def test_01_label_encoder_contains_all_22_classes(self):
        classes = sorted(list(model_service.label_encoder.classes_))
        self.assertEqual(len(classes), 22)
        expected_classes = sorted(list(CROP_TEST_PROFILES.keys()))
        self.assertEqual(classes, expected_classes)

    def test_02_all_22_crops_predicted_accurately_at_top1(self):
        for crop_name, profile in CROP_TEST_PROFILES.items():
            inputs = {k: v for k, v in profile.items() if k != "has_market"}
            recs = model_service.recommend_crops(**inputs)
            self.assertTrue(len(recs) > 0, f"No recommendations returned for {crop_name}")
            top_rec = recs[0]
            self.assertEqual(
                top_rec["crop"].lower().strip(),
                crop_name.lower().strip(),
                f"Expected top prediction '{crop_name}', got '{top_rec['crop']}'"
            )
            self.assertGreater(top_rec["confidence"], 50.0, f"Confidence for {crop_name} is too low: {top_rec['confidence']}%")

    def test_03_all_22_crops_selected_as_best_crop_in_recommend_with_market(self):
        for crop_name, profile in CROP_TEST_PROFILES.items():
            inputs = {k: v for k, v in profile.items() if k != "has_market"}
            req = UserCropInput(user_id=self.user_id, **inputs)
            res = recommend_with_market(req)
            self.assertEqual(
                res["best_overall_crop"].lower().strip(),
                crop_name.lower().strip(),
                f"Endpoint did not select '{crop_name}' as best crop; got '{res['best_overall_crop']}'"
            )
            # Verify market analysis entry presence matches expected coverage
            market_list = res["market_analysis"]
            if profile["has_market"]:
                self.assertTrue(
                    any(m["crop"].lower().strip() == crop_name for m in market_list),
                    f"Expected market data for '{crop_name}', but not found in market_analysis"
                )
            else:
                self.assertFalse(
                    any(m["crop"].lower().strip() == crop_name for m in market_list),
                    f"Expected no market data for '{crop_name}', but found entry"
                )

    def test_04_market_coverage_consistency(self):
        # 17 crops with market data, 5 without
        with_market = [c for c, p in CROP_TEST_PROFILES.items() if p["has_market"]]
        without_market = [c for c, p in CROP_TEST_PROFILES.items() if not p["has_market"]]
        self.assertEqual(len(with_market), 17)
        self.assertEqual(len(without_market), 5)
        self.assertEqual(sorted(without_market), ["coffee", "kidneybeans", "mothbeans", "muskmelon", "pomegranate"])


if __name__ == "__main__":
    unittest.main()
