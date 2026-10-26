"""
api/index.py
Serverless entry point for Vercel Python runtime.
Exposes the FastAPI application instance `app`.
"""

import os
import sys
from pathlib import Path

# Resolve root directory and backend directory in various deployment configurations
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent

search_paths = [
    parent_dir / "backend",
    parent_dir,
    current_dir / "backend",
    current_dir,
    Path("/var/task/backend"),
    Path("/var/task"),
]

for p in search_paths:
    if p.exists() and str(p) not in sys.path:
        sys.path.insert(0, str(p))

try:
    from app.api import app  # noqa: E402
except ImportError:
    from backend.app.api import app  # noqa: E402

# Vercel's Python runtime requires an ASGI callable named `app`
__all__ = ["app"]
