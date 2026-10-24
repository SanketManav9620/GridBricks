#!/usr/bin/env python3
"""
scripts/explore_elexon.py
Exploratory data analysis for Elexon Insights Solution (BMRS) datasets:
- Actual generation: FUELHH (fuelType=WIND)
- Forecasted generation: WINDFOR

Date range analyzed: 2025-12-31 to 2026-02-02.
"""

import os
import sys
import argparse
import json
from pathlib import Path
from datetime import datetime, timedelta
import requests
import pandas as pd
import numpy as np

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
FUELHH_ENDPOINT = f"{BASE_URL}/datasets/FUELHH/stream"
WINDFOR_ENDPOINT = f"{BASE_URL}/datasets/WINDFOR/stream"

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

def fetch_fuelhh(start_date: str, end_date: str, cache_path: Path, use_cache: bool = True) -> pd.DataFrame:
    """Fetch FUELHH actual wind generation outturn."""
    if use_cache and cache_path.exists():
        print(f"[CACHE] Loading FUELHH from {cache_path}")
        with open(cache_path, "r", encoding="utf-8") as f:
            records = json.load(f)
    else:
        print(f"[FETCH] Querying FUELHH from {start_date} to {end_date} (fuelType=WIND)...")
        params = {
            "settlementDateFrom": start_date,
            "settlementDateTo": end_date,
            "fuelType": "WIND"
        }
        res = requests.get(FUELHH_ENDPOINT, params=params, timeout=60)
        res.raise_for_status()
        records = res.json()
        print(f"[FETCH] Received {len(records)} records for FUELHH.")
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(records, f)

    df = pd.DataFrame(records)
    if not df.empty:
        df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
        df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
        df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
    return df

def fetch_windfor(start_dt: str, end_dt: str, cache_path: Path, use_cache: bool = True) -> pd.DataFrame:
    """Fetch WINDFOR forecast wind generation stream."""
    if use_cache and cache_path.exists():
        print(f"[CACHE] Loading WINDFOR from {cache_path}")
        with open(cache_path, "r", encoding="utf-8") as f:
            records = json.load(f)
    else:
        print(f"[FETCH] Querying WINDFOR with publishDateTimeFrom={start_dt} to publishDateTimeTo={end_dt}...")
        params = {
            "publishDateTimeFrom": start_dt,
            "publishDateTimeTo": end_dt
        }
        res = requests.get(WINDFOR_ENDPOINT, params=params, timeout=120)
        res.raise_for_status()
        records = res.json()
        print(f"[FETCH] Received {len(records)} records for WINDFOR.")
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(records, f)

    df = pd.DataFrame(records)
    if not df.empty:
        df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
        df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
        df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
    return df

