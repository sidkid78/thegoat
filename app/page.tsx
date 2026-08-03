import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search,
  TrendingUp,
  Wand2,
  FileSignature,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=80';

const capabilities = [
  {
    Icon: Search,
    title: 'Semantic Property Search',
    body: 'Describe the home you want in plain language. Listings are embedded with Gemini and matched on meaning, not keyword overlap.',
    href: '/search',
  },
  {
    Icon: TrendingUp,
    title: 'Automated Valuations',
    body: 'Generate a Comparative Market Analysis reasoned over local comparables, with a confidence range and the adjustments behind it.',
    href: '/search',
  },
  {
    Icon: Wand2,
    title: 'Virtual Staging',
    body: 'Upload a room photo and generate photorealistic staging in a chosen interior style, keeping the original architecture intact.',
    href: '/staging',
  },
];

const transparencyPoints = [
  { title: 'Guided Offers', body: 'Contingency review before you submit' },
  { title: 'Tracked Viewings', body: 'Tours booked straight from the assistant' },
  { title: 'Saved Portfolio', body: 'Favourites and CMAs in one dashboard' },
  { title: 'Row-Level Security', body: 'Your data scoped to you at the database' },
];

export default async function HomePage() {
  // Real corpus size rather than an invented marketing figure.
  let listingCount: number | null = null;
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    listingCount = count ?? null;
  } catch {
    listingCount = null;
  }

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden">
        <Image src={HERO_IMAGE} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-navy-deep/95 via-navy-deep/80 to-navy/40" />

        <div className="mx-auto max-w-7xl px-6 py-28 lg:px-10 lg:py-36">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal/15 px-3 py-1.5 text-label-md uppercase text-teal ring-1 ring-teal/30">
              <Sparkles className="h-3.5 w-3.5" />
              Next-Gen Real Estate AI
            </span>

            <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              The AI-Powered Path to
              <br />
              <span className="text-teal">Homeownership</span>
            </h1>

            <p className="mt-6 max-w-xl text-body-lg leading-8 text-white/80">
              Navigate the complex landscape of real estate with Dwellingly.ai. Intelligent systems
              analyse market data, automate due diligence, and personalise your search in real time.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/search"
                className="flex items-center gap-2 rounded-soft bg-teal px-7 py-4 text-sm font-bold text-navy-deep transition hover:bg-teal-dim"
              >
                Start Your Journey
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-soft border border-white/40 px-7 py-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                Open Dashboard
              </Link>
            </div>
          </div>

          {/* Market pulse — the listing figure is read from the database. */}
          <div className="mt-16 w-full max-w-xs rounded-card border border-white/20 bg-white/10 p-5 backdrop-blur-md lg:absolute lg:bottom-16 lg:right-10 lg:mt-0">
            <div className="flex items-center justify-between">
              <p className="text-label-md uppercase text-white/80">Market Pulse</p>
              <TrendingUp className="h-4 w-4 text-teal" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-soft bg-white/10 p-3">
                <dt className="text-body-sm text-white/70">Listings indexed</dt>
                <dd className="mt-1 font-display text-xl font-bold text-white">
                  {listingCount !== null ? listingCount.toLocaleString() : '—'}
                </dd>
              </div>
              <div className="rounded-soft bg-white/10 p-3">
                <dt className="text-body-sm text-white/70">Vector dims</dt>
                <dd className="mt-1 font-display text-xl font-bold text-white">768</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Capabilities                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-headline-lg text-navy-deep">Future-Proof Real Estate</h2>
          <p className="mt-3 text-body-md leading-7 text-ink-muted">
            Manual research replaced with instant AI augmentation, so you have the edge in every
            transaction.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {capabilities.map(({ Icon, title, body, href }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-card border border-hairline bg-surface-lowest p-7 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-soft bg-navy text-white">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-navy-deep">{title}</h3>
              <p className="mt-2 text-body-md leading-7 text-ink-muted">{body}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
                Explore
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Transparency                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-surface-high py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-2 lg:px-10">
          <div>
            <h2 className="font-display text-headline-lg text-navy-deep">
              Transparent Transactions
            </h2>
            <p className="mt-4 max-w-lg text-body-md leading-7 text-ink-muted">
              Every step is tracked and attributable — from the first search through valuation,
              tours, and the offer itself. No hidden steps, just clarity.
            </p>
            <Link
              href="/search"
              className="mt-7 inline-flex items-center gap-2 rounded-soft bg-navy px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-deep"
            >
              <ShieldCheck className="h-4 w-4" />
              Browse Listings
            </Link>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {transparencyPoints.map((point) => (
              <li
                key={point.title}
                className="rounded-card border border-hairline bg-surface-lowest p-5 shadow-card"
              >
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
                <p className="mt-3 text-body-md font-semibold text-ink">{point.title}</p>
                <p className="mt-1 text-body-sm leading-6 text-ink-muted">{point.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Closing CTA                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="rounded-card bg-navy-deep px-8 py-16 text-center">
          <h2 className="font-display text-headline-lg text-white">
            Ready to find your future home?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-body-md leading-7 text-white/75">
            Search {listingCount !== null ? `${listingCount.toLocaleString()} ` : ''}live listings by
            describing what you actually want — then let the assistant do the legwork.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/search"
              className="flex items-center gap-2 rounded-soft bg-teal px-7 py-4 text-sm font-bold text-navy-deep transition hover:bg-teal-dim"
            >
              <FileSignature className="h-4 w-4" />
              Get Started Now
            </Link>
            <Link
              href="/dashboard"
              className="rounded-soft border border-white/40 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Talk to an Agent
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
