'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { CreditCard, CheckCircle2, FileSignature, Loader2, MessagesSquare } from 'lucide-react';
import { createEarnestMoneyCheckoutAction } from '@/app/actions/offers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OfferRow = any;

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-surface-container text-ink-muted',
  countered: 'bg-surface-container text-ink-muted',
  accepted: 'bg-success/15 text-success',
  rejected: 'bg-danger-container text-danger',
  withdrawn: 'bg-surface-container text-ink-muted',
};

function OfferRowItem({ offer }: { offer: OfferRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const property = offer.properties;

  const handlePay = () => {
    setError(null);
    startTransition(async () => {
      const res = await createEarnestMoneyCheckoutAction(offer.id);
      if (!res.success) {
        setError(res.error || 'Failed to start checkout.');
        return;
      }
      if (res.url) window.location.href = res.url;
    });
  };

  const isPaid = !!offer.earnest_money_paid_at;
  const canPay = offer.status === 'accepted' && !isPaid && offer.earnest_money;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-hairline bg-surface-lowest p-5 shadow-card">
      <div>
        <Link
          href={`/properties/${property?.id}`}
          className="font-display text-base font-semibold text-navy-deep hover:underline"
        >
          {property?.address || 'Property'}
        </Link>
        <p className="mt-0.5 text-body-sm text-ink-muted">
          {property?.city}, {property?.state} • ${Number(offer.offer_amount).toLocaleString()}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1.5 text-label-md uppercase ${STATUS_STYLES[offer.status] ?? 'bg-surface-container text-ink-muted'}`}
        >
          {offer.status}
        </span>

        <Link
          href={`/deals/${offer.id}`}
          className="flex items-center gap-1.5 text-body-sm font-semibold text-navy transition hover:underline"
        >
          <MessagesSquare className="h-4 w-4" /> Negotiate
        </Link>

        {isPaid ? (
          <span className="flex items-center gap-1.5 text-body-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Earnest money paid
          </span>
        ) : canPay ? (
          <button
            type="button"
            onClick={handlePay}
            disabled={isPending}
            className="flex items-center gap-2 rounded-soft bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Pay Earnest Money (${Number(offer.earnest_money).toLocaleString()})
          </button>
        ) : null}

        {offer.docusign_envelope_id && !isPaid && (
          <span className="flex items-center gap-1.5 text-body-sm text-ink-muted">
            <FileSignature className="h-4 w-4 text-navy" /> Check your email to sign the agreement
          </span>
        )}
      </div>

      {error && <p className="w-full text-body-sm text-danger">{error}</p>}
    </div>
  );
}

export function MyOffersSection({ offers }: { offers: OfferRow[] }) {
  if (offers.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="font-display text-headline-md text-navy-deep">Your Offers</h2>
      <div className="mt-6 space-y-4">
        {offers.map((offer) => (
          <OfferRowItem key={offer.id} offer={offer} />
        ))}
      </div>
    </div>
  );
}
