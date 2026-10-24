"""
backend/app/models.py
Typed Pydantic domain models for Elexon BMRS datasets.
Normalises all datetime timestamps to timezone-aware UTC.
"""

from datetime import datetime, timezone
from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator


def _ensure_utc(v: Any) -> datetime:
    """Helper to convert str or datetime to tz-aware UTC datetime."""
    if isinstance(v, str):
        # Elexon returns ISO 8601 strings like '2026-01-01T00:00:00Z'
        # Handle trailing Z
        cleaned = v.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
    elif isinstance(v, datetime):
        dt = v
    else:
        raise ValueError(f"Cannot parse datetime from type {type(v)}: {v}")

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt


class FuelHHRecord(BaseModel):
    """
    Model representing a single half-hour fuel outturn record (FUELHH).
    """
    dataset: str = "FUELHH"
    publishTime: datetime
    startTime: datetime
    settlementDate: str
    settlementPeriod: int
    fuelType: str = "WIND"
    generation: float = Field(..., description="Generation in MW")

    @field_validator("publishTime", "startTime", mode="before")
    @classmethod
    def normalise_timestamps(cls, v: Any) -> datetime:
        return _ensure_utc(v)

    @field_validator("generation", mode="before")
    @classmethod
    def validate_generation(cls, v: Any) -> float:
        if v is None:
            raise ValueError("Generation value cannot be None")
        val = float(v)
        if val < 0:
            raise ValueError(f"Generation cannot be negative: {val}")
        return val


class WindForecastRecord(BaseModel):
    """
    Model representing a single wind forecast record (WINDFOR).
    """
    dataset: str = "WINDFOR"
    publishTime: datetime
    startTime: datetime
    generation: float = Field(..., description="Forecasted Generation in MW")

    @field_validator("publishTime", "startTime", mode="before")
    @classmethod
    def normalise_timestamps(cls, v: Any) -> datetime:
        return _ensure_utc(v)

    @field_validator("generation", mode="before")
    @classmethod
    def validate_generation(cls, v: Any) -> float:
        if v is None:
            raise ValueError("Generation value cannot be None")
        val = float(v)
        if val < 0:
            raise ValueError(f"Generation cannot be negative: {val}")
        return val
