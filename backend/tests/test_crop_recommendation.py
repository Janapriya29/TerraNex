import sys
import unittest
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from unittest.mock import patch, MagicMock
from app.services.model_service import model_service
from app.routers.crop import recommend_crop, recommend_with_market, CropInput, UserCropInput


class TestCropRecommendationModule(unittest.TestCase):
    """
    Focused tests for the Crop Recommendation module verifying:
    1. Raw agronomic inputs produce accurate, dynamic predictions (no static outputs).
    2. Model does NOT return identical probabilities across different inputs.
    3. Crops without market data are not silently replaced by low-confidence crops.
    4. Market combined scores function properly among viable candidate crops.
    5. API endpoints return valid contracts and persist history correctly.
    """

    def setUp(self):
        # Sample realistic agricultural profiles
        self.inputs_rice = {
            "N": 90.0, "P": 42.0, "K": 43.0,
            "temperature": 20.88, "humidity": 82.00,
            "ph": 6.50, "rainfall": 202.94
        }
        self.inputs_chickpea = {
            "N": 40.0, "P": 70.0, "K": 80.0,
            "temperature": 20.0, "humidity": 30.0,
            "ph": 7.0, "rainfall": 50.0
        }
        self.inputs_coffee = {
            "N": 107.0, "P": 34.0, "K": 32.0,
            "temperature": 26.77, "humidity": 66.41,
            "ph": 6.78, "rainfall": 177.77
        }
        self.inputs_kidneybeans = {
            "N": 20.75, "P": 67.54, "K": 20.05,
            "temperature": 20.12, "humidity": 21.61,
            "ph": 5.75, "rainfall": 105.92
        }
        self.inputs_cotton = {
            "N": 120.0, "P": 40.0, "K": 20.0,
            "temperature": 25.0, "humidity": 80.0,
            "ph": 7.0, "rainfall": 80.0
        }

    # =========================================================================
    # 1. DYNAMIC PROBABILITIES & ACCURATE PREDICTIONS (NO STATIC COLLAPSE)
    # =========================================================================

    def test_01_varied_inputs_produce_distinct_non_identical_probabilities(self):
        """Verify different farm inputs produce distinctly different probability outputs."""
        recs_rice = model_service.recommend_crops(**self.inputs_rice)
        recs_chickpea = model_service.recommend_crops(**self.inputs_chickpea)
        recs_coffee = model_service.recommend_crops(**self.inputs_coffee)
        recs_kidneybeans = model_service.recommend_crops(**self.inputs_kidneybeans)

        top_crops = [
            recs_rice[0]["crop"].lower(),
            recs_chickpea[0]["crop"].lower(),
            recs_coffee[0]["crop"].lower(),
            recs_kidneybeans[0]["crop"].lower()
        ]

        # Verify that predictions are not all the same crop (was previously Orange for all)
        self.assertEqual(len(set(top_crops)), 4, f"Top crops must all be distinct, got {top_crops}")

        # Verify that output probabilities are not the frozen static vector
        # (Kidneybeans 37%, Muskmelon 23.5%, Orange 14%, Mothbeans 13.5%)
        rice_probs = {r["crop"].lower(): r["confidence"] for r in recs_rice}
        self.assertNotEqual(rice_probs.get("kidneybeans"), 37.0)
        self.assertNotEqual(rice_probs.get("muskmelon"), 23.5)
        self.assertNotEqual(rice_probs.get("orange"), 14.0)

    def test_02_rice_profile_accurately_recommends_rice(self):
        """Inputs matching typical rice soil and rain conditions must predict rice as top crop."""
        recs = model_service.recommend_crops(**self.inputs_rice)
        self.assertGreater(len(recs), 0)
        self.assertEqual(recs[0]["crop"].lower(), "rice")
        self.assertGreaterEqual(recs[0]["confidence"], 80.0)

    def test_03_chickpea_profile_accurately_recommends_chickpea(self):
        """Inputs matching typical chickpea soil conditions must predict chickpea as top crop."""
        recs = model_service.recommend_crops(**self.inputs_chickpea)
        self.assertGreater(len(recs), 0)
        self.assertEqual(recs[0]["crop"].lower(), "chickpea")
        self.assertGreaterEqual(recs[0]["confidence"], 35.0)

    def test_04_coffee_profile_accurately_recommends_coffee(self):
        """Inputs matching typical coffee conditions must predict coffee as top crop."""
        recs = model_service.recommend_crops(**self.inputs_coffee)
        self.assertGreater(len(recs), 0)
        self.assertEqual(recs[0]["crop"].lower(), "coffee")
        self.assertGreaterEqual(recs[0]["confidence"], 90.0)

    def test_05_kidneybeans_profile_accurately_recommends_kidneybeans(self):
        """Inputs matching typical kidneybeans conditions must predict kidneybeans as top crop."""
        recs = model_service.recommend_crops(**self.inputs_kidneybeans)
        self.assertGreater(len(recs), 0)
        self.assertEqual(recs[0]["crop"].lower(), "kidneybeans")
        self.assertGreaterEqual(recs[0]["confidence"], 90.0)

    # =========================================================================
    # 2. MARKET RANKING INTEGRITY WITHOUT SILENT MISREPRESENTATION
    # =========================================================================

    def test_06_top_crop_without_market_data_not_displaced_by_trace_crop(self):
        """
        When top ML crop (e.g. coffee) has no market data, a trace secondary crop
        with market data (e.g. coconut at 0.5%) must NOT be selected as best_overall_crop.
        """
        recs = model_service.recommend_crops(**self.inputs_coffee)
        self.assertEqual(recs[0]["crop"].lower(), "coffee")

        market_res = model_service.analyze_market(recs)
        # Coffee should be omitted from market_analysis (no price data in market dataset)
        market_crop_names = [m["crop"].lower() for m in market_res]
        self.assertNotIn("coffee", market_crop_names)

        # In /recommend-with-market, evaluate best_overall_crop
        market_score_map = {item["crop"].lower().strip(): float(item.get("combined_score", 0)) for item in market_res}
        best_crop = None
        best_score = -1.0
        for item in recs:
            c = item["crop"].lower().strip()
            conf = float(item["confidence"])
            score = market_score_map.get(c, round(0.70 * conf, 2))
            if score > best_score:
                best_score = score
                best_crop = item["crop"]

        # Best crop must remain Coffee, NOT the trace crop with market data
        self.assertEqual(best_crop.lower(), "coffee", f"Expected coffee to win, but got {best_crop}")

    def test_07_top_crop_with_market_data_selected_as_best_overall(self):
        """When top ML crop has market data (e.g. rice), best overall crop is rice."""
        recs = model_service.recommend_crops(**self.inputs_rice)
        self.assertEqual(recs[0]["crop"].lower(), "rice")

        market_res = model_service.analyze_market(recs)
        market_crop_names = [m["crop"].lower() for m in market_res]
        self.assertIn("rice", market_crop_names)

        market_score_map = {item["crop"].lower().strip(): float(item.get("combined_score", 0)) for item in market_res}
        best_crop = None
        best_score = -1.0
        for item in recs:
            c = item["crop"].lower().strip()
            conf = float(item["confidence"])
            score = market_score_map.get(c, round(0.70 * conf, 2))
            if score > best_score:
                best_score = score
                best_crop = item["crop"]

        self.assertEqual(best_crop.lower(), "rice")

    def test_08_competing_viable_crops_honor_market_combined_score(self):
        """
        When two viable crops compete and both have market data,
        the crop with the higher combined score is selected.
        """
        # Simulated recommendations with two viable crops
        mock_recs = [
            {"crop": "rice", "confidence": 52.0},
            {"crop": "apple", "confidence": 48.0}
        ]
        market_res = model_service.analyze_market(mock_recs)
        self.assertEqual(len(market_res), 2)

        # Apple has modal price ~11,270 vs Rice ~3,845; Apple's combined score should exceed Rice
        apple_item = next(item for item in market_res if item["crop"] == "apple")
        rice_item = next(item for item in market_res if item["crop"] == "rice")
        self.assertGreater(apple_item["combined_score"], rice_item["combined_score"])

        market_score_map = {item["crop"].lower().strip(): float(item.get("combined_score", 0)) for item in market_res}
        best_crop = None
        best_score = -1.0
        for item in mock_recs:
            c = item["crop"].lower().strip()
            conf = float(item["confidence"])
            score = market_score_map.get(c, round(0.70 * conf, 2))
            if score > best_score:
                best_score = score
                best_crop = item["crop"]

        self.assertEqual(best_crop.lower(), "apple")

    # =========================================================================
    # 3. ROUTER ENDPOINT INTEGRATION & CONTRACT TESTS
    # =========================================================================

    def test_09_router_recommend_endpoint_contract(self):
        """recommend_crop() endpoint returns valid recommendations list with non-static crops."""
        data_in = CropInput(**self.inputs_rice)
        res = recommend_crop(data_in)
        self.assertIn("recommendations", res)
        self.assertGreater(len(res["recommendations"]), 0)
        self.assertEqual(res["recommendations"][0]["crop"].lower(), "rice")

    @patch("app.routers.crop.find_user")
    @patch("app.routers.crop.crop_history_collection")
    def test_10_router_recommend_with_market_endpoint_contract(self, mock_hist, mock_find_user):
        """recommend_with_market() endpoint returns best_overall_crop, market_analysis, and saves history."""
        mock_find_user.return_value = ({"_id": "0123456789abcdef01234567", "email": "farmer@example.com"}, "0123456789abcdef01234567")
        mock_hist.insert_one.return_value = MagicMock(inserted_id="hist12345678901234567890")

        data_in = UserCropInput(user_id="0123456789abcdef01234567", **self.inputs_rice)
        res = recommend_with_market(data_in)

        self.assertIn("best_overall_crop", res)
        self.assertIn("recommendations", res)
        self.assertIn("market_analysis", res)
        self.assertEqual(res["best_overall_crop"].lower(), "rice")
        self.assertTrue(mock_hist.insert_one.called)

    @patch("app.routers.crop.find_user")
    @patch("app.routers.crop.crop_history_collection")
    def test_11_router_recommend_with_market_coffee_preserves_best_crop(self, mock_hist, mock_find_user):
        """recommend_with_market() for Coffee returns coffee as best_overall_crop."""
        mock_find_user.return_value = ({"_id": "0123456789abcdef01234567", "email": "farmer@example.com"}, "0123456789abcdef01234567")
        mock_hist.insert_one.return_value = MagicMock(inserted_id="hist12345678901234567890")

        data_in = UserCropInput(user_id="0123456789abcdef01234567", **self.inputs_coffee)
        res = recommend_with_market(data_in)

        self.assertEqual(res["best_overall_crop"].lower(), "coffee")
        # Ensure it was not replaced with orange or coconut
        self.assertNotEqual(res["best_overall_crop"].lower(), "orange")
        self.assertNotEqual(res["best_overall_crop"].lower(), "coconut")


if __name__ == "__main__":
    unittest.main()