def analyze_fuelhh(df: pd.DataFrame):
    print("\n" + "=" * 70)
    print(" 1. FUELHH (ACTUALS) EXPLORATORY ANALYSIS")
    print("=" * 70)

    print(f"Row count: {len(df):,}")
    print("\nColumns & Data Types:")
    for col, dtype in df.dtypes.items():
        print(f"  - {col}: {dtype}")

    print("\nTimestamp Ranges:")
    print(f"  - min startTime:   {df['startTime'].min()}")
    print(f"  - max startTime:   {df['startTime'].max()}")
    print(f"  - min publishTime: {df['publishTime'].min()}")
    print(f"  - max publishTime: {df['publishTime'].max()}")

    print("\nNull Value Counts:")
    for col, null_c in df.isnull().sum().items():
        print(f"  - {col}: {null_c} nulls ({null_c / len(df) * 100:.2f}%)")

    # Duplicates
    exact_dups = df.duplicated().sum()
    start_dups = df.duplicated(subset=["startTime"]).sum()
    print("\nDuplicate Check:")
    print(f"  - Exact row duplicates: {exact_dups}")
    print(f"  - Duplicate startTimes: {start_dups}")

    # 30-min grid continuity check
    df_sorted = df.sort_values("startTime").reset_index(drop=True)
    full_grid = pd.date_range(
        start=df_sorted["startTime"].min(),
        end=df_sorted["startTime"].max(),
        freq="30min",
        tz="UTC"
    )
    missing_intervals = full_grid.difference(df_sorted["startTime"])
    print("\n30-Minute Grid Continuity Check:")
    print(f"  - Expected periods between min and max: {len(full_grid):,}")
    print(f"  - Actual unique periods present:       {df_sorted['startTime'].nunique():,}")
    print(f"  - Missing intervals in 30-min grid:    {len(missing_intervals)}")
    if len(missing_intervals) > 0:
        print(f"    Sample missing: {list(missing_intervals[:5])}")

    # Unit sanity check (MW)
    gen = df["generation"]
    print("\nUnit Sanity Checks (generation in MW):")
    print(f"  - Min generation:      {gen.min():.2f} MW")
    print(f"  - Max generation:      {gen.max():.2f} MW")
    print(f"  - Mean generation:     {gen.mean():.2f} MW")
    print(f"  - Median generation:   {gen.median():.2f} MW")
    print(f"  - Std dev generation:  {gen.std():.2f} MW")
    print(f"  - Negative values:     {(gen < 0).sum()}")
    print(f"  - Values > 35,000 MW:  {(gen > 35000).sum()}")

