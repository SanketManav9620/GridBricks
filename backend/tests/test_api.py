"""
backend/tests/test_api.py
Unit tests for all FastAPI endpoints using starlette/fastapi TestClient.
"""

import pytest
from fastapi.testclient import TestClient

from app.api import app

client = TestClient(app)


def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert "timestamp" in data


def test_meta_endpoint():
    resp = client.get("/api/meta")
    assert resp.status_code == 200
    data = resp.json()
    assert data["default_cutoff"] == "09:00"
    assert data["fuel_type"] == "WIND"
    assert "2026-01-15" in data["available_dates"]
    assert data["total_actual_periods"] > 0


def test_forecast_endpoint_valid():
    resp = client.get("/api/forecast", params={"delivery_date": "2026-01-15", "cutoff": "11:00"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["delivery_date"] == "2026-01-15"
    assert data["cutoff"] == "11:00"
    assert len(data["points"]) == 48  # Exactly 48 settlement periods
    assert data["points"][0]["settlementPeriod"] == 1
    assert data["points"][47]["settlementPeriod"] == 48
    assert data["p90_buffer_mw"] > 0
    assert "revisions" in data


def test_forecast_endpoint_invalid_date():
    resp = client.get("/api/forecast", params={"delivery_date": "2024-05-01", "cutoff": "11:00"})
    assert resp.status_code == 400
    assert "outside available evaluation range" in resp.json()["detail"]


def test_forecast_endpoint_invalid_cutoff():
    resp = client.get("/api/forecast", params={"delivery_date": "2026-01-15", "cutoff": "25:61"})
    assert resp.status_code == 400
    assert "Invalid cutoff time format" in resp.json()["detail"]


def test_actuals_endpoint_valid():
    resp = client.get("/api/actuals", params={"delivery_date": "2026-01-15"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["delivery_date"] == "2026-01-15"
    assert len(data["points"]) == 48
    assert data["points"][0]["settlementPeriod"] == 1
    assert data["points"][0]["generation_mw"] > 0


def test_accuracy_summary_endpoint():
    resp = client.get("/api/accuracy/summary", params={"cutoff": "11:00"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_delivery_periods"] == 744  # 31 days * 24 hours
    assert "bias_mw" in data
    assert "mae_mw" in data
    assert "rmse_mw" in data
    assert "recommended_buffer_p90_mw" in data
    assert data["recommended_buffer_p90_mw"] > 0


def test_accuracy_daily_endpoint():
    resp = client.get("/api/accuracy/daily", params={"cutoff": "11:00"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 31  # 31 days in January
    assert data[0]["delivery_date"] == "2026-01-01"
    assert "recommended_buffer_mw" in data[0]


def test_accuracy_by_hour_endpoint():
    resp = client.get("/api/accuracy/by-hour", params={"cutoff": "11:00"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 24  # 24 hours of the day
    assert data[0]["hour"] == 0
    assert data[23]["hour"] == 23


def test_accuracy_by_horizon_endpoint():
    resp = client.get("/api/accuracy/by-horizon", params={"cutoff": "11:00"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert "horizon_bucket" in data[0]


def test_accuracy_distribution_endpoint():
    resp = client.get("/api/accuracy/distribution", params={"cutoff": "11:00", "bin_size_mw": 500.0})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert "bin_min" in data[0]
    assert "frequency_pct" in data[0]


def test_accuracy_timeseries_endpoint():
    resp = client.get("/api/accuracy/timeseries", params={"cutoff": "09:00"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert "startTime" in data[0]
    assert "forecast_mw" in data[0]
    assert "actual_mw" in data[0]
    assert "p90_hedge_mw" in data[0]

