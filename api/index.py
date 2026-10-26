"""
api/index.py
Serverless entry point for Vercel Python runtime.
Exposes the FastAPI application instance `app`.
"""

import sys
from pathlib import Path

# Add current directory (api/) so api/app is directly importable
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

parent_dir = current_dir.parent
for p in (parent_dir / "backend", parent_dir, Path("/var/task/api"), Path("/var/task")):
    if p.exists() and str(p) not in sys.path:
        sys.path.insert(0, str(p))

try:
    from app.api import app  # noqa: E402
except ImportError:
    from backend.app.api import app  # noqa: E402

__all__ = ["app"]
