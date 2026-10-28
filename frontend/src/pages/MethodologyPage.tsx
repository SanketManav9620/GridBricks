import React, { useEffect } from 'react';
import {
  BookOpen,
  Clock,
  ShieldCheck,
  Calculator,
  AlertCircle,
  HelpCircle,
  Zap,
  Layers,
  Database,
} from 'lucide-react';

export const MethodologyPage: React.FC = () => {
  useEffect(() => {
    document.title = 'GridBricks | Methodology & Trading Model Reference';
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="border-b border-stone-200/90 pb-5">
        <div className="flex items-center space-x-2.5 text-burgundy-700 mb-2">
          <BookOpen className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wider font-mono">
            Domain Architecture & Quantitative Formulations
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          Methodology & Trading Desk Reference
        </h1>
        <p className="text-sm text-stone-600 mt-1 max-w-3xl leading-relaxed">
          Comprehensive reference explaining day-ahead auction timing mechanics, point-in-time forecast selection,
          statistical error metric formulas, and empirical safety buffer sizing for Great Britain wholesale electricity trading.
        </p>
      </div>

      {/* Section 1: The Day-Ahead Trading Problem & Cutoff Gate */}
      <section className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-burgundy-50 border border-burgundy-200 text-burgundy-700">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            1. Day-Ahead Wholesale Power Market Timing & Cutoff Gate
          </h2>
        </div>

        <div className="text-xs text-stone-700 leading-relaxed space-y-3">
          <p>
            In the UK electricity wholesale market, physical delivery occurs across <strong className="text-stone-900 font-semibold">48 half-hour settlement periods (SP 1 to 48)</strong> on Delivery Day <strong>D</strong> (00:00 to 24:00 clock time / UTC).
            However, energy purchases must be submitted into the Day-Ahead blind auction (hosted by EPEX SPOT and Nord Pool) on day <strong>D-1</strong> before auction gate closure (typically 11:00 or 12:00 UK time).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3">
            <div className="p-3.5 rounded-lg bg-beige-50/80 border border-beige-300 space-y-1.5">
              <span className="text-burgundy-800 font-semibold font-mono text-[11px] uppercase tracking-wide">
                Decision Cutoff Gate Formulation
              </span>
              <p className="text-[11px] text-stone-600">
                At a user-selected decision cutoff <code className="text-burgundy-900 bg-white px-1 py-0.5 rounded border border-beige-300">HH:MM</code>, the system computes the exact auction gate timestamp:
              </p>
              <div className="p-2 rounded bg-white text-stone-900 font-mono text-[11px] border border-beige-300 shadow-2xs">
                Gate_UTC = (Delivery_Date - 1 Day) @ HH:MM [Europe/London] → UTC
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-beige-50/80 border border-beige-300 space-y-1.5">
              <span className="text-burgundy-800 font-semibold font-mono text-[11px] uppercase tracking-wide">
                Zero Look-Ahead Guarantee
              </span>
              <p className="text-[11px] text-stone-600">
                To guarantee zero look-ahead data leakage, every forecast record evaluated must strictly satisfy:
              </p>
              <div className="p-2 rounded bg-white text-burgundy-900 font-mono text-[11px] border border-beige-300 shadow-2xs font-semibold">
                publishTime ≤ Gate_UTC
              </div>
              <p className="text-[10px] text-stone-500">
                Any forecast published even 1 second after Gate_UTC is strictly eliminated from the trading desk decision set.
              </p>
            </div>
          </div>

          <p>
            National Grid ESO publishes updated Numerical Weather Prediction (NWP) wind forecasts (<code className="text-stone-800 font-mono bg-stone-100 px-1 py-0.5 rounded">WINDFOR</code>) approximately 8 times per day (standard runs at 02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, and 22:30 UTC). At the desk default cutoff of <strong>09:00 London</strong>, the latest model available to traders is the <strong>07:30 UTC</strong> run, resulting in an effective lead-time horizon of <strong>16.5 hours</strong> (for SP 1 at 00:00 D) to <strong>40.5 hours</strong> (for SP 48 at 23:30 D).
          </p>
        </div>
      </section>

      {/* Section 2: Latest Forecast Selection & Resolution Matching */}
      <section className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-beige-100 border border-beige-300 text-stone-800">
            <Layers className="w-5 h-5 text-burgundy-700" />
          </div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            2. Point-in-Time Forecast Selection & Resolution Matching
          </h2>
        </div>

        <div className="text-xs text-stone-700 leading-relaxed space-y-3">
          <p>
            Because meteorological models update continuously, multiple forecast versions exist for any target delivery timestamp. For each target delivery hour <code className="text-stone-800 font-mono bg-stone-100 px-1 py-0.5 rounded">h ∈ &#123;0, ..., 23&#125;</code> on Delivery Day D, the system executes:
          </p>

          <div className="p-3 rounded-lg bg-stone-50 font-mono text-[11px] text-stone-900 border border-stone-200 shadow-2xs">
            LatestForecast(h, Gate) = arg max &#123; publishTime | publishTime ≤ Gate and startTime == h:00 and publishTime ≤ startTime &#125;
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-200 space-y-1">
              <h4 className="text-stone-900 font-semibold text-xs flex items-center space-x-1.5">
                <Database className="w-3.5 h-3.5 text-stone-600" />
                <span>Hourly vs Half-Hourly Alignment</span>
              </h4>
              <p className="text-[11px] text-stone-600 leading-normal">
                Elexon <code className="text-stone-800">WINDFOR</code> forecasts are published at strictly hourly resolution (`:00`), while physical delivery and <code className="text-stone-800">FUELHH</code> actuals settle half-hourly (`:00` and `:30`). For the 48-period trading schedule, the hourly forecast is broadcast to both constituent half-hours. For quantitative verification, actuals are averaged to hourly mean.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-burgundy-50/60 border border-burgundy-200 space-y-1">
              <h4 className="text-burgundy-950 font-semibold text-xs flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-burgundy-700" />
                <span>Reanalysis Anomaly Cleansing</span>
              </h4>
              <p className="text-[11px] text-stone-600 leading-normal">
                Analysis of the raw Elexon BMRS stream revealed that 20.55% of records have <code className="text-burgundy-900 font-mono">publishTime &gt; startTime</code> (retrospective meteorological reanalysis). These records are strictly flagged and filtered out because an ex-post reanalysis cannot be known at pre-delivery trading time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Quantitative Metric Definitions */}
      <section className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-burgundy-50 border border-burgundy-200 text-burgundy-700">
            <Calculator className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            3. Quantitative Accuracy Metrics & Error Sign Conventions
          </h2>
        </div>

        <div className="text-xs text-stone-700 leading-relaxed space-y-2">
          <p>
            Error is formally defined from the perspective of a physical generator or utility trading desk:
          </p>
          <div className="p-2.5 rounded-lg bg-beige-50/80 font-mono text-xs text-burgundy-900 border border-beige-300 inline-block shadow-2xs font-bold">
            e_i = Forecast_i - Actual_i = ŷ_i - y_i
          </div>
          <ul className="list-disc list-inside text-stone-600 space-y-1 text-[11px] pt-1">
            <li>
              <strong className="text-burgundy-800">e_i &gt; 0 (Over-Forecast Shortfall): </strong>
              The forecast exceeded physical generation. The trading desk over-sold power in the day-ahead auction and must purchase replacement energy at the punitive System Buy Price (SBP).
            </li>
            <li>
              <strong className="text-stone-700">e_i &lt; 0 (Under-Forecast Surplus): </strong>
              Actual outturn exceeded day-ahead expectations. Spill energy is cashed out at the System Sell Price (SSP).
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* MBE / Bias */}
          <div className="p-3.5 rounded-lg bg-beige-50/60 border border-beige-300 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-stone-900 text-xs">Mean Bias Error (MBE / Bias)</span>
              <span className="text-[10px] text-burgundy-800 font-mono font-semibold">Systematic Drift</span>
            </div>
            <div className="p-2 rounded bg-white text-stone-900 font-mono text-xs text-center border border-stone-200 shadow-2xs font-bold">
              Bias = (1 / N) * Σ (ŷ_i - y_i)
            </div>
            <p className="text-[11px] text-stone-600 leading-normal">
              Measures persistent directional offset. In January 2026, the model exhibited a systematic bias of +1,840 MW, requiring deliberate down-hedging.
            </p>
          </div>

          {/* MAE */}
          <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-stone-900 text-xs">Mean Absolute Error (MAE)</span>
              <span className="text-[10px] text-stone-500 font-mono">Dispersion</span>
            </div>
            <div className="p-2 rounded bg-white text-stone-900 font-mono text-xs text-center border border-stone-200 shadow-2xs font-bold">
              MAE = (1 / N) * Σ |ŷ_i - y_i|
            </div>
            <p className="text-[11px] text-stone-600 leading-normal">
              Average absolute miss magnitude across all periods regardless of sign. Provides the foundational baseline of model precision.
            </p>
          </div>

          {/* RMSE */}
          <div className="p-3.5 rounded-lg bg-burgundy-50/40 border border-burgundy-200 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-stone-900 text-xs">Root Mean Square Error (RMSE)</span>
              <span className="text-[10px] text-burgundy-800 font-mono font-semibold">Quadratic Penalty</span>
            </div>
            <div className="p-2 rounded bg-white text-burgundy-900 font-mono text-xs text-center border border-burgundy-200 shadow-2xs font-bold">
              RMSE = √ [ (1 / N) * Σ (ŷ_i - y_i)² ]
            </div>
            <p className="text-[11px] text-stone-600 leading-normal">
              Squaring penalizes large outliers severely. Essential for detecting sudden meteorological ramp timing errors where the desk faces extreme volume shortfalls.
            </p>
          </div>

          {/* WAPE */}
          <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-stone-900 text-xs">Weighted Absolute Percentage Error (WAPE)</span>
              <span className="text-[10px] text-stone-600 font-mono">Relative Precision</span>
            </div>
            <div className="p-2 rounded bg-white text-stone-900 font-mono text-xs text-center border border-stone-200 shadow-2xs font-bold">
              WAPE = [ Σ |ŷ_i - y_i| / Σ y_i ] * 100%
            </div>
            <p className="text-[11px] text-stone-600 leading-normal">
              Normalizes aggregate error against total physical volume generated. Avoids standard MAPE division by zero during calm, near-zero wind lull periods.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Sizing the Empirical Safety Buffer */}
      <section className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-beige-100 border border-beige-300 text-stone-800">
            <ShieldCheck className="w-5 h-5 text-burgundy-700" />
          </div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            4. Sizing the Empirical Safety Buffer for Imbalance Risk
          </h2>
        </div>

        <div className="text-xs text-stone-700 leading-relaxed space-y-3">
          <p>
            Under the Balancing and Settlement Code (BSC), trading desks with generation deficits settle out-of-balance energy at the <strong className="text-stone-900">System Buy Price (SBP)</strong>, which can spike above £500–£1,000/MWh during system stress. Selling 100% of an unadjusted wind forecast guarantees chronic financial loss when forecasts have positive bias.
          </p>

          <div className="p-4 rounded-lg bg-beige-50/80 border border-beige-300 space-y-2">
            <span className="text-burgundy-900 font-bold text-xs uppercase tracking-wide">
              The P90 Conservative Bid Sizing Rule
            </span>
            <p className="text-[11px] text-stone-700">
              The desk calculates the 90th percentile of empirical over-forecast shortfall:
            </p>
            <div className="p-2 rounded bg-white text-burgundy-900 font-mono text-xs border border-beige-300 shadow-2xs font-bold">
              Buffer_P90 = Quantile_0.90( e_i ) where e_i = Forecast_i - Actual_i
            </div>
            <div className="p-2 rounded bg-white text-stone-900 font-mono text-xs border border-stone-300 shadow-2xs font-bold">
              Safe_Auction_Bid = max(0, Raw_Forecast - Buffer_P90)
            </div>
            <p className="text-[11px] text-stone-600">
              By offering <code className="text-burgundy-900 font-mono bg-white px-1 py-0.5 rounded border border-beige-300">Safe_Auction_Bid</code>, the desk ensures with <strong className="text-stone-900">90% statistical probability</strong> that physical wind generation will meet or exceed traded commitments, eliminating 90% of cash-out shortfall risk.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-200 space-y-1">
            <h4 className="text-stone-900 font-semibold text-xs flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-burgundy-700" />
              <span>Dynamic Expanding Window (Strict Walk-Forward)</span>
            </h4>
            <p className="text-[11px] text-stone-600 leading-normal">
              In live desk deployment, the buffer for Delivery Day D cannot use data from Day D or beyond. The platform implements an expanding-window calibrator where <code className="text-stone-800 font-mono bg-white px-1 py-0.5 rounded border border-stone-200">Buffer_P90(D)</code> is calibrated strictly on verified delivery days prior to D (<code className="text-stone-800 font-mono bg-white px-1 py-0.5 rounded border border-stone-200">t &lt; D</code>). As January progresses, the buffer dynamically adapts from early storms to late-month regimes without look-ahead data leakage.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5: Assumptions & Limitations */}
      <section className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-stone-100 border border-stone-200 text-stone-600">
            <HelpCircle className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            5. Model Assumptions & Trading Limitations
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-stone-700">
          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5">
            <h4 className="text-stone-900 font-semibold text-xs">National Aggregate vs. Zonal Constraints</h4>
            <p className="text-[11px] text-stone-600 leading-normal">
              This system models total Great Britain national wind generation. In actual trading, transmission boundaries (such as the B6 constraint between Scotland and England) can cause physical export curtailment even when aggregate generation is high.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5">
            <h4 className="text-stone-900 font-semibold text-xs">Balancing Mechanism (BM) Curtailment Effects</h4>
            <p className="text-[11px] text-stone-600 leading-normal">
              <code className="text-stone-800">FUELHH</code> records metered generation. If National Grid ESO accepted Bid-Offer Acceptances (BOAs) to curtail wind farms for network management, recorded outturn is lower than unconstrained wind energy potential.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5">
            <h4 className="text-stone-900 font-semibold text-xs">January 2026 Seasonality</h4>
            <p className="text-[11px] text-stone-600 leading-normal">
              Evaluation metrics are specific to January 2026, characterized by high North Atlantic cyclonic activity and cold temperatures. Summer regimes feature lower overall generation, lower bias, and different error variance.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5">
            <h4 className="text-stone-900 font-semibold text-xs">Single-Gate Auction Approximation</h4>
            <p className="text-[11px] text-stone-600 leading-normal">
              The desk simulates day-ahead positioning. In production, traders can dynamically re-hedge open imbalances in intraday auctions (IDA1, IDA2, IDA3) and continuous intraday markets up to 1 hour before physical delivery gate closure.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
