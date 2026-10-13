from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
try:
    from pydantic import EmailStr
    class _EmailCheck(BaseModel):
        e: EmailStr
except Exception:
    EmailStr = str

from datetime import datetime
import hashlib
import hmac
import re

from app.database import users_collection


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


# =====================================
# USER REGISTRATION INPUT
# =====================================

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


# =====================================
# USER LOGIN INPUT
# =====================================

class UserLogin(BaseModel):
    email: EmailStr
    password: str


# =====================================
# HELPER: FIND USER BY EMAIL
# =====================================

def find_user_by_email(email_str: str):
    norm_email = email_str.strip().lower()

    # 1. Exact match with normalized email
    user = users_collection.find_one({"email": norm_email})
    if user:
        return user

    # 2. Case-insensitive regex fallback for legacy records
    try:
        user = users_collection.find_one({
            "email": {"$regex": f"^{re.escape(norm_email)}$", "$options": "i"}
        })
        if user:
            return user
    except Exception:
        pass

    return None


# =====================================
# REGISTER USER
# =====================================

@router.post("/register")
def register_user(user: UserRegister):

    cleaned_name = user.name.strip()
    cleaned_email = user.email.strip().lower()

    if not cleaned_name:
        raise HTTPException(
            status_code=400,
            detail="Name cannot be empty."
        )

    if not user.password:
        raise HTTPException(
            status_code=400,
            detail="Password cannot be empty."
        )

    existing_user = find_user_by_email(cleaned_email)

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered."
        )

    hashed_password = hashlib.sha256(
        user.password.encode()
    ).hexdigest()

    new_user = {
        "name": cleaned_name,
        "email": cleaned_email,
        "password": hashed_password,
        "created_at": datetime.now()
    }

    result = users_collection.insert_one(new_user)

    return {
        "message": "User registered successfully!",
        "user_id": str(result.inserted_id),
        "name": cleaned_name,
        "email": cleaned_email
    }


# =====================================
# USER LOGIN
# =====================================

@router.post("/login")
def login_user(user: UserLogin):

    cleaned_email = user.email.strip().lower()

    if not cleaned_email or not user.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    existing_user = find_user_by_email(cleaned_email)

    if not existing_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    hashed_password = hashlib.sha256(
        user.password.encode()
    ).hexdigest()

    stored_hash = str(existing_user.get("password", ""))

    if not hmac.compare_digest(stored_hash, hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    return {
        "message": "Login successful!",
        "user_id": str(existing_user["_id"]),
        "name": existing_user["name"],
        "email": existing_user["email"]
    }