"""
backend/app/analytics.py
Pure, typed, documented pandas analytics functions for day-ahead wind trading desk.
Calculates point-in-time forecasts, error tables, accuracy metrics, multi-dimensional aggregations,
and expanding-window safety buffers.
"""

from datetime import datetime, date, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional, Union, Dict, Any, List
import numpy as np
import pandas as pd


def _ensure_utc_datetime(dt_val: Any) -> datetime:
    """Helper to convert date, str, or datetime to tz-aware UTC datetime."""
    if isinstance(dt_val, str):
        cleaned = dt_val.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
    elif isinstance(dt_val, date) and not isinstance(dt_val, datetime):
        dt = datetime(dt_val.year, dt_val.month, dt_val.day, 0, 0, tzinfo=timezone.utc)
    elif isinstance(dt_val, datetime):
        dt = dt_val
    else:
        raise TypeError(f"Unsupported datetime type: {type(dt_val)}")

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def compute_decision_cutoff(delivery_date: Union[date, str], cutoff_hhmm: str = "11:00") -> datetime:
    """
    Compute the auction gate cutoff timestamp in UTC.
    The cutoff is evaluated on the day prior to delivery (D-1) at cutoff_hhmm in Europe/London timezone.

    Formula:
        trading_day = delivery_date - 1 day
        cutoff_utc = datetime(trading_day, cutoff_hhmm, tz="Europe/London").astimezone(UTC)
    """
    if isinstance(delivery_date, str):
        d = date.fromisoformat(delivery_date)
    elif isinstance(delivery_date, datetime):
        d = delivery_date.date()
    else:
        d = delivery_date

    trading_day = d - timedelta(days=1)
    hour, minute = map(int, cutoff_hhmm.strip().split(":"))

    london_tz = ZoneInfo("Europe/London")
    cutoff_london = datetime(trading_day.year, trading_day.month, trading_day.day, hour, minute, tzinfo=london_tz)
    return cutoff_london.astimezone(timezone.utc)


def latest_forecast_at_cutoff(
    forecasts: pd.DataFrame,
    delivery_date: Union[date, str],
    cutoff_hhmm: str = "11:00",
) -> pd.DataFrame:
    """
    Extract the latest available wind forecast for each target startTime on delivery_date,
    strictly conditioned on publishTime <= decision_cutoff(D-1, cutoff_hhmm).

    Parameters:
        forecasts: DataFrame with columns ['startTime', 'publishTime', 'generation'].
        delivery_date: Target delivery date D (date object or 'YYYY-MM-DD').
        cutoff_hhmm: Auction gate closure time on D-1 in London clock time (default '11:00').

    Formula:
        For each target period t in delivery_date:
            latest_version(t) = argmax_{publishTime <= cutoff}(publishTime)
            forecast_mw(t) = generation of latest_version(t)
            horizon_hours(t) = (t - publishTime) in hours

    Returns:
        DataFrame with columns:
            ['startTime', 'forecast_mw', 'publishTime', 'horizon_hours', 'delivery_date', 'cutoff_time']
        Empty DataFrame with these columns if no eligible forecast exists.
    """
    cols = ["startTime", "forecast_mw", "publishTime", "horizon_hours", "delivery_date", "cutoff_time"]
    if forecasts.empty:
        return pd.DataFrame(columns=cols)

    df = forecasts.copy()
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
    df["generation"] = pd.to_numeric(df["generation"], errors="coerce")

    # Drop invalid rows
    df = df.dropna(subset=["startTime", "publishTime", "generation"])

    # Target delivery bounds
    if isinstance(delivery_date, str):
        d_target = date.fromisoformat(delivery_date)
    elif isinstance(delivery_date, datetime):
        d_target = delivery_date.date()
    else:
        d_target = delivery_date

    d_start = datetime(d_target.year, d_target.month, d_target.day, 0, 0, tzinfo=timezone.utc)
    d_end = d_start + timedelta(days=1)

    cutoff_utc = compute_decision_cutoff(d_target, cutoff_hhmm)

    # 1. Strictly filter target delivery day
    day_mask = (df["startTime"] >= d_start) & (df["startTime"] < d_end)
    # 2. Strictly filter by auction gate cutoff
    cutoff_mask = df["publishTime"] <= cutoff_utc

    eligible = df[day_mask & cutoff_mask].copy()
    if eligible.empty:
        return pd.DataFrame(columns=cols)

    # Pick latest publishTime for each startTime
    # Sort by startTime asc, publishTime asc, then keep last
    latest = eligible.sort_values(["startTime", "publishTime"]).drop_duplicates(subset=["startTime"], keep="last")

    latest["forecast_mw"] = latest["generation"]
    latest["horizon_hours"] = (latest["startTime"] - latest["publishTime"]).dt.total_seconds() / 3600.0
    latest["delivery_date"] = d_target.isoformat()
    latest["cutoff_time"] = cutoff_utc

    result = latest[cols].reset_index(drop=True)
    return result


