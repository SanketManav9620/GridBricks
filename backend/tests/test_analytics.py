"""
backend/tests/test_analytics.py
Unit tests for analytics functions with hand-computed fixtures and explicit edge cases.
"""

from datetime import date, datetime, timezone

import numpy as np
import pandas as pd
import pytest
from app.analytics import (
    _ensure_utc_datetime,
    aggregate_by_delivery_day,
    aggregate_by_horizon_bucket,
    aggregate_by_hour_of_day,
    calculate_metrics,
    compute_decision_cutoff,
    compute_error_histogram,
    compute_errors,
    forecast_revisions,
    latest_forecast_at_cutoff,
    recommended_buffer,
    recommended_buffer_expanding_window,
)


@pytest.fixture
def hand_computed_fixture():
    """
    Construct a deterministic dataset with hand-computable expected values.
    Delivery date: 2026-01-02.
    Cutoff on D-1 (2026-01-01) at 11:00 London (UTC):
      - Hour 00:00:
          v1: 07:30 UTC -> 10,000 MW
          v2: 09:30 UTC -> 12,000 MW (latest before 11:00 cutoff -> MUST BE CHOSEN)
          v3: 11:30 UTC -> 15,000 MW (after cutoff -> MUST BE IGNORED)
          Actual: SP1=10,000, SP2=10,000 -> Mean=10,000 MW.
          Error = 12,000 - 10,000 = +2,000 MW.
      - Hour 01:00:
          v1: 09:30 UTC -> 8,000 MW
          Actual: SP3=9,000, SP4=11,000 -> Mean=10,000 MW.
          Error = 8,000 - 10,000 = -2,000 MW.
      - Hour 02:00:
          v1: 09:30 UTC -> 10,500 MW
          Actual: SP5=10,000, SP6=10,000 -> Mean=10,000 MW.
          Error = 10,500 - 10,000 = +500 MW.
    """
    forecasts = pd.DataFrame(
        [
            # Hour 00:00 (v1, v2, v3)
            {
                "startTime": "2026-01-02T00:00:00Z",
                "publishTime": "2026-01-01T07:30:00Z",
                "generation": 10000.0,
            },
            {
                "startTime": "2026-01-02T00:00:00Z",
                "publishTime": "2026-01-01T09:30:00Z",
                "generation": 12000.0,
            },
            {
                "startTime": "2026-01-02T00:00:00Z",
                "publishTime": "2026-01-01T11:30:00Z",
                "generation": 15000.0,
            },  # After cutoff!
            # Hour 01:00
            {
                "startTime": "2026-01-02T01:00:00Z",
                "publishTime": "2026-01-01T09:30:00Z",
                "generation": 8000.0,
            },
            # Hour 02:00
            {
                "startTime": "2026-01-02T02:00:00Z",
                "publishTime": "2026-01-01T09:30:00Z",
                "generation": 10500.0,
            },
        ]
    )

    actuals = pd.DataFrame(
        [
            # Hour 00:00 (two half hours)
            {"startTime": "2026-01-02T00:00:00Z", "generation": 10000.0},
            {"startTime": "2026-01-02T00:30:00Z", "generation": 10000.0},
            # Hour 01:00
            {"startTime": "2026-01-02T01:00:00Z", "generation": 9000.0},
            {"startTime": "2026-01-02T01:30:00Z", "generation": 11000.0},
            # Hour 02:00
            {"startTime": "2026-01-02T02:00:00Z", "generation": 10000.0},
            {"startTime": "2026-01-02T02:30:00Z", "generation": 10000.0},
        ]
    )

    return forecasts, actuals


def test_decision_cutoff_calculation():
    # London winter time (GMT) is UTC+0
    cutoff = compute_decision_cutoff("2026-01-02", "11:00")
    assert cutoff == datetime(2026, 1, 1, 11, 0, tzinfo=timezone.utc)

    # Cutoff at 12:30
    cutoff_1230 = compute_decision_cutoff("2026-01-02", "12:30")
    assert cutoff_1230 == datetime(2026, 1, 1, 12, 30, tzinfo=timezone.utc)


