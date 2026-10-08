"""
FreshSight — Backend Launcher
============================
Starts the FastAPI backend server on port 8000.
"""

import sys
import asyncio

# Fix for Playwright on Windows
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        app_dir="backend",   # backend modules use top-level imports (from database import ...)
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["backend"]
    )
