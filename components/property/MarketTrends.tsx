'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
export function MarketTrends({ zipCode, trends }: { zipCode: string; trends: MarketTrendPoint[] }) {
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