def test_latest_forecast_at_cutoff_ignores_post_cutoff(hand_computed_fixture):
    forecasts, _ = hand_computed_fixture
    df_desk = latest_forecast_at_cutoff(forecasts, delivery_date="2026-01-02", cutoff_hhmm="11:00")

    # Should have 3 target hours: 00:00, 01:00, 02:00
    assert len(df_desk) == 3

    # Check Hour 00:00 picked the 09:30 version (12,000 MW), NOT the 11:30 version (15,000 MW)
    h0 = df_desk[df_desk["startTime"] == pd.Timestamp("2026-01-02 00:00:00+0000")].iloc[0]
    assert h0["forecast_mw"] == 12000.0
    assert h0["publishTime"] == pd.Timestamp("2026-01-01 09:30:00+0000")
    assert h0["horizon_hours"] == 14.5  # 00:00 on Jan 2 minus 09:30 on Jan 1 = 14.5 hours


def test_hand_computed_error_metrics(hand_computed_fixture):
    forecasts, actuals = hand_computed_fixture
    df_desk = latest_forecast_at_cutoff(forecasts, delivery_date="2026-01-02", cutoff_hhmm="11:00")
    errors_df = compute_errors(df_desk, actuals, alignment="hourly")

    assert len(errors_df) == 3
    # Check individual errors
    # Hour 00: 12000 - 10000 = +2000
    # Hour 01: 8000 - 10000 = -2000
    # Hour 02: 10500 - 10000 = +500
    assert errors_df["error_mw"].tolist() == [2000.0, -2000.0, 500.0]
    assert errors_df["abs_error_mw"].tolist() == [2000.0, 2000.0, 500.0]

    # Hand-computed metrics:
    # Bias = (2000 - 2000 + 500) / 3 = 166.6667
    # MAE = (2000 + 2000 + 500) / 3 = 1500.0
    # RMSE = sqrt( (4M + 4M + 0.25M) / 3 ) = sqrt(2,750,000) = 1658.312395...
    # WAPE = 4500 / 30000 * 100 = 15.0%
    # Within 10%: only Hour 02 (|500| <= 1000) -> 1/3 = 33.333%
    m = calculate_metrics(errors_df)

    assert m["count"] == 3
    assert pytest.approx(m["bias"], rel=1e-4) == 166.6667
    assert pytest.approx(m["mae"], rel=1e-4) == 1500.0
    assert pytest.approx(m["rmse"], rel=1e-4) == np.sqrt(8250000 / 3)
    assert pytest.approx(m["wape"], rel=1e-4) == 15.0
    assert pytest.approx(m["pct_within_10pct"], rel=1e-4) == 100.0 / 3.0
    assert m["p50_abs_error"] == 2000.0


def test_forecast_revisions(hand_computed_fixture):
    forecasts, _ = hand_computed_fixture
    revs = forecast_revisions(forecasts, delivery_date="2026-01-02")
    # All 5 forecast entries belong to 2026-01-02
    assert len(revs) == 5
    # First revision should be earliest publishTime (07:30)
    assert revs["publishTime"].iloc[0] == pd.Timestamp("2026-01-01 07:30:00+0000")

    # With max_publish_time filter
    revs_filtered = forecast_revisions(
        forecasts,
        delivery_date="2026-01-02",
        max_publish_time=datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc),
    )
    # The 11:30 revision should be excluded
    assert len(revs_filtered) == 4


def test_edge_case_null_generation():
    forecasts = pd.DataFrame(
        [
            {
                "startTime": "2026-01-02T00:00:00Z",
                "publishTime": "2026-01-01T09:30:00Z",
                "generation": None,
            },
            {
                "startTime": "2026-01-02T00:00:00Z",
                "publishTime": "2026-01-01T07:30:00Z",
                "generation": 11000.0,
            },
        ]
    )
    df = latest_forecast_at_cutoff(forecasts, delivery_date="2026-01-02")
    # The None generation should be dropped, leaving the 11000.0 record
    assert len(df) == 1
    assert df["forecast_mw"].iloc[0] == 11000.0


def test_edge_case_missing_actual():
    forecasts = pd.DataFrame(
        [
            {"startTime": "2026-01-02T00:00:00Z", "generation": 12000.0},
            {"startTime": "2026-01-02T01:00:00Z", "generation": 13000.0},
        ]
    )
    # Actuals only exist for 00:00, missing for 01:00
    actuals = pd.DataFrame(
        [
            {"startTime": "2026-01-02T00:00:00Z", "generation": 12000.0},
            {"startTime": "2026-01-02T00:30:00Z", "generation": 12000.0},
        ]
    )

    errors_df = compute_errors(forecasts, actuals, alignment="hourly")
    # Inner join retains only periods where actual exists
    assert len(errors_df) == 1
    assert errors_df["error_mw"].iloc[0] == 0.0


