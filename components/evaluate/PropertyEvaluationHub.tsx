'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';
import { saveBuyerPreferencesAction, neighborhoodVibeAction } from '@/app/actions/evaluation';
import { BUYER_PRIORITIES, type BuyerPreferences } from '@/lib/buyer-preferences';
import type { NeighborhoodVibe } from '@/lib/ai/neighborhood';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-navy text-white',
  pending: 'bg-surface-highest text-ink-muted',
  sold: 'bg-surface-highest text-ink-muted',
  draft: 'bg-surface-highest text-ink-muted',
  archived: 'bg-surface-highest text-ink-muted',
};

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

/**
 * Gross rental yield from the property's most recent CMA: the AI's estimated
 * monthly rent annualised over the list price. Deliberately labelled "gross" --
 * it's before tax, insurance, maintenance and vacancy, so calling it plain
 * "ROI" would overstate what the number actually is.
 */
function grossYield(price: number, cma: Row | undefined): number | null {
  const monthly = Number(cma?.report_data?.estimatedMonthlyRentalIncome);
  if (!cma || !Number.isFinite(monthly) || monthly <= 0 || !price) return null;
  return ((monthly * 12) / price) * 100;
}

function yieldBand(pct: number): { label: string; tone: string; bar: string } {
  if (pct >= 7) return { label: 'High', tone: 'text-success', bar: 'bg-teal' };
  if (pct >= 5) return { label: 'Medium', tone: 'text-ink', bar: 'bg-navy' };
  return { label: 'Moderate', tone: 'text-ink-muted', bar: 'bg-ink-muted' };
}

