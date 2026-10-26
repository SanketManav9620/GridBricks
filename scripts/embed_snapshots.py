"""
scripts/embed_snapshots.py
Generates backend/app/embedded_snapshots.py containing base64-encoded
January 2026 actuals and forecasts for zero-dependency serverless fallback.
"""

import base64
from pathlib import Path

root = Path(__file__).resolve().parent.parent
actuals_path = root / "backend" / "data" / "actuals.csv.gz"
forecasts_path = root / "backend" / "data" / "forecasts.csv.gz"

with open(actuals_path, "rb") as f:
    act_b64 = base64.b64encode(f.read()).decode("ascii")

with open(forecasts_path, "rb") as f:
    fc_b64 = base64.b64encode(f.read()).decode("ascii")

target_file = root / "backend" / "app" / "embedded_snapshots.py"
with open(target_file, "w", encoding="utf-8") as f:
    f.write('"""\n')
    f.write("backend/app/embedded_snapshots.py\n")
    f.write("Zero-dependency in-memory fallback snapshots of verified January 2026 actuals and forecasts.\n")
    f.write("Guarantees 100% reliability in serverless environments (e.g. Vercel) where file paths\n")
    f.write("or asset bundling can vary across lambda runtimes.\n")
    f.write('"""\n\n')
    f.write(f'ACTUALS_CSV_GZ_B64 = "{act_b64}"\n\n')
    f.write(f'FORECASTS_CSV_GZ_B64 = "{fc_b64}"\n')

print(f"Generated {target_file} successfully! Size: {target_file.stat().st_size} bytes")
