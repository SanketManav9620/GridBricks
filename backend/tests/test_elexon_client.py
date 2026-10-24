"""
backend/tests/test_elexon_client.py
Unit tests for ElexonClient, typed Pydantic models, retries, and UTC normalisation.
"""

from datetime import datetime, timezone
import pytest
import httpx
from unittest.mock import MagicMock, patch

from app.models import FuelHHRecord, WindForecastRecord
from app.elexon_client import ElexonClient, ElexonAPIError, ElexonTimeoutError


def test_fuelhh_model_utc_normalisation():
    # String with Z
    rec = FuelHHRecord(
        dataset="FUELHH",
        publishTime="2026-01-01T00:30:00Z",
        startTime="2026-01-01T00:00:00Z",
        settlementDate="2026-01-01",
        settlementPeriod=1,
        fuelType="WIND",
        generation=12500.5
    )
    assert rec.publishTime.tzinfo == timezone.utc
    assert rec.startTime.tzinfo == timezone.utc
    assert rec.generation == 12500.5


def test_fuelhh_model_rejects_negative_generation():
    with pytest.raises(ValueError, match="cannot be negative"):
        FuelHHRecord(
            dataset="FUELHH",
            publishTime="2026-01-01T00:30:00Z",
            startTime="2026-01-01T00:00:00Z",
            settlementDate="2026-01-01",
            settlementPeriod=1,
            fuelType="WIND",
            generation=-10.0
        )


def test_windfor_model_utc_normalisation():
    rec = WindForecastRecord(
        dataset="WINDFOR",
        publishTime="2026-01-01T02:30:00Z",
        startTime="2026-01-01T12:00:00Z",
        generation=15400
    )
    assert rec.publishTime.tzinfo == timezone.utc
    assert rec.startTime.tzinfo == timezone.utc
    assert rec.generation == 15400.0


def test_client_fetch_actuals_day_success():
    sample_response = [
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": 14000
        }
    ]

    mock_http = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = sample_response
    mock_http.get.return_value = mock_resp

    client = ElexonClient(client=mock_http)
    records = client.fetch_actuals_day("2026-01-01")

    assert len(records) == 1
    assert records[0].generation == 14000.0
    mock_http.get.assert_called_once()


def test_client_fetch_forecasts_day_success():
    sample_response = [
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T02:30:00Z",
            "startTime": "2026-01-01T10:00:00Z",
            "generation": 13200
        }
    ]

    mock_http = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = sample_response
    mock_http.get.return_value = mock_resp

    client = ElexonClient(client=mock_http)
    records = client.fetch_forecasts_day("2026-01-01")

    assert len(records) == 1
    assert records[0].generation == 13200.0


def test_client_retry_on_server_error_then_success():
    mock_http = MagicMock()
    
    error_resp = MagicMock()
    error_resp.status_code = 500
    error_resp.text = "Internal Server Error"

    success_resp = MagicMock()
    success_resp.status_code = 200
    success_resp.json.return_value = [
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T02:30:00Z",
            "startTime": "2026-01-01T10:00:00Z",
            "generation": 9800
        }
    ]

    mock_http.get.side_effect = [error_resp, success_resp]

    # Use zero backoff factor for fast test
    client = ElexonClient(client=mock_http, max_retries=2, backoff_factor=0.0)
    records = client.fetch_forecasts_day("2026-01-01")

    assert len(records) == 1
    assert mock_http.get.call_count == 2


def test_client_raises_after_max_retries():
    mock_http = MagicMock()
    error_resp = MagicMock()
    error_resp.status_code = 503
    error_resp.text = "Service Unavailable"
    mock_http.get.return_value = error_resp

    client = ElexonClient(client=mock_http, max_retries=2, backoff_factor=0.0)
    with pytest.raises(ElexonAPIError) as exc_info:
        client.fetch_actuals_day("2026-01-01")
    assert exc_info.value.status_code == 503
    assert mock_http.get.call_count == 3


def test_client_handles_timeout_retry():
    mock_http = MagicMock()
    mock_http.get.side_effect = httpx.TimeoutException("Connection timed out")

    client = ElexonClient(client=mock_http, max_retries=1, backoff_factor=0.0)
    with pytest.raises(ElexonTimeoutError):
        client.fetch_actuals_day("2026-01-01")
    assert mock_http.get.call_count == 2
