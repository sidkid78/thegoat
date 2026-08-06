'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MyOffersSection } from '@/components/dashboard/MyOffersSection';
import { RecommendedForYou } from '@/components/dashboard/RecommendedForYou';
import type { RecommendationResult } from '@/app/actions/recommendations';
import {
  Bookmark,
  CalendarDays,
  FileText,
  TrendingUp,
  Calculator,
  BarChart3,
  Wand2,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface DashboardViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  favorites: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offers: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewings: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cmaReports: any[];
  /** Ranked by the server component; `basis: 'none'` when there is no real
   *  signal to rank against. */
  recommendations: RecommendationResult;
  /** Rendered-at timestamp, supplied by the server component. Passing it in
   *  keeps server and client markup identical (no hydration mismatch) and
   *  keeps the clock out of render. */
  now: number;
}

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';

const toolkit = [
  {
    Icon: BarChart3,
    title: 'Market Analysis',
    body: 'Run an AI Comparative Market Analysis on any listing, with a confidence range and the adjustments behind it.',
    href: '/search',
  },
  {
    Icon: Wand2,
    title: 'Virtual Staging',
    body: 'Generate photorealistic staging for a room photo in the interior style you choose.',
    href: '/staging',
  },
  {
    Icon: Calculator,
    title: 'Payment Estimates',
    body: 'Model down payments and monthly costs on a property detail page before you make an offer.',
    href: '/search',
  },
];

