"""
backend/tests/test_repository.py
Unit tests for DataRepository: caching, time-slice queries, decision-time cutoff, and fallback.
"""

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from app.models import FuelHHRecord, WindForecastRecord
from app.repository import DataRepository


@pytest.fixture
def sample_data_dir(tmp_path: Path) -> Path:
    """Create sample compressed CSV snapshots for testing."""
    actuals = pd.DataFrame(
        [
            {
                "startTime": "2026-01-01T00:00:00+00:00",
                "publishTime": "2026-01-01T00:30:00+00:00",
                "settlementDate": "2026-01-01",
                "settlementPeriod": 1,
                "generation": 10000.0,
            },
            {
                "startTime": "2026-01-01T00:30:00+00:00",
                "publishTime": "2026-01-01T01:00:00+00:00",
                "settlementDate": "2026-01-01",
                "settlementPeriod": 2,
                "generation": 10500.0,
            },
            {
                "startTime": "2026-01-01T01:00:00+00:00",
                "publishTime": "2026-01-01T01:30:00+00:00",
                "settlementDate": "2026-01-01",
                "settlementPeriod": 3,
                "generation": 11000.0,
            },
        ]
    )
    actuals.to_csv(tmp_path / "actuals.csv.gz", index=False, compression="gzip")

    forecasts = pd.DataFrame(
        [
            {
                "startTime": "2026-01-01T12:00:00+00:00",
                "publishTime": "2025-12-31T09:30:00+00:00",
                "generation": 12000.0,
            },
            {
                "startTime": "2026-01-01T12:00:00+00:00",
                "publishTime": "2025-12-31T11:30:00+00:00",
                "generation": 12500.0,
            },
            {
                "startTime": "2026-01-01T12:00:00+00:00",
                "publishTime": "2025-12-31T15:30:00+00:00",
                "generation": 13000.0,
            },
        ]
    )
    forecasts.to_csv(tmp_path / "forecasts.csv.gz", index=False, compression="gzip")
    return tmp_path


def test_repository_loads_and_queries_actuals(sample_data_dir: Path):
    repo = DataRepository(data_dir=sample_data_dir, live_fallback=False)

    # Query all
    df_all = repo.get_actuals()
    assert len(df_all) == 3
    assert df_all["startTime"].dt.tz is not None

    # Query with start_time filter
    st = datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc)
    df_filtered = repo.get_actuals(start_time=st)
    assert len(df_filtered) == 2
    assert df_filtered["startTime"].iloc[0] == st


def test_repository_forecast_decision_cutoff(sample_data_dir: Path):
    repo = DataRepository(data_dir=sample_data_dir, live_fallback=False)

    # Cutoff at 11:00 on Dec 31 -> should only get the 09:30 forecast (12000.0)
    cutoff_11am = datetime(2025, 12, 31, 11, 0, tzinfo=timezone.utc)
    df_11am = repo.get_forecasts(max_publish_time=cutoff_11am)
    assert len(df_11am) == 1
    assert df_11am["generation"].iloc[0] == 12000.0

    # Cutoff at 12:00 on Dec 31 -> should get 09:30 and 11:30 forecasts
    cutoff_12pm = datetime(2025, 12, 31, 12, 0, tzinfo=timezone.utc)
    df_12pm = repo.get_forecasts(max_publish_time=cutoff_12pm)
    assert len(df_12pm) == 2


def test_repository_immutability(sample_data_dir: Path):
    repo = DataRepository(data_dir=sample_data_dir, live_fallback=False)
    df = repo.get_actuals()
    # Mutate the returned DataFrame
    df["generation"] = 0.0

    # Check internal repo state was unaffected
    df_fresh = repo.get_actuals()
    assert df_fresh["generation"].iloc[0] == 10000.0


def test_repository_raises_when_missing_and_no_fallback(tmp_path: Path):
    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()
    repo = DataRepository(data_dir=empty_dir, live_fallback=False)

    with pytest.raises(FileNotFoundError, match="Actuals snapshot file not found"):
        repo.get_actuals()


def test_repository_live_fallback_when_missing(tmp_path: Path):
    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()

    repo = DataRepository(data_dir=empty_dir, live_fallback=True)

    with patch("app.repository.ElexonClient") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.__enter__.return_value = mock_instance
        mock_instance.fetch_actuals_range.return_value = [
            FuelHHRecord(
                dataset="FUELHH",
                startTime=datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc),
                publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc),
                settlementDate="2026-01-01",
                settlementPeriod=1,
                fuelType="WIND",
                generation=11200.0,
            )
        ]
        mock_instance.fetch_forecasts_range.return_value = [
            WindForecastRecord(
                dataset="WINDFOR",
                startTime=datetime(2026, 1, 1, 1, 0, tzinfo=timezone.utc),
                publishTime=datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc),
                generation=10800.0,
            )
        ]
        mock_client_cls.return_value = mock_instance

        # Load actuals via fallback
        df = repo.get_actuals()
        assert len(df) == 1
        assert df["generation"].iloc[0] == 11200.0

        # Load forecasts via fallback
        df_f = repo.get_forecasts()
        assert len(df_f) == 1
        assert df_f["generation"].iloc[0] == 10800.0
