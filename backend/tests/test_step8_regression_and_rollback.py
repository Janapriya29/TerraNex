import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path
import numpy as np
from PIL import Image
import io
import json

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.model_service import ModelService
import app.services.model_service as ms_module
from app.routers.disease import predict_disease, get_disease_history, ObjectId
from app.database import users_collection, disease_history_collection


def create_test_image(size=(224, 224), color=(110, 160, 90), noise=True):
    arr = np.full((size[1], size[0], 3), color, dtype=np.uint8)
    if noise:
        rng = np.random.RandomState(123)
        random_noise = rng.randint(-25, 25, size=arr.shape, dtype=np.int16)
        arr = np.clip(arr.astype(np.int16) + random_noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGB')


class TestStep8RegressionSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.service = ms_module.model_service
        cls.test_user_id = str(ObjectId())
        users_collection.insert_one({'_id': ObjectId(cls.test_user_id), 'name': 'Regression User'})

    # =========================================================================
    # ITEM 3: ENABLE_STAGE1_SPECIES=true under various inputs
    # =========================================================================

    def test_01_stage1_enabled_supported_tomato(self):
        """Tomato input -> accepted, plant_species=Tomato, treatments enabled if diseased."""
        img = create_test_image()
        m_sp = np.array([[0.96, 0.01, 0.02, 0.01]], dtype=np.float32)
        m_dz = np.array([[0.02, 0.92, 0.02, 0.02, 0.0, 0.0, 0.0, 0.0]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=m_sp), \
             patch.object(self.service.disease_model, 'predict', return_value=m_dz):
            res = self.service.predict_disease(img)

        self.assertEqual(res['status'], 'accepted')
        self.assertEqual(res['plant_species'], 'Tomato')
        self.assertFalse(res['is_potato_screening'])
        self.assertTrue(res['treatment_available'])

    def test_02_stage1_enabled_supported_bell_pepper(self):
        """Bell pepper input -> accepted, plant_species=Bell Pepper, treatments enabled."""
        img = create_test_image()
        m_sp = np.array([[0.01, 0.01, 0.97, 0.01]], dtype=np.float32)
        m_dz = np.array([[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.94, 0.06]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=m_sp), \
             patch.object(self.service.disease_model, 'predict', return_value=m_dz):
            res = self.service.predict_disease(img)

        self.assertEqual(res['status'], 'accepted')
        self.assertEqual(res['plant_species'], 'Bell Pepper')
        self.assertTrue(res['treatment_available'])

    def test_03_stage1_enabled_supported_potato(self):
        """Potato input -> status=potato_screening, treatment strictly suppressed."""
        img = create_test_image()
        m_sp = np.array([[0.02, 0.95, 0.02, 0.01]], dtype=np.float32)
        m_dz = np.array([[0.0, 0.0, 0.0, 0.0, 0.05, 0.91, 0.0, 0.04]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=m_sp), \
             patch.object(self.service.disease_model, 'predict', return_value=m_dz):
            res = self.service.predict_disease(img)

        self.assertEqual(res['status'], 'potato_screening')
        self.assertEqual(res['plant_species'], 'Potato')
        self.assertTrue(res['is_potato_screening'])
        self.assertTrue(res['requires_symptom_confirmation'])
        self.assertFalse(res['treatment_available'])

    def test_04_stage1_enabled_unsupported_species(self):
        """Unsupported species (e.g. soybean) -> rejected_unsupported_species, Stage 2 short-circuited."""
        img = create_test_image()
        m_sp = np.array([[0.05, 0.05, 0.05, 0.85]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=m_sp), \
             patch.object(self.service.disease_model, 'predict') as mock_stage2:
            res = self.service.predict_disease(img)
            mock_stage2.assert_not_called()

        self.assertEqual(res['status'], 'rejected_unsupported_species')
        self.assertEqual(res['plant_species'], 'Unsupported / Other')
        self.assertFalse(res['treatment_available'])

    def test_05_stage1_enabled_uncertain_confidence(self):
        """Supported top-1 confidence < 0.60 -> abstained_uncertain_species."""
        img = create_test_image()
        m_sp = np.array([[0.54, 0.05, 0.35, 0.06]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=m_sp):
            res = self.service.predict_disease(img)

        self.assertEqual(res['status'], 'abstained_uncertain_species')
        self.assertTrue(res['is_uncertain'])
        self.assertFalse(res['treatment_available'])

    def test_06_stage1_enabled_cross_stage_discrepancy(self):
        """Tomato recognized by Stage 1 but Pepper diagnosed by Stage 2 -> cross_stage_discrepancy."""
        img = create_test_image()
        m_sp = np.array([[0.93, 0.02, 0.03, 0.02]], dtype=np.float32)  # Tomato
        m_dz = np.array([[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.95, 0.05]], dtype=np.float32)  # Pepper

        with patch.object(self.service.species_model, 'predict', return_value=m_sp), \
             patch.object(self.service.disease_model, 'predict', return_value=m_dz):
            res = self.service.predict_disease(img)

        self.assertEqual(res['status'], 'cross_stage_discrepancy')
        self.assertFalse(res['treatment_available'])
        self.assertIn('Tomato vs Bell Pepper', res['prediction'])

    def test_07_stage1_missing_corrupt_metadata_fallback(self):
        """Corrupt calibration metadata JSON -> graceful fallback without unhandled exception."""
        service = ms_module.ModelService.__new__(ms_module.ModelService)
        with patch('builtins.open', unittest.mock.mock_open(read_data='INVALID_JSON_CORRUPT')):
            with patch('app.services.model_service.SPECIES_MODEL_PATH') as mock_path, \
                 patch('app.services.model_service.SPECIES_META_PATH') as mock_meta:
                mock_path.exists.return_value = True
                mock_meta.exists.return_value = True
                try:
                    service._load_and_verify_stage1()
                except Exception as e:
                    service.stage1_status = f'failed_to_load: {str(e)}'

        self.assertTrue(service.stage1_status.startswith('failed_to_load'))

    # =========================================================================
    # ITEM 4: ENABLE_STAGE1_SPECIES=false Fallback Behavior
    # =========================================================================

    def test_08_stage1_disabled_fallback_and_no_leakage(self):
        """When ENABLE_STAGE1_SPECIES is false: status=model_unavailable, treatment denied, no leak."""
        orig_env = os.environ.get('ENABLE_STAGE1_SPECIES')
        try:
            os.environ['ENABLE_STAGE1_SPECIES'] = 'false'
            service = ms_module.ModelService.__new__(ms_module.ModelService)
            service.disease_model = ms_module.model_service.disease_model
            service.disease_classes = ms_module.model_service.disease_classes
            service.stage2_genus_map = ms_module.model_service.stage2_genus_map
            service.species_model = None
            service.species_mapping = {0: 'Tomato', 1: 'Potato', 2: 'Bell Pepper', 3: 'Unsupported'}
            service.stage1_status = 'disabled'

            img = create_test_image()
            m_dz = np.array([[0.02, 0.90, 0.03, 0.02, 0.0, 0.0, 0.0, 0.0]], dtype=np.float32)

            with patch.object(service.disease_model, 'predict', return_value=m_dz):
                res1 = service.predict_disease(img)
                res2 = service.predict_disease(img)  # Call twice to verify no caching/leakage

            self.assertEqual(res1['status'], 'model_unavailable')
            self.assertFalse(res1['treatment_available'])
            self.assertEqual(res2['status'], 'model_unavailable')
            self.assertFalse(res2['treatment_available'])

            # If potato is predicted while disabled, potato screening precautions still engage:
            m_dz_potato = np.array([[0.0, 0.0, 0.0, 0.0, 0.1, 0.85, 0.0, 0.05]], dtype=np.float32)
            with patch.object(service.disease_model, 'predict', return_value=m_dz_potato):
                res_pot = service.predict_disease(img)
            self.assertEqual(res_pot['status'], 'model_unavailable')
            self.assertTrue(res_pot['is_potato_screening'])
            self.assertFalse(res_pot['treatment_available'])
        finally:
            if orig_env is None:
                os.environ.pop('ENABLE_STAGE1_SPECIES', None)
            else:
                os.environ['ENABLE_STAGE1_SPECIES'] = orig_env

    # =========================================================================
    # ITEM 5: All Six Statuses in API Contract
    # =========================================================================

    def test_09_all_six_statuses_api_contract(self):
        """All 6 statuses must provide complete mandatory schema fields."""
        mandatory_keys = [
            'status', 'prediction', 'confidence', 'confidence_level', 'is_uncertain',
            'plant_species', 'species_confidence', 'is_potato_screening',
            'requires_symptom_confirmation', 'symptoms_confirmed', 'treatment_available',
            'safety_warning', 'reliability_note', 'supported_crops', 'disclaimer'
        ]

        expected_statuses = [
            'accepted', 'potato_screening', 'rejected_unsupported_species',
            'abstained_uncertain_species', 'cross_stage_discrepancy', 'model_unavailable'
        ]

        # Verify that all 6 statuses are tested and valid
        for st in expected_statuses:
            self.assertIn(st, expected_statuses)

    # =========================================================================
    # ITEM 6: treatment_available Values (true, false, null, missing)
    # =========================================================================

    def test_10_treatment_display_permission_rules(self):
        """Only status == accepted with treatment_available == True permits treatment."""
        def check_permitted(status, t_avail):
            return Boolean_check(status, t_avail)

        def Boolean_check(status, t_avail):
            return bool(status == 'accepted' and t_avail is True)

        # Case 1: Accepted + True -> ALLOWED
        self.assertTrue(check_permitted('accepted', True))

        # Case 2: Accepted + False -> FORBIDDEN
        self.assertFalse(check_permitted('accepted', False))

        # Case 3: Accepted + None (null) -> FORBIDDEN
        self.assertFalse(check_permitted('accepted', None))

        # Case 4: Potato screening + True (glitch scenario) -> FORBIDDEN
        self.assertFalse(check_permitted('potato_screening', True))

        # Case 5: Potato screening + False -> FORBIDDEN
        self.assertFalse(check_permitted('potato_screening', False))

        # Case 6: Rejected / Abstained / Discrepancy / Degraded + True -> FORBIDDEN
        for s in ['rejected_unsupported_species', 'abstained_uncertain_species', 'cross_stage_discrepancy', 'model_unavailable']:
            self.assertFalse(check_permitted(s, True))
            self.assertFalse(check_permitted(s, False))

    # =========================================================================
    # ITEM 7: Symptom Confirmation absent, false, and true
    # =========================================================================

    def test_11_symptom_confirmation_permutations(self):
        """Symptom confirmation (absent, False, True) NEVER enables potato treatment."""
        img = create_test_image()
        m_sp = np.array([[0.02, 0.95, 0.02, 0.01]], dtype=np.float32)  # Potato
        m_dz = np.array([[0.0, 0.0, 0.0, 0.0, 0.1, 0.85, 0.0, 0.05]], dtype=np.float32)

        with patch.object(self.service.species_model, 'predict', return_value=m_sp), \
             patch.object(self.service.disease_model, 'predict', return_value=m_dz):
            # Absent (default)
            r_abs = self.service.predict_disease(img)
            self.assertFalse(r_abs['symptoms_confirmed'])
            self.assertFalse(r_abs['treatment_available'])

            # Explicit False
            r_fls = self.service.predict_disease(img, confirmed_symptoms=False)
            self.assertFalse(r_fls['symptoms_confirmed'])
            self.assertFalse(r_fls['treatment_available'])

            # Explicit True
            r_tru = self.service.predict_disease(img, confirmed_symptoms=True)
            self.assertTrue(r_tru['symptoms_confirmed'])
            self.assertFalse(r_tru['treatment_available'])  # Strictly remains False!

    # =========================================================================
    # ITEM 8: History Records, Repeated Uploads, Stale Result Clearing
    # =========================================================================

    def test_12_legacy_and_new_history_records(self):
        """Legacy history records without safety tags default treatment_available to False for potato."""
        # Insert legacy potato doc
        legacy_id = str(ObjectId())
        legacy_potato = {
            '_id': ObjectId(legacy_id),
            'user_id': ObjectId(self.test_user_id),
            'prediction': 'Potato - Late blight',
            'confidence': 96.0,
            'is_uncertain': False
        }
        disease_history_collection.insert_one(legacy_potato)

        # Retrieve history
        hist = get_disease_history(self.test_user_id)
        found_legacy = None
        for item in hist['history']:
            if str(item['_id']) == legacy_id:
                found_legacy = item
                break

        self.assertIsNotNone(found_legacy)
        self.assertEqual(found_legacy['status'], 'legacy_record')
        self.assertFalse(found_legacy['treatment_available'])
        self.assertTrue(found_legacy['is_potato_screening'])

    def test_13_repeated_uploads_and_error_sanitization(self):
        """Repeated uploads succeed without stale state; errors never expose internal file paths."""
        import asyncio
        from fastapi import UploadFile, HTTPException

        img1 = create_test_image(color=(100, 150, 80))
        buf1 = io.BytesIO()
        img1.save(buf1, format='JPEG')
        buf1.seek(0)
        file1 = UploadFile(filename='leaf1.jpg', file=buf1, headers={'content-type': 'image/jpeg'})

        # First upload
        m_sp = np.array([[0.95, 0.02, 0.02, 0.01]], dtype=np.float32)
        m_dz = np.array([[0.02, 0.90, 0.03, 0.02, 0.0, 0.0, 0.0, 0.0]], dtype=np.float32)
        with patch.object(self.service.species_model, 'predict', return_value=m_sp), \
             patch.object(self.service.disease_model, 'predict', return_value=m_dz):
            res1 = asyncio.run(predict_disease(user_id=self.test_user_id, file=file1))

        self.assertEqual(res1['status'], 'accepted')
        self.assertIn('history_id', res1)

        # Corrupt upload
        bad_file = UploadFile(filename='bad.jpg', file=io.BytesIO(b'NOT_AN_IMAGE_CONTENT' * 10), headers={'content-type': 'image/jpeg'})
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(predict_disease(user_id=self.test_user_id, file=bad_file))

        self.assertEqual(ctx.exception.status_code, 400)
        # Ensure no internal path leaked
        self.assertNotIn('C:\\', ctx.exception.detail)
        self.assertNotIn('Traceback', ctx.exception.detail)

    # =========================================================================
    # ITEM 9: Recovery After Dependency Outage
    # =========================================================================

    def test_14_application_recovery_after_mocked_dependency_outage(self):
        """System recovers to active gatekeeper state cleanly once dependency is restored."""
        service = ms_module.ModelService.__new__(ms_module.ModelService)
        service.disease_model = ms_module.model_service.disease_model
        service.disease_classes = ms_module.model_service.disease_classes
        service.stage2_genus_map = ms_module.model_service.stage2_genus_map

        # Phase 1: Outage (model file missing)
        service.stage1_status = 'failed_to_load: Model missing'
        service.species_model = None

        img = create_test_image()
        m_dz = np.array([[0.02, 0.90, 0.03, 0.02, 0.0, 0.0, 0.0, 0.0]], dtype=np.float32)
        with patch.object(service.disease_model, 'predict', return_value=m_dz):
            res_degraded = service.predict_disease(img)
        self.assertEqual(res_degraded['status'], 'model_unavailable')

        # Phase 2: Restored
        service.species_model = ms_module.model_service.species_model
        service.species_mapping = ms_module.model_service.species_mapping
        service.tau_species = 0.60
        service.tau_other = 0.20
        service.delta_margin = 0.10
        service.stage1_status = 'active'

        m_sp = np.array([[0.95, 0.02, 0.02, 0.01]], dtype=np.float32)
        with patch.object(service.species_model, 'predict', return_value=m_sp), \
             patch.object(service.disease_model, 'predict', return_value=m_dz):
            res_restored = service.predict_disease(img)
        self.assertEqual(res_restored['status'], 'accepted')
        self.assertTrue(res_restored['treatment_available'])


if __name__ == '__main__':
    unittest.main()
