'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Inbox } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OfferRow = any;

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

interface ListingGroup {
  property: OfferRow;
  offers: OfferRow[];
}

/** Groups offers by the listing they were made on, newest listing activity first. */
function groupByProperty(offers: OfferRow[]): ListingGroup[] {
  const groups = new Map<number, ListingGroup>();
  for (const offer of offers) {
    const property = offer.properties;
    if (!property) continue;
    const existing = groups.get(property.id);
    if (existing) {
      existing.offers.push(offer);
    } else {
      groups.set(property.id, { property, offers: [offer] });
    }
  }
  return [...groups.values()];
}

function ListingCard({ group }: { group: ListingGroup }) {
  const { property, offers } = group;

  // Withdrawn offers are retired rather than deleted, so they shouldn't count
  // toward what the seller sees as live activity.
  const live = offers.filter((o) => o.status !== 'withdrawn');
  const open = live.filter((o) => o.status === 'submitted' || o.status === 'countered');
  const accepted = live.find((o) => o.status === 'accepted');
  const best = live.reduce<number>((max, o) => Math.max(max, Number(o.offer_amount)), 0);
  const listPrice = Number(property.price) || 0;
  const bestDelta = listPrice ? ((best - listPrice) / listPrice) * 100 : 0;

  return (
    <Link
      href={`/dashboard/offers/${property.id}`}
      className="block rounded-card border border-hairline bg-surface-lowest p-6 shadow-card transition hover:shadow-card-hover"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy-deep">{property.address}</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            {property.city}, {property.state} • Listed at {usd(listPrice)}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-label-md uppercase text-navy">
          Compare {live.length} offer{live.length === 1 ? '' : 's'}
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4 sm:grid-cols-3">
        <div>
          <dt className="text-label-md uppercase text-ink-muted">Highest Offer</dt>
          <dd className="mt-1 text-body-md font-semibold text-ink">
            {best ? usd(best) : '—'}
            {best > 0 && listPrice > 0 && (
              <span className={`ml-1.5 text-body-sm ${bestDelta >= 0 ? 'text-success' : 'text-ink-muted'}`}>
                {bestDelta >= 0 ? '+' : ''}
                {bestDelta.toFixed(1)}%
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-label-md uppercase text-ink-muted">Awaiting Response</dt>
          <dd className="mt-1 text-body-md font-semibold text-ink">{open.length}</dd>
        </div>
        <div>
          <dt className="text-label-md uppercase text-ink-muted">Status</dt>
          <dd className="mt-1 text-body-md font-semibold text-ink">
            {accepted ? 'Offer accepted' : open.length > 0 ? 'Open for review' : 'No open offers'}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

export function SellerOffersInbox({ offers, isSignedIn }: { offers: OfferRow[]; isSignedIn: boolean }) {
  const groups = useMemo(() => groupByProperty(offers), [offers]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <h1 className="font-display text-headline-xl text-navy-deep">Offers Received</h1>
      <p className="mt-2 text-body-md text-ink-muted">
        Offers submitted on properties you own. Open a listing to compare its offers side-by-side;
        accepting one sends the purchase agreement to that buyer for e-signature via DocuSign.
      </p>

      {!isSignedIn ? (
        <p className="mt-8 rounded-card border border-dashed border-outline-variant bg-surface-lowest p-10 text-center text-body-md text-ink-muted">
          Sign in to view offers on your listings.
        </p>
      ) : groups.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-outline-variant bg-surface-lowest p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-outline" />
          <p className="mt-3 text-body-md text-ink-muted">No offers yet on your listings.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {groups.map((group) => (
            <ListingCard key={group.property.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
