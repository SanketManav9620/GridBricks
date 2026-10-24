"""
backend/app/repository.py
In-memory data repository for actuals and wind forecasts.
Loads compressed snapshots once on startup/first access, provides fast slicing,
and supports live API fallback via environment flag ELEXON_LIVE_FALLBACK.
"""

import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd

from app.elexon_client import ElexonClient

logger = logging.getLogger(__name__)

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _normalize_tz(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime is tz-aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class DataRepository:
    """
    Thread-safe repository providing cached access to actual and forecast wind data.
    """

    def __init__(self, data_dir: Optional[Path] = None, live_fallback: Optional[bool] = None):
        self.data_dir = data_dir or DEFAULT_DATA_DIR
        if live_fallback is None:
            env_val = os.getenv("ELEXON_LIVE_FALLBACK", "false").lower()
            self.live_fallback = env_val in ("1", "true", "yes")
        else:
            self.live_fallback = live_fallback

        self._lock = threading.Lock()
        self._actuals_df: Optional[pd.DataFrame] = None
        self._forecasts_df: Optional[pd.DataFrame] = None

    def _load_actuals_snapshot(self) -> pd.DataFrame:
        """Load actuals snapshot from gzipped CSV."""
        snapshot_file = self.data_dir / "actuals.csv.gz"
        if snapshot_file.exists():
            logger.info(f"Loading actuals snapshot from {snapshot_file}")
            df = pd.read_csv(snapshot_file, compression="gzip")
            df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
            df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
            df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
            return df

        if self.live_fallback:
            logger.warning(
                "Actuals snapshot not found. Triggering live fallback fetch for 2025-12-31 to 2026-02-02..."
            )
            with ElexonClient() as client:
                records = client.fetch_actuals_range("2025-12-31", "2026-02-02")
                from app.ingest import clean_and_dedupe_actuals

                df = clean_and_dedupe_actuals(records)
                df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
                df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
                return df

        raise FileNotFoundError(
            f"Actuals snapshot file not found at {snapshot_file} and live fallback is disabled. "
            f"Run 'python -m app.ingest' or set ELEXON_LIVE_FALLBACK=true."
        )

    def _load_forecasts_snapshot(self) -> pd.DataFrame:
        """Load forecasts snapshot from gzipped CSV."""
        snapshot_file = self.data_dir / "forecasts.csv.gz"
        if snapshot_file.exists():
            logger.info(f"Loading forecasts snapshot from {snapshot_file}")
            df = pd.read_csv(snapshot_file, compression="gzip")
            df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
            df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
            df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
            return df

        if self.live_fallback:
            logger.warning(
                "Forecasts snapshot not found. Triggering live fallback fetch for 2025-12-31 to 2026-02-02..."
            )
            with ElexonClient() as client:
                records = client.fetch_forecasts_range("2025-12-31", "2026-02-02")
                from app.ingest import clean_and_dedupe_forecasts

                df = clean_and_dedupe_forecasts(records)
                df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
                df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
                return df

        raise FileNotFoundError(
            f"Forecasts snapshot file not found at {snapshot_file} and live fallback is disabled. "
            f"Run 'python -m app.ingest' or set ELEXON_LIVE_FALLBACK=true."
        )

    def _ensure_loaded(self):
        """Ensure both datasets are loaded into memory once."""
        if self._actuals_df is None or self._forecasts_df is None:
            with self._lock:
                if self._actuals_df is None:
                    self._actuals_df = self._load_actuals_snapshot()
                if self._forecasts_df is None:
                    self._forecasts_df = self._load_forecasts_snapshot()

    def reload(self):
        """Force re-reading of snapshots from disk or live."""
        with self._lock:
            self._actuals_df = None
            self._forecasts_df = None
            self._ensure_loaded()

    def get_actuals(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> pd.DataFrame:
        """
        Query actual generation records, optionally filtered by delivery startTime range.
        Returns a copy to prevent mutation of the internal cached dataset.
        """
        self._ensure_loaded()
        df = self._actuals_df
        assert df is not None

        mask = pd.Series(True, index=df.index)
        if start_time is not None:
            st = _normalize_tz(start_time)
            mask &= df["startTime"] >= st
        if end_time is not None:
            et = _normalize_tz(end_time)
            mask &= df["startTime"] <= et

        return df[mask].copy().reset_index(drop=True)

    def get_forecasts(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        max_publish_time: Optional[datetime] = None,
    ) -> pd.DataFrame:
        """
        Query wind forecast records, optionally filtered by target delivery startTime range
        and maximum publication time (decision cutoff gate).
        Returns a copy to prevent mutation of the internal cached dataset.
        """
        self._ensure_loaded()
        df = self._forecasts_df
        assert df is not None

        mask = pd.Series(True, index=df.index)
        if start_time is not None:
            st = _normalize_tz(start_time)
            mask &= df["startTime"] >= st
        if end_time is not None:
            et = _normalize_tz(end_time)
            mask &= df["startTime"] <= et
        if max_publish_time is not None:
            mpt = _normalize_tz(max_publish_time)
            mask &= df["publishTime"] <= mpt

        return df[mask].copy().reset_index(drop=True)


# Default singleton instance
_repository_instance: Optional[DataRepository] = None
_instance_lock = threading.Lock()


def get_repository() -> DataRepository:
    """Get or initialise the global DataRepository singleton instance."""
    global _repository_instance
    if _repository_instance is None:
        with _instance_lock:
            if _repository_instance is None:
                _repository_instance = DataRepository()
    return _repository_instance
