"""
FreshSight — Configuration
=========================
Loads environment variables and defines paths/constants used across the backend.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# ── Load .env ─────────────────────────────────────────────────────────────────
_ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

# ── MongoDB ───────────────────────────────────────────────────────────────────
MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME: str = os.getenv("DB_NAME", "fridgeiq")

# ── Gemini (recipe generation) ────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# ── API / security ────────────────────────────────────────────────────────────
# Comma-separated list of allowed browser origins (the Vite dev server by default).
CORS_ORIGINS: list = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
    if o.strip()
]
MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "10"))
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}

# ── AI Model Paths ────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
MODELS_DIR = PROJECT_ROOT / "backend" / "models"
DETECTOR_PATH = MODELS_DIR / "fruit_detector.pt"
CLASSIFIER_PATH = MODELS_DIR / "freshness_classifier.pt"

# ── Detection Constants ───────────────────────────────────────────────────────
# Minimum YOLO confidence for a box to be counted (tune via .env).
DETECTION_CONF: float = float(os.getenv("DETECTION_CONF", "0.46"))

# Must match the data.yaml order used when training the YOLO detector.
YOLO_NAMES = ["apple", "banana", "orange"]

FRESHNESS_CLASSES = [
    "freshapples",
    "freshbanana",
    "freshoranges",
    "rottenapples",
    "rottenbanana",
    "rottenoranges",
]

# Only these fruits go through the freshness classifier; the rest are counted
# as-is (assumed fresh since there is no trained model for them).
CLASSIFIABLE_FRUITS = ["apple", "banana", "orange"]

# ── Default Inventory Expectations ────────────────────────────────────────────
DEFAULT_ITEMS = {
    "apple": 5,
    "banana": 4,
    "orange": 4,
}

# ── Shelf-life lookup (for informational display) ─────────────────────────────
SHELF_LIFE = {
    "freshapples": "5-7 days left",
    "freshbanana": "3-5 days left",
    "freshoranges": "7-10 days left",
    "rottenapples": "0 days left",
    "rottenbanana": "0 days left",
    "rottenoranges": "0 days left",
}
