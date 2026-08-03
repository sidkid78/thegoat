'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { PropertyCard } from '@/components/search/PropertyCard';
import { performVectorSearchAction } from '@/app/actions/search';
import { Search, Sparkles, MapPin, Loader2, List, Map as MapIcon, TrendingUp } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PropertyItem = any;

interface PropertySearchProps {
  initialProperties: PropertyItem[];
}

/** Chip label -> property_type values stored in the database. */
const PROPERTY_TYPES: { label: string; match: string[] }[] = [
  { label: 'House', match: ['single_family'] },
  { label: 'Condo', match: ['condo'] },
  { label: 'Townhome', match: ['townhouse'] },
  { label: 'Lot/Land', match: ['land'] },
];

const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5'];

/**
 * These feed extra intent into the embedded query rather than being decorative
 * toggles — the search is semantic, so the phrasing genuinely changes results.
 */
const AI_PREFERENCES: { id: string; label: string; phrase: string }[] = [
  { id: 'appreciation', label: 'High Appreciation', phrase: 'strong long-term value appreciation' },
  { id: 'cashflow', label: 'Cash Flow Focus', phrase: 'strong rental income potential' },
  { id: 'renovation', label: 'Renovation Potential', phrase: 'renovation and improvement potential' },
];

type SortKey = 'relevance' | 'price-asc' | 'price-desc';