def test_edge_case_day_with_no_forecast():
    empty_forecasts = pd.DataFrame(columns=["startTime", "publishTime", "generation"])
    df = latest_forecast_at_cutoff(empty_forecasts, delivery_date="2026-01-05")
    assert df.empty
    assert list(df.columns) == [
        "startTime",
        "forecast_mw",
        "publishTime",
        "horizon_hours",
        "delivery_date",
        "cutoff_time",
    ]

    # Also test error calculation on empty dataframe
    m = calculate_metrics(df)
    assert m["count"] == 0
    assert np.isnan(m["mae"])


def test_aggregations(hand_computed_fixture):
    forecasts, actuals = hand_computed_fixture
    df_desk = latest_forecast_at_cutoff(forecasts, delivery_date="2026-01-02", cutoff_hhmm="11:00")
    errors_df = compute_errors(df_desk, actuals, alignment="hourly")

    # By delivery day
    by_day = aggregate_by_delivery_day(errors_df)
    assert len(by_day) == 1
    assert by_day["delivery_date"].iloc[0] == "2026-01-02"
    assert by_day["count"].iloc[0] == 3

    # By hour of day
    by_hour = aggregate_by_hour_of_day(errors_df)
    assert len(by_hour) == 3
    assert by_hour["hour"].tolist() == [0, 1, 2]

    # By horizon bucket
    by_bucket = aggregate_by_horizon_bucket(errors_df)
    assert not by_bucket.empty
    assert "horizon_bucket" in by_bucket.columns

    # Error histogram
    hist = compute_error_histogram(errors_df, bin_size_mw=1000.0)
    assert not hist.empty
    assert hist["count"].sum() == 3


def test_recommended_buffer_and_expanding_window():
    # Errors across 3 days:
    # Day 1: [1000, 2000] -> max overforecast 2000
    # Day 2: [500, 1500]
    # Day 3: [3000, 4000]
    errors_df = pd.DataFrame(
        [
            {"delivery_date": "2026-01-01", "error_mw": 1000.0},
            {"delivery_date": "2026-01-01", "error_mw": 2000.0},
            {"delivery_date": "2026-01-02", "error_mw": 500.0},
            {"delivery_date": "2026-01-02", "error_mw": 1500.0},
            {"delivery_date": "2026-01-03", "error_mw": 3000.0},
            {"delivery_date": "2026-01-03", "error_mw": 4000.0},
        ]
    )

    # Static buffer on day 1
    buf_d1 = recommended_buffer(
        errors_df[errors_df["delivery_date"] == "2026-01-01"], quantile=0.90
    )
    # p90 of [1000, 2000] is 1900.0
    assert pytest.approx(buf_d1, rel=1e-3) == 1900.0

    # Expanding window
    exp_df = recommended_buffer_expanding_window(errors_df, quantile=0.90, min_history_days=1)
    assert len(exp_df) == 3

    # Day 1 has 0 prior days history -> buffer = 0.0
    assert (
        exp_df.loc[exp_df["delivery_date"] == "2026-01-01", "recommended_buffer_mw"].iloc[0] == 0.0
    )
    assert exp_df.loc[exp_df["delivery_date"] == "2026-01-01", "history_days_count"].iloc[0] == 0

    # Day 2 only uses Day 1 -> buffer = 1900.0
    assert (
        pytest.approx(
            exp_df.loc[exp_df["delivery_date"] == "2026-01-02", "recommended_buffer_mw"].iloc[0],
            rel=1e-3,
        )
        == 1900.0
    )
    assert exp_df.loc[exp_df["delivery_date"] == "2026-01-02", "history_days_count"].iloc[0] == 1

    # Day 3 uses Day 1 & Day 2 (4 points: 500, 1000, 1500, 2000)
    # p90 of [500, 1000, 1500, 2000] is 1850.0
    assert exp_df.loc[exp_df["delivery_date"] == "2026-01-03", "history_days_count"].iloc[0] == 2
    assert (
        pytest.approx(
            exp_df.loc[exp_df["delivery_date"] == "2026-01-03", "recommended_buffer_mw"].iloc[0],
            rel=1e-3,
        )
        == 1850.0
    )


