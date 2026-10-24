"""
backend/tests/test_ingest.py
Unit tests for data cleansing, deduplication, and snapshot creation in ingest.py.
"""

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pandas as pd
from app.ingest import clean_and_dedupe_actuals, clean_and_dedupe_forecasts, run_ingest
from app.models import FuelHHRecord, WindForecastRecord


def test_clean_and_dedupe_actuals():
    # 2 identical (startTime, publishTime) records, 1 valid distinct, 1 negative (invalid)
    t1 = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    p1 = datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc)
    t2 = datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc)
    p2 = datetime(2026, 1, 1, 1, 0, tzinfo=timezone.utc)

    records = [
        FuelHHRecord(
            dataset="FUELHH",
            startTime=t1,
            publishTime=p1,
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=1000.0,
        ),
        FuelHHRecord(
            dataset="FUELHH",
            startTime=t1,
            publishTime=p1,
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=1200.0,
        ),  # Duplicate
        FuelHHRecord(
            dataset="FUELHH",
            startTime=t2,
            publishTime=p2,
            settlementDate="2026-01-01",
            settlementPeriod=2,
            fuelType="WIND",
            generation=2000.0,
        ),
    ]

    df = clean_and_dedupe_actuals(records)
    assert len(df) == 2
    # The duplicate kept was the latest one (1200.0)
    assert df.loc[df["startTime"] == t1.isoformat(), "generation"].iloc[0] == 1200.0
    assert df.loc[df["startTime"] == t2.isoformat(), "generation"].iloc[0] == 2000.0


def test_clean_and_dedupe_forecasts():
    t1 = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    p1 = datetime(2026, 1, 1, 2, 30, tzinfo=timezone.utc)
    p2 = datetime(2026, 1, 1, 4, 30, tzinfo=timezone.utc)

    records = [
        WindForecastRecord(dataset="WINDFOR", startTime=t1, publishTime=p1, generation=5000.0),
        WindForecastRecord(
            dataset="WINDFOR", startTime=t1, publishTime=p1, generation=5200.0
        ),  # Duplicate
        WindForecastRecord(
            dataset="WINDFOR", startTime=t1, publishTime=p2, generation=5500.0
        ),  # New version
    ]

    df = clean_and_dedupe_forecasts(records)
    # 2 unique (startTime, publishTime) pairs
    assert len(df) == 2
    assert df.iloc[0]["generation"] == 5200.0
    assert df.iloc[1]["generation"] == 5500.0


def test_run_ingest_writes_gzipped_csv(tmp_path: Path):
    mock_client = MagicMock()
    mock_client.fetch_actuals_range.return_value = [
        FuelHHRecord(
            dataset="FUELHH",
            startTime=datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc),
            publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc),
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=14500.0,
        )
    ]
    mock_client.fetch_forecasts_range.return_value = [
        WindForecastRecord(
            dataset="WINDFOR",
            startTime=datetime(2026, 1, 1, 1, 0, tzinfo=timezone.utc),
            publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc),
            generation=13800.0,
        )
    ]

    actuals_file, forecasts_file = run_ingest(
        start_date="2026-01-01",
        end_date="2026-01-01",
        output_dir=tmp_path,
        client=mock_client,
    )

    assert actuals_file.exists()
    assert forecasts_file.exists()
    assert str(actuals_file).endswith(".csv.gz")
    assert str(forecasts_file).endswith(".csv.gz")

    # Read back to verify valid gzip compression
    df_act = pd.read_csv(actuals_file, compression="gzip")
    df_fc = pd.read_csv(forecasts_file, compression="gzip")

    assert len(df_act) == 1
    assert df_act["generation"].iloc[0] == 14500.0
    assert len(df_fc) == 1
    assert df_fc["generation"].iloc[0] == 13800.0
