import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path
import numpy as np
from PIL import Image
import io

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.model_service import ModelService
import app.services.model_service as ms_module


def create_test_image(size=(224, 224), color=(100, 150, 80), noise=True):
    arr = np.full((size[1], size[0], 3), color, dtype=np.uint8)
    if noise:
        rng = np.random.RandomState(42)
        random_noise = rng.randint(-30, 30, size=arr.shape, dtype=np.int16)
        arr = np.clip(arr.astype(np.int16) + random_noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGB')


class TestTwoStageDecisionLogic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.service = ms_module.model_service

    def test_01_supported_tomato_early_blight_accepted(self):
        """Supported tomato leaf with clear early blight -> accepted, treatments enabled."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.95, 0.02, 0.02, 0.01]], dtype=np.float32)
        mock_stage2 = np.array([[0.05, 0.90, 0.03, 0.02, 0.0, 0.0, 0.0, 0.0]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1),              patch.object(self.service.disease_model, 'predict', return_value=mock_stage2):
            res = self.service.predict_disease(test_img)

        self.assertEqual(res['status'], 'accepted')
        self.assertEqual(res['plant_species'], 'Tomato')
        self.assertFalse(res['is_potato_screening'])
        self.assertFalse(res['requires_symptom_confirmation'])
        self.assertTrue(res['treatment_available'])
        self.assertFalse(res['is_uncertain'])
        self.assertEqual(res['prediction'], 'Tomato - Early blight')

    def test_02_supported_bell_pepper_bacterial_spot_accepted(self):
        """Supported bell pepper leaf with bacterial spot -> accepted, treatments enabled."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.02, 0.02, 0.94, 0.02]], dtype=np.float32)
        mock_stage2 = np.array([[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.92, 0.08]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1),              patch.object(self.service.disease_model, 'predict', return_value=mock_stage2):
            res = self.service.predict_disease(test_img)

        self.assertEqual(res['status'], 'accepted')
        self.assertEqual(res['plant_species'], 'Bell Pepper')
        self.assertFalse(res['is_potato_screening'])
        self.assertTrue(res['treatment_available'])
        self.assertEqual(res['prediction'], 'Pepper bell - Bacterial spot')

    def test_03_supported_bell_pepper_healthy_no_treatment(self):
        """Healthy bell pepper leaf -> accepted, but treatment_available is False."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.02, 0.02, 0.94, 0.02]], dtype=np.float32)
        mock_stage2 = np.array([[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.05, 0.95]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1),              patch.object(self.service.disease_model, 'predict', return_value=mock_stage2):
            res = self.service.predict_disease(test_img)

        self.assertEqual(res['status'], 'accepted')
        self.assertFalse(res['treatment_available'])
        self.assertEqual(res['prediction'], 'Pepper bell - healthy')

    def test_04_potato_screening_mode_blight_suppression(self):
        """Potato leaf classified as Late Blight -> potato_screening status, chemical guidance suppressed."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.02, 0.95, 0.02, 0.01]], dtype=np.float32)
        mock_stage2 = np.array([[0.0, 0.0, 0.0, 0.0, 0.05, 0.92, 0.0, 0.03]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1),              patch.object(self.service.disease_model, 'predict', return_value=mock_stage2):
            res = self.service.predict_disease(test_img)

        self.assertEqual(res['status'], 'potato_screening')
        self.assertEqual(res['plant_species'], 'Potato')
        self.assertTrue(res['is_potato_screening'])
        self.assertTrue(res['requires_symptom_confirmation'])
        self.assertFalse(res['treatment_available'])
        self.assertIn('Diagnostic Safety Notice', res['safety_warning'])
        self.assertIn('DO NOT apply fungicide treatments', res['safety_warning'])

    def test_05_healthy_potato_falsely_predicted_as_late_blight(self):
        """Healthy potato foliage falsely classified as late blight -> suppressed by potato safety rules."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.05, 0.90, 0.03, 0.02]], dtype=np.float32)
        mock_stage2 = np.array([[0.0, 0.0, 0.0, 0.0, 0.10, 0.88, 0.0, 0.02]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1),              patch.object(self.service.disease_model, 'predict', return_value=mock_stage2):
            res = self.service.predict_disease(test_img)

        self.assertEqual(res['status'], 'potato_screening')
        self.assertFalse(res['treatment_available'])
        self.assertTrue(res['requires_symptom_confirmation'])

    def test_06_potato_symptom_checklist_absent_negative_positive(self):
        """Potato symptom checklist variations: absent, False, and True all preserve treatment suppression."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.02, 0.95, 0.02, 0.01]], dtype=np.float32)
        mock_stage2 = np.array([[0.0, 0.0, 0.0, 0.0, 0.85, 0.10, 0.0, 0.05]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1),              patch.object(self.service.disease_model, 'predict', return_value=mock_stage2):
            res_absent = self.service.predict_disease(test_img)
            self.assertFalse(res_absent['symptoms_confirmed'])
            self.assertFalse(res_absent['treatment_available'])

            res_neg = self.service.predict_disease(test_img, confirmed_symptoms=False)
            self.assertFalse(res_neg['symptoms_confirmed'])
            self.assertFalse(res_neg['treatment_available'])

            res_pos = self.service.predict_disease(test_img, confirmed_symptoms=True)
            self.assertTrue(res_pos['symptoms_confirmed'])
            self.assertFalse(res_pos['treatment_available'])

    def test_07_unsupported_species_rejection(self):
        """Unsupported plant foliage -> rejected, Stage 2 not called."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.05, 0.05, 0.05, 0.85]], dtype=np.float32)

        stage2_called = False
        def fake_stage2_predict(*args, **kwargs):
            nonlocal stage2_called
            stage2_called = True
            return np.zeros((1, 8), dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1),              patch.object(self.service.disease_model, 'predict', side_effect=fake_stage2_predict):
            res = self.service.predict_disease(test_img)

        self.assertEqual(res['status'], 'rejected_unsupported_species')
        self.assertEqual(res['plant_species'], 'Unsupported / Other')
        self.assertFalse(res['treatment_available'])
        self.assertFalse(stage2_called, 'Stage 2 pathology model must not be called when Stage 1 rejects.')

    def test_08_unsupported_probability_threshold_priority(self):
        """Top-1 is Tomato with 0.70, but Unsupported has 0.22 (>= tau_other=0.20) -> Priority rejection."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.70, 0.04, 0.04, 0.22]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1),              patch.object(self.service.disease_model, 'predict') as mock_stage2:
            res = self.service.predict_disease(test_img)
            mock_stage2.assert_not_called()

        self.assertEqual(res['status'], 'rejected_unsupported_species')
        self.assertFalse(res['treatment_available'])
        self.assertEqual(res['confidence'], 22.0)

    def test_09_low_confidence_abstention(self):
        """Supported top-1 confidence below tau_species (0.60) -> abstained_uncertain_species."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.55, 0.05, 0.35, 0.05]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1),              patch.object(self.service.disease_model, 'predict') as mock_stage2:
            res = self.service.predict_disease(test_img)
            mock_stage2.assert_not_called()

        self.assertEqual(res['status'], 'abstained_uncertain_species')
        self.assertTrue(res['is_uncertain'])
        self.assertFalse(res['treatment_available'])
        self.assertEqual(res['plant_species'], 'Tomato')

    def test_10_insufficient_margin_abstention(self):
        """Margin between Top-1 and Top-2 is < delta_margin (0.10) -> abstained_uncertain_species."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.61, 0.0, 0.55, 0.0]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1):
            res = self.service.predict_disease(test_img)

        self.assertEqual(res['status'], 'abstained_uncertain_species')
        self.assertTrue(res['is_uncertain'])
        self.assertFalse(res['treatment_available'])

    def test_11_cross_stage_genus_disagreement(self):
        """Stage 1 identifies Tomato, but Stage 2 diagnoses Bell Pepper -> cross_stage_discrepancy."""
        test_img = create_test_image()
        mock_stage1 = np.array([[0.92, 0.03, 0.03, 0.02]], dtype=np.float32)
        mock_stage2 = np.array([[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.95, 0.05]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1),              patch.object(self.service.disease_model, 'predict', return_value=mock_stage2):
            res = self.service.predict_disease(test_img)

        self.assertEqual(res['status'], 'cross_stage_discrepancy')
        self.assertTrue(res['is_uncertain'])
        self.assertFalse(res['treatment_available'])
        self.assertIn('Discrepancy (Tomato vs Bell Pepper)', res['prediction'])
        self.assertIn('Contradiction detected', res['safety_warning'])

    def test_12_non_finite_probability_vectors(self):
        """Non-finite probability outputs from Stage 1 -> safe abstention, no crash."""
        test_img = create_test_image()
        mock_stage1 = np.array([[np.nan, 0.2, 0.2, 0.2]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=mock_stage1):
            res = self.service.predict_disease(test_img)

        self.assertEqual(res['status'], 'abstained_uncertain_species')
        self.assertEqual(res['confidence_level'], 'uncertain')
        self.assertFalse(res['treatment_available'])

    def test_13_non_finite_input_pixels(self):
        """Non-finite pixel inputs -> ValueError raised immediately."""
        img = Image.new('RGB', (224, 224))
        with patch('numpy.array', return_value=np.full((224, 224, 3), np.nan, dtype=np.float32)):
            with self.assertRaises(ValueError):
                self.service.predict_disease(img)


class TestStage1LifecycleAndFailures(unittest.TestCase):
    def test_14_stage1_disabled_feature_flag(self):
        """When ENABLE_STAGE1_SPECIES is false, system operates with status model_unavailable and suppressed treatment."""
        service = ms_module.ModelService.__new__(ms_module.ModelService)
        service.disease_model = ms_module.model_service.disease_model
        service.disease_classes = ms_module.model_service.disease_classes
        service.stage2_genus_map = ms_module.model_service.stage2_genus_map
        service.species_model = None
        service.species_mapping = {0: 'Tomato', 1: 'Potato', 2: 'Bell Pepper', 3: 'Unsupported'}
        service.stage1_status = 'disabled'

        test_img = create_test_image()
        mock_stage2 = np.array([[0.05, 0.90, 0.03, 0.02, 0.0, 0.0, 0.0, 0.0]], dtype=np.float32)

        with patch.object(service.disease_model, 'predict', return_value=mock_stage2):
            res = service.predict_disease(test_img)

        self.assertEqual(res['status'], 'model_unavailable')
        self.assertFalse(res['treatment_available'])
        self.assertIn('Gatekeeper is unavailable', res['safety_warning'])

    def test_15_stage1_missing_model_file_fallback(self):
        """When Stage 1 model file is missing on startup, fallback to model_unavailable mode."""
        with patch.dict(os.environ, {'ENABLE_STAGE1_SPECIES': 'true'}):
            with patch('app.services.model_service.SPECIES_MODEL_PATH', Path('models/non_existent_model.keras')):
                service = ms_module.ModelService.__new__(ms_module.ModelService)
                service.disease_model = ms_module.model_service.disease_model
                service.disease_classes = ms_module.model_service.disease_classes
                service.stage2_genus_map = ms_module.model_service.stage2_genus_map
                service.species_model = None
                service.enable_stage1 = True
                service.tau_species = 0.60
                service.tau_other = 0.20
                service.delta_margin = 0.10
                service.species_mapping = {0: 'Tomato', 1: 'Potato', 2: 'Bell Pepper', 3: 'Unsupported'}

                try:
                    service._load_and_verify_stage1()
                except Exception as e:
                    service.stage1_status = f'failed_to_load: {str(e)}'

                self.assertTrue(service.stage1_status.startswith('failed_to_load'))
                self.assertIsNone(service.species_model)

                test_img = create_test_image()
                mock_stage2 = np.array([[0.0, 0.0, 0.0, 0.0, 0.1, 0.85, 0.0, 0.05]], dtype=np.float32)
                with patch.object(service.disease_model, 'predict', return_value=mock_stage2):
                    res = service.predict_disease(test_img)

                self.assertEqual(res['status'], 'model_unavailable')
                self.assertTrue(res['is_potato_screening'])
                self.assertTrue(res['requires_symptom_confirmation'])
                self.assertFalse(res['treatment_available'])

    def test_16_stage1_checksum_mismatch(self):
        """When checksum does not match metadata, load raises ValueError."""
        service = ms_module.ModelService.__new__(ms_module.ModelService)
        with patch('app.services.model_service.SPECIES_MODEL_PATH') as mock_path,              patch('app.services.model_service.SPECIES_META_PATH') as mock_meta,              patch('builtins.open', unittest.mock.mock_open(read_data='{"model_sha256": "wrong_hash_12345"}')),              patch.object(service, '_compute_sha256', return_value='actual_hash_67890'):
            mock_path.exists.return_value = True
            mock_meta.exists.return_value = True
            with self.assertRaises(ValueError) as ctx:
                service._load_and_verify_stage1()
            self.assertIn('Checksum mismatch', str(ctx.exception))


class TestDiseaseRouterIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app.routers.disease import predict_disease, get_disease_history, ObjectId
        from app.database import users_collection, disease_history_collection
        cls.predict_disease = staticmethod(predict_disease)
        cls.get_disease_history = staticmethod(get_disease_history)
        cls.users_col = users_collection
        cls.history_col = disease_history_collection
        cls.test_user_id = str(ObjectId())

        cls.users_col.insert_one({'_id': ObjectId(cls.test_user_id), 'name': 'Test Farmer'})

    def test_17_router_corrupt_and_invalid_uploads(self):
        """FastAPI router rejects corrupt, too-small, or invalid image uploads with HTTP 400."""
        import asyncio
        from fastapi import HTTPException, UploadFile

        small_file = UploadFile(filename='leaf.jpg', file=io.BytesIO(b'short'), headers={'content-type': 'image/jpeg'})
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(self.predict_disease(user_id=self.test_user_id, file=small_file))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn('empty or too small', ctx.exception.detail)

        garbage_file = UploadFile(filename='leaf.jpg', file=io.BytesIO(b'X' * 500), headers={'content-type': 'image/jpeg'})
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(self.predict_disease(user_id=self.test_user_id, file=garbage_file))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn('could not be decoded', ctx.exception.detail)

        tiny_img = Image.new('RGB', (32, 32), color=(100, 150, 80))
        tiny_buf = io.BytesIO()
        tiny_img.save(tiny_buf, format='JPEG')
        tiny_buf.seek(0)
        tiny_file = UploadFile(filename='tiny.jpg', file=tiny_buf, headers={'content-type': 'image/jpeg'})
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(self.predict_disease(user_id=self.test_user_id, file=tiny_file))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn('resolution is too low', ctx.exception.detail)

        blank_img = Image.new('RGB', (100, 100), color=(128, 128, 128))
        blank_buf = io.BytesIO()
        blank_img.save(blank_buf, format='JPEG')
        blank_buf.seek(0)
        blank_file = UploadFile(filename='blank.jpg', file=blank_buf, headers={'content-type': 'image/jpeg'})
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(self.predict_disease(user_id=self.test_user_id, file=blank_file))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn('blank, uniform', ctx.exception.detail)

    def test_18_router_end_to_end_payload_and_history_persistence(self):
        """Router saves new two-stage safety fields and returns them in response."""
        import asyncio
        from fastapi import UploadFile

        test_img = create_test_image()
        buf = io.BytesIO()
        test_img.save(buf, format='JPEG')
        buf.seek(0)
        file_obj = UploadFile(filename='test_potato.jpg', file=buf, headers={'content-type': 'image/jpeg'})

        mock_stage1 = np.array([[0.02, 0.95, 0.02, 0.01]], dtype=np.float32)
        mock_stage2 = np.array([[0.0, 0.0, 0.0, 0.0, 0.05, 0.90, 0.0, 0.05]], dtype=np.float32)

        with patch.object(ms_module.model_service.species_model, 'predict', return_value=mock_stage1),              patch.object(ms_module.model_service.disease_model, 'predict', return_value=mock_stage2):
            res = asyncio.run(self.predict_disease(
                user_id=self.test_user_id,
                file=file_obj,
                confirmed_symptoms=True
            ))

        self.assertEqual(res['status'], 'potato_screening')
        self.assertEqual(res['plant_species'], 'Potato')
        self.assertTrue(res['is_potato_screening'])
        self.assertTrue(res['requires_symptom_confirmation'])
        self.assertTrue(res['symptoms_confirmed'])
        self.assertFalse(res['treatment_available'])
        self.assertIn('history_id', res)

        hist_res = self.get_disease_history(self.test_user_id)
        self.assertGreaterEqual(hist_res['total_predictions'], 1)
        latest_item = hist_res['history'][0]
        self.assertEqual(latest_item['status'], 'potato_screening')
        self.assertFalse(latest_item['treatment_available'])

    def test_19_leak_prevention_across_legacy_history_records(self):
        """Legacy history records without safety tags never default to treatment_available=True for potato."""
        from app.routers.disease import ObjectId
        legacy_doc = {
            'user_id': ObjectId(self.test_user_id),
            'prediction': 'Potato - Late blight',
            'confidence': 94.5,
            'is_uncertain': False
        }
        self.history_col.insert_one(legacy_doc)

        hist_res = self.get_disease_history(self.test_user_id)
        for item in hist_res['history']:
            if 'potato' in str(item.get('prediction', '')).lower():
                self.assertFalse(item['treatment_available'], 'Potato record in history must not enable treatment!')


class TestRealModelSmoke(unittest.TestCase):
    def test_20_live_model_smoke_test(self):
        """Lightweight smoke test running actual trained models without mocks."""
        test_img = create_test_image()
        res = ms_module.model_service.predict_disease(test_img)

        expected_keys = [
            'status', 'prediction', 'confidence', 'confidence_level', 'is_uncertain',
            'plant_species', 'species_confidence', 'is_potato_screening',
            'requires_symptom_confirmation', 'symptoms_confirmed', 'treatment_available',
            'safety_warning', 'reliability_note', 'supported_crops', 'disclaimer'
        ]
        for key in expected_keys:
            self.assertIn(key, res, f'Missing expected schema key: {key}')

        valid_statuses = [
            'accepted', 'rejected_unsupported_species', 'abstained_uncertain_species',
            'cross_stage_discrepancy', 'potato_screening', 'model_unavailable'
        ]
        self.assertIn(res['status'], valid_statuses)

        if res['is_potato_screening']:
            self.assertFalse(res['treatment_available'])


if __name__ == '__main__':
    unittest.main()
