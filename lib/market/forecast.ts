/**
 * Zip-level price trend and 12-month projection.
 *
 * Deliberately plain statistics, not a model call: the projection has to be
 * reproducible and auditable, and an LLM asked to "predict the price" would
 * produce a confident number with no derivation behind it. Gemini's role here
 * is to narrate what these figures mean (see lib/ai/market-forecast.ts); the
 * numbers themselves come from here.
 *
 * Method: ordinary least squares on log(median sale price) against month
 * index, over a trailing window. Log space because housing prices compound --
 * fitting a straight line to raw dollars would understate growth early in the
 * window and overstate it late.
 *
 * The uncertainty band is **measured, not assumed**. Textbook OLS prediction
 * intervals assume independent residuals; monthly median prices are strongly
 * autocorrelated, so those intervals come out far too narrow and would imply
 * precision this method does not have. Instead `backtest()` walks the series
 * forward, re-fitting at each historical origin and scoring the 12-month-ahead
 * prediction against what actually happened. The reported band is the 10th-90th
 * percentile of those real errors.
 *
 * This describes a ZIP code's median, never an individual property, and it is
 * a trend extrapolation -- it cannot anticipate a rate shock or a local supply
 * change. Callers must present it as such.
 */

export interface SeriesPoint {
  periodBegin: string;
  medianSalePrice: number;
}

export interface Forecast {
  /** Months of history the fit used. */
  windowMonths: number;
  /** Compounded annual growth implied by the fitted slope, e.g. 0.043 = +4.3%/yr. */
  annualizedTrend: number;
  /** Latest observed median. */
  latestPrice: number;
  latestPeriod: string;
  /** Trailing 3-month mean the projection actually runs from. Exposed so the UI
   *  can compare against the right baseline -- against a noisy single month the
   *  projected change reads wrong. */
  anchorPrice: number;
  /** Central 12-month-ahead projection. */
  projectedPrice: number;
  projectedPeriod: string;
  /** Empirical 10th-90th percentile band around the projection. */
  lowPrice: number;
  highPrice: number;
  /** How well this method did on this ZIP's own history. */
  backtest: BacktestResult | null;
  /** Share of the fit's variance explained; low means the trend is weak. */
  rSquared: number;
}

export interface BacktestResult {
  /** Number of historical origins scored. */
  samples: number;
  /** Median absolute percentage error of 12-month-ahead predictions. */
  medianAbsPctError: number;
  /** 10th and 90th percentile of signed percentage error. */
  p10PctError: number;
  p90PctError: number;
}

/** Months of history each fit uses. Five years spans a full local cycle without
 *  letting 2012-era prices drag a present-day slope. */
const WINDOW = 60;
/** Minimum history before a projection is meaningful at all. */
const MIN_WINDOW = 36;
const HORIZON = 12;
/** Months averaged to anchor the projection. A single month's median swings on
 *  which handful of homes happened to close, so anchoring on one point makes
 *  the projection jitter month to month. */
const ANCHOR_MONTHS = 3;

/**
 * Applies the fitted trend to a smoothed recent level, rather than reading the
 * projection off the regression line itself.
 *
 * The textbook approach -- evaluating the fitted line `HORIZON` months past its
 * end -- produces jumps when recent prices sit well off the line. ZIP 78701 is
 * the worked example: a -2.1%/yr fitted slope, but the last observation sits so
 * far below the line that the fitted value 12 months out lands 21% ABOVE the
 * latest actual price. A projection that rises 21% while reporting a falling
 * trend is indefensible to a user, however sound the arithmetic.
 *
 * Anchoring on the trailing average and applying only the *slope* keeps the
 * projection consistent with both the reported trend and observed reality.
 *
 * The tradeoff is a small, quantified downward bias: averaging three months
 * lags a compounding series by roughly one month, which is -0.4% on a series
 * growing 5%/yr. That is paid for several times over in real accuracy -- on
 * the seeded ZIPs, switching to this anchoring cut median absolute 12-month
 * error from 10.6/10.8/16.6% to 7.2/8.9/11.5%. The backtest measures the
 * shipped procedure including this bias, so the reported band absorbs it.
 */
function project(window: number[], slope: number): number {
  const anchorSlice = window.slice(-ANCHOR_MONTHS);
  const anchor = anchorSlice.reduce((a, b) => a + b, 0) / anchorSlice.length;
  return anchor * Math.exp(slope * HORIZON);
}