def forecast_revisions(
    forecasts: pd.DataFrame,
    delivery_date: Union[date, str],
    max_publish_time: Optional[datetime] = None,
) -> pd.DataFrame:
    """
    Extract all forecast versions published for a given delivery date, optionally capped
    by a maximum publish timestamp (useful for plotting forecast evolution fan charts).

    Parameters:
        forecasts: DataFrame with columns ['startTime', 'publishTime', 'generation'].
        delivery_date: Target delivery date D.
        max_publish_time: Optional ceiling on publication time.

    Returns:
        DataFrame sorted by [publishTime, startTime] with columns:
            ['publishTime', 'startTime', 'forecast_mw', 'horizon_hours']
    """
    cols = ["publishTime", "startTime", "forecast_mw", "horizon_hours"]
    if forecasts.empty:
        return pd.DataFrame(columns=cols)

    df = forecasts.copy()
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
    df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
    df = df.dropna(subset=["startTime", "publishTime", "generation"])

    if isinstance(delivery_date, str):
        d_target = date.fromisoformat(delivery_date)
    elif isinstance(delivery_date, datetime):
        d_target = delivery_date.date()
    else:
        d_target = delivery_date

    d_start = datetime(d_target.year, d_target.month, d_target.day, 0, 0, tzinfo=timezone.utc)
    d_end = d_start + timedelta(days=1)

    mask = (df["startTime"] >= d_start) & (df["startTime"] < d_end)
    if max_publish_time is not None:
        mpt = _ensure_utc_datetime(max_publish_time)
        mask &= (df["publishTime"] <= mpt)

    revs = df[mask].copy()
    if revs.empty:
        return pd.DataFrame(columns=cols)

    revs["forecast_mw"] = revs["generation"]
    revs["horizon_hours"] = (revs["startTime"] - revs["publishTime"]).dt.total_seconds() / 3600.0
    revs = revs.sort_values(["publishTime", "startTime"]).reset_index(drop=True)
    return revs[cols]


