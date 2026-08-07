'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bed, Bath, Maximize, Sparkles } from 'lucide-react';
import type { RecommendationResult, RecommendationBasis } from '@/app/actions/recommendations';

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';

/**
 * What the ranking was actually computed from. Stated plainly under the heading
 * so the shelf isn't an unexplained black box -- and so it's obvious how to
 * make it better.
 */
const BASIS_COPY: Record<Exclude<RecommendationBasis, 'none'>, string> = {
  both: 'Ranked against your stated priorities and the listings you have saved.',
  preferences: 'Ranked against the buying priorities you set on the Evaluation Hub.',
  favorites: 'Ranked against the listings you have saved. Set your priorities to sharpen this.',
  views: 'Ranked against the listings you have browsed. Save one or set your priorities to sharpen this.',
};

export function RecommendedForYou({ recommendations }: { recommendations: RecommendationResult }) {
  const { properties, basis } = recommendations;

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-navy" aria-hidden="true" />
        <h2 className="font-display text-headline-md text-navy-deep">Recommended for You</h2>
      </div>

      {basis === 'none' ? (
        /* No stated priorities and nothing saved means there is genuinely
           nothing to rank against. Saying so beats filling the shelf with
           arbitrary listings under a personalized heading. */
        <div className="mt-6 rounded-card border border-dashed border-outline-variant bg-surface-low p-8 text-center">
          <p className="text-body-md text-ink">Nothing to base recommendations on yet.</p>
          <p className="mx-auto mt-2 max-w-md text-body-sm text-ink-muted">
            Browse a few listings, save one you like, or set your buying priorities — this fills
            with matches ranked by semantic similarity.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/search"
              className="rounded-soft bg-navy px-4 py-2 text-body-sm font-semibold text-white transition hover:bg-navy-deep"
            >
              Browse listings
            </Link>
            <Link
              href="/evaluate"
              className="rounded-soft border border-outline-variant px-4 py-2 text-body-sm font-semibold text-ink transition hover:bg-surface-container"
            >
              Set your priorities
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-body-sm text-ink-muted">{BASIS_COPY[basis]}</p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <Link
                key={property.id}
                href={`/properties/${property.id}`}
                className="group overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="relative h-40 w-full bg-surface-container">
                  <Image
                    src={property.photos[0] || FALLBACK_PHOTO}
                    alt={property.address}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                  {/* Real cosine similarity, the same measure the Evaluation Hub
                      reports -- not a rescaled or invented confidence score. */}
                  <span className="absolute left-3 top-3 rounded-full bg-navy px-2.5 py-1 text-label-md uppercase text-white">
                    {Math.round(property.similarity * 100)}% Match
                  </span>
                </div>

                <div className="p-4">
                  <p className="font-display text-lg font-semibold text-navy-deep">
                    ${property.price.toLocaleString()}
                  </p>
                  <p className="mt-1 truncate text-body-sm text-ink-muted">
                    {property.address}, {property.city}, {property.state} {property.zipCode}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-body-sm text-ink-muted">
                    <span className="flex items-center gap-1">
                      <Bed className="h-4 w-4" aria-hidden="true" /> {property.bedrooms}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="h-4 w-4" aria-hidden="true" /> {property.bathrooms}
                    </span>
                    {property.squareFeet != null && (
                      <span className="flex items-center gap-1">
                        <Maximize className="h-4 w-4" aria-hidden="true" />{' '}
                        {property.squareFeet.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