interface Fit {
  intercept: number;
  slope: number;
  rSquared: number;
}

/** OLS of log(price) on index. Returns null if the window is degenerate. */
function fitLogLinear(prices: number[]): Fit | null {
  const n = prices.length;
  if (n < 2) return null;

  const ys = prices.map((p) => Math.log(p));
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - meanX) * (ys[i] - meanY);
    sxx += (i - meanX) ** 2;
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { intercept, slope, rSquared };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (rank - lo) * (sorted[hi] - sorted[lo]);
}

/**
 * Walk-forward validation: at each origin with enough history behind it and a
 * real observation 12 months ahead, fit on history only and score the
 * prediction. Nothing after the origin ever informs its own fit.
 */
function backtest(prices: number[]): BacktestResult | null {
  const errors: number[] = [];

  // `last` is the index of the final observed month, so the window ends there
  // and the target is exactly HORIZON months later. Indexing the window's end
  // and the target off different origins is an easy off-by-one -- an earlier
  // version predicted `last + HORIZON - 1` and scored it against
  // `last + HORIZON`, which showed up as a phantom 0.4% error on a noiseless
  // 5%/yr series (one month of drift).
  for (let last = MIN_WINDOW - 1; last + HORIZON < prices.length; last++) {
    const window = prices.slice(Math.max(0, last - WINDOW + 1), last + 1);
    if (window.length < MIN_WINDOW) continue;

    const fit = fitLogLinear(window);
    if (!fit) continue;

    // Identical procedure to the live projection, so the measured error
    // describes what actually ships rather than a different method.
    const predicted = project(window, fit.slope);
    const actual = prices[last + HORIZON];
    if (!(actual > 0) || !Number.isFinite(predicted)) continue;

    errors.push(((predicted - actual) / actual) * 100);
  }

  if (errors.length < 12) return null;

  const signed = [...errors].sort((a, b) => a - b);
  const absolute = errors.map(Math.abs).sort((a, b) => a - b);

  return {
    samples: errors.length,
    medianAbsPctError: percentile(absolute, 0.5),
    p10PctError: percentile(signed, 0.1),
    p90PctError: percentile(signed, 0.9),
  };
}

/**
 * Builds the projection, or null when the ZIP has too little history to say
 * anything. Returning null rather than a low-confidence guess is deliberate --
 * a projection with no error bar to stand on is worse than none.
 */
export function forecastPrices(series: SeriesPoint[]): Forecast | null {
  const clean = series
    .filter((p) => Number.isFinite(p.medianSalePrice) && p.medianSalePrice > 0)
    .sort((a, b) => a.periodBegin.localeCompare(b.periodBegin));

  if (clean.length < MIN_WINDOW) return null;

  const prices = clean.map((p) => p.medianSalePrice);
  const window = prices.slice(-WINDOW);
  const fit = fitLogLinear(window);
  if (!fit) return null;

  const latest = clean[clean.length - 1];
  const projected = project(window, fit.slope);
  if (!Number.isFinite(projected) || projected <= 0) return null;

  const scores = backtest(prices);

  // The band is the projection adjusted by how wrong this method has historically
  // been on this ZIP. A p90 error of +8% means it has overshot by 8% one time in
  // ten, so the low edge of the band divides that overshoot back out.
  const low = scores ? projected / (1 + scores.p90PctError / 100) : projected;
  const high = scores ? projected / (1 + scores.p10PctError / 100) : projected;

  return {
    windowMonths: window.length,
    annualizedTrend: Math.exp(fit.slope * 12) - 1,
    latestPrice: latest.medianSalePrice,
    latestPeriod: latest.periodBegin,
    anchorPrice:
      window.slice(-ANCHOR_MONTHS).reduce((a, b) => a + b, 0) / Math.min(ANCHOR_MONTHS, window.length),
    projectedPrice: projected,
    projectedPeriod: addMonths(latest.periodBegin, HORIZON),
    lowPrice: Math.min(low, high),
    highPrice: Math.max(low, high),
    backtest: scores,
    rSquared: fit.rSquared,
  };
}

function addMonths(iso: string, months: number): string {
  const [year, month] = iso.split('-').map(Number);
  const zeroBased = month - 1 + months;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = (zeroBased % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, '0')}-01`;
}
