'use client';

import React, { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Bed, Bath, Ruler, MapPin, Sparkles, Share2 } from 'lucide-react';
import { toggleFavoriteAction } from '@/app/actions/properties';

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';

export function PropertyCard({
  property,
  priority = false,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  property: any;
  /** Set on above-the-fold cards so the LCP image isn't lazy-loaded. */
  priority?: boolean;
}) {
  const [isFavorite, setIsFavorite] = useState(property.isFavorite || false);
  const [isPending, startTransition] = useTransition();

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      try {
        const res = await toggleFavoriteAction(property.id);
        setIsFavorite(res.isFavorite);
      } catch {
        // Handle auth trigger
      }
    });
  };

  const photo = typeof property.photos?.[0] === 'string' ? property.photos[0].trim() : '';
  const mainPhoto = photo || FALLBACK_PHOTO;
  const propId = property.id ?? property.property_id;

  // Vector search returns cosine similarity; surface it as the match score the
  // mockup shows. Absent on plain filtered results, in which case we hide it.
  const matchScore =
    typeof property.similarity === 'number' ? Math.round(property.similarity * 100) : null;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
      <Link href={`/properties/${propId}`} className="relative block aspect-16/10 overflow-hidden bg-surface-container">
        <Image
          src={mainPhoto}
          alt={property.address}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <span className="absolute left-3 top-3 rounded-soft bg-navy px-2.5 py-1 text-label-md uppercase text-white">
          For Sale
        </span>

        {matchScore !== null && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-teal px-3 py-1.5 text-sm font-bold text-navy-deep shadow-card">
            <Sparkles className="h-3.5 w-3.5" />
            {matchScore}% Match
          </span>
        )}
      </Link>

      {/* Favourite sits outside the Link so it doesn't nest an interactive
          control inside an anchor. */}
      <button
        type="button"
        onClick={handleFavoriteClick}
        disabled={isPending}
        aria-label={isFavorite ? 'Remove from favourites' : 'Save to favourites'}
        aria-pressed={isFavorite}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-navy shadow-card backdrop-blur-sm transition hover:bg-white disabled:opacity-60"
      >
        <Heart className={`h-4.5 w-4.5 ${isFavorite ? 'fill-danger text-danger' : ''}`} />
      </button>

      <div className="flex flex-1 flex-col p-5">
        <p className="font-display text-2xl font-bold tracking-tight text-navy-deep">
          ${Number(property.price).toLocaleString()}
        </p>

        <Link
          href={`/properties/${propId}`}
          className="mt-2 flex items-start gap-1.5 text-sm text-ink-muted transition hover:text-navy"
        >
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-outline" />
          <span className="line-clamp-2">
            {property.address}, {property.city}, {property.state} {property.zip_code}
          </span>
        </Link>

        {/* Visual chunking: specs are divided from the identity block above. */}
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-hairline pt-4 text-center">
          <div>
            <dt className="sr-only">Bedrooms</dt>
            <Bed className="mx-auto h-4.5 w-4.5 text-ink-muted" aria-hidden="true" />
            <dd className="mt-1.5 whitespace-nowrap text-[13px] font-semibold text-ink">{property.bedrooms} Beds</dd>
          </div>
          <div className="border-x border-hairline">
            <dt className="sr-only">Bathrooms</dt>
            <Bath className="mx-auto h-4.5 w-4.5 text-ink-muted" aria-hidden="true" />
            <dd className="mt-1.5 whitespace-nowrap text-[13px] font-semibold text-ink">{property.bathrooms} Baths</dd>
          </div>
          <div>
            <dt className="sr-only">Floor area</dt>
            <Ruler className="mx-auto h-4.5 w-4.5 text-ink-muted" aria-hidden="true" />
            <dd className="mt-1.5 whitespace-nowrap text-[13px] font-semibold text-ink">
              {property.square_feet ? Number(property.square_feet).toLocaleString() : '—'} SqFt
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center gap-3">
          <Link
            href={`/properties/${propId}`}
            className="flex-1 rounded-soft bg-navy py-3 text-center text-sm font-semibold text-white transition hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            View Details
          </Link>
          <button
            type="button"
            aria-label={`Share ${property.address}`}
            className="flex h-11 w-11 items-center justify-center rounded-soft border border-outline-variant text-ink-muted transition hover:border-navy hover:text-navy"
          >
            <Share2 className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