function greetingFor(now: number) {
  const hour = new Date(now).getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso: string, now: number) {
  const diff = now - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function DashboardView({
  user,
  favorites = [],
  offers = [],
  viewings = [],
  cmaReports = [],
  recommendations,
  now,
}: DashboardViewProps) {
  const displayName =
    user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // Headline card: the newest saved property, which is the thing most likely
  // to be acted on next.
  const featured = favorites.find((f) => f.properties)?.properties ?? null;

  const nextViewing = useMemo(() => {
    return (
      viewings
        .filter((v) => new Date(v.scheduled_at).getTime() > now)
        .sort(
          (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        )[0] ?? null
    );
  }, [viewings, now]);

  // One merged, time-ordered feed built from real rows.
  const activity = useMemo(() => {
    const items: { id: string; title: string; body: string; at: string; tone: string }[] = [];

    for (const o of offers) {
      items.push({
        id: `offer-${o.id}`,
        title: 'Offer submitted',
        body: `$${Number(o.offer_amount).toLocaleString()} on ${o.properties?.address ?? 'a property'} — ${o.status}.`,
        at: o.created_at,
        tone: 'bg-navy',
      });
    }
    for (const v of viewings) {
      items.push({
        id: `viewing-${v.id}`,
        title: 'Tour scheduled',
        body: `${v.properties?.address ?? 'A property'} on ${new Date(v.scheduled_at).toLocaleDateString()}.`,
        at: v.created_at ?? v.scheduled_at,
        tone: 'bg-teal',
      });
    }
    for (const c of cmaReports) {
      items.push({
        id: `cma-${c.id}`,
        title: 'Valuation ready',
        body: `${c.properties?.address ?? 'A property'} valued at $${Number(c.estimated_valuation).toLocaleString()}.`,
        at: c.created_at,
        tone: 'bg-outline',
      });
    }

    return items
      .filter((i) => i.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 6);
  }, [offers, viewings, cmaReports]);

  const stats = [
    { label: 'Saved Properties', value: favorites.length, Icon: Bookmark },
    { label: 'Scheduled Tours', value: viewings.length, Icon: CalendarDays },
    { label: 'Active Offers', value: offers.length, Icon: FileText },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        {/* ---------------------------------------------------------------- */}
        {/* Main column                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <h1 className="font-display text-headline-xl text-navy-deep">
            {greetingFor(now)}, {displayName}.
          </h1>
          <p className="mt-2 text-body-md text-ink-muted">
            {user
              ? "Here's what's happening with your real estate portfolio today."
              : 'Sign in to track saved properties, tours, and offers.'}
          </p>

          {/* Featured saved property */}
          {featured ? (
            <div className="mt-8 grid overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-card sm:grid-cols-[16rem_1fr]">
              <div className="relative aspect-4/3 sm:aspect-auto">
                <Image
                  src={
                    Array.isArray(featured.photos) && typeof featured.photos[0] === 'string'
                      ? featured.photos[0]
                      : FALLBACK_PHOTO
                  }
                  alt={featured.address}
                  fill
                  sizes="(max-width: 640px) 100vw, 16rem"
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-headline-md text-navy-deep">
                      {featured.address}
                    </h2>
                    <p className="mt-1 text-body-sm text-ink-muted">
                      {featured.city}, {featured.state} • Est. value $
                      {Number(featured.price).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-teal px-3 py-1.5 text-label-md uppercase text-navy-deep">
                    Saved
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card bg-surface-low p-4">
                  <div>
                    <p className="text-label-md uppercase text-ink-muted">Next step</p>
                    <p className="mt-1 text-body-md font-semibold text-ink">
                      {nextViewing
                        ? `Tour on ${new Date(nextViewing.scheduled_at).toLocaleDateString()}`
                        : 'Book a tour or run a valuation'}
                    </p>
                  </div>
                  <Link
                    href={`/properties/${featured.id}`}
                    className="rounded-soft bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-deep"
                  >
                    Open Property
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-card border border-dashed border-outline-variant bg-surface-lowest p-10 text-center">
              <Bookmark className="mx-auto h-8 w-8 text-outline" />
              <h2 className="mt-3 font-display text-headline-md text-navy-deep">
                No saved properties yet
              </h2>
              <p className="mx-auto mt-2 max-w-md text-body-md text-ink-muted">
                Save a listing from search and it will appear here with its next action.
              </p>
              <Link
                href="/search"
                className="mt-6 inline-flex items-center gap-2 rounded-soft bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy-deep"
              >
                Browse Listings
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {/* Stats */}
          <dl className="mt-6 grid gap-6 sm:grid-cols-3">
            {stats.map(({ label, value, Icon }) => (
              <div
                key={label}
                className="rounded-card border border-hairline bg-surface-lowest p-6 shadow-card"
              >
                <div className="flex items-start justify-between">
                  <dt className="text-body-md text-ink-muted">{label}</dt>
                  <Icon className="h-4 w-4 text-outline" aria-hidden="true" />
                </div>
                <dd className="mt-3 font-display text-headline-lg text-navy-deep">{value}</dd>
              </div>
            ))}
          </dl>

          <MyOffersSection offers={offers} />

          {/* Signed-out visitors have no taste to rank against, so the section
              would only ever render its empty state -- omit it entirely. */}
          {user && <RecommendedForYou recommendations={recommendations} />}

          {/* Toolkit */}
          <h2 className="mt-12 font-display text-headline-md text-navy-deep">
            Your Real Estate Toolkit
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {toolkit.map(({ Icon, title, body, href }) => (
              <Link
                key={title}
                href={href}
                className="group rounded-card border border-hairline bg-surface-lowest p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-soft bg-surface-container text-navy">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-navy-deep">{title}</h3>
                <p className="mt-2 text-body-sm leading-6 text-ink-muted">{body}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Activity rail                                                     */}
        {/* ---------------------------------------------------------------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-hairline bg-surface-lowest shadow-card">
            <div className="border-b border-hairline px-6 py-5">
              <h2 className="font-display text-headline-md text-navy-deep">Activity</h2>
            </div>

            {activity.length > 0 ? (
              <ul className="divide-y divide-hairline">
                {activity.map((item) => (
                  <li key={item.id} className="flex gap-3 px-6 py-4">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.tone}`}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-body-md font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-body-sm leading-6 text-ink-muted">{item.body}</p>
                      <p className="mt-1 text-body-sm text-outline">{timeAgo(item.at, now)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-8 text-body-sm text-ink-muted">
                No activity yet. Saving a property, booking a tour, or submitting an offer will show
                up here.
              </p>
            )}
          </div>

          {/* AI prompt card */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('dwellingly:open-ai'))}
            className="mt-6 flex w-full items-start gap-3 rounded-card bg-navy-deep p-6 text-left transition hover:bg-navy"
          >
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
            <span>
              <span className="block text-label-md uppercase text-teal">Dwellingly AI</span>
              <span className="mt-2 block text-body-md leading-6 text-white">
                Ask me to find listings, explain a neighborhood, or book a tour.
              </span>
            </span>
          </button>

          <Link
            href="/search"
            className="mt-4 flex items-center justify-between rounded-card border border-hairline bg-surface-lowest px-6 py-4 shadow-card transition hover:border-navy"
          >
            <span className="text-body-md font-semibold text-navy-deep">Find more listings</span>
            <TrendingUp className="h-4 w-4 text-navy" />
          </Link>

          <Link
            href="/dashboard/offers"
            className="mt-4 flex items-center justify-between rounded-card border border-hairline bg-surface-lowest px-6 py-4 shadow-card transition hover:border-navy"
          >
            <span className="text-body-md font-semibold text-navy-deep">Offers received on your listings</span>
            <FileText className="h-4 w-4 text-navy" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
