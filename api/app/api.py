"""
backend/app/api.py
FastAPI application providing endpoints for UK Day-Ahead Wind Trading desk.
Exposes health, metadata, point-in-time forecasts, actuals, error tables,
accuracy summaries, daily/hourly/horizon aggregations, and error histograms.
"""

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List

import pandas as pd
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.analytics import (
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
from app.repository import DataRepository, get_repository
from app.schemas import (
    AccuracySummaryResponse,
    ActualPoint,
    ActualsResponse,
    DailyAccuracyItem,
    ErrorHistogramItem,
    ForecastPoint,
    ForecastResponse,
    HealthResponse,
    HorizonAccuracyItem,
    HourlyAccuracyItem,
    MetaResponse,
    RevisionItem,
    TimeseriesPoint,
)

CUTOFF_REGEX = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")

app = FastAPI(
    title="UK Day-Ahead Wind Trading & Analytics API",
    description="Production-grade API providing point-in-time wind forecasts, actuals, accuracy analytics, and dynamic safety buffer sizing for the UK wholesale electricity market.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

import logging

logger = logging.getLogger(__name__)

# Enable CORS for local Vite dev server and Vercel deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ensure all unhandled exceptions log detailed traceback and return clean JSON response."""
    logger.exception(f"Unhandled error processing {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc) or "Internal server error occurred while processing request.",
            "type": type(exc).__name__,
            "path": str(request.url.path),
        },
    )


# In-memory LRU computation caches to ensure instant responses on repeated queries
_analytics_cache: Dict[str, Any] = {}


api_router = APIRouter()


def validate_cutoff(
    cutoff: str = Query("09:00", description="Cutoff time on D-1 in HH:MM (London time)"),
) -> str:
    """Validate 24-hour HH:MM format."""
    clean = cutoff.strip()
    if not CUTOFF_REGEX.match(clean):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid cutoff time format '{cutoff}'. Expected 24-hour clock 'HH:MM' (e.g. '09:00' or '11:00').",
        )
    return clean


def validate_delivery_date(
    delivery_date: str = Query(..., description="Delivery date (YYYY-MM-DD)"),
    repo: DataRepository = Depends(get_repository),
) -> str:
    """Validate date format and ensure it falls within available snapshot records."""
    try:
        d = date.fromisoformat(delivery_date.strip())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format '{delivery_date}'. Expected 'YYYY-MM-DD' (e.g. '2026-01-15').",
        )

    # Check bounds against actuals repository
    act_df = repo.get_actuals()
    min_date = act_df["startTime"].dt.date.min()
    max_date = act_df["startTime"].dt.date.max()

    if d < min_date or d > max_date:
        raise HTTPException(
            status_code=400,
            detail=f"Delivery date '{delivery_date}' is outside available evaluation range ({min_date.isoformat()} to {max_date.isoformat()}).",
        )
    return delivery_date.strip()


@api_router.get("/health", response_model=HealthResponse, tags=["System"])
def get_health():
    """Health check endpoint returning system status and current UTC timestamp."""
    return HealthResponse(status="ok", version="0.1.0", timestamp=datetime.now(timezone.utc))


@api_router.get("/meta", response_model=MetaResponse, tags=["Metadata"])
def get_metadata(repo: DataRepository = Depends(get_repository)):
    """Return available delivery dates, default cutoff gate, and dataset statistics."""
    act_df = repo.get_actuals()
    fc_df = repo.get_forecasts()

    unique_dates = sorted(list(act_df["startTime"].dt.date.astype(str).unique()))
    # Limit decision dates to 2026-01-01 to 2026-01-31 (January 2026 evaluation period)
    jan_dates = [d for d in unique_dates if d.startswith("2026-01")]

    return MetaResponse(
        min_delivery_date=jan_dates[0] if jan_dates else unique_dates[0],
        max_delivery_date=jan_dates[-1] if jan_dates else unique_dates[-1],
        available_dates=jan_dates if jan_dates else unique_dates,
        default_cutoff="09:00",
        market="UK Day-Ahead Electricity Market (BMRS)",
        fuel_type="WIND",
        total_actual_periods=len(act_df),
        total_forecast_versions=len(fc_df),
    )


