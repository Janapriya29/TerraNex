from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.routers import disease, crop, market, user
from app.config import UPLOAD_DIR


# =====================================
# CREATE FASTAPI APP
# =====================================

app = FastAPI(
    title="TerraNex API",
    description="AI-powered agriculture assistance system",
    version="1.0.0"
)


# =====================================
# CORS CONFIGURATION
# =====================================

import os

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::1]:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://TerraNex-frontend.onrender.com",
]

_cors_env = os.getenv("CORS_ORIGINS")
if _cors_env:
    cors_origins = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
else:
    cors_origins = DEFAULT_CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================
# UPLOAD DIRECTORY
# =====================================

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# =====================================
# SERVE UPLOADED FILES
# =====================================

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads"
)


# =====================================
# INCLUDE ROUTERS
# =====================================

app.include_router(user.router)

app.include_router(crop.router)

app.include_router(disease.router)

app.include_router(market.router)


# =====================================
# ROOT API
# =====================================

@app.get("/")
def root():

    return {
        "message": "Welcome to TerraNex API",
        "status": "running"
    }


# =====================================
# HEALTH CHECK
# =====================================

@app.get("/health")
def health_check():

    return {
        "status": "healthy"
    }