"""
backend/app/schemas.py
Pydantic response models and input validation schemas for the FastAPI API layer.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
    timestamp: datetime


class MetaResponse(BaseModel):
    min_delivery_date: str
    max_delivery_date: str
    available_dates: List[str]
    default_cutoff: str = "09:00"
    market: str = "UK Day-Ahead Electricity Market (BMRS)"
    fuel_type: str = "WIND"
    total_actual_periods: int
    total_forecast_versions: int


class TimeseriesPoint(BaseModel):
    startTime: datetime
    delivery_date: str
    hour: int
    forecast_mw: float
    actual_mw: Optional[float] = None
    error_mw: Optional[float] = None
    p90_buffer_mw: float = 0.0
    p90_hedge_mw: float = 0.0


class ForecastPoint(BaseModel):
    settlementPeriod: int = Field(
        ..., ge=1, le=48, description="Half-hour settlement period (1-48)"
    )
    startTime: datetime = Field(..., description="Target delivery start timestamp (UTC)")
    forecast_mw: float = Field(..., description="Day-ahead forecasted generation in MW")
    publishTime: datetime = Field(
        ..., description="Publication timestamp of this forecast run (UTC)"
    )
    horizon_hours: float = Field(..., description="Forecast horizon/lead time in hours")
    risk_band_p90_mw: float = Field(
        ..., description="Conservative hedge generation (Forecast - P90 buffer)"
    )
    risk_band_p95_mw: float = Field(
        ..., description="High-confidence hedge generation (Forecast - P95 buffer)"
    )


class RevisionItem(BaseModel):
    publishTime: datetime
    startTime: datetime
    forecast_mw: float
    horizon_hours: float


class ForecastResponse(BaseModel):
    delivery_date: str
    cutoff: str
    cutoff_time: datetime
    points: List[ForecastPoint]
    revisions: List[RevisionItem]
    p90_buffer_mw: float
    p95_buffer_mw: float


class ActualPoint(BaseModel):
    settlementPeriod: int = Field(..., ge=1, le=48)
    startTime: datetime
    generation_mw: float


class ActualsResponse(BaseModel):
    delivery_date: str
    points: List[ActualPoint]


class AccuracySummaryResponse(BaseModel):
    cutoff: str
    evaluation_window: str
    total_delivery_periods: int
    bias_mw: float
    mae_mw: float
    rmse_mw: float
    wape_pct: float
    p50_abs_error_mw: float
    p90_abs_error_mw: float
    p95_abs_error_mw: float
    p90_over_forecast_mw: float
    pct_within_10pct: float
    mean_actual_mw: float
    mean_forecast_mw: float
    recommended_buffer_p90_mw: float
    recommended_buffer_p95_mw: float


class DailyAccuracyItem(BaseModel):
    delivery_date: str
    count: int
    bias: float
    mae: float
    rmse: float
    wape: float
    p90_over_forecast: float
    pct_within_10pct: float
    recommended_buffer_mw: float


class HourlyAccuracyItem(BaseModel):
    hour: int
    count: int
    bias: float
    mae: float
    rmse: float
    wape: float
    p90_over_forecast: float
    pct_within_10pct: float


class HorizonAccuracyItem(BaseModel):
    horizon_bucket: str
    count: int
    bias: float
    mae: float
    rmse: float
    wape: float
    p90_over_forecast: float


class ErrorHistogramItem(BaseModel):
    bin_min: float
    bin_max: float
    bin_label: str
    count: int
    frequency_pct: float