export function PropertySearch({ initialProperties }: PropertySearchProps) {
  const [properties, setProperties] = useState<PropertyItem[]>(initialProperties);
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>(['appreciation', 'renovation']);
  const [sort, setSort] = useState<SortKey>('relevance');
  const [hasSearched, setHasSearched] = useState(false);

  const toggle = (value: string, list: string[], setList: (v: string[]) => void) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    startTransition(async () => {
      const prefPhrases = AI_PREFERENCES.filter((p) => preferences.includes(p.id)).map((p) => p.phrase);
      const composedQuery = [query.trim(), ...prefPhrases].filter(Boolean).join('. ');

      if (composedQuery) {
        const res = await performVectorSearchAction({
          query: composedQuery,
          city: city || undefined,
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
        });

        if (res.success && res.results) {
          setProperties(res.results);
          setHasSearched(true);
        }
      } else {
        const params = new URLSearchParams();
        if (city) params.set('city', city);
        if (minPrice) params.set('minPrice', minPrice);
        if (maxPrice) params.set('maxPrice', maxPrice);
        if (bedrooms) params.set('bedrooms', bedrooms);

        const res = await fetch(`/api/properties?${params.toString()}`);
        const data = await res.json();
        if (data.properties) {
          setProperties(data.properties);
          setHasSearched(true);
        }
      }
    });
  };

  const resetFilters = () => {
    setQuery('');
    setCity('');
    setMinPrice('');
    setMaxPrice('');
    setBedrooms('');
    setSelectedTypes([]);
    setPreferences([]);
    setSort('relevance');
    setHasSearched(false);
    setProperties(initialProperties);
  };

  // Property type and sort are applied client-side: match_properties has no
  // type filter, and the RPC already returns rows ordered by similarity.
  const visibleProperties = useMemo(() => {
    const wanted = PROPERTY_TYPES.filter((t) => selectedTypes.includes(t.label)).flatMap((t) => t.match);

    const filtered = wanted.length
      ? properties.filter((p) => wanted.includes(p.property_type))
      : properties;

    const sorted = [...filtered];
    if (sort === 'price-asc') sorted.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'price-desc') sorted.sort((a, b) => Number(b.price) - Number(a.price));
    return sorted;
  }, [properties, selectedTypes, sort]);

  const locationLabel = city.trim() || 'All Locations';

  return (
    <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
      {/* ---------------------------------------------------------------- */}
      {/* Filter rail                                                       */}
      {/* ---------------------------------------------------------------- */}
      <aside className="custom-scrollbar w-full shrink-0 border-hairline bg-surface-lowest lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-80 lg:overflow-y-auto lg:border-r">
        <form onSubmit={handleSearch} className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-hairline px-6 py-5">
            <h2 className="font-display text-headline-md text-navy-deep">Filters</h2>
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-medium text-ink-muted underline-offset-4 transition hover:text-navy hover:underline"
            >
              Reset
            </button>
          </div>

          <div className="flex-1 space-y-7 px-6 py-6">
            {/* Location */}
            <div>
              <label htmlFor="filter-city" className="text-label-md uppercase text-ink-muted">
                Location
              </label>
              <div className="relative mt-3">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                <input
                  id="filter-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Austin, TX"
                  className="h-11 w-full rounded-soft border border-outline-variant bg-surface-lowest pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-outline focus:border-navy focus:border-b-2"
                />
              </div>
            </div>

            {/* Price range */}
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-label-md uppercase text-ink-muted">Price Range</span>
                <span className="text-sm font-semibold text-navy">
                  {minPrice || maxPrice
                    ? `${minPrice ? `$${Number(minPrice).toLocaleString()}` : 'Any'} – ${
                        maxPrice ? `$${Number(maxPrice).toLocaleString()}` : 'Any'
                      }`
                    : 'Any'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min"
                  aria-label="Minimum price"
                  className="h-11 w-full rounded-soft border border-outline-variant bg-surface-lowest px-3 text-sm text-ink outline-none transition placeholder:text-outline focus:border-navy focus:border-b-2"
                />
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  aria-label="Maximum price"
                  className="h-11 w-full rounded-soft border border-outline-variant bg-surface-lowest px-3 text-sm text-ink outline-none transition placeholder:text-outline focus:border-navy focus:border-b-2"
                />
              </div>
            </div>

            {/* Property type */}
            <fieldset>
              <legend className="text-label-md uppercase text-ink-muted">Property Type</legend>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {PROPERTY_TYPES.map((type) => {
                  const active = selectedTypes.includes(type.label);
                  return (
                    <button
                      key={type.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(type.label, selectedTypes, setSelectedTypes)}
                      className={`h-11 rounded-soft border text-sm font-medium transition ${
                        active
                          ? 'border-navy bg-navy text-white'
                          : 'border-outline-variant bg-surface-lowest text-ink hover:border-navy hover:text-navy'
                      }`}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Bedrooms */}
            <fieldset>
              <legend className="text-label-md uppercase text-ink-muted">Bedrooms</legend>
              <div className="mt-3 flex gap-2">
                {BEDROOM_OPTIONS.map((option) => {
                  const active = bedrooms === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setBedrooms(active ? '' : option)}
                      className={`h-10 flex-1 rounded-soft border text-sm font-medium transition ${
                        active
                          ? 'border-navy bg-navy text-white'
                          : 'border-outline-variant bg-surface-lowest text-ink hover:border-navy hover:text-navy'
                      }`}
                    >
                      {option}+
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* AI preferences — extra padding marks this as an AI-driven block. */}
            <fieldset className="rounded-card bg-surface-low p-5">
              <legend className="flex items-center gap-2 px-1 text-label-md uppercase text-ink-muted">
                <Sparkles className="h-3.5 w-3.5 text-navy" />
                AI Preferences
              </legend>
              <div className="mt-3 space-y-3">
                {AI_PREFERENCES.map((pref) => (
                  <label
                    key={pref.id}
                    className="flex cursor-pointer items-center justify-between text-sm text-ink"
                  >
                    {pref.label}
                    <input
                      type="checkbox"
                      checked={preferences.includes(pref.id)}
                      onChange={() => toggle(pref.id, preferences, setPreferences)}
                      className="h-4 w-4 shrink-0 accent-navy"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="sticky bottom-0 border-t border-hairline bg-surface-lowest px-6 py-5">
            <button
              type="submit"
              disabled={isPending}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-soft bg-navy text-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Apply Filters
            </button>
          </div>
        </form>
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/* Results                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="min-w-0 flex-1">
        {/* Search + view controls */}
        <div className="flex flex-col gap-3 border-b border-hairline px-6 py-5 lg:flex-row lg:items-center lg:px-8">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe the home you want — “modern 3 bed with a pool near downtown”"
              aria-label="Describe the home you want"
              className="h-12 w-full rounded-soft border border-outline-variant bg-surface-lowest pl-12 pr-4 text-sm text-ink outline-none transition placeholder:text-outline focus:border-navy focus:border-b-2"
            />
          </form>

          <div className="flex items-center gap-3">
            {/* Map view isn't built yet — shown but explicitly disabled rather
                than pretending to be available. */}
            <div className="flex h-12 items-center rounded-soft border border-outline-variant bg-surface-lowest p-1">
              <span className="flex h-full items-center gap-1.5 rounded-soft bg-surface-container px-3 text-sm font-semibold text-navy">
                <List className="h-4 w-4" /> List
              </span>
              <button
                type="button"
                disabled
                title="Map view is not available yet"
                className="flex h-full cursor-not-allowed items-center gap-1.5 px-3 text-sm font-medium text-outline"
              >
                <MapIcon className="h-4 w-4" /> Map
              </button>
            </div>

            <label className="sr-only" htmlFor="sort-results">
              Sort results
            </label>
            <select
              id="sort-results"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-12 rounded-soft border border-outline-variant bg-surface-lowest px-3 text-sm font-medium text-ink outline-none transition focus:border-navy"
            >
              <option value="relevance">Sort: Most Relevant</option>
              <option value="price-asc">Sort: Price (Low to High)</option>
              <option value="price-desc">Sort: Price (High to Low)</option>
            </select>
          </div>
        </div>

        <div className="px-6 py-6 lg:px-8">
          {/* AI banner */}
          <div className="flex flex-col gap-5 rounded-card bg-linear-to-r from-navy-deep to-navy p-8 md:flex-row md:items-center">
            <div className="flex-1">
              <span className="inline-block rounded-full bg-teal px-3 py-1 text-label-md uppercase text-navy-deep">
                Powered by Dwellingly AI
              </span>
              <h2 className="mt-4 font-display text-headline-md text-white">
                Top Matches for Your Portfolio
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                Every listing is embedded with Gemini and ranked by semantic similarity — not keyword
                overlap — so results reflect what you described, including your AI preferences.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('dwellingly:open-ai'))}
              className="flex shrink-0 items-center justify-center gap-2 rounded-soft bg-teal px-6 py-4 text-sm font-bold text-navy-deep transition hover:bg-teal-dim"
            >
              Ask the AI Agent
              <TrendingUp className="h-4 w-4" />
            </button>
          </div>

          {/* Results heading */}
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-display text-headline-lg text-navy-deep">
              {visibleProperties.length} {visibleProperties.length === 1 ? 'Result' : 'Results'} in{' '}
              {locationLabel}
            </h1>
            <p className="text-sm text-ink-muted">
              {hasSearched ? 'Ranked by AI relevance' : 'Showing latest listings'}
            </p>
          </div>

          {isPending ? (
            <div className="flex items-center justify-center gap-3 rounded-card border border-hairline bg-surface-lowest py-20 text-sm text-ink-muted">
              <Loader2 className="h-5 w-5 animate-spin text-navy" />
              Embedding your query and searching…
            </div>
          ) : visibleProperties.length === 0 ? (
            <div className="rounded-card border border-dashed border-outline-variant bg-surface-lowest px-6 py-20 text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-outline" />
              <h2 className="font-display text-headline-md text-navy-deep">No properties found</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Try broadening your description, clearing a filter, or widening the price range.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {visibleProperties.map((property, index) => (
                <PropertyCard
                  key={property.id ?? property.property_id}
                  property={property}
                  priority={index < 3}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
