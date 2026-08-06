'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import {
  Bed,
  Bath,
  Ruler,
  CalendarDays,
  MapPin,
  Mail,
  FileText,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Loader2,
  Images,
  ChevronRight,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { requestCmaAction } from '@/app/actions/cma';
import { scheduleViewingAction } from '@/app/actions/properties';
import { MarketTrends, type MarketTrendPoint } from '@/components/property/MarketTrends';
import type { Forecast } from '@/lib/market/forecast';

const FALLBACKS = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
  'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3',
];

const photoAt = (photos: unknown, i: number) =>
  Array.isArray(photos) && typeof photos[i] === 'string' && photos[i].trim() !== ''
    ? (photos[i] as string)
    : FALLBACKS[i % FALLBACKS.length];

/** Human labels for the keys stored in properties.features. */
const FEATURE_LABELS: Record<string, string> = {
  hasPool: 'Private Pool',
  centralAir: 'Central Air Conditioning',
  centralHeating: 'Central Heating',
  garageSpaces: 'Garage',
  yearBuilt: 'Year Built',
  hoaFeeMonthly: 'HOA Fee',
};

export function PropertyDetail({
  property,
  initialCma,
  marketTrends = [],
  forecast = null,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  property: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialCma?: any;
  /** Zip-level Redfin history, oldest first. Empty when the zip has no coverage. */
  marketTrends?: MarketTrendPoint[];
  /** Computed server-side from that history; null when it's too short to fit. */
  forecast?: Forecast | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cmaReport, setCmaReport] = useState<any>(initialCma);
  const [cmaError, setCmaError] = useState<string | null>(null);
  const [isCmaLoading, setIsCmaLoading] = useState(false);
  const [viewingScheduled, setViewingScheduled] = useState(false);
  const [isViewingPending, startViewingTransition] = useTransition();
  const [downPaymentPct, setDownPaymentPct] = useState(20);

  const price = Number(property.price) || 0;

  const handleGenerateCma = async () => {
    setIsCmaLoading(true);
    setCmaError(null);
    try {
      const res = await requestCmaAction(property.id);
      if (res.success) {
        setCmaReport(res.report);
      } else {
        setCmaError(res.error || 'Valuation failed.');
      }
    } catch (err) {
      setCmaError(err instanceof Error ? err.message : 'Valuation failed.');
    } finally {
      setIsCmaLoading(false);
    }
  };

  const handleScheduleViewing = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append('propertyId', property.id.toString());

    startViewingTransition(async () => {
      const res = await scheduleViewingAction(formData);
      if (res.success) {
        setViewingScheduled(true);
      }
    });
  };

  // Standard amortisation over a 30-year term at a representative rate.
  const { monthlyPayment, downPayment } = useMemo(() => {
    const down = price * (downPaymentPct / 100);
    const principal = price - down;
    const monthlyRate = 0.0642 / 12;
    const months = 360;
    const payment =
      monthlyRate > 0
        ? (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
        : principal / months;
    return { monthlyPayment: Math.round(payment), downPayment: Math.round(down) };
  }, [price, downPaymentPct]);

  const features = useMemo(() => {
    const raw = property.features || {};
    return Object.entries(raw)
      .filter(([key, value]) => FEATURE_LABELS[key] && value !== false && value !== null)
      .map(([key, value]) => {
        let detail = '';
        if (key === 'garageSpaces') detail = `${value} space${Number(value) === 1 ? '' : 's'}`;
        else if (key === 'yearBuilt') detail = String(value);
        else if (key === 'hoaFeeMonthly')
          detail = Number(value) > 0 ? `$${Number(value).toLocaleString()}/mo` : 'None';
        return { label: FEATURE_LABELS[key], detail };
      });
  }, [property.features]);

  const photoCount = Array.isArray(property.photos) ? property.photos.length : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      {/* ---------------------------------------------------------------- */}
      {/* Gallery                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative aspect-16/10 overflow-hidden rounded-card bg-surface-container md:col-span-2">
          <Image
            src={photoAt(property.photos, 0)}
            alt={property.address}
            fill
            sizes="(max-width: 768px) 100vw, 66vw"
            priority
            className="object-cover"
          />
        </div>

        <div className="hidden grid-rows-2 gap-4 md:grid">
          {[1, 2].map((i) => (
            <div key={i} className="relative overflow-hidden rounded-card bg-surface-container">
              <Image
                src={photoAt(property.photos, i)}
                alt={`${property.address} — view ${i + 1}`}
                fill
                sizes="33vw"
                className="object-cover"
              />
              {i === 2 && photoCount > 0 && (
                <span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-soft bg-white/90 px-3 py-2 text-sm font-semibold text-navy shadow-card backdrop-blur-sm">
                  <Images className="h-4 w-4" />
                  {photoCount} photo{photoCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Title + price                                                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-headline-xl text-navy-deep">{property.address}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-body-md text-ink-muted">
            <MapPin className="h-4 w-4 text-outline" />
            {property.city}, {property.state} {property.zip_code}
          </p>
        </div>
        <p className="font-display text-headline-lg text-navy-deep md:text-right">
          ${price.toLocaleString()}
        </p>
      </div>

      {/* Spec strip */}
      <dl className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-hairline py-4">
        {[
          { Icon: Bed, label: 'Beds', value: property.bedrooms },
          { Icon: Bath, label: 'Baths', value: property.bathrooms },
          {
            Icon: Ruler,
            label: 'Sq Ft',
            value: property.square_feet ? Number(property.square_feet).toLocaleString() : '—',
          },
          { Icon: CalendarDays, label: 'Built', value: property.features?.yearBuilt ?? '—' },
        ].map(({ Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-ink-muted" aria-hidden="true" />
            <dd className="text-body-md font-semibold text-ink">{value}</dd>
            <dt className="text-body-md text-ink-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* -------------------------------------------------------------- */}
        {/* Main column                                                     */}
        {/* -------------------------------------------------------------- */}
        <div className="space-y-8 lg:col-span-2">
          {/* Renders nothing when the zip has no Redfin coverage. */}
          <MarketTrends
            propertyId={property.id}
            zipCode={property.zip_code}
            trends={marketTrends}
            forecast={forecast}
          />

          {/* Neighborhood expert — routes into the real assistant rather than
              standing up a second, separate chat implementation. */}
          <section className="overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-card">
            <div className="flex items-center justify-between bg-linear-to-r from-navy-deep to-teal px-6 py-4">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                <Sparkles className="h-4 w-4" />
                Dwellingly AI Neighborhood Expert
              </h2>
              <span className="flex items-center gap-1.5 text-label-md uppercase text-white/90">
                <span className="h-2 w-2 rounded-full bg-spring" />
                Online
              </span>
            </div>
            <div className="space-y-4 p-6">
              <p className="rounded-card bg-surface-low p-4 text-body-md leading-6 text-ink">
                Ask about local schools, recent comparable sales, or the lifestyle around{' '}
                {property.address}. The assistant can also search listings and book a tour for you.
              </p>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('dwellingly:open-ai', {
                      detail: {
                        address: property.address,
                        city: property.city,
                        state: property.state,
                        zipCode: property.zip_code,
                        latitude: property.latitude,
                        longitude: property.longitude,
                      },
                    })
                  )
                }
                className="flex items-center gap-2 rounded-soft bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-deep"
              >
                Ask about this neighborhood
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* About */}
          <section>
            <h2 className="font-display text-headline-md text-navy-deep">About this home</h2>
            <div className="mt-4 border-t border-hairline pt-5">
              <p className="text-body-md leading-7 text-ink-muted">{property.description}</p>

              {features.length > 0 && (
                <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {features.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      <div>
                        <p className="text-body-md font-semibold text-ink">{feature.label}</p>
                        {feature.detail && (
                          <p className="text-body-sm text-ink-muted">{feature.detail}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Market insights — backed by the real Gemini CMA, not mock data. */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-headline-md text-navy-deep">Market Insights</h2>
              <button
                type="button"
                onClick={handleGenerateCma}
                disabled={isCmaLoading}
                className="flex items-center gap-2 rounded-soft bg-teal px-4 py-2.5 text-sm font-bold text-navy-deep transition hover:bg-teal-dim disabled:opacity-60"
              >
                {isCmaLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                {cmaReport ? 'Re-run Valuation' : 'Generate AI Valuation'}
              </button>
            </div>

            <div className="mt-4 border-t border-hairline pt-5">
              {cmaError && (
                <p className="mb-4 rounded-card bg-danger-container px-4 py-3 text-body-sm text-ink">
                  {cmaError}
                </p>
              )}

              {cmaReport ? (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-card border border-hairline bg-surface-lowest p-5 shadow-card">
                      <p className="text-label-md uppercase text-ink-muted">Estimated Value</p>
                      <p className="mt-2 font-display text-headline-md text-navy-deep">
                        ${Number(cmaReport.estimatedValuation).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-card border border-hairline bg-surface-lowest p-5 shadow-card">
                      <p className="text-label-md uppercase text-ink-muted">Valuation Range</p>
                      <p className="mt-2 text-body-md font-semibold text-ink">
                        ${Number(cmaReport.valuationRangeLow).toLocaleString()} – $
                        {Number(cmaReport.valuationRangeHigh).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-card border border-hairline bg-surface-lowest p-5 shadow-card">
                      <p className="text-label-md uppercase text-ink-muted">Confidence</p>
                      <p className="mt-2 font-display text-headline-md text-navy-deep">
                        {Math.round((Number(cmaReport.confidenceScore) || 0) * 100)}%
                      </p>
                    </div>
                  </div>

                  {cmaReport.marketTrendAnalysis && (
                    <dl className="rounded-card border border-hairline bg-surface-lowest p-5 shadow-card">
                      {[
                        ['Neighborhood velocity', cmaReport.marketTrendAnalysis.neighborhoodVelocity],
                        ['Supply & demand', cmaReport.marketTrendAnalysis.supplyDemandBalance],
                        [
                          '12-month outlook',
                          cmaReport.marketTrendAnalysis.projected12MonthAppreciation,
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label as string}
                          className="flex flex-wrap justify-between gap-2 border-b border-hairline py-2.5 last:border-0"
                        >
                          <dt className="text-body-sm text-ink-muted">{label}</dt>
                          <dd className="text-body-sm font-semibold text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {Array.isArray(cmaReport.keyAdjustments) && cmaReport.keyAdjustments.length > 0 && (
                    <div>
                      <h3 className="text-label-md uppercase text-ink-muted">Key adjustments</h3>
                      <ul className="mt-3 space-y-2">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {cmaReport.keyAdjustments.map((adj: any) => (
                          <li
                            key={adj.feature}
                            className="flex flex-wrap items-baseline justify-between gap-2 rounded-card bg-surface-low px-4 py-3"
                          >
                            <span className="text-body-sm font-semibold text-ink">{adj.feature}</span>
                            <span
                              className={`text-body-sm font-bold ${
                                Number(adj.valueImpactUsd) >= 0 ? 'text-success' : 'text-danger'
                              }`}
                            >
                              {Number(adj.valueImpactUsd) >= 0 ? '+' : '−'}$
                              {Math.abs(Number(adj.valueImpactUsd)).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-body-md text-ink-muted">
                  Run a Comparative Market Analysis to get an AI valuation, a confidence range, and
                  the adjustments behind it — reasoned over comparable local listings.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Sidebar                                                         */}
        {/* -------------------------------------------------------------- */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-hairline bg-surface-lowest p-6 shadow-card">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('dwellingly:open-ai'))}
              className="flex w-full items-center justify-center gap-2 rounded-soft bg-navy py-3.5 text-sm font-semibold text-white transition hover:bg-navy-deep"
            >
              <Mail className="h-4 w-4" />
              Contact Agent
            </button>
            <Link
              href={`/properties/${property.id}/offer`}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-soft border border-navy py-3.5 text-sm font-semibold text-navy transition hover:bg-navy-tint"
            >
              <FileText className="h-4 w-4" />
              Make an Offer
            </Link>
          </div>

          {/* Investment calculator — real amortisation, not a static figure. */}
          <div className="rounded-card border border-hairline bg-surface-lowest p-6 shadow-card">
            <h2 className="font-display text-base font-semibold text-navy-deep">
              Investment Calculator
            </h2>

            <label
              htmlFor="down-payment"
              className="mt-4 block text-label-md uppercase text-ink-muted"
            >
              Down payment ({downPaymentPct}%)
            </label>
            <input
              id="down-payment"
              type="range"
              min={5}
              max={50}
              step={5}
              value={downPaymentPct}
              onChange={(e) => setDownPaymentPct(Number(e.target.value))}
              className="mt-3 w-full accent-navy"
            />
            <p className="mt-1 rounded-soft bg-surface-container px-3 py-2.5 text-body-md font-semibold text-ink">
              ${downPayment.toLocaleString()}
            </p>

            <div className="mt-4 flex items-baseline justify-between border-t border-hairline pt-4">
              <span className="text-body-sm text-ink-muted">Est. Monthly Payment</span>
              <span className="font-display text-lg font-bold text-navy-deep">
                ${monthlyPayment.toLocaleString()}
              </span>
            </div>
            <p className="mt-2 text-body-sm text-ink-muted">
              30-year fixed at 6.42%, principal and interest only.
            </p>
          </div>

          {/* Viewing scheduler */}
          <div className="rounded-card border border-hairline bg-surface-lowest p-6 shadow-card">
            <h2 className="font-display text-base font-semibold text-navy-deep">
              Schedule a Viewing
            </h2>

            {viewingScheduled ? (
              <p className="mt-4 flex items-start gap-2 rounded-card bg-surface-low p-4 text-body-sm text-ink">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                Your tour request is confirmed — it will appear on your dashboard.
              </p>
            ) : (
              <form onSubmit={handleScheduleViewing} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="scheduledAt"
                    className="block text-label-md uppercase text-ink-muted"
                  >
                    Date &amp; time
                  </label>
                  <input
                    id="scheduledAt"
                    type="datetime-local"
                    name="scheduledAt"
                    required
                    className="mt-2 h-11 w-full rounded-soft border border-outline-variant bg-surface-lowest px-3 text-body-sm text-ink outline-none transition focus:border-navy focus:border-b-2"
                  />
                </div>
                <div>
                  <label htmlFor="notes" className="block text-label-md uppercase text-ink-muted">
                    Notes for agent
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    placeholder="e.g. Interested in the backyard…"
                    className="mt-2 w-full rounded-soft border border-outline-variant bg-surface-lowest px-3 py-2 text-body-sm text-ink outline-none transition placeholder:text-outline focus:border-navy focus:border-b-2"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isViewingPending}
                  className="w-full rounded-soft bg-navy py-3 text-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
                >
                  {isViewingPending ? 'Confirming…' : 'Request Home Tour'}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
