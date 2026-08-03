'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Sparkles,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Home,
  Landmark,
  ClipboardCheck,
  CalendarDays,
  CircleCheck,
  Circle,
} from 'lucide-react';
import { submitOfferAction } from '@/app/actions/offers';

const STEPS = ['Price', 'Contingencies', 'Review'] as const;

const CONTINGENCIES = [
  {
    id: 'Inspection',
    Icon: Home,
    title: 'Home Inspection',
    body: 'Allows the buyer to inspect the property and negotiate repairs or cancel if issues arise.',
  },
  {
    id: 'Financing',
    Icon: Landmark,
    title: 'Financing',
    body: 'Ensures the buyer can secure a mortgage loan before the transaction is finalized.',
  },
  {
    id: 'Appraisal',
    Icon: ClipboardCheck,
    title: 'Appraisal',
    body: 'Protects the buyer if the property appraises below the agreed purchase price.',
  },
];

const JOURNEY = [
  { key: 'submitted', label: 'Offer Submitted' },
  { key: 'review', label: 'Agent Review' },
  { key: 'seller', label: 'Seller Response' },
  { key: 'decision', label: 'Decision' },
];

export function OfferWizard({
  property,
  cma,
  comps,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  property: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cma: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  comps: any[];
}) {
  const listPrice = Number(property.price) || 0;

  const [step, setStep] = useState(0);
  const [offerAmount, setOfferAmount] = useState(String(listPrice));
  const [earnestMoney, setEarnestMoney] = useState(String(Math.round(listPrice * 0.03)));
  const [contingencies, setContingencies] = useState<string[]>(['Financing', 'Inspection']);
  const [closingDate, setClosingDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [submitted, setSubmitted] = useState<any>(null);

  const amount = Number(offerAmount) || 0;
  const deltaPct = listPrice ? ((amount - listPrice) / listPrice) * 100 : 0;

  const low = cma ? Number(cma.valuation_range_low) : null;
  const high = cma ? Number(cma.valuation_range_high) : null;

  // Position within the CMA band, clamped, for the Too Low / Sweet Spot meter.
  const meterPct = useMemo(() => {
    if (low === null || high === null || high <= low) return null;
    const span = high - low;
    const padded = span * 0.5;
    const min = low - padded;
    const max = high + padded;
    return Math.min(100, Math.max(0, ((amount - min) / (max - min)) * 100));
  }, [amount, low, high]);

  const band =
    low !== null && high !== null
      ? amount < low
        ? 'below the supported range'
        : amount > high
          ? 'above the supported range'
          : 'within the supported range'
      : null;

  const toggleContingency = (id: string) =>
    setContingencies((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await submitOfferAction({
        propertyId: property.id,
        offerAmount: amount,
        earnestMoney: Number(earnestMoney) || 0,
        contingencies,
        proposedClosingDate: closingDate,
      });
      if (res.success) {
        setSubmitted(res.offer);
      } else {
        setError(res.error || 'Offer submission failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Offer submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------------------------------------------------------------------ //
  // Offer sent                                                          //
  // ------------------------------------------------------------------ //
  if (submitted) {
    // Index of the stage currently in progress. A freshly submitted offer has
    // completed "Offer Submitted" and is sitting in "Agent Review".
    const statusIndex =
      submitted.status === 'accepted' || submitted.status === 'rejected'
        ? JOURNEY.length - 1
        : submitted.status === 'countered'
          ? 2
          : 1;

    return (
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="rounded-card bg-linear-to-r from-navy-deep to-teal px-8 py-16 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-card bg-white/15">
            <Check className="h-10 w-10 text-white" />
          </span>
          <h1 className="mt-6 font-display text-headline-xl text-white">Offer Sent Successfully!</h1>
          <p className="mx-auto mt-3 max-w-xl text-body-lg text-white/85">
            Your offer for <strong>{property.address}</strong> at{' '}
            <strong>${amount.toLocaleString()}</strong> has been securely transmitted.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-card border border-hairline bg-surface-lowest p-7 shadow-card">
            <h2 className="font-display text-headline-md text-navy-deep">Offer Journey</h2>
            <ol className="mt-6 space-y-6">
              {JOURNEY.map((stage, i) => {
                const done = i < statusIndex;
                const current = i === statusIndex;
                return (
                  <li key={stage.key} className="flex gap-4">
                    {done ? (
                      <CircleCheck className="h-5 w-5 shrink-0 text-teal" />
                    ) : (
                      <Circle
                        className={`h-5 w-5 shrink-0 ${current ? 'text-navy' : 'text-outline-variant'}`}
                      />
                    )}
                    <div>
                      <p className="text-label-md uppercase text-ink-muted">
                        {done ? 'Completed' : current ? 'In progress' : 'Pending'}
                      </p>
                      <p className="mt-1 text-body-md font-semibold text-ink">{stage.label}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="rounded-card border border-hairline bg-surface-lowest p-7 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-headline-md text-navy-deep">
              <Sparkles className="h-5 w-5 text-navy" />
              Offer Summary
            </h2>
            <dl className="mt-6 space-y-3">
              {[
                ['Offer price', `$${amount.toLocaleString()}`],
                ['Earnest money', `$${Number(earnestMoney).toLocaleString()}`],
                ['Proposed closing', closingDate || 'Not specified'],
                ['Contingencies', contingencies.join(', ') || 'None'],
                ['Status', submitted.status],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap justify-between gap-2 border-b border-hairline py-2.5 last:border-0"
                >
                  <dt className="text-body-sm text-ink-muted">{label}</dt>
                  <dd className="text-body-sm font-semibold capitalize text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-soft bg-navy px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-deep"
          >
            Return to Dashboard
          </Link>
          <Link
            href={`/properties/${property.id}`}
            className="rounded-soft border border-navy px-7 py-3.5 text-sm font-semibold text-navy transition hover:bg-navy-tint"
          >
            Back to Property
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ //
  // Wizard                                                              //
  // ------------------------------------------------------------------ //
  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      {/* Stepper */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                  i < step
                    ? 'bg-teal text-navy-deep'
                    : i === step
                      ? 'bg-navy-deep text-white'
                      : 'bg-surface-container text-ink-muted'
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`text-sm ${
                  i === step ? 'font-semibold text-navy-deep' : 'font-medium text-ink-muted'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={`mx-2 h-0.5 flex-1 rounded-full ${i < step ? 'bg-teal' : 'bg-surface-container'}`}
              />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-headline-xl text-navy-deep">
          {step === 0 ? 'Offer Strategy' : step === 1 ? 'Contingencies & Terms' : 'Review & Submit'}
        </h1>
        <p className="flex items-center gap-1.5 text-body-md text-ink-muted">
          <MapPin className="h-4 w-4 text-outline" />
          {property.address}
        </p>
      </div>

      {error && (
        <p className="mt-6 rounded-card bg-danger-container px-5 py-4 text-body-sm text-ink">
          {error}
        </p>
      )}

      {/* ---------------- Step 1: price ---------------- */}
      {step === 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <section className="rounded-card border border-hairline bg-surface-lowest p-7 shadow-card">
              <h2 className="font-display text-headline-md text-navy-deep">Determine Offer Price</h2>
              <p className="mt-2 text-body-md leading-7 text-ink-muted">
                Review the listing details and enter your offer. The guide compares it against the
                AI valuation for this property.
              </p>

              <dl className="mt-6 grid gap-4 rounded-card bg-surface-low p-5 sm:grid-cols-2">
                <div>
                  <dt className="text-label-md uppercase text-ink-muted">List Price</dt>
                  <dd className="mt-1.5 font-display text-headline-md text-navy-deep">
                    ${listPrice.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-label-md uppercase text-ink-muted">Bedrooms / Baths</dt>
                  <dd className="mt-1.5 text-body-lg font-semibold text-ink">
                    {property.bedrooms} / {property.bathrooms}
                  </dd>
                </div>
              </dl>

              <label htmlFor="offer-amount" className="mt-6 block text-label-md uppercase text-ink-muted">
                Your Offer Amount
              </label>
              <div className="relative mt-2">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-body-lg text-ink-muted">
                  $
                </span>
                <input
                  id="offer-amount"
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="h-14 w-full rounded-soft border border-outline-variant bg-surface-lowest pl-9 pr-4 font-display text-xl font-bold text-navy-deep outline-none transition focus:border-navy focus:border-b-2"
                />
              </div>
              {listPrice > 0 && amount > 0 && (
                <p className="mt-2 text-body-sm text-ink-muted">
                  {Math.abs(deltaPct).toFixed(2)}% {deltaPct >= 0 ? 'above' : 'below'} list price
                </p>
              )}

              <label htmlFor="earnest" className="mt-6 block text-label-md uppercase text-ink-muted">
                Earnest Money Deposit
              </label>
              <input
                id="earnest"
                type="number"
                value={earnestMoney}
                onChange={(e) => setEarnestMoney(e.target.value)}
                className="mt-2 h-12 w-full rounded-soft border border-outline-variant bg-surface-lowest px-4 text-body-md text-ink outline-none transition focus:border-navy focus:border-b-2"
              />
            </section>

            {/* Market context — real comparables from the CMA */}
            <section className="rounded-card border border-hairline bg-surface-lowest p-7 shadow-card">
              <h2 className="font-display text-headline-md text-navy-deep">Market Context</h2>
              {comps.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {comps.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface-low px-5 py-4"
                    >
                      <div>
                        <p className="text-body-md font-semibold text-ink">{c.address}</p>
                        <p className="text-body-sm text-ink-muted">
                          {c.city}, {c.state} • {c.bedrooms} bd / {c.bathrooms} ba
                          {c.square_feet ? ` • ${Number(c.square_feet).toLocaleString()} sqft` : ''}
                        </p>
                      </div>
                      <p className="font-display text-lg font-bold text-navy-deep">
                        ${Number(c.price).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-body-md text-ink-muted">
                  Comparables appear here once a valuation has been generated for this property.{' '}
                  <Link
                    href={`/properties/${property.id}`}
                    className="font-semibold text-navy underline underline-offset-4"
                  >
                    Generate one
                  </Link>
                  .
                </p>
              )}
            </section>
          </div>

          {/* AI strategy guide */}
          <aside className="h-fit rounded-card bg-navy-tint p-7">
            <h2 className="flex items-center gap-2 font-display text-headline-md text-navy-deep">
              <Sparkles className="h-5 w-5" />
              AI Strategy Guide
            </h2>

            {low !== null && high !== null ? (
              <>
                <p className="mt-4 text-body-md leading-7 text-navy-deep/80">
                  Based on the most recent AI valuation for this property, the supported range is
                  shown below. Your offer currently sits {band}.
                </p>

                <div className="mt-6 rounded-card bg-surface-lowest p-5">
                  <p className="text-label-md uppercase text-ink-muted">Recommended Range</p>
                  <p className="mt-2 font-display text-2xl font-bold text-navy-deep">
                    ${low.toLocaleString()} – ${high.toLocaleString()}
                  </p>

                  {meterPct !== null && (
                    <div className="mt-4">
                      <div className="relative h-2 rounded-full bg-linear-to-r from-danger via-teal to-danger">
                        <span
                          className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-navy-deep"
                          style={{ left: `${meterPct}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
                        <span>Too Low</span>
                        <span>Sweet Spot</span>
                        <span>Overpaying</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setOfferAmount(String(Math.round((low + high) / 2)))}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-soft bg-teal py-3.5 text-sm font-bold text-navy-deep transition hover:bg-teal-dim"
                >
                  <Sparkles className="h-4 w-4" />
                  Apply Recommended Price
                </button>
              </>
            ) : (
              <p className="mt-4 text-body-md leading-7 text-navy-deep/80">
                No AI valuation exists for this property yet. Generate a Comparative Market Analysis
                on the property page and the recommended range will appear here.
              </p>
            )}
          </aside>
        </div>
      )}

      {/* ---------------- Step 2: contingencies ---------------- */}
      {step === 1 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {CONTINGENCIES.map(({ id, Icon, title, body }) => {
            const active = contingencies.includes(id);
            return (
              <section
                key={id}
                className="rounded-card border border-hairline bg-surface-lowest p-7 shadow-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-navy-deep">
                    <Icon className="h-5 w-5 text-navy" />
                    {title}
                  </h2>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-label={`${active ? 'Remove' : 'Add'} ${title} contingency`}
                    onClick={() => toggleContingency(id)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      active ? 'bg-navy' : 'bg-surface-highest'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                        active ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-3 text-body-md leading-7 text-ink-muted">{body}</p>
              </section>
            );
          })}

          <section className="rounded-card border border-hairline bg-surface-lowest p-7 shadow-card lg:col-span-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-navy-deep">
              <CalendarDays className="h-5 w-5 text-navy" />
              Closing Timeline
            </h2>
            <label htmlFor="closing" className="mt-4 block text-label-md uppercase text-ink-muted">
              Proposed closing date
            </label>
            <input
              id="closing"
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="mt-2 h-12 w-full max-w-sm rounded-soft border border-outline-variant bg-surface-lowest px-4 text-body-md text-ink outline-none transition focus:border-navy focus:border-b-2"
            />
          </section>
        </div>
      )}

      {/* ---------------- Step 3: review ---------------- */}
      {step === 2 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <section className="rounded-card border border-hairline bg-surface-lowest p-7 shadow-card">
            <h2 className="font-display text-headline-md text-navy-deep">Offer Summary</h2>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card bg-surface-low p-5">
              <div>
                <p className="text-body-lg font-semibold text-navy-deep">{property.address}</p>
                <p className="mt-1 text-body-sm text-ink-muted">
                  {property.city}, {property.state} {property.zip_code}
                </p>
              </div>
              <span className="rounded-full bg-teal px-3 py-1.5 text-label-md uppercase text-navy-deep">
                {property.status}
              </span>
            </div>

            <dl className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-label-md uppercase text-ink-muted">Offer Price</dt>
                <dd className="mt-1.5 font-display text-headline-md text-navy-deep">
                  ${amount.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-label-md uppercase text-ink-muted">Earnest Money</dt>
                <dd className="mt-1.5 text-body-lg font-semibold text-ink">
                  ${Number(earnestMoney).toLocaleString()}
                  {amount > 0 && (
                    <span className="ml-1 text-body-sm text-ink-muted">
                      ({((Number(earnestMoney) / amount) * 100).toFixed(1)}%)
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-label-md uppercase text-ink-muted">Proposed Closing</dt>
                <dd className="mt-1.5 text-body-lg font-semibold text-ink">
                  {closingDate || 'Not specified'}
                </dd>
              </div>
              <div>
                <dt className="text-label-md uppercase text-ink-muted">vs List Price</dt>
                <dd className="mt-1.5 text-body-lg font-semibold text-ink">
                  {Math.abs(deltaPct).toFixed(2)}% {deltaPct >= 0 ? 'above' : 'below'}
                </dd>
              </div>
            </dl>

            <h3 className="mt-8 text-label-md uppercase text-ink-muted">Selected contingencies</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {contingencies.length > 0 ? (
                contingencies.map((c) => (
                  <li
                    key={c}
                    className="rounded-full border border-outline-variant px-4 py-2 text-body-sm text-ink"
                  >
                    {c}
                  </li>
                ))
              ) : (
                <li className="text-body-sm text-ink-muted">None selected</li>
              )}
            </ul>
          </section>

          <aside className="h-fit rounded-card bg-navy-tint p-7">
            <h2 className="flex items-center gap-2 font-display text-headline-md text-navy-deep">
              <Sparkles className="h-5 w-5" />
              Before you submit
            </h2>
            <p className="mt-4 text-body-md leading-7 text-navy-deep/80">
              Submitting records the offer against this property and makes it visible to the listing
              owner. You can withdraw it later by changing its status.
            </p>
            <p className="mt-5 flex items-center gap-2 text-body-sm font-semibold text-navy-deep">
              <ShieldCheck className="h-4 w-4" />
              Stored with row-level security
            </p>
          </aside>
        </div>
      )}

      {/* Footer nav */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-6">
        {step === 0 ? (
          <Link
            href={`/properties/${property.id}`}
            className="flex items-center gap-2 rounded-soft border border-outline-variant px-6 py-3 text-sm font-semibold text-ink transition hover:border-navy hover:text-navy"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Property
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-2 rounded-soft border border-outline-variant px-6 py-3 text-sm font-semibold text-ink transition hover:border-navy hover:text-navy"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 0 && amount <= 0}
            className="flex items-center gap-2 rounded-soft bg-navy px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
          >
            Next: {STEPS[step + 1]}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || amount <= 0}
            className="flex items-center gap-2 rounded-soft bg-navy px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit Offer Officially
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
