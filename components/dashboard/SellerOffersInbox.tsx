'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, FileSignature, Loader2, Inbox } from 'lucide-react';
import { acceptOfferAction, rejectOfferAction } from '@/app/actions/offers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OfferRow = any;

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-surface-container text-ink-muted',
  countered: 'bg-surface-container text-ink-muted',
  accepted: 'bg-success/15 text-success',
  rejected: 'bg-danger-container text-danger',
  withdrawn: 'bg-surface-container text-ink-muted',
};

function OfferCard({ offer }: { offer: OfferRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [docusignNote, setDocusignNote] = useState<string | null>(null);

  const property = offer.properties;
  const buyer = offer.profiles;

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      const res = await acceptOfferAction(offer.id);
      if (!res.success) {
        setError(res.error || 'Failed to accept offer.');
        return;
      }
      if (res.docusignError) {
        setDocusignNote(`Offer accepted, but sending the contract for signature failed: ${res.docusignError}`);
      } else {
        setDocusignNote('Offer accepted — the purchase agreement has been sent to the buyer for signature.');
      }
    });
  };

  const handleReject = () => {
    setError(null);
    startTransition(async () => {
      const res = await rejectOfferAction(offer.id);
      if (!res.success) setError(res.error || 'Failed to reject offer.');
    });
  };

  return (
    <div className="rounded-card border border-hairline bg-surface-lowest p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/properties/${property?.id}`}
            className="font-display text-lg font-semibold text-navy-deep hover:underline"
          >
            {property?.address}
          </Link>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            {property?.city}, {property?.state}
          </p>
          <p className="mt-1 text-body-sm text-ink-muted">
            From {buyer?.full_name || 'a buyer'} ({buyer?.email})
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-label-md uppercase ${STATUS_STYLES[offer.status] ?? 'bg-surface-container text-ink-muted'}`}
        >
          {offer.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4 sm:grid-cols-4">
        <div>
          <p className="text-label-md uppercase text-ink-muted">Offer</p>
          <p className="mt-1 text-body-md font-semibold text-ink">
            ${Number(offer.offer_amount).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-label-md uppercase text-ink-muted">Earnest Money</p>
          <p className="mt-1 text-body-md font-semibold text-ink">
            {offer.earnest_money ? `$${Number(offer.earnest_money).toLocaleString()}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-label-md uppercase text-ink-muted">Closing Date</p>
          <p className="mt-1 text-body-md font-semibold text-ink">
            {offer.proposed_closing_date
              ? new Date(offer.proposed_closing_date).toLocaleDateString()
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-label-md uppercase text-ink-muted">Contingencies</p>
          <p className="mt-1 text-body-sm text-ink">
            {Array.isArray(offer.contingencies) && offer.contingencies.length > 0
              ? offer.contingencies.join(', ')
              : 'None'}
          </p>
        </div>
      </div>

      {offer.docusign_envelope_id && (
        <p className="mt-4 flex items-center gap-2 rounded-soft bg-surface-low px-3 py-2 text-body-sm text-ink-muted">
          <FileSignature className="h-4 w-4 text-navy" />
          Purchase agreement sent for signature (envelope {offer.docusign_envelope_id.slice(0, 8)}…)
        </p>
      )}

      {docusignNote && (
        <p className="mt-4 rounded-soft bg-surface-low px-3 py-2 text-body-sm text-ink-muted">{docusignNote}</p>
      )}
      {error && (
        <p className="mt-4 rounded-soft bg-danger-container px-3 py-2 text-body-sm text-danger">{error}</p>
      )}

      {offer.status === 'submitted' && (
        <div className="mt-5 flex gap-3 border-t border-hairline pt-5">
          <button
            type="button"
            onClick={handleAccept}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-soft bg-navy py-3 text-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Accept Offer
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-soft border border-outline-variant py-3 text-sm font-semibold text-ink transition hover:border-danger hover:text-danger disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export function SellerOffersInbox({ offers, isSignedIn }: { offers: OfferRow[]; isSignedIn: boolean }) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <h1 className="font-display text-headline-xl text-navy-deep">Offers Received</h1>
      <p className="mt-2 text-body-md text-ink-muted">
        Offers submitted on properties you own. Accepting an offer sends the purchase agreement to the
        buyer for e-signature via DocuSign.
      </p>

      {!isSignedIn ? (
        <p className="mt-8 rounded-card border border-dashed border-outline-variant bg-surface-lowest p-10 text-center text-body-md text-ink-muted">
          Sign in to view offers on your listings.
        </p>
      ) : offers.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-outline-variant bg-surface-lowest p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-outline" />
          <p className="mt-3 text-body-md text-ink-muted">No offers yet on your listings.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
