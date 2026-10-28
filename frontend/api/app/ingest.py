"""
backend/app/ingest.py
Command Line Interface (CLI) to pull Elexon BMRS actuals and forecasts,
deduplicate, drop nulls, and persist compact gzipped CSV snapshots for Vercel deployment.

Usage:
    python -m app.ingest --from 2025-12-31 --to 2026-02-02
"""

import argparse
import logging
from pathlib import Path
from typing import Optional

import pandas as pd

from app.elexon_client import ElexonClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def clean_and_dedupe_actuals(records: list) -> pd.DataFrame:
    """
    Convert FUELHH records to DataFrame, enforce types, drop nulls/invalid generation,
    and deduplicate on composite key (startTime, publishTime).
    """
    if not records:
        return pd.DataFrame(
            columns=["startTime", "publishTime", "settlementDate", "settlementPeriod", "generation"]
        )

    data = [
        {
            "startTime": r.startTime.isoformat(),
            "publishTime": r.publishTime.isoformat(),
            "settlementDate": r.settlementDate,
            "settlementPeriod": r.settlementPeriod,
            "generation": r.generation,
        }
        for r in records
    ]
    if not data:
        return pd.DataFrame(
            columns=["startTime", "publishTime", "settlementDate", "settlementPeriod", "generation"]
        )

    df = pd.DataFrame(data)
    initial_count = len(df)

    # 1. Drop null or non-numeric generation
    df = df.dropna(subset=["generation", "startTime", "publishTime"])
    df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
    df = df.dropna(subset=["generation"])
    df = df[df["generation"] >= 0]
    valid_count = len(df)

    # 2. Deduplicate on (startTime, publishTime) keeping the last occurrence
    df = df.drop_duplicates(subset=["startTime", "publishTime"], keep="last")
    final_count = len(df)

    # Sort deterministically
    df = df.sort_values(["startTime", "publishTime"]).reset_index(drop=True)

    logger.info(
        f"[ACTUALS] Fetched: {initial_count:,} | Dropped invalid: {initial_count - valid_count:,} | "
        f"Dropped duplicates: {valid_count - final_count:,} | Clean total: {final_count:,}"
    )
    return df


def clean_and_dedupe_forecasts(records: list) -> pd.DataFrame:
    """
    Convert WINDFOR records to DataFrame, enforce types, drop nulls/invalid generation,
    and deduplicate on composite key (startTime, publishTime).
    """
    if not records:
        return pd.DataFrame(columns=["startTime", "publishTime", "generation"])

    data = [
        {
            "startTime": r.startTime.isoformat(),
            "publishTime": r.publishTime.isoformat(),
            "generation": r.generation,
        }
        for r in records
    ]
    if not data:
        return pd.DataFrame(columns=["startTime", "publishTime", "generation"])

    df = pd.DataFrame(data)
    initial_count = len(df)

    # 1. Drop null or non-numeric generation
    df = df.dropna(subset=["generation", "startTime", "publishTime"])
    df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
    df = df.dropna(subset=["generation"])
    df = df[df["generation"] >= 0]
    valid_count = len(df)

    # 2. Deduplicate on (startTime, publishTime) keeping the last occurrence
    df = df.drop_duplicates(subset=["startTime", "publishTime"], keep="last")
    final_count = len(df)

    # Sort deterministically
    df = df.sort_values(["startTime", "publishTime"]).reset_index(drop=True)

    logger.info(
        f"[FORECASTS] Fetched: {initial_count:,} | Dropped invalid: {initial_count - valid_count:,} | "
        f"Dropped duplicates: {valid_count - final_count:,} | Clean total: {final_count:,}"
    )
    return df


def run_ingest(
    start_date: str,
    end_date: str,
    output_dir: Path,
    client: Optional[ElexonClient] = None,
) -> tuple[Path, Path]:
    """
    Execute end-to-end ingestion pipeline and write compressed CSV snapshots.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    actuals_path = output_dir / "actuals.csv.gz"
    forecasts_path = output_dir / "forecasts.csv.gz"

    own_client = False
    if client is None:
        client = ElexonClient()
        own_client = True

    try:
        logger.info(f"Starting ingestion from {start_date} to {end_date}...")

        # 1. Ingest Actuals (FUELHH)
        logger.info(f"Fetching FUELHH actuals day-by-day from {start_date} to {end_date}...")
        raw_actuals = client.fetch_actuals_range(start_date, end_date)
        df_actuals = clean_and_dedupe_actuals(raw_actuals)
        df_actuals.to_csv(actuals_path, index=False, compression="gzip")
        size_actuals_kb = actuals_path.stat().st_size / 1024
        logger.info(f"Saved actuals snapshot: {actuals_path} ({size_actuals_kb:.1f} KB)")

        # 2. Ingest Forecasts (WINDFOR)
        logger.info(f"Fetching WINDFOR forecasts day-by-day from {start_date} to {end_date}...")
        raw_forecasts = client.fetch_forecasts_range(start_date, end_date)
        df_forecasts = clean_and_dedupe_forecasts(raw_forecasts)
        df_forecasts.to_csv(forecasts_path, index=False, compression="gzip")
        size_forecasts_kb = forecasts_path.stat().st_size / 1024
        logger.info(f"Saved forecasts snapshot: {forecasts_path} ({size_forecasts_kb:.1f} KB)")

        print("\n" + "=" * 60)
        print(" INGESTION COMPLETE")
        print("=" * 60)
        print(
            f"  Actuals rows:    {len(df_actuals):,} -> {actuals_path} ({size_actuals_kb:.1f} KB)"
        )
        print(
            f"  Forecasts rows:  {len(df_forecasts):,} -> {forecasts_path} ({size_forecasts_kb:.1f} KB)"
        )
        print(
            f"  Total bundle:    {(size_actuals_kb + size_forecasts_kb):.1f} KB (optimised for Vercel)"
        )
        print("=" * 60 + "\n")

        return actuals_path, forecasts_path

    finally:
        if own_client:
            client.close()


def main():
    parser = argparse.ArgumentParser(
        description="Ingest Elexon BMRS datasets into compressed snapshots."
    )
    parser.add_argument(
        "--from", dest="from_date", default="2025-12-31", help="Start date (YYYY-MM-DD)"
    )
    parser.add_argument("--to", dest="to_date", default="2026-02-02", help="End date (YYYY-MM-DD)")
    parser.add_argument(
        "--output-dir", default=str(DEFAULT_DATA_DIR), help="Output directory for snapshot files"
    )
    args = parser.parse_args()

    run_ingest(args.from_date, args.to_date, Path(args.output_dir))


if __name__ == "__main__":
    main()