def test_analytics_date_types_and_empty_inputs():
    """Test date/datetime parameter types and empty inputs."""
    d_obj = date(2026, 1, 15)
    dt_obj = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)

    # Empty inputs
    assert latest_forecast_at_cutoff(pd.DataFrame(), d_obj).empty
    assert forecast_revisions(pd.DataFrame(), dt_obj).empty
    assert compute_errors(pd.DataFrame(), pd.DataFrame()).empty
    assert calculate_metrics(pd.DataFrame())["count"] == 0
    assert aggregate_by_delivery_day(pd.DataFrame()).empty
    assert aggregate_by_hour_of_day(pd.DataFrame()).empty
    assert aggregate_by_horizon_bucket(pd.DataFrame()).empty
    assert compute_error_histogram(pd.DataFrame()).empty
    assert recommended_buffer_expanding_window(pd.DataFrame()).empty


def test_compute_errors_half_hourly_and_invalid_alignment():
    """Test half_hourly alignment and invalid alignment handling."""
    fc_df = pd.DataFrame(
        [
            {
                "startTime": "2026-01-01T12:00:00Z",
                "generation": 1000.0,
                "publishTime": "2026-01-01T06:00:00Z",
            }
        ]
    )
    act_df = pd.DataFrame(
        [
            {"startTime": "2026-01-01T12:00:00Z", "generation": 900.0},
            {"startTime": "2026-01-01T12:30:00Z", "generation": 950.0},
        ]
    )

    hh_err = compute_errors(fc_df, act_df, alignment="half_hourly")
    assert len(hh_err) == 2
    assert "error_mw" in hh_err.columns

    with pytest.raises(ValueError, match="Unsupported alignment"):
        compute_errors(fc_df, act_df, alignment="invalid_mode")


def test_recommended_buffer_types_and_edge_cases():
    """Test Series, missing columns, and invalid types in recommended_buffer."""
    # Series input
    s = pd.Series([100.0, 200.0, 300.0, 400.0, 500.0])
    buf = recommended_buffer(s, quantile=0.90)
    assert buf > 0.0

    # DataFrame without error_mw
    assert recommended_buffer(pd.DataFrame({"other_col": [1, 2, 3]})) == 0.0

    # Invalid type
    with pytest.raises(TypeError, match="errors must be a DataFrame or Series"):
        recommended_buffer([100, 200, 300])  # type: ignore

    # Empty Series
    assert recommended_buffer(pd.Series([], dtype=float)) == 0.0


def test_ensure_utc_datetime_and_horizon_buckets():
    """Test _ensure_utc_datetime branches and custom horizon buckets."""
    # String
    dt_str = _ensure_utc_datetime("2026-01-01T12:00:00Z")
    assert dt_str.tzinfo == timezone.utc

    # Date
    d = date(2026, 1, 1)
    dt_d = _ensure_utc_datetime(d)
    assert dt_d.hour == 0 and dt_d.tzinfo == timezone.utc

    # Naive datetime
    naive = datetime(2026, 1, 1, 14, 30)
    aware = _ensure_utc_datetime(naive)
    assert aware.tzinfo == timezone.utc

    # Invalid type
    with pytest.raises(TypeError, match="Unsupported datetime type"):
        _ensure_utc_datetime(12345)

    # Datetime inputs to compute_decision_cutoff
    cutoff = compute_decision_cutoff(datetime(2026, 1, 15, 0, 0))
    assert cutoff.tzinfo == timezone.utc

    # Custom buckets for aggregate_by_horizon_bucket
    df_err = pd.DataFrame(
        [
            {
                "startTime": "2026-01-01T12:00:00Z",
                "horizon_hours": 8.0,
                "forecast_mw": 550.0,
                "error_mw": 50.0,
                "abs_error_mw": 50.0,
                "pct_error": 10.0,
                "actual_mw": 500.0,
            },
            {
                "startTime": "2026-01-01T13:00:00Z",
                "horizon_hours": 30.0,
                "forecast_mw": 500.0,
                "error_mw": -100.0,
                "abs_error_mw": 100.0,
                "pct_error": 16.67,
                "actual_mw": 600.0,
            },
        ]
    )
    custom_buckets = [("short", 12.0), ("long", float("inf"))]
    res_b = aggregate_by_horizon_bucket(df_err, buckets=custom_buckets)
    assert len(res_b) == 2
    assert "short" in res_b["horizon_bucket"].values

    # Histogram with all NaN errors
    nan_hist = compute_error_histogram(pd.DataFrame({"error_mw": [np.nan, np.nan]}))
    assert nan_hist.empty