def compute_errors(
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    alignment: str = "hourly",
) -> pd.DataFrame:
    """
    Join forecasts and actuals to compute forecast errors.

    Parameters:
        forecasts: DataFrame containing ['startTime', 'forecast_mw'] (and optionally 'publishTime', 'horizon_hours').
        actuals: DataFrame containing ['startTime', 'generation'] (from FUELHH).
        alignment: Resolution alignment strategy:
            - 'hourly' (default): Aggregates half-hourly actuals to hourly mean ((SP1 + SP2)/2).
            - 'half_hourly': Broadcasts hourly forecast to both 30-min settlement periods.

    Formulas:
        error = forecast_mw - actual_mw
        abs_error = |error|
        pct_error = (|error| / actual_mw) * 100  (when actual_mw > 0)

    Sign Convention:
        error > 0: Over-forecast (generation shortfall, imbalance deficit)
        error < 0: Under-forecast (generation surplus, spill volume)

    Returns:
        DataFrame with columns:
            ['startTime', 'delivery_date', 'hour', 'forecast_mw', 'actual_mw',
             'error_mw', 'abs_error_mw', 'pct_error', 'publishTime', 'horizon_hours']
    """
    cols = [
        "startTime", "delivery_date", "hour", "forecast_mw", "actual_mw",
        "error_mw", "abs_error_mw", "pct_error", "publishTime", "horizon_hours"
    ]
    if forecasts.empty or actuals.empty:
        return pd.DataFrame(columns=cols)

    fc = forecasts.copy()
    fc["startTime"] = pd.to_datetime(fc["startTime"], utc=True)
    if "forecast_mw" not in fc.columns and "generation" in fc.columns:
        fc["forecast_mw"] = fc["generation"]
    fc["forecast_mw"] = pd.to_numeric(fc["forecast_mw"], errors="coerce")

    act = actuals.copy()
    act["startTime"] = pd.to_datetime(act["startTime"], utc=True)
    act["generation"] = pd.to_numeric(act["generation"], errors="coerce")

    if alignment == "hourly":
        # Aggregate half-hourly actuals to hour level
        act["hour_start"] = act["startTime"].dt.floor("h")
        act_agg = act.groupby("hour_start", as_index=False).agg(
            actual_mw=("generation", "mean")
        ).rename(columns={"hour_start": "startTime"})

        # Ensure forecasts are on the hour
        fc["startTime"] = fc["startTime"].dt.floor("h")
        merged = pd.merge(fc, act_agg, on="startTime", how="inner")
    elif alignment == "half_hourly":
        # Broadcast hourly forecast to half hours
        fc["hour_start"] = fc["startTime"].dt.floor("h")
        act["hour_start"] = act["startTime"].dt.floor("h")
        merged = pd.merge(act, fc, on="hour_start", how="inner", suffixes=("_act", "_fc"))
        merged["startTime"] = merged["startTime_act"]
        merged["actual_mw"] = merged["generation"]
    else:
        raise ValueError(f"Unsupported alignment: {alignment}. Must be 'hourly' or 'half_hourly'.")

    if merged.empty:
        return pd.DataFrame(columns=cols)

    # Compute errors
    merged["error_mw"] = merged["forecast_mw"] - merged["actual_mw"]
    merged["abs_error_mw"] = merged["error_mw"].abs()
    merged["pct_error"] = np.where(
        merged["actual_mw"] > 0,
        (merged["abs_error_mw"] / merged["actual_mw"]) * 100.0,
        np.nan
    )
    merged["delivery_date"] = merged["startTime"].dt.date.astype(str)
    merged["hour"] = merged["startTime"].dt.hour

    if "publishTime" not in merged.columns:
        merged["publishTime"] = pd.Series(pd.NaT, index=merged.index, dtype="datetime64[ns, UTC]")
        if "horizon_hours" not in merged.columns:
            merged["horizon_hours"] = np.nan
    else:
        merged["publishTime"] = pd.to_datetime(merged["publishTime"], utc=True)
        if "horizon_hours" not in merged.columns:
            if merged["publishTime"].isna().all():
                merged["horizon_hours"] = np.nan
            else:
                merged["horizon_hours"] = (merged["startTime"] - merged["publishTime"]).dt.total_seconds() / 3600.0

    res = merged[cols].sort_values("startTime").reset_index(drop=True)
    return res



def calculate_metrics(errors_df: pd.DataFrame) -> Dict[str, float]:
    """
    Compute quantitative forecast accuracy metrics for day-ahead wind power.

    Formulas:
        count = N (number of matched delivery periods)
        bias (MBE) = (1/N) * sum(forecast - actual)
        mae = (1/N) * sum(|forecast - actual|)
        rmse = sqrt( (1/N) * sum((forecast - actual)^2) )
        wape = sum(|forecast - actual|) / sum(actual) * 100%
        p50_abs_error = median(|forecast - actual|)
        p90_abs_error = 90th percentile(|forecast - actual|)
        p95_abs_error = 95th percentile(|forecast - actual|)
        p90_over_forecast = 90th percentile of (forecast - actual)
        pct_within_10pct = % of periods where |forecast - actual| <= 0.10 * actual

    Returns:
        Dictionary of computed scalar metrics.
    """
    empty_result = {
        "count": 0,
        "bias": float("nan"),
        "mae": float("nan"),
        "rmse": float("nan"),
        "wape": float("nan"),
        "p50_abs_error": float("nan"),
        "p90_abs_error": float("nan"),
        "p95_abs_error": float("nan"),
        "p90_over_forecast": float("nan"),
        "pct_within_10pct": float("nan"),
        "mean_actual_mw": float("nan"),
        "mean_forecast_mw": float("nan"),
    }
    if errors_df.empty or "error_mw" not in errors_df.columns:
        return empty_result

    clean = errors_df.dropna(subset=["error_mw", "actual_mw"]).copy()
    n = len(clean)
    if n == 0:
        return empty_result

    err = clean["error_mw"]
    abs_err = clean["abs_error_mw"]
    actual = clean["actual_mw"]
    forecast = clean["forecast_mw"]

    sum_actual = actual.sum()
    wape = (abs_err.sum() / sum_actual * 100.0) if sum_actual > 0 else float("nan")

    # % within +/-10% of actual
    within_10 = (abs_err <= 0.10 * actual) & (actual > 0)
    pct_within_10 = (within_10.sum() / n) * 100.0

    return {
        "count": n,
        "bias": float(err.mean()),
        "mae": float(abs_err.mean()),
        "rmse": float(np.sqrt((err ** 2).mean())),
        "wape": float(wape),
        "p50_abs_error": float(abs_err.quantile(0.50)),
        "p90_abs_error": float(abs_err.quantile(0.90)),
        "p95_abs_error": float(abs_err.quantile(0.95)),
        "p90_over_forecast": float(err.quantile(0.90)),
        "pct_within_10pct": float(pct_within_10),
        "mean_actual_mw": float(actual.mean()),
        "mean_forecast_mw": float(forecast.mean()),
    }


