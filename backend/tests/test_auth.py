import sys
import unittest
import hashlib
import uuid
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import HTTPException
from app.database import users_collection, MockCollection
from app.routers.user import (
    register_user,
    login_user,
    find_user_by_email,
    UserRegister,
    UserLogin
)
from app.routers.crop import find_user


class TestMockCollectionFidelity(unittest.TestCase):
    """Verify that MockCollection filters behave consistently with database expectations."""

    def setUp(self):
        self.mock_coll = MockCollection("test_users")
        self.mock_coll.insert_one({
            "name": "Jane Farmer",
            "email": "jane@example.com",
            "password": hashlib.sha256("Secret123!".encode()).hexdigest()
        })
        self.mock_coll.insert_one({
            "name": "John Agronomist",
            "email": "john@example.com",
            "password": hashlib.sha256("OtherPass456!".encode()).hexdigest()
        })

    def test_mock_find_one_exact_email(self):
        doc = self.mock_coll.find_one({"email": "jane@example.com"})
        self.assertIsNotNone(doc)
        self.assertEqual(doc["name"], "Jane Farmer")

    def test_mock_find_one_case_insensitive_email(self):
        doc = self.mock_coll.find_one({"email": "JANE@EXAMPLE.COM"})
        self.assertIsNotNone(doc)
        self.assertEqual(doc["name"], "Jane Farmer")

    def test_mock_find_one_missing_email_returns_none(self):
        doc = self.mock_coll.find_one({"email": "missing@example.com"})
        self.assertIsNone(doc)

    def test_mock_find_one_by_id(self):
        first_doc = self.mock_coll.find_one({"email": "jane@example.com"})
        doc_id = first_doc["_id"]
        found = self.mock_coll.find_one({"_id": doc_id})
        self.assertIsNotNone(found)
        self.assertEqual(found["email"], "jane@example.com")

    def test_mock_find_filter_multiple(self):
        matches = list(self.mock_coll.find({"email": "john@example.com"}))
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["name"], "John Agronomist")


class TestAuthenticationEndpoints(unittest.TestCase):
    """Test user registration and login endpoint functions directly."""

    def setUp(self):
        self.uid = uuid.uuid4().hex[:8]
        self.valid_email = f"user_{self.uid}@example.com"
        self.valid_password = "StrongPassword987!"
        self.valid_name = f"Farmer {self.uid}"

    def test_01_successful_registration(self):
        data = register_user(UserRegister(
            name=self.valid_name,
            email=self.valid_email,
            password=self.valid_password
        ))
        self.assertEqual(data["email"], self.valid_email.lower())
        self.assertEqual(data["name"], self.valid_name)
        self.assertIn("user_id", data)

    def test_02_duplicate_email_registration_rejected(self):
        register_user(UserRegister(
            name=self.valid_name,
            email=self.valid_email,
            password=self.valid_password
        ))
        with self.assertRaises(HTTPException) as ctx:
            register_user(UserRegister(
                name="Different Name",
                email=self.valid_email,
                password="DifferentPassword!"
            ))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already registered", ctx.exception.detail.lower())

    def test_03_duplicate_case_insensitive_registration_rejected(self):
        register_user(UserRegister(
            name=self.valid_name,
            email=self.valid_email,
            password=self.valid_password
        ))
        with self.assertRaises(HTTPException) as ctx:
            register_user(UserRegister(
                name="Different Name",
                email=self.valid_email.upper(),
                password="DifferentPassword!"
            ))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already registered", ctx.exception.detail.lower())

    def test_04_successful_login(self):
        register_user(UserRegister(
            name=self.valid_name,
            email=self.valid_email,
            password=self.valid_password
        ))
        data = login_user(UserLogin(
            email=self.valid_email,
            password=self.valid_password
        ))
        self.assertEqual(data["email"], self.valid_email.lower())
        self.assertEqual(data["name"], self.valid_name)
        self.assertIn("user_id", data)

    def test_05_login_with_uppercase_and_whitespace_email(self):
        register_user(UserRegister(
            name=self.valid_name,
            email=self.valid_email,
            password=self.valid_password
        ))
        data = login_user(UserLogin(
            email=f"  {self.valid_email.upper()}  ",
            password=self.valid_password
        ))
        self.assertEqual(data["email"], self.valid_email.lower())

    def test_06_login_invalid_password(self):
        register_user(UserRegister(
            name=self.valid_name,
            email=self.valid_email,
            password=self.valid_password
        ))
        with self.assertRaises(HTTPException) as ctx:
            login_user(UserLogin(
                email=self.valid_email,
                password="IncorrectPassword!"
            ))
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail, "Invalid email or password.")

    def test_07_login_non_existent_email(self):
        ghost_email = f"ghost_{uuid.uuid4().hex[:12]}@example.com"
        with self.assertRaises(HTTPException) as ctx:
            login_user(UserLogin(
                email=ghost_email,
                password="AnyPassword123!"
            ))
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail, "Invalid email or password.")

    def test_08_empty_fields_validation(self):
        with self.assertRaises(HTTPException) as ctx:
            register_user(UserRegister(
                name="   ",
                email=f"empty_name_{self.uid}@example.com",
                password="ValidPassword123!"
            ))
        self.assertEqual(ctx.exception.status_code, 400)

        with self.assertRaises(HTTPException) as ctx:
            register_user(UserRegister(
                name="Valid Name",
                email=f"empty_pw_{self.uid}@example.com",
                password=""
            ))
        self.assertEqual(ctx.exception.status_code, 400)


class TestCropUserLookupCompatibility(unittest.TestCase):
    """Verify crop router find_user helper resolves normalized email addresses."""

    def test_find_user_by_normalized_email(self):
        uid = uuid.uuid4().hex[:8]
        test_email = f"croptest_{uid}@example.com"
        users_collection.insert_one({
            "name": f"Crop Farmer {uid}",
            "email": test_email,
            "password": hashlib.sha256("Pass123!".encode()).hexdigest()
        })

        # Exact email
        user, obj_id = find_user(test_email)
        self.assertIsNotNone(user)
        self.assertIsNotNone(obj_id)

        # Uppercase email
        user_up, obj_id_up = find_user(test_email.upper())
        self.assertIsNotNone(user_up)
        self.assertEqual(str(obj_id), str(obj_id_up))


if __name__ == "__main__":
    unittest.main()
