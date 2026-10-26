"""
scripts/dual_mount_api.py
Refactors backend/app/api.py and api/app/api.py to mount all routes
on both '/api' and '' (root) so requests succeed whether or not '/api' is stripped.
"""

from pathlib import Path

for path in [
    Path("backend/app/api.py"),
    Path("api/app/api.py"),
]:
    content = path.read_text(encoding="utf-8")
    
    # 1. Update import
    old_import = "from fastapi import Depends, FastAPI, HTTPException, Query, Request"
    new_import = "from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request"
    content = content.replace(old_import, new_import)

    # 2. Add router definition
    if "api_router = APIRouter()" not in content:
        content = content.replace(
            "def validate_cutoff(",
            "api_router = APIRouter()\n\n\ndef validate_cutoff(",
            1,
        )

    # 3. Change @app.get("/api/ to @api_router.get("/
    content = content.replace('@app.get("/api/', '@api_router.get("/')

    # 4. Mount router at end of file if not already mounted
    if 'app.include_router(api_router, prefix="/api")' not in content:
        mount_block = (
            "\n\n# Mount router with and without /api prefix for maximum deployment flexibility\n"
            'app.include_router(api_router, prefix="/api")\n'
            "app.include_router(api_router)\n\n"
            '@app.get("/", tags=["System"])\n'
            "def root_status():\n"
            '    return {"status": "ok", "service": "GridBricks UK Wind Trading API", "version": "0.1.0"}\n'
        )
        content += mount_block

    path.write_text(content, encoding="utf-8")
    print(f"Updated {path}")
