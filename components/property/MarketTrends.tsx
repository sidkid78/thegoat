'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import type { Forecast } from '@/lib/market/forecast';
import type { MarketAnalysis } from '@/lib/ai/market-forecast';
import { marketAnalysisAction } from '@/app/actions/market';

export interface MarketTrendPoint {
  periodBegin: string;
  medianSalePrice: number | null;
  medianPpsf: number | null;
  homesSold: number | null;
  medianDom: number | null;
  medianSalePriceYoy: number | null;
}

const CHART_W = 640;
const CHART_H = 180;
const PAD_Y = 16;

function formatMonth(iso: string) {
  const [year, month] = iso.split('-');
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(month) - 1]} ${year}`;
}

function formatPrice(value: number) {
  return value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(2)}M`
    : `$${Math.round(value / 1000)}k`;
}

/**
 * Area-level market history for the listing's zip code, from the Redfin Data
 * Center.
 *
 * The design spec asks for the price shown "with the option to view the area's
 * historical pricing data or market trends" -- area's, which is what this is.
 * It is deliberately NOT a price history for this property: the seeded
 * listings come from a Kaggle export with no real transaction record, so a
 * per-property chart would be invented. The heading and footnote say so
 * explicitly rather than letting the chart imply otherwise.
 *
 * Collapsed by default to honour "the option to view". The data is already
 * server-rendered, so expanding costs nothing.
 *
 * Drawn as inline SVG rather than pulling in a charting library -- this is one
 * line and an area fill, and the project has no chart dependency to reuse.
 */