def aggregate_by_delivery_day(errors_df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate forecast accuracy metrics grouped by delivery day.

    Returns:
        DataFrame indexed by delivery_date with daily summary metrics.
    """
    if errors_df.empty or "delivery_date" not in errors_df.columns:
        return pd.DataFrame()

    results = []
    for d_date, group in errors_df.groupby("delivery_date"):
        m = calculate_metrics(group)
        m["delivery_date"] = d_date
        results.append(m)

    res_df = pd.DataFrame(results)
    # Reorder columns with delivery_date first
    first_cols = ["delivery_date", "count", "bias", "mae", "rmse", "wape", "p90_over_forecast", "pct_within_10pct"]
    remaining = [c for c in res_df.columns if c not in first_cols]
    return res_df[first_cols + remaining].sort_values("delivery_date").reset_index(drop=True)


def aggregate_by_hour_of_day(errors_df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate forecast accuracy metrics grouped by hour of the day (0 to 23 UTC).

    Returns:
        DataFrame with 24 hourly rows detailing intra-day error profiling.
    """
    if errors_df.empty or "hour" not in errors_df.columns:
        return pd.DataFrame()

    results = []
    for hr, group in errors_df.groupby("hour"):
        m = calculate_metrics(group)
        m["hour"] = int(hr)
        results.append(m)

    res_df = pd.DataFrame(results)
    first_cols = ["hour", "count", "bias", "mae", "rmse", "wape", "p90_over_forecast", "pct_within_10pct"]
    remaining = [c for c in res_df.columns if c not in first_cols]
    return res_df[first_cols + remaining].sort_values("hour").reset_index(drop=True)


def aggregate_by_horizon_bucket(
    errors_df: pd.DataFrame,
    buckets: Optional[List[tuple]] = None,
) -> pd.DataFrame:
    """
    Aggregate forecast accuracy metrics grouped by lead time / horizon buckets.

    Default buckets:
        - 0-6h (Intraday)
        - 6-12h (Near day-ahead)
        - 12-24h (Standard day-ahead)
        - 24-48h (Two-day ahead)
        - 48h+ (Medium range)

    Returns:
        DataFrame containing error progression as forecast horizon expands.
    """
    if errors_df.empty or "horizon_hours" not in errors_df.columns:
        return pd.DataFrame()

    if buckets is None:
        bins = [-float("inf"), 6.0, 12.0, 24.0, 48.0, float("inf")]
        labels = ["0-6h", "6-12h", "12-24h", "24-48h", "48h+"]
    else:
        bins = [-float("inf")] + [b[1] for b in buckets[:-1]] + [float("inf")]
        labels = [b[0] for b in buckets]

    df = errors_df.copy()
    df["horizon_bucket"] = pd.cut(df["horizon_hours"], bins=bins, labels=labels, right=True)

    results = []
    for bucket_name, group in df.groupby("horizon_bucket", observed=False):
        m = calculate_metrics(group)
        m["horizon_bucket"] = bucket_name
        results.append(m)

    res_df = pd.DataFrame(results)
    first_cols = ["horizon_bucket", "count", "bias", "mae", "rmse", "wape", "p90_over_forecast"]
    remaining = [c for c in res_df.columns if c not in first_cols]
    return res_df[first_cols + remaining].reset_index(drop=True)


def compute_error_histogram(
    errors_df: pd.DataFrame,
    bin_size_mw: float = 500.0,
) -> pd.DataFrame:
    """
    Compute frequency distribution of forecast errors (Forecast - Actual) for risk histograms.

    Parameters:
        errors_df: DataFrame containing 'error_mw'.
        bin_size_mw: Width of each histogram bin in MW (default 500 MW).

    Returns:
        DataFrame with columns ['bin_min', 'bin_max', 'bin_label', 'count', 'frequency_pct'].
    """
    cols = ["bin_min", "bin_max", "bin_label", "count", "frequency_pct"]
    if errors_df.empty or "error_mw" not in errors_df.columns:
        return pd.DataFrame(columns=cols)

    err = errors_df["error_mw"].dropna()
    if len(err) == 0:
        return pd.DataFrame(columns=cols)

    min_err = np.floor(err.min() / bin_size_mw) * bin_size_mw
    max_err = np.ceil(err.max() / bin_size_mw) * bin_size_mw

    # Create bins
    bins = np.arange(min_err, max_err + bin_size_mw, bin_size_mw)
    counts, edges = np.histogram(err, bins=bins)
    total = len(err)

    rows = []
    for i in range(len(counts)):
        b_min = edges[i]
        b_max = edges[i + 1]
        c = counts[i]
        rows.append({
            "bin_min": float(b_min),
            "bin_max": float(b_max),
            "bin_label": f"[{b_min:.0f}, {b_max:.0f})",
            "count": int(c),
            "frequency_pct": float((c / total) * 100.0),
        })

    return pd.DataFrame(rows)


def recommended_buffer(errors: Union[pd.DataFrame, pd.Series], quantile: float = 0.90) -> float:
    """
    Compute the recommended safety buffer in MW to protect against generation shortfalls.

    Formula:
        buffer = Quantile_{q}(error_mw) where error_mw = Forecast - Actual.

    Implication:
        Subtracting this buffer from the forecast ensures that:
            P(Actual < Forecast - Buffer) <= 1 - quantile.
        For quantile=0.90, the desk has 90% confidence that physical outturn
        will satisfy or exceed the hedged delivery volume.

    Returns:
        Buffer size in MW (float). Returns 0.0 if empty or negative.
    """
    if isinstance(errors, pd.DataFrame):
        if "error_mw" not in errors.columns:
            return 0.0
        s = errors["error_mw"].dropna()
    elif isinstance(errors, pd.Series):
        s = errors.dropna()
    else:
        raise TypeError("errors must be a DataFrame or Series")

    if len(s) == 0:
        return 0.0

    buf = float(s.quantile(quantile))
    # Buffer cannot be negative (a negative buffer would imply adding volume to an over-forecaster)
    return max(0.0, buf)


def recommended_buffer_expanding_window(
    errors_df: pd.DataFrame,
    quantile: float = 0.90,
    min_history_days: int = 1,
) -> pd.DataFrame:
    """
    Compute daily recommended safety buffer using an expanding historical window.
    For each delivery day D, the safety buffer is calculated exclusively using errors
    from days strictly preceding D (delivery_date < D).

    Ensures zero look-ahead bias and simulates true live desk performance.

    Parameters:
        errors_df: DataFrame containing ['delivery_date', 'error_mw'].
        quantile: Desired confidence level (default 0.90).
        min_history_days: Minimum days of prior history required before computing a dynamic buffer.

    Returns:
        DataFrame with columns:
            ['delivery_date', 'recommended_buffer_mw', 'history_days_count', 'mean_error_prior_mw']
    """
    cols = ["delivery_date", "recommended_buffer_mw", "history_days_count", "mean_error_prior_mw"]
    if errors_df.empty or "delivery_date" not in errors_df.columns:
        return pd.DataFrame(columns=cols)

    df = errors_df.dropna(subset=["delivery_date", "error_mw"]).copy()
    unique_days = sorted(df["delivery_date"].unique())

    records = []
    for i, current_day in enumerate(unique_days):
        # Prior history strictly before current_day
        prior_data = df[df["delivery_date"] < current_day]
        prior_days_count = prior_data["delivery_date"].nunique()

        if prior_days_count >= min_history_days:
            buf = recommended_buffer(prior_data["error_mw"], quantile=quantile)
            mean_prior = float(prior_data["error_mw"].mean())
        else:
            # Fall back to 0.0 or initial day estimate
            buf = 0.0
            mean_prior = float("nan")

        records.append({
            "delivery_date": current_day,
            "recommended_buffer_mw": buf,
            "history_days_count": prior_days_count,
            "mean_error_prior_mw": mean_prior,
        })

    return pd.DataFrame(records)