@api_router.get("/forecast", response_model=ForecastResponse, tags=["Trading Desk"])
def get_forecast(
    delivery_date: str = Depends(validate_delivery_date),
    cutoff: str = Depends(validate_cutoff),
    repo: DataRepository = Depends(get_repository),
):
    """
    Get the latest wind forecast available at decision cutoff for all 48 half-hour settlement periods,
    including historical revisions and conservative risk hedge bands (P90 and P95).
    """
    cache_key = f"forecast_{delivery_date}_{cutoff}"
    if cache_key in _analytics_cache:
        return _analytics_cache[cache_key]

    fc_df = repo.get_forecasts()

    # 1. Extract hourly latest forecasts at cutoff

    hourly_latest = latest_forecast_at_cutoff(fc_df, delivery_date, cutoff_hhmm=cutoff)
    if hourly_latest.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No forecast versions found for delivery date {delivery_date} published on or before cutoff {cutoff}.",
        )

    # 2. Compute dynamic expanding window buffer up to delivery_date
    # Pull errors prior to delivery date to size the buffer
    all_desk_errors = _get_or_compute_all_errors(repo, cutoff)
    p90_buf = recommended_buffer(
        all_desk_errors[all_desk_errors["delivery_date"] < delivery_date], quantile=0.90
    )
    p95_buf = recommended_buffer(
        all_desk_errors[all_desk_errors["delivery_date"] < delivery_date], quantile=0.95
    )

    if p90_buf == 0.0:
        # Fall back to global evaluation buffer if first day
        p90_buf = recommended_buffer(all_desk_errors, quantile=0.90)
        p95_buf = recommended_buffer(all_desk_errors, quantile=0.95)

    # 3. Broadcast 24 hourly points to 48 half-hourly settlement periods (SP 1 to 48)
    points: List[ForecastPoint] = []
    d_target = date.fromisoformat(delivery_date)

    hourly_dict = {row["startTime"].hour: row for _, row in hourly_latest.iterrows()}

    for sp in range(1, 49):
        hour = (sp - 1) // 2
        minute = 30 if (sp % 2 == 0) else 0
        sp_time = datetime(
            d_target.year, d_target.month, d_target.day, hour, minute, tzinfo=timezone.utc
        )

        if hour in hourly_dict:
            hr_row = hourly_dict[hour]
            fc_val = float(hr_row["forecast_mw"])
            pub_time = hr_row["publishTime"]
            horizon = float((sp_time - pub_time).total_seconds() / 3600.0)
        else:
            fc_val = 0.0
            pub_time = sp_time
            horizon = 0.0

        p90_hedge = max(0.0, fc_val - p90_buf)
        p95_hedge = max(0.0, fc_val - p95_buf)

        points.append(
            ForecastPoint(
                settlementPeriod=sp,
                startTime=sp_time,
                forecast_mw=round(fc_val, 2),
                publishTime=pub_time,
                horizon_hours=round(horizon, 2),
                risk_band_p90_mw=round(p90_hedge, 2),
                risk_band_p95_mw=round(p95_hedge, 2),
            )
        )

    # 4. Extract earlier revisions for the day (for the revision fan chart)
    cutoff_utc = compute_decision_cutoff(delivery_date, cutoff)
    rev_df = forecast_revisions(fc_df, delivery_date, max_publish_time=cutoff_utc)

    revisions = [
        RevisionItem(
            publishTime=row["publishTime"],
            startTime=row["startTime"],
            forecast_mw=round(float(row["forecast_mw"]), 2),
            horizon_hours=round(float(row["horizon_hours"]), 2),
        )
        for _, row in rev_df.iterrows()
    ]

    response = ForecastResponse(
        delivery_date=delivery_date,
        cutoff=cutoff,
        cutoff_time=cutoff_utc,
        points=points,
        revisions=revisions,
        p90_buffer_mw=round(p90_buf, 2),
        p95_buffer_mw=round(p95_buf, 2),
    )

    _analytics_cache[cache_key] = response
    return response