export function MarketTrends({
  propertyId,
  zipCode,
  trends,
  forecast,
}: {
  propertyId: number;
  zipCode: string;
  trends: MarketTrendPoint[];
  /** Computed server-side from the same series; null when history is too short. */
  forecast: Forecast | null;
}) {
  const [open, setOpen] = useState(false);

  const priced = useMemo(
    () => trends.filter((t): t is MarketTrendPoint & { medianSalePrice: number } => t.medianSalePrice != null),
    [trends]
  );

  const geometry = useMemo(() => {
    if (priced.length < 2) return null;
    const values = priced.map((t) => t.medianSalePrice);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // A flat series would divide by zero; fall back to a centred line.
    const span = max - min || 1;
    const x = (i: number) => (i / (priced.length - 1)) * CHART_W;
    const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (CHART_H - PAD_Y * 2);

    const line = priced.map((t, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(t.medianSalePrice).toFixed(1)}`).join(' ');
    const area = `${line} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`;
    return { min, max, line, area };
  }, [priced]);

  const latest = priced.at(-1) ?? null;
  const yoy = latest?.medianSalePriceYoy ?? null;

  if (trends.length === 0) return null;

  const TrendIcon = yoy == null ? Minus : yoy > 0 ? TrendingUp : yoy < 0 ? TrendingDown : Minus;
  const yoyColor = yoy == null ? 'text-ink-muted' : yoy > 0 ? 'text-success' : yoy < 0 ? 'text-danger' : 'text-ink-muted';

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-6 py-4 text-left transition hover:bg-surface-container"
      >
        <span>
          <span className="block font-display text-base font-semibold text-navy-deep">
            Area Market Trends
          </span>
          {/* One template literal rather than text + {zipCode} + &mdash;: JSX
              drops the space between the expression and the entity, rendering
              "ZIP 78704— not". */}
          <span className="mt-0.5 block text-body-sm text-ink-muted">
            {`Median sale price across ZIP ${zipCode} — not this home’s sale history`}
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-hairline p-6">
          <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-label-md uppercase text-ink-muted">Median sale price</dt>
              <dd className="mt-1 font-display text-lg font-semibold text-navy-deep">
                {latest ? `$${latest.medianSalePrice.toLocaleString()}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-label-md uppercase text-ink-muted">Year over year</dt>
              <dd className={`mt-1 flex items-center gap-1 font-display text-lg font-semibold ${yoyColor}`}>
                <TrendIcon className="h-4 w-4" aria-hidden="true" />
                {yoy == null ? '—' : `${(yoy * 100).toFixed(1)}%`}
              </dd>
            </div>
            <div>
              <dt className="text-label-md uppercase text-ink-muted">Homes sold</dt>
              <dd className="mt-1 font-display text-lg font-semibold text-navy-deep">
                {latest?.homesSold ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-label-md uppercase text-ink-muted">Median days on market</dt>
              <dd className="mt-1 font-display text-lg font-semibold text-navy-deep">
                {latest?.medianDom ?? '—'}
              </dd>
            </div>
          </dl>

          {geometry ? (
            <>
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="h-44 w-full"
                preserveAspectRatio="none"
                role="img"
                aria-label={`Median sale price in ZIP ${zipCode} from ${formatMonth(priced[0].periodBegin)} to ${formatMonth(priced.at(-1)!.periodBegin)}`}
              >
                <defs>
                  <linearGradient id="market-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2c0a75" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#2c0a75" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={geometry.area} fill="url(#market-fill)" />
                {/* Non-scaling stroke: preserveAspectRatio="none" stretches the
                    viewBox horizontally, which would otherwise thin the line. */}
                <path
                  d={geometry.line}
                  fill="none"
                  stroke="#2c0a75"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              </svg>

              <div className="mt-2 flex justify-between text-label-md text-ink-muted">
                <span>{formatMonth(priced[0].periodBegin)}</span>
                <span>
                  {formatPrice(geometry.min)} &ndash; {formatPrice(geometry.max)}
                </span>
                <span>{formatMonth(priced.at(-1)!.periodBegin)}</span>
              </div>
            </>
          ) : (
            <p className="text-body-sm text-ink-muted">
              Not enough monthly observations in this ZIP to chart a trend.
            </p>
          )}

          {forecast && <ForecastPanel propertyId={propertyId} forecast={forecast} />}

          <p className="mt-5 border-t border-hairline pt-4 text-body-sm text-ink-muted">
            Source:{' '}
            <a
              href="https://www.redfin.com/news/data-center/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-navy hover:underline"
            >
              Redfin Data Center
            </a>
            . Aggregated monthly sales across the whole ZIP code, all residential property types.
            It describes the area, not this listing.
          </p>
        </div>
      )}
    </section>
  );
}

const CONFIDENCE_STYLE: Record<MarketAnalysis['confidence'], string> = {
  low: 'bg-danger-container text-danger',
  moderate: 'bg-surface-container text-ink',
  high: 'bg-navy-tint text-navy-deep',
};

/**
 * The 12-month projection, plus an on-demand AI reading of it.
 *
 * The numbers are computed by `forecastPrices()` -- plain log-linear regression
 * with a walk-forward backtest -- and rendered whether or not the user asks for
 * the AI narrative, which is a paid call. The measured error is shown next to
 * the projection rather than buried: on these ZIPs the method is off by 7-12%
 * at the median, and a projection presented without that context implies a
 * precision it does not have.
 */
function ForecastPanel({ propertyId, forecast }: { propertyId: number; forecast: Forecast }) {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const changeVsAnchor = forecast.projectedPrice / forecast.anchorPrice - 1;
  // Weak fits are common here: five years spanning the 2021 spike and the
  // plateau after it often have no clean log-linear trend at all.
  const weakTrend = forecast.rSquared < 0.25;

  return (
    <div className="mt-6 border-t border-hairline pt-6">
      <h3 className="font-display text-base font-semibold text-navy-deep">12-Month Projection</h3>

      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-label-md uppercase text-ink-muted">
            Projected median &middot; {formatMonth(forecast.projectedPeriod)}
          </p>
          <p className="mt-1 font-display text-headline-md text-navy-deep">
            ${Math.round(forecast.projectedPrice).toLocaleString()}
          </p>
          <p className="mt-1 text-body-sm text-ink-muted">
            {changeVsAnchor >= 0 ? '+' : ''}
            {(changeVsAnchor * 100).toFixed(1)}% vs. the trailing 3-month average of $
            {Math.round(forecast.anchorPrice).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-label-md uppercase text-ink-muted">Likely range</p>
          {/* Template literal for the same reason as the header above: JSX eats
              the space between an expression and a following entity. */}
          <p className="mt-1 text-body-md font-semibold text-ink">
            {`$${Math.round(forecast.lowPrice).toLocaleString()} – $${Math.round(forecast.highPrice).toLocaleString()}`}
          </p>
        </div>
        <div>
          <p className="text-label-md uppercase text-ink-muted">Fitted trend</p>
          <p className="mt-1 text-body-md font-semibold text-ink">
            {forecast.annualizedTrend >= 0 ? '+' : ''}
            {(forecast.annualizedTrend * 100).toFixed(1)}% / yr
          </p>
        </div>
      </div>

      {/* The honest health warning. A weak fit means the slope explains almost
          nothing, which the reader needs before they lean on the number. */}
      {weakTrend && (
        <p className="mt-4 flex items-start gap-2 rounded-soft bg-surface-low p-3 text-body-sm text-ink-muted">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-outline" aria-hidden="true" />
          <span>
            The trend line explains little of this ZIP&rsquo;s recent movement (r&sup2; ={' '}
            {forecast.rSquared.toFixed(2)}), so treat the projection as barely more informative than
            assuming prices stay flat.
          </span>
        </p>
      )}

      <p className="mt-3 text-body-sm text-ink-muted">
        Log-linear trend over {forecast.windowMonths} months, anchored on the trailing 3-month
        average.{' '}
        {forecast.backtest
          ? `Tested against this ZIP's own history: ${forecast.backtest.samples} predictions, median error ${forecast.backtest.medianAbsPctError.toFixed(1)}%.`
          : 'Too little history to measure this method against past outcomes.'}{' '}
        A trend extrapolation cannot anticipate a rate shock or a local supply change.
      </p>

      {analysis ? (
        <div className="mt-5 rounded-card border border-hairline bg-surface-low p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-navy" aria-hidden="true" />
            <span className="font-display text-base font-semibold text-navy-deep">
              AI Market Analysis
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-label-md uppercase ${CONFIDENCE_STYLE[analysis.confidence]}`}
            >
              {analysis.confidence} confidence
            </span>
          </div>

          <p className="mt-3 text-body-md leading-6 text-ink">{analysis.summary}</p>
          <p className="mt-2 text-body-sm text-ink-muted">{analysis.confidenceReason}</p>

          {analysis.risks.length > 0 && (
            <>
              <p className="mt-4 text-label-md uppercase text-ink-muted">What could change it</p>
              <ul className="mt-2 space-y-1.5">
                {analysis.risks.map((risk) => (
                  <li key={risk} className="flex gap-2 text-body-sm text-ink">
                    <span aria-hidden="true" className="text-outline">
                      &bull;
                    </span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await marketAnalysisAction(propertyId);
              if (result.success) setAnalysis(result.analysis);
              else setError(result.error);
            })
          }
          className="mt-5 flex items-center gap-2 rounded-soft bg-navy px-4 py-2 text-body-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {isPending ? 'Analyzing…' : 'Explain this market with AI'}
        </button>
      )}

      {error && <p className="mt-3 text-body-sm text-danger">{error}</p>}
    </div>
  );
}