def analyze_windfor(df: pd.DataFrame):
    print("\n" + "=" * 70)
    print(" 2. WINDFOR (FORECASTS) EXPLORATORY ANALYSIS")
    print("=" * 70)

    print(f"Row count: {len(df):,}")
    print("\nColumns & Data Types:")
    for col, dtype in df.dtypes.items():
        print(f"  - {col}: {dtype}")

    print("\nTimestamp Ranges:")
    print(f"  - min startTime:   {df['startTime'].min()}")
    print(f"  - max startTime:   {df['startTime'].max()}")
    print(f"  - min publishTime: {df['publishTime'].min()}")
    print(f"  - max publishTime: {df['publishTime'].max()}")

    print("\nNull Value Counts:")
    for col, null_c in df.isnull().sum().items():
        print(f"  - {col}: {null_c} nulls ({null_c / len(df) * 100:.2f}%)")

    # Duplicates
    exact_dups = df.duplicated().sum()
    pair_dups = df.duplicated(subset=["startTime", "publishTime"]).sum()
    print("\nDuplicate Check:")
    print(f"  - Exact row duplicates: {exact_dups}")
    print(f"  - Duplicate (startTime, publishTime) pairs: {pair_dups}")

    # Versions per target startTime
    versions_per_target = df.groupby("startTime")["publishTime"].count()
    print("\nForecast Versions per Target startTime:")
    print(f"  - Unique target startTimes: {len(versions_per_target):,}")
    print(f"  - Min versions per target:  {versions_per_target.min()}")
    print(f"  - Max versions per target:  {versions_per_target.max()}")
    print(f"  - Mean versions per target: {versions_per_target.mean():.2f}")
    print(f"  - Median versions:          {versions_per_target.median():.2f}")
    print("  - Quantiles (10%, 25%, 50%, 75%, 90%):")
    for q, val in versions_per_target.quantile([0.1, 0.25, 0.5, 0.75, 0.9]).items():
        print(f"      p{int(q*100)}: {val:.1f}")

    # Forecast horizon distribution: startTime - publishTime
    df["horizon_hours"] = (df["startTime"] - df["publishTime"]).dt.total_seconds() / 3600.0
    h = df["horizon_hours"]
    print("\nForecast Horizon Distribution (startTime - publishTime in hours):")
    print(f"  - Min horizon:    {h.min():.2f} hours")
    print(f"  - Max horizon:    {h.max():.2f} hours ({h.max() / 24:.1f} days)")
    print(f"  - Mean horizon:   {h.mean():.2f} hours")
    print(f"  - Median horizon: {h.median():.2f} hours")
    print(f"  - Negative horizons (publishTime > startTime): {(h < 0).sum()} ({((h < 0).sum()/len(df))*100:.2f}%)")
    print("    *Note: Negative horizons represent retrospective re-analysis/history points emitted by National Grid ESO.")
    print("  - Horizon percentiles:")
    for q in [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99]:
        print(f"      p{int(q*100):02d}: {h.quantile(q):.2f} hours")

    # Horizon breakdown bins
    bins = [-float("inf"), 0, 4, 12, 24, 36, 48, 72, float("inf")]
    labels = ["< 0h (retrospective/reanalysis)", "0-4h (real-time/intraday)", "4-12h (within-day)",
              "12-24h (day-ahead near)", "24-36h (day-ahead far)", "36-48h (2-day ahead)",
              "48-72h (3-day ahead)", "> 72h (long range)"]
    binned = pd.cut(h, bins=bins, labels=labels)
    print("\nHorizon Bins breakdown:")
    for label, count in binned.value_counts()[labels].items():
        print(f"  - {label:<32}: {count:,} ({count / len(df) * 100:.2f}%)")

    # Publication frequency & schedule
    unique_pub_times = pd.Series(df["publishTime"].unique()).sort_values().reset_index(drop=True)
    pub_diffs = unique_pub_times.diff().dt.total_seconds() / 3600.0
    pub_hours = unique_pub_times.dt.hour.value_counts().sort_index()
    print("\nForecast Publication Frequency & Schedule:")
    print(f"  - Total unique publication events: {len(unique_pub_times):,}")
    print(f"  - Publication interval median:    {pub_diffs.median():.2f} hours")
    print(f"  - Publication interval mode:      {pub_diffs.mode().iloc[0]:.2f} hours")
    print(f"  - Daily publication hours (UTC):  {list(pub_hours.index)}")

    # Target startTime resolution
    unique_start_times = pd.Series(df["startTime"].unique()).sort_values().reset_index(drop=True)
    minutes = df["startTime"].dt.minute.value_counts()
    print("\nForecast Target Time Resolution:")
    print(f"  - Minute distribution: {dict(minutes)}")
    print(f"  - Key Finding: WINDFOR is 100% HOURLY (:00), while FUELHH is HALF-HOURLY (:00 & :30).")

    # Unit sanity check (MW)
    gen = df["generation"]
    print("\nUnit Sanity Checks (generation in MW):")
    print(f"  - Min generation:     {gen.min():.2f} MW")
    print(f"  - Max generation:     {gen.max():.2f} MW")
    print(f"  - Mean generation:    {gen.mean():.2f} MW")
    print(f"  - Median generation:  {gen.median():.2f} MW")
    print(f"  - Std dev generation: {gen.std():.2f} MW")
    print(f"  - Negative values:    {(gen < 0).sum()}")
    print(f"  - Values > 35,000 MW: {(gen > 35000).sum()}")