@api_router.get("/actuals", response_model=ActualsResponse, tags=["Trading Desk"])
def get_actuals(
    delivery_date: str = Depends(validate_delivery_date),
    repo: DataRepository = Depends(get_repository),
):
    """Get actual outturn generation for all 48 half-hour settlement periods on delivery_date."""
    cache_key = f"actuals_{delivery_date}"
    if cache_key in _analytics_cache:
        return _analytics_cache[cache_key]

    d_target = date.fromisoformat(delivery_date)
    start_dt = datetime(d_target.year, d_target.month, d_target.day, 0, 0, tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=1) - timedelta(minutes=30)

    act_df = repo.get_actuals(start_time=start_dt, end_time=end_dt)
    if act_df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No actual outturn records found for delivery date {delivery_date}.",
        )

    act_sorted = act_df.sort_values("startTime").reset_index(drop=True)
    points = [
        ActualPoint(
            settlementPeriod=int(row["settlementPeriod"]),
            startTime=row["startTime"],
            generation_mw=round(float(row["generation"]), 2),
        )
        for _, row in act_sorted.iterrows()
    ]

    response = ActualsResponse(delivery_date=delivery_date, points=points)
    _analytics_cache[cache_key] = response
    return response


def _get_or_compute_all_errors(repo: DataRepository, cutoff: str) -> Any:
    """Helper to compute desk errors for all January 2026 delivery days at a given cutoff."""
    cache_key = f"errors_all_{cutoff}"
    if cache_key in _analytics_cache:
        return _analytics_cache[cache_key]

    fc_df = repo.get_forecasts()
    act_df = repo.get_actuals()

    # All January 2026 delivery days
    jan_days = [f"2026-01-{day:02d}" for day in range(1, 32)]
    desk_forecasts_list = []

    for d in jan_days:
        d_fc = latest_forecast_at_cutoff(fc_df, delivery_date=d, cutoff_hhmm=cutoff)
        if not d_fc.empty:
            desk_forecasts_list.append(d_fc)

    import pandas as pd

    if desk_forecasts_list:
        combined_fc = pd.concat(desk_forecasts_list, ignore_index=True)
        errors_df = compute_errors(combined_fc, act_df, alignment="hourly")
    else:
        errors_df = pd.DataFrame()

    _analytics_cache[cache_key] = errors_df
    return errors_df


@api_router.get("/accuracy/summary", response_model=AccuracySummaryResponse, tags=["Analytics"])
def get_accuracy_summary(
    cutoff: str = Depends(validate_cutoff),
    repo: DataRepository = Depends(get_repository),
):
    """
    Get holistic accuracy metrics across all January 2026 trading days:
    Bias (MBE), MAE, RMSE, WAPE, Percentiles, and empirical Safety Buffers.
    """
    cache_key = f"summary_{cutoff}"
    if cache_key in _analytics_cache:
        return _analytics_cache[cache_key]

    errors_df = _get_or_compute_all_errors(repo, cutoff)
    if errors_df.empty:
        raise HTTPException(
            status_code=404, detail="No error data available for the specified cutoff."
        )

    m = calculate_metrics(errors_df)
    buf_p90 = recommended_buffer(errors_df, quantile=0.90)
    buf_p95 = recommended_buffer(errors_df, quantile=0.95)

    response = AccuracySummaryResponse(
        cutoff=cutoff,
        evaluation_window="2026-01-01 to 2026-01-31 (744 Delivery Hours)",
        total_delivery_periods=int(m["count"]),
        bias_mw=round(m["bias"], 2),
        mae_mw=round(m["mae"], 2),
        rmse_mw=round(m["rmse"], 2),
        wape_pct=round(m["wape"], 2),
        p50_abs_error_mw=round(m["p50_abs_error"], 2),
        p90_abs_error_mw=round(m["p90_abs_error"], 2),
        p95_abs_error_mw=round(m["p95_abs_error"], 2),
        p90_over_forecast_mw=round(m["p90_over_forecast"], 2),
        pct_within_10pct=round(m["pct_within_10pct"], 2),
        mean_actual_mw=round(m["mean_actual_mw"], 2),
        mean_forecast_mw=round(m["mean_forecast_mw"], 2),
        recommended_buffer_p90_mw=round(buf_p90, 2),
        recommended_buffer_p95_mw=round(buf_p95, 2),
    )

    _analytics_cache[cache_key] = response
    return response


