'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Download,
  Inbox,
  Loader2,
  MapPin,
  MessagesSquare,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { acceptOfferAction, rejectOfferAction, analyzeOffersAction } from '@/app/actions/offers';
import type { OfferAnalysisResult } from '@/lib/ai/offer-analysis';

// Supabase's generated row types aren't wired up in this project; the rest of
// the dashboard components use the same escape hatch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

/**
 * The contingencies OfferWizard offers. Rendered in full on every column so a
 * seller can see at a glance which ones a buyer *waived* -- an absent
 * contingency is the interesting signal, and a column that just omits it
 * silently hides that.
 */
const ALL_CONTINGENCIES = ['Inspection', 'Financing', 'Appraisal'] as const;

const FINANCING_LABELS: Record<string, string> = {
  conventional: 'Conventional',
  fha: 'FHA',
  va: 'VA',
  cash: 'All Cash',
  other: 'Other',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-teal/25 text-navy-deep',
  pending: 'bg-surface-container text-ink-muted',
  sold: 'bg-surface-container text-ink-muted',
  draft: 'bg-surface-container text-ink-muted',
  archived: 'bg-surface-container text-ink-muted',
};

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

function compactUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return usd(n);
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** A matrix row label — repeated inside each cell below the md breakpoint. */
function CellLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 text-label-md uppercase text-ink-muted md:hidden">{children}</span>
  );
}