export function PropertyEvaluationHub({
  favorites,
  scores,
  cmaByProperty,
  preferences,
  isSignedIn,
}: {
  favorites: Row[];
  scores: Record<number, number>;
  cmaByProperty: Record<number, Row>;
  preferences: BuyerPreferences | null;
  isSignedIn: boolean;
}) {
  const [priorities, setPriorities] = useState<string[]>(preferences?.priorities ?? []);
  const [notes, setNotes] = useState(preferences?.notes ?? '');
  const [isSaving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const togglePriority = (id: string) =>
    setPriorities((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const handleSave = () => {
    setSaveError(null);
    startSaving(async () => {
      const res = await saveBuyerPreferencesAction({ priorities, notes });
      if (!res.success) setSaveError(res.error);
    });
  };

  const hasPreferences = !!preferences && Object.keys(scores).length > 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <h1 className="font-display text-headline-xl text-navy-deep">Property Evaluation Hub</h1>
          <p className="mt-2 text-body-md text-ink-muted">
            Compare your shortlisted properties side-by-side to make the best decision.
          </p>
        </div>
        <Link
          href="/search"
          className="flex items-center gap-2 rounded-soft bg-navy-deep px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy"
        >
          <Plus className="h-4 w-4" /> Add Property
        </Link>
      </div>

      {!isSignedIn ? (
        <p className="mt-8 rounded-card border border-dashed border-outline-variant bg-surface-lowest p-10 text-center text-body-md text-ink-muted">
          Sign in to build and compare a shortlist.
        </p>
      ) : (
        <>
          {/* --- Buying priorities: what match % is actually measured against --- */}
          <section className="mt-8 rounded-card border border-hairline bg-surface-lowest p-7 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-headline-md text-navy-deep">
              <Sparkles className="h-5 w-5 text-navy" /> What matters to you
            </h2>
            <p className="mt-1.5 text-body-sm text-ink-muted">
              Match % is the semantic similarity between these priorities and each listing — the same
              scoring the search page uses. Without them there is nothing to match against, so no
              score is shown.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {BUYER_PRIORITIES.map((pref) => {
                const active = priorities.includes(pref.id);
                return (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => togglePriority(pref.id)}
                    aria-pressed={active}
                    className={`rounded-full px-4 py-2 text-label-md uppercase transition ${
                      active
                        ? 'bg-navy text-white'
                        : 'border border-outline-variant bg-surface-lowest text-ink-muted hover:border-navy hover:text-navy'
                    }`}
                  >
                    {pref.label}
                  </button>
                );
              })}
            </div>

            <label htmlFor="pref-notes" className="mt-6 block text-label-md uppercase text-ink-muted">
              Anything else
            </label>
            <textarea
              id="pref-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. walkable to coffee, home office, quiet street, good light"
              className="mt-2 w-full rounded-soft border border-outline-variant bg-surface-lowest px-4 py-3 text-body-md text-ink outline-none transition placeholder:text-outline focus:border-navy focus:border-b-2"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-soft bg-teal px-5 py-2.5 text-label-md uppercase text-navy-deep transition hover:bg-teal-dim disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Save &amp; re-score
              </button>
              {saveError && <span className="text-body-sm text-danger">{saveError}</span>}
            </div>
          </section>

          {favorites.length === 0 ? (
            <div className="mt-8 rounded-card border border-dashed border-outline-variant bg-surface-lowest p-12 text-center">
              <Bookmark className="mx-auto h-8 w-8 text-outline" />
              <p className="mt-3 text-body-md text-ink-muted">
                No saved properties yet. Save listings from search to compare them here.
              </p>
              <Link
                href="/search"
                className="mt-5 inline-block rounded-soft bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy-deep"
              >
                Browse listings
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {favorites.map((fav) => (
                <ShortlistCard
                  key={fav.properties.id}
                  property={fav.properties}
                  score={scores[fav.properties.id]}
                  cma={cmaByProperty[fav.properties.id]}
                  hasPreferences={hasPreferences}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ShortlistCard({
  property,
  score,
  cma,
  hasPreferences,
}: {
  property: Row;
  score: number | undefined;
  cma: Row | undefined;
  hasPreferences: boolean;
}) {
  const [vibe, setVibe] = useState<NeighborhoodVibe | null>(null);
  const [vibeError, setVibeError] = useState<string | null>(null);
  const [isLoadingVibe, startVibe] = useTransition();

  const price = Number(property.price) || 0;
  const photo = Array.isArray(property.photos) ? property.photos[0] : null;
  const yieldPct = grossYield(price, cma);
  const band = yieldPct !== null ? yieldBand(yieldPct) : null;
  const canOffer = property.status === 'active';

  const handleVibe = () => {
    setVibeError(null);
    startVibe(async () => {
      const res = await neighborhoodVibeAction(property.id);
      if (!res.success) {
        setVibeError(res.error);
        return;
      }
      setVibe(res.vibe);
    });
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-card">
      <div className="relative h-48 w-full bg-surface-container">
        {photo && (
          <Image
            src={photo}
            alt={property.address}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-label-md uppercase ${
            STATUS_STYLES[property.status] ?? 'bg-surface-highest text-ink-muted'
          }`}
        >
          {property.status}
        </span>
        {hasPreferences && score !== undefined && (
          <span
            title="Semantic similarity between this listing and your saved priorities"
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-label-md text-navy-deep backdrop-blur-sm"
          >
            <BadgeCheck className="h-4 w-4 text-success" />
            {Math.round(score * 100)}% Match
          </span>
        )}
      </div>

      <div className="p-6">
        <Link href={`/properties/${property.id}`} className="font-display text-headline-md text-navy-deep hover:underline">
          {usd(price)}
        </Link>
        <p className="mt-1 text-body-sm text-ink-muted">
          {property.address}, {property.city}, {property.state}
        </p>

        <dl className="mt-5 grid grid-cols-3 divide-x divide-hairline border-y border-hairline py-4 text-center">
          <div>
            <dd className="font-display text-xl font-bold text-navy-deep">{property.bedrooms}</dd>
            <dt className="text-body-sm text-ink-muted">Beds</dt>
          </div>
          <div>
            <dd className="font-display text-xl font-bold text-navy-deep">{property.bathrooms}</dd>
            <dt className="text-body-sm text-ink-muted">Baths</dt>
          </div>
          <div>
            <dd className="font-display text-xl font-bold text-navy-deep">
              {property.square_feet ? Number(property.square_feet).toLocaleString() : '—'}
            </dd>
            <dt className="text-body-sm text-ink-muted">Sqft</dt>
          </div>
        </dl>

        {/* --- Maps-grounded neighborhood read, on demand --- */}
        <div className="mt-5 rounded-card bg-surface-low p-4">
          <p className="flex items-center gap-2 text-label-md uppercase text-navy">
            <Sparkles className="h-4 w-4" /> AI Neighborhood Vibe
          </p>
          {vibe ? (
            <>
              <p className="mt-2 text-body-sm text-ink">{vibe.summary}</p>
              {vibe.citations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {vibe.citations.slice(0, 4).map((c) => (
                    <a
                      key={c.url}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-surface-lowest px-2.5 py-1 text-label-md text-ink-muted transition hover:text-navy"
                    >
                      {c.name}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleVibe}
                disabled={isLoadingVibe}
                className="mt-2 flex items-center gap-2 text-body-sm font-semibold text-navy transition hover:underline disabled:opacity-60"
              >
                {isLoadingVibe && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoadingVibe ? 'Checking what’s nearby…' : 'Generate from Google Maps'}
              </button>
              {vibeError && <p className="mt-2 text-body-sm text-danger">{vibeError}</p>}
            </>
          )}
        </div>

        {/* --- Gross rental yield, real or absent --- */}
        <div className="mt-5">
          {yieldPct !== null && band ? (
            <>
              <div className="flex items-center justify-between">
                <span
                  title="Estimated annual rent from the latest CMA, over the list price. Before costs."
                  className="text-body-sm text-ink-muted"
                >
                  Gross rental yield
                </span>
                <span className={`text-body-sm font-semibold ${band.tone}`}>
                  {band.label} ({yieldPct.toFixed(1)}%)
                </span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-container">
                <div
                  className={`h-full rounded-full ${band.bar}`}
                  style={{ width: `${Math.min(100, (yieldPct / 10) * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-body-sm text-ink-muted">
              Yield needs a valuation —{' '}
              <Link href={`/properties/${property.id}`} className="text-navy hover:underline">
                generate a CMA
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto space-y-2 border-t border-hairline p-4">
        <Link
          href={`/properties/${property.id}`}
          className="flex items-center justify-center gap-2 rounded-soft border border-outline-variant py-3 text-sm font-semibold text-ink transition hover:border-navy hover:text-navy"
        >
          <CalendarDays className="h-4 w-4" /> Request Tour
        </Link>
        {canOffer ? (
          <Link
            href={`/properties/${property.id}/offer`}
            className="flex items-center justify-center rounded-soft bg-navy-deep py-3 text-sm font-semibold text-white transition hover:bg-navy"
          >
            Start Offer
          </Link>
        ) : (
          <span className="flex items-center justify-center rounded-soft bg-surface-container py-3 text-sm font-semibold capitalize text-ink-muted">
            {property.status} — not accepting offers
          </span>
        )}
      </div>
    </article>
  );
}