@api_router.get("/accuracy/daily", response_model=List[DailyAccuracyItem], tags=["Analytics"])
def get_accuracy_daily(
    cutoff: str = Depends(validate_cutoff),
    repo: DataRepository = Depends(get_repository),
):
    """Get day-by-day accuracy metrics and expanding-window dynamic recommended safety buffer."""
    cache_key = f"daily_{cutoff}"
    if cache_key in _analytics_cache:
        return _analytics_cache[cache_key]

    errors_df = _get_or_compute_all_errors(repo, cutoff)
    if errors_df.empty:
        raise HTTPException(status_code=404, detail="No error data available.")

    daily_agg = aggregate_by_delivery_day(errors_df)
    expanding_buf = recommended_buffer_expanding_window(
        errors_df, quantile=0.90, min_history_days=1
    )

    import pandas as pd

    merged = pd.merge(
        daily_agg,
        expanding_buf[["delivery_date", "recommended_buffer_mw"]],
        on="delivery_date",
        how="left",
    )
    merged["recommended_buffer_mw"] = merged["recommended_buffer_mw"].fillna(0.0)

    items = [
        DailyAccuracyItem(
            delivery_date=str(row["delivery_date"]),
            count=int(row["count"]),
            bias=round(float(row["bias"]), 2),
            mae=round(float(row["mae"]), 2),
            rmse=round(float(row["rmse"]), 2),
            wape=round(float(row["wape"]), 2),
            p90_over_forecast=round(float(row["p90_over_forecast"]), 2),
            pct_within_10pct=round(float(row["pct_within_10pct"]), 2),
            recommended_buffer_mw=round(float(row["recommended_buffer_mw"]), 2),
        )
        for _, row in merged.iterrows()
    ]

    _analytics_cache[cache_key] = items
    return items


@api_router.get("/accuracy/by-hour", response_model=List[HourlyAccuracyItem], tags=["Analytics"])
def get_accuracy_by_hour(
    cutoff: str = Depends(validate_cutoff),
    repo: DataRepository = Depends(get_repository),
):
    """Get forecast error profiling grouped by hour of the day (0 to 23 UTC)."""
    cache_key = f"hourly_{cutoff}"
    if cache_key in _analytics_cache:
        return _analytics_cache[cache_key]

    errors_df = _get_or_compute_all_errors(repo, cutoff)
    if errors_df.empty:
        raise HTTPException(status_code=404, detail="No error data available.")

    hr_agg = aggregate_by_hour_of_day(errors_df)
    items = [
        HourlyAccuracyItem(
            hour=int(row["hour"]),
            count=int(row["count"]),
            bias=round(float(row["bias"]), 2),
            mae=round(float(row["mae"]), 2),
            rmse=round(float(row["rmse"]), 2),
            wape=round(float(row["wape"]), 2),
            p90_over_forecast=round(float(row["p90_over_forecast"]), 2),
            pct_within_10pct=round(float(row["pct_within_10pct"]), 2),
        )
        for _, row in hr_agg.iterrows()
    ]

    _analytics_cache[cache_key] = items
    return items