export function OfferComparisonMatrix({
  property,
  offers,
}: {
  property: Row;
  offers: Row[];
}) {
  const [analysis, setAnalysis] = useState<OfferAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, startAnalyzing] = useTransition();

  const listPrice = Number(property.price) || 0;

  // Withdrawn offers are retired, not deleted (there's no DELETE policy on
  // `offers`), so they'd otherwise linger as dead columns.
  const columns = useMemo(
    () => offers.filter((o) => o.status !== 'withdrawn'),
    [offers]
  );

  const openOffers = columns.filter((o) => o.status === 'submitted' || o.status === 'countered');
  const acceptedOffer = columns.find((o) => o.status === 'accepted');

  const avgOffer = columns.length
    ? columns.reduce((sum, o) => sum + Number(o.offer_amount), 0) / columns.length
    : 0;

  const daysOnMarket = Math.max(0, daysBetween(new Date(property.created_at), new Date()));
  const coverPhoto = Array.isArray(property.photos) ? property.photos[0] : null;

  const handleAnalyze = () => {
    setAnalysisError(null);
    startAnalyzing(async () => {
      const res = await analyzeOffersAction(property.id);
      if (!res.success) {
        setAnalysisError(res.error);
        return;
      }
      setAnalysis(res.analysis);
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      <Link
        href="/dashboard/offers"
        className="inline-flex items-center gap-1.5 text-body-sm text-ink-muted transition hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> All listings with offers
      </Link>

      {/* ---------------- Listing summary ---------------- */}
      <section className="mt-4 flex flex-col justify-between gap-6 rounded-card border border-hairline bg-surface-lowest p-6 shadow-card md:flex-row md:items-center">
        <div className="flex items-center gap-6">
          {coverPhoto && (
            <div className="relative hidden h-24 w-24 shrink-0 overflow-hidden rounded-card sm:block">
              <Image src={coverPhoto} alt="" fill sizes="96px" className="object-cover" />
            </div>
          )}
          <div>
            <h1 className="font-display text-headline-lg text-ink">{property.address}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-ink-muted">
              <span className="flex items-center gap-1 text-label-md">
                <MapPin className="h-4 w-4" /> {property.city}, {property.state} {property.zip_code}
              </span>
              <span className="h-1 w-1 rounded-full bg-outline-variant" />
              <span className="text-label-md">
                Listed {daysOnMarket === 0 ? 'today' : `${daysOnMarket} day${daysOnMarket === 1 ? '' : 's'} ago`}
              </span>
              <span className="h-1 w-1 rounded-full bg-outline-variant" />
              <span
                className={`rounded-full px-2 py-1 text-label-md uppercase ${
                  STATUS_STYLES[property.status] ?? 'bg-surface-container text-ink-muted'
                }`}
              >
                {property.status}
              </span>
            </div>
          </div>
        </div>

        <dl className="grid w-full grid-cols-2 gap-6 rounded-card bg-surface-low p-4 text-center md:w-auto md:grid-cols-4 md:text-right">
          <div>
            <dt className="mb-1 text-label-md uppercase text-ink-muted">List Price</dt>
            <dd className="font-display text-headline-md text-navy-deep">{compactUsd(listPrice)}</dd>
          </div>
          <div>
            <dt className="mb-1 text-label-md uppercase text-ink-muted">Offers</dt>
            <dd className="font-display text-headline-md text-navy-deep">{columns.length}</dd>
          </div>
          <div>
            <dt className="mb-1 text-label-md uppercase text-ink-muted">Avg. Offer</dt>
            <dd className="font-display text-headline-md text-navy-deep">
              {columns.length ? compactUsd(avgOffer) : '—'}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-label-md uppercase text-ink-muted">Days on Market</dt>
            <dd className="font-display text-headline-md text-navy-deep">{daysOnMarket}</dd>
          </div>
        </dl>
      </section>

      {/* ---------------- Matrix header ---------------- */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-headline-md text-ink">Offer Comparison Matrix</h2>
          <p className="mt-1 text-body-md text-ink-muted">
            Review and compare current offers side-by-side.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {openOffers.length >= 2 && (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex items-center gap-2 rounded-soft bg-teal px-4 py-2 text-label-md uppercase text-navy-deep transition hover:bg-teal-dim disabled:opacity-60"
            >
              {isAnalyzing ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
              ) : (
                <Sparkles className="h-[18px] w-[18px]" />
              )}
              {analysis ? 'Re-rank with AI' : 'Rank offers with AI'}
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-soft border border-outline-variant bg-surface-low px-4 py-2 text-label-md uppercase text-ink transition hover:bg-surface-container"
          >
            <Download className="h-[18px] w-[18px]" /> Export PDF
          </button>
        </div>
      </div>

      {analysisError && (
        <p className="mt-4 rounded-soft bg-danger-container px-3 py-2 text-body-sm text-danger">
          {analysisError}
        </p>
      )}

      {analysis && (
        <div className="mt-4 rounded-card border border-teal bg-teal/10 p-5">
          <p className="flex items-center gap-2 text-label-md uppercase text-navy-deep">
            <Sparkles className="h-4 w-4" /> AI Recommendation
          </p>
          <p className="mt-2 text-body-md text-ink">{analysis.rationale}</p>
        </div>
      )}

      {/* ---------------- The matrix ---------------- */}
      {columns.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-outline-variant bg-surface-lowest p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-outline" />
          <p className="mt-3 text-body-md text-ink-muted">No offers on this listing yet.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-4">
            {/* Label rail — heights below must stay in step with the cells. */}
            <div className="mt-[104px] hidden w-40 shrink-0 flex-col md:flex">
              {['Offer Price', 'Financing', 'Closing Date', 'Contingencies', 'Earnest Money'].map(
                (label, i) => (
                  <div
                    key={label}
                    className={`flex items-center border-b border-hairline p-4 ${
                      i === 3 ? 'h-32 items-start pt-6' : 'h-24'
                    }`}
                  >
                    <span className="text-label-md uppercase text-ink-muted">{label}</span>
                  </div>
                )
              )}
            </div>

            {columns.map((offer, index) => (
              <OfferColumn
                key={offer.id}
                offer={offer}
                letter={String.fromCharCode(65 + index)}
                listPrice={listPrice}
                isTopPick={analysis?.topPickOfferId === offer.id}
                note={analysis?.notes.find((n) => n.offerId === offer.id) ?? null}
                anotherOfferAccepted={!!acceptedOffer && acceptedOffer.id !== offer.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OfferColumn({
  offer,
  letter,
  listPrice,
  isTopPick,
  note,
  anotherOfferAccepted,
}: {
  offer: Row;
  letter: string;
  listPrice: number;
  isTopPick: boolean;
  note: { strength: string; risk: string } | null;
  anotherOfferAccepted: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const buyer = offer.profiles;
  const amount = Number(offer.offer_amount);
  const deltaPct = listPrice ? ((amount - listPrice) / listPrice) * 100 : 0;
  const kept: string[] = Array.isArray(offer.contingencies) ? offer.contingencies : [];

  const closing = offer.proposed_closing_date ? new Date(offer.proposed_closing_date) : null;
  const daysToClose = closing ? daysBetween(new Date(), closing) : null;

  const financing = offer.financing_type ? FINANCING_LABELS[offer.financing_type] : null;
  const downPayment = offer.down_payment === null ? null : Number(offer.down_payment);
  // One decimal, trimmed -- rounding to whole percent turns a 3.5%-down FHA
  // offer into "4% Down", which flattens exactly the distinction this row exists
  // to draw.
  const downPct =
    downPayment && amount
      ? ((downPayment / amount) * 100).toFixed(1).replace(/\.0$/, '')
      : null;

  const isOpen = offer.status === 'submitted' || offer.status === 'countered';

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      const res = await acceptOfferAction(offer.id);
      if (!res.success) {
        setError(res.error || 'Failed to accept offer.');
        return;
      }
      setNotice(
        res.docusignError
          ? `Accepted, but sending the contract failed: ${res.docusignError}`
          : 'Accepted — the purchase agreement has been sent to the buyer for signature.'
      );
    });
  };

  const handleReject = () => {
    setError(null);
    startTransition(async () => {
      const res = await rejectOfferAction(offer.id);
      if (!res.success) setError(res.error || 'Failed to reject offer.');
    });
  };

  const dimmed = offer.status === 'rejected' || anotherOfferAccepted;

  return (
    <div
      className={`flex w-[280px] shrink-0 flex-col overflow-hidden rounded-card bg-surface-lowest shadow-card ${
        isTopPick ? 'border-2 border-teal' : 'border border-hairline'
      } ${dimmed ? 'opacity-60' : ''}`}
    >
      {/* Header — 104px tall to line up with the label rail's top offset. The
          badge floats above the flow so the top pick's title stays on the same
          baseline as every other column's. */}
      <div className="relative flex h-[104px] flex-col items-center justify-center border-b border-hairline px-4 text-center">
        {isTopPick && (
          <span className="absolute left-0 right-0 top-0 flex items-center justify-center gap-1.5 bg-teal/25 py-1.5 text-label-md uppercase text-navy-deep">
            <Sparkles className="h-[14px] w-[14px]" /> AI Top Pick
          </span>
        )}
        <h3 className="font-display text-headline-md text-ink">Offer {letter}</h3>
        <p className="text-body-sm text-ink-muted">Buyer: {buyer?.full_name || 'Unknown'}</p>
      </div>

      {/* Offer price */}
      <div className="flex h-auto flex-col items-center justify-center border-b border-hairline p-4 md:h-24">
        <CellLabel>Offer Price</CellLabel>
        <span
          className={`font-display text-headline-md ${deltaPct > 0 ? 'text-success' : 'text-ink'}`}
        >
          {usd(amount)}
        </span>
        <span className={`text-label-md ${deltaPct > 0 ? 'text-success' : 'text-ink-muted'}`}>
          {deltaPct === 0
            ? 'At asking price'
            : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}% ${deltaPct > 0 ? 'over' : 'under'} ask`}
        </span>
      </div>

      {/* Financing */}
      <div className="flex h-auto flex-col items-center justify-center border-b border-hairline p-4 text-center md:h-24">
        <CellLabel>Financing</CellLabel>
        <span className="text-body-lg text-ink">{financing ?? 'Not specified'}</span>
        {offer.financing_type === 'cash' ? (
          <span className="text-label-md text-ink-muted">No loan contingency risk</span>
        ) : downPayment !== null ? (
          <span className="text-label-md text-ink-muted">
            {downPct}% Down ({compactUsd(downPayment)})
          </span>
        ) : null}
      </div>

      {/* Closing date */}
      <div className="flex h-auto flex-col items-center justify-center border-b border-hairline p-4 text-center md:h-24">
        <CellLabel>Closing Date</CellLabel>
        <span className={`text-body-lg ${daysToClose !== null && daysToClose > 45 ? 'text-danger' : 'text-ink'}`}>
          {closing
            ? closing.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
            : '—'}
        </span>
        {daysToClose !== null && (
          <span className="text-label-md text-ink-muted">
            {daysToClose < 0
              ? `${Math.abs(daysToClose)} days overdue`
              : `${daysToClose} days${daysToClose <= 21 ? ' (Fast)' : ''}`}
          </span>
        )}
      </div>

      {/* Contingencies — waived ones stay visible, struck through. */}
      <div className="flex h-auto flex-col items-center justify-center border-b border-hairline p-4 text-center md:h-32">
        <CellLabel>Contingencies</CellLabel>
        <div className="flex flex-wrap justify-center gap-2">
          {ALL_CONTINGENCIES.map((c) => {
            const waived = !kept.includes(c);
            return (
              <span
                key={c}
                title={waived ? `${c} contingency waived` : `${c} contingency kept`}
                className={`rounded-soft px-2 py-1 text-label-md ${
                  waived
                    ? 'bg-surface-low text-ink-muted line-through opacity-60'
                    : 'bg-surface-high text-ink'
                }`}
              >
                {c}
              </span>
            );
          })}
        </div>
      </div>

      {/* Earnest money */}
      <div className="flex h-auto flex-col items-center justify-center p-4 text-center md:h-24">
        <CellLabel>Earnest Money</CellLabel>
        <span className="text-body-lg text-ink">
          {offer.earnest_money ? usd(Number(offer.earnest_money)) : '—'}
        </span>
        {offer.earnest_money_paid_at && (
          <span className="text-label-md text-success">Paid</span>
        )}
      </div>

      {note && (
        <div className="border-t border-hairline bg-teal/5 px-4 py-3 text-body-sm">
          <p className="text-ink">
            <span className="text-label-md uppercase text-success">Strength</span> {note.strength}
          </p>
          <p className="mt-1.5 text-ink">
            <span className="text-label-md uppercase text-danger">Risk</span> {note.risk}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto border-t border-hairline bg-surface-low p-4">
        {notice && <p className="mb-3 text-body-sm text-ink-muted">{notice}</p>}
        {error && <p className="mb-3 text-body-sm text-danger">{error}</p>}

        <Link
          href={`/deals/${offer.id}`}
          className="mb-2 flex items-center justify-center gap-1.5 rounded-soft py-2 text-label-md uppercase text-navy transition hover:underline print:hidden"
        >
          <MessagesSquare className="h-4 w-4" /> Negotiate
        </Link>

        {isOpen && !anotherOfferAccepted ? (
          <div className="space-y-2 print:hidden">
            <button
              type="button"
              onClick={handleAccept}
              disabled={isPending}
              className={`flex w-full items-center justify-center gap-2 rounded-soft py-3 text-label-md uppercase transition disabled:opacity-60 ${
                isTopPick
                  ? 'bg-navy-deep text-white hover:bg-navy'
                  : 'border border-navy bg-surface-lowest text-navy hover:bg-surface-container'
              }`}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Accept Offer {letter}
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-soft py-2 text-label-md uppercase text-ink-muted transition hover:text-danger disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
          </div>
        ) : (
          <p className="py-3 text-center text-label-md uppercase text-ink-muted">
            {offer.status === 'accepted'
              ? 'Accepted'
              : offer.status === 'rejected'
                ? 'Rejected'
                : 'Closed — another offer accepted'}
          </p>
        )}
      </div>
    </div>
  );
}
