"""
api/index.py
Serverless entry point for Vercel Python runtime.
Exposes the FastAPI application instance `app`.
"""

import sys
from pathlib import Path

# Add the backend directory to sys.path so app modules are discoverable
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.api import app  # noqa: E402

# Vercel's Python runtime requires an ASGI callable named `app`
__all__ = ["app"]