@api_router.get("/accuracy/by-horizon", response_model=List[HorizonAccuracyItem], tags=["Analytics"])
def get_accuracy_by_horizon(
    cutoff: str = Depends(validate_cutoff),
    repo: DataRepository = Depends(get_repository),
):
    """Get forecast accuracy breakdown by lead-time horizon buckets (0-6h, 6-12h, 12-24h, 24-48h, 48h+)."""
    cache_key = f"horizon_{cutoff}"
    if cache_key in _analytics_cache:
        return _analytics_cache[cache_key]

    errors_df = _get_or_compute_all_errors(repo, cutoff)
    if errors_df.empty:
        raise HTTPException(status_code=404, detail="No error data available.")

    hor_agg = aggregate_by_horizon_bucket(errors_df)
    items = [
        HorizonAccuracyItem(
            horizon_bucket=str(row["horizon_bucket"]),
            count=int(row["count"]),
            bias=round(float(row["bias"]), 2),
            mae=round(float(row["mae"]), 2),
            rmse=round(float(row["rmse"]), 2),
            wape=round(float(row["wape"]), 2),
            p90_over_forecast=round(float(row["p90_over_forecast"]), 2),
        )
        for _, row in hor_agg.iterrows()
    ]

    _analytics_cache[cache_key] = items
    return items


@api_router.get("/accuracy/distribution", response_model=List[ErrorHistogramItem], tags=["Analytics"])
def get_accuracy_distribution(
    cutoff: str = Depends(validate_cutoff),
    bin_size_mw: float = Query(500.0, ge=100.0, le=2000.0, description="Bin width in MW"),
    repo: DataRepository = Depends(get_repository),
):
    """Get error frequency distribution histogram (Forecast - Actual) for risk profiling."""
    cache_key = f"dist_{cutoff}_{bin_size_mw}"
    if cache_key in _analytics_cache:
        return _analytics_cache[cache_key]

    errors_df = _get_or_compute_all_errors(repo, cutoff)
    if errors_df.empty:
        raise HTTPException(status_code=404, detail="No error data available.")

    hist_df = compute_error_histogram(errors_df, bin_size_mw=bin_size_mw)
    items = [
        ErrorHistogramItem(
            bin_min=float(row["bin_min"]),
            bin_max=float(row["bin_max"]),
            bin_label=str(row["bin_label"]),
            count=int(row["count"]),
            frequency_pct=round(float(row["frequency_pct"]), 2),
        )
        for _, row in hist_df.iterrows()
    ]

    _analytics_cache[cache_key] = items
    return items


@api_router.get("/accuracy/timeseries", response_model=List[TimeseriesPoint], tags=["Analytics"])
def get_accuracy_timeseries(
    cutoff: str = Depends(validate_cutoff),
    repo: DataRepository = Depends(get_repository),
):
    """
    Get full January 2026 hourly timeseries of forecasts vs actuals at the specified cutoff
    for month-wide trajectory exploration and brush zooming.
    """
    cache_key = f"timeseries_{cutoff}"
    if cache_key in _analytics_cache:
        return _analytics_cache[cache_key]

    errors_df = _get_or_compute_all_errors(repo, cutoff)
    if errors_df.empty:
        raise HTTPException(status_code=404, detail="No timeseries data available.")

    buf_p90 = recommended_buffer(errors_df, quantile=0.90)

    # Sort chronologically by startTime
    sorted_df = errors_df.sort_values("startTime").reset_index(drop=True)
    items = [
        TimeseriesPoint(
            startTime=row["startTime"],
            delivery_date=str(row["delivery_date"]),
            hour=int(row["hour"]),
            forecast_mw=round(float(row["forecast_mw"]), 2),
            actual_mw=round(float(row["actual_mw"]), 2)
            if "actual_mw" in row and not pd.isna(row["actual_mw"])
            else None,
            error_mw=round(float(row["error_mw"]), 2)
            if "error_mw" in row and not pd.isna(row["error_mw"])
            else None,
            p90_buffer_mw=round(float(buf_p90), 2),
            p90_hedge_mw=round(max(0.0, float(row["forecast_mw"]) - float(buf_p90)), 2),
        )
        for _, row in sorted_df.iterrows()
    ]

    _analytics_cache[cache_key] = items
    return items


# Mount router with and without /api prefix for maximum deployment flexibility
app.include_router(api_router, prefix="/api")
app.include_router(api_router)

@app.get("/", tags=["System"])
def root_status():
    return {"status": "ok", "service": "GridBricks UK Wind Trading API", "version": "0.1.0"}
