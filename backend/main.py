"""
FreshSight — Backend Entrypoint
=============================
Assembles the FastAPI application. Sets up lifespan events to initialize
the MongoDB database (seeding) and warm-load AI models. Configures CORS
and registers the food API router.
"""

import sys
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Playwright Windows fix
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from config import CORS_ORIGINS
from database import get_db, seed_default_items
from services.detection_service import detection_service
from routers.food import router as food_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown actions."""
    print("[Lifespan] Booting FreshSight services...")
    
    # 1. Initialize MongoDB client and seed default items
    try:
        db = get_db()
        seed_default_items()
    except Exception as e:
        print(f"[Lifespan-DB] Error seeding database: {e}")

    # 2. Warm-load the YOLO and Freshness models (loads once at startup)
    try:
        detection_service.load_models()
    except Exception as e:
        print(f"[Lifespan-AI] Warning: Could not pre-load AI models: {e}. They will be loaded on demand.")

    yield
    print("[Lifespan] Shutting down FreshSight services...")

app = FastAPI(
    title="FreshSight Unified API",
    description="Unified backend for food detection, freshness classification, smart shopping, and recipe generation.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,  # configurable via CORS_ORIGINS in .env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(food_router)

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "models_loaded": detection_service.loaded,
        "database": "connected" if get_db() is not None else "disconnected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