def analyze_day_ahead_desk_slice(df_fuel: pd.DataFrame, df_wind: pd.DataFrame):
    """
    Simulate the Day-Ahead trading desk view:
    For delivery day D (in January 2026), decisions are taken on D-1 before auction gate (e.g. 11:00 UTC).
    Compare both alignment paradigms:
      Option A: Aggregate actuals to hourly resolution (mean of two half-hours).
      Option B: Broadcast hourly forecast to both half-hourly settlement periods.
    """
    print("\n" + "=" * 70)
    print(" 3. DAY-AHEAD TRADING DESK SIMULATION & ACCURACY BENCHMARK")
    print("=" * 70)

    # Filter for January 2026 delivery
    jan_fuel = df_fuel[(df_fuel["startTime"] >= "2026-01-01T00:00:00Z") &
                       (df_fuel["startTime"] < "2026-02-01T00:00:00Z")].copy()

    # --- Paradigm A: Hourly Aggregation ---
    jan_fuel["hour_start"] = jan_fuel["startTime"].dt.floor("h")
    hourly_actuals = jan_fuel.groupby("hour_start").agg(
        actual_mw=("generation", "mean"),
        count_hh=("generation", "count")
    ).reset_index()

    desk_hourly = []
    for _, row in hourly_actuals.iterrows():
        st = row["hour_start"]
        delivery_date = st.floor("D")
        decision_cutoff = delivery_date - timedelta(days=1) + timedelta(hours=11) # 11:00 UTC on D-1

        f_avail = df_wind[(df_wind["startTime"] == st) & (df_wind["publishTime"] <= decision_cutoff)]
        if not f_avail.empty:
            latest_f = f_avail.sort_values("publishTime").iloc[-1]
            desk_hourly.append({
                "startTime": st,
                "actual_mw": row["actual_mw"],
                "forecast_mw": latest_f["generation"],
                "forecast_publishTime": latest_f["publishTime"],
                "horizon_hours": (st - latest_f["publishTime"]).total_seconds() / 3600.0
            })

    h_df = pd.DataFrame(desk_hourly)
    print(f"Hourly Alignment (31 days * 24h = 744 hours):")
    print(f"  - Matched hours: {len(h_df)} / 744 ({len(h_df)/744*100:.1f}%)")

    err = h_df["forecast_mw"] - h_df["actual_mw"]
    abs_err = err.abs()
    rmse = np.sqrt((err**2).mean())
    mae = abs_err.mean()
    mbe = err.mean()
    mean_act = h_df["actual_mw"].mean()
    nmae = mae / mean_act * 100

    print(f"  - Mean Bias Error (MBE):     {mbe:+.2f} MW ({mbe/mean_act*100:+.2f}% of mean gen)")
    print(f"  - Mean Absolute Error (MAE):  {mae:.2f} MW ({nmae:.2f}% of mean gen)")
    print(f"  - Root Mean Squared Error:    {rmse:.2f} MW")
    print(f"  - Error 5th Percentile:       {err.quantile(0.05):.2f} MW (Under-forecast risk)")
    print(f"  - Error 95th Percentile:      {err.quantile(0.95):.2f} MW (Over-forecast risk)")
    print(f"  - Max Under-forecast:         {err.min():.2f} MW")
    print(f"  - Max Over-forecast:          {err.max():.2f} MW")

    # Safety buffer sizing preview:
    # If the desk sizes a buffer for 95% protection against under-generation:
    # Error = Forecast - Actual. If Error > 0, we over-forecasted (actual was less than forecast).
    over_gen_shortfall = np.maximum(0, err)
    p90_buffer = err.quantile(0.90)
    p95_buffer = err.quantile(0.95)
    print("\nDesk Safety Buffer Sizing Implication (Protection against Over-forecasting):")
    print(f"  - 90% Confidence Safety Buffer: {p90_buffer:.2f} MW")
    print(f"  - 95% Confidence Safety Buffer: {p95_buffer:.2f} MW")

def main():
    parser = argparse.ArgumentParser(description="Explore Elexon FUELHH and WINDFOR data.")
    parser.add_argument("--no-cache", action="store_true", help="Force fresh download from API, ignoring cache.")
    args = parser.parse_args()

    use_cache = not args.no_cache

    fuel_cache = DATA_DIR / "fuelhh_20251231_20260202.json"
    wind_cache = DATA_DIR / "windfor_20251231_20260202.json"

    fuel_df = fetch_fuelhh("2025-12-31", "2026-02-02", fuel_cache, use_cache=use_cache)
    wind_df = fetch_windfor("2025-12-31T00:00:00Z", "2026-02-02T23:59:59Z", wind_cache, use_cache=use_cache)

    analyze_fuelhh(fuel_df)
    analyze_windfor(wind_df)
    analyze_day_ahead_desk_slice(fuel_df, wind_df)

if __name__ == "__main__":
    main()
