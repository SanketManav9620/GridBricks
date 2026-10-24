"""
backend/app/elexon_client.py
HTTP client for the Elexon Insights Solution (BMRS) API.
Built with httpx, chunked daily queries, exponential backoff retries, and typed validation.
"""

import time
import logging
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Dict, Any, Generator
import httpx
from pydantic import ValidationError

from app.models import FuelHHRecord, WindForecastRecord

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_RETRIES = 3
DEFAULT_BACKOFF_FACTOR = 0.5  # 0.5s, 1.0s, 2.0s


class ElexonClientError(Exception):
    """Base exception for Elexon client errors."""
    pass


class ElexonAPIError(ElexonClientError):
    """Exception raised when Elexon API returns an error response."""
    def __init__(self, status_code: int, message: str):
        super().__init__(f"Elexon API error {status_code}: {message}")
        self.status_code = status_code
        self.message = message


class ElexonTimeoutError(ElexonClientError):
    """Exception raised when an Elexon API request times out."""
    pass


class ElexonClient:
    """
    Robust HTTP client for interacting with Elexon BMRS stream endpoints.
    Features day-by-day chunking, exponential backoff, and Pydantic validation.
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
        client: Optional[httpx.Client] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self._external_client = client is not None
        self.client = client or httpx.Client(
            timeout=httpx.Timeout(self.timeout, connect=10.0),
            headers={"Accept": "application/json"}
        )

    def close(self):
        """Close the underlying HTTP client if internally owned."""
        if not self._external_client:
            self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def _request_with_retry(self, endpoint: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Execute a GET request with exponential backoff on transient errors (5xx, timeouts, connection errors).
        """
        url = f"{self.base_url}{endpoint}"
        last_exception = None

        for attempt in range(self.max_retries + 1):
            try:
                response = self.client.get(url, params=params)
                
                # Check for server errors that warrant retry
                if response.status_code in (500, 502, 503, 504, 429):
                    raise ElexonAPIError(response.status_code, response.text[:200])

                response.raise_for_status()
                return response.json()

            except (httpx.TimeoutException, ElexonTimeoutError) as e:
                last_exception = ElexonTimeoutError(f"Request to {url} timed out: {e}")
                logger.warning(f"Timeout on {url} (attempt {attempt + 1}/{self.max_retries + 1}): {e}")
            except (httpx.NetworkError, ElexonAPIError) as e:
                last_exception = e
                logger.warning(f"Transient error on {url} (attempt {attempt + 1}/{self.max_retries + 1}): {e}")
            except httpx.HTTPStatusError as e:
                # 4xx client errors (e.g. 400 Bad Request, 404) are not retried
                raise ElexonAPIError(e.response.status_code, e.response.text[:200]) from e
            except Exception as e:
                raise ElexonClientError(f"Unexpected error querying {url}: {e}") from e

            # If retries remain, back off exponentially
            if attempt < self.max_retries:
                sleep_time = self.backoff_factor * (2 ** attempt)
                time.sleep(sleep_time)

        raise last_exception or ElexonClientError(f"Failed to query {url} after {self.max_retries + 1} attempts")

    @staticmethod
    def _date_range_days(start_date: str, end_date: str) -> Generator[str, None, None]:
        """Yield individual day strings 'YYYY-MM-DD' from start_date to end_date inclusive."""
        cur = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
        while cur <= end:
            yield cur.isoformat()
            cur += timedelta(days=1)

    def fetch_actuals_day(self, day_str: str) -> List[FuelHHRecord]:
        """
        Fetch FUELHH actual wind generation for a single settlement date (48 half-hours).
        """
        params = {
            "settlementDateFrom": day_str,
            "settlementDateTo": day_str,
            "fuelType": "WIND"
        }
        data = self._request_with_retry("/datasets/FUELHH/stream", params=params)
        
        records: List[FuelHHRecord] = []
        for raw in data:
            try:
                records.append(FuelHHRecord.model_validate(raw))
            except ValidationError as err:
                logger.warning(f"Dropping invalid FUELHH record: {err} | Raw: {raw}")
        return records

    def fetch_actuals_range(self, start_date: str, end_date: str) -> List[FuelHHRecord]:
        """
        Fetch FUELHH actual wind generation chunked day-by-day over the specified date range.
        """
        all_records: List[FuelHHRecord] = []
        for day in self._date_range_days(start_date, end_date):
            day_records = self.fetch_actuals_day(day)
            all_records.extend(day_records)
        return all_records

    def fetch_forecasts_day(self, day_str: str) -> List[WindForecastRecord]:
        """
        Fetch WINDFOR wind forecasts published during a single day (00:00:00Z to 23:59:59Z).
        """
        params = {
            "publishDateTimeFrom": f"{day_str}T00:00:00Z",
            "publishDateTimeTo": f"{day_str}T23:59:59Z"
        }
        data = self._request_with_retry("/datasets/WINDFOR/stream", params=params)

        records: List[WindForecastRecord] = []
        for raw in data:
            try:
                records.append(WindForecastRecord.model_validate(raw))
            except ValidationError as err:
                logger.warning(f"Dropping invalid WINDFOR record: {err} | Raw: {raw}")
        return records

    def fetch_forecasts_range(self, start_date: str, end_date: str) -> List[WindForecastRecord]:
        """
        Fetch WINDFOR wind forecasts chunked day-by-day over the specified publication range.
        """
        all_records: List[WindForecastRecord] = []
        for day in self._date_range_days(start_date, end_date):
            day_records = self.fetch_forecasts_day(day)
            all_records.extend(day_records)
        return all_records
