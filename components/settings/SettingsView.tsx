'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Eye, Loader2, ShieldCheck, Sparkles, Trash2, User } from 'lucide-react';
import {
  updateProfileAction,
  updatePreferencesAction,
  setActivityTrackingAction,
  clearBrowsingHistoryAction,
} from '@/app/actions/settings';
import { BUYER_PRIORITIES, type BuyerPreferences } from '@/lib/buyer-preferences';

interface ProfileInfo {
  fullName: string;
  email: string;
  role: string;
  phone: string | null;
  memberSince: string | null;
}

interface RecentView {
  propertyId: number;
  viewCount: number;
  lastViewedAt: string;
  address: string;
  city: string;
  state: string;
}

const ROLE_LABELS: Record<string, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  agent: 'Agent',
  admin: 'Admin',
};

const FIELD =
  'h-11 w-full rounded-soft border border-outline-variant bg-surface-lowest px-3 text-body-md text-ink outline-none transition placeholder:text-outline focus:border-navy focus:ring-1 focus:ring-navy';

function Section({
  Icon,
  title,
  description,
  children,
}: {
  Icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface-lowest p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-soft bg-surface-container text-navy">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-navy-deep">{title}</h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="flex items-center gap-1 text-label-md text-success">
      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Saved
    </span>
  );
}

export function SettingsView({
  profile,
  preferences,
  trackActivity,
  recentViews,
  totalViews,
}: {
  profile: ProfileInfo;
  preferences: BuyerPreferences | null;
  trackActivity: boolean;
  recentViews: RecentView[];
  totalViews: number;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
      <h1 className="font-display text-headline-xl text-navy-deep">Settings</h1>
      <p className="mt-1 text-body-md text-ink-muted">
        Your account, what Dwellingly recommends, and what it remembers.
      </p>

      <div className="mt-8 space-y-6">
        <ProfileSection profile={profile} />
        <PreferencesSection preferences={preferences} />
        <PrivacySection
          trackActivity={trackActivity}
          recentViews={recentViews}
          totalViews={totalViews}
        />
      </div>
    </main>
  );
}

function ProfileSection({ profile }: { profile: ProfileInfo }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (result.success) setSaved(true);
      else setError(result.error);
    });
  };

  return (
    <Section Icon={User} title="Profile" description="How you appear across the app.">
      <form onSubmit={handleSubmit}>
        <label htmlFor="fullName" className="mb-1.5 block text-label-md uppercase text-ink-muted">
          Full name
        </label>
        <input id="fullName" name="fullName" defaultValue={profile.fullName} required className={FIELD} />

        <label htmlFor="phone" className="mb-1.5 mt-5 block text-label-md uppercase text-ink-muted">
          Mobile for SMS alerts
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={profile.phone ?? ''}
          placeholder="(512) 555-0192"
          className={FIELD}
        />
        <p className="mt-1.5 text-body-sm text-ink-muted">
          Offer updates and tour confirmations. Leave empty to turn texts off. Stored normalised, so
          it may come back reformatted.
        </p>

        {/* Read-only, and said so rather than shown as a disabled input with no
            explanation. Email changes need a confirmation round trip that
            /auth/confirm does not handle yet; role gates the properties INSERT
            policy, so it is not a preference. */}
        <dl className="mt-5 grid gap-4 border-t border-hairline pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-label-md uppercase text-ink-muted">Email</dt>
            <dd className="mt-1 truncate text-body-sm text-ink">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-label-md uppercase text-ink-muted">Account type</dt>
            <dd className="mt-1 text-body-sm text-ink">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </dd>
          </div>
          <div>
            <dt className="text-label-md uppercase text-ink-muted">Member since</dt>
            <dd className="mt-1 text-body-sm text-ink">
              {profile.memberSince
                ? new Date(profile.memberSince).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                  })
                : '—'}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-body-sm text-ink-muted">
          Email and account type can&rsquo;t be changed here — contact support if you need them
          updated.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-soft bg-navy px-4 py-2 text-body-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save profile
          </button>
          <Saved show={saved} />
        </div>
        {error && <p className="mt-3 text-body-sm text-danger">{error}</p>}
      </form>
    </Section>
  );
}

function PreferencesSection({ preferences }: { preferences: BuyerPreferences | null }) {
  const [priorities, setPriorities] = useState<string[]>(preferences?.priorities ?? []);
  const [notes, setNotes] = useState(preferences?.notes ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setSaved(false);
    setPriorities((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  return (
    <Section
      Icon={Sparkles}
      title="Buying priorities"
      description="Ranks your shortlist and the recommendations on your dashboard."
    >
      <div className="flex flex-wrap gap-2">
        {BUYER_PRIORITIES.map((priority) => {
          const active = priorities.includes(priority.id);
          return (
            <button
              key={priority.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(priority.id)}
              className={`rounded-full border px-3.5 py-1.5 text-label-md uppercase transition ${
                active
                  ? 'border-navy bg-navy text-white'
                  : 'border-outline-variant text-ink hover:bg-surface-container'
              }`}
            >
              {priority.label}
            </button>
          );
        })}
      </div>

      <label htmlFor="notes" className="mb-1.5 mt-5 block text-label-md uppercase text-ink-muted">
        Anything else
      </label>
      <textarea
        id="notes"
        rows={3}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        placeholder="e.g. walkable to coffee, home office, quiet street, good light"
        className="w-full rounded-soft border border-outline-variant bg-surface-lowest p-3 text-body-md text-ink outline-none transition placeholder:text-outline focus:border-navy focus:ring-1 focus:ring-navy"
      />

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setSaved(false);
              const result = await updatePreferencesAction({ priorities, notes });
              if (result.success) setSaved(true);
              else setError(result.error);
            })
          }
          className="flex items-center gap-2 rounded-soft bg-navy px-4 py-2 text-body-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save priorities
        </button>
        <Saved show={saved} />
        <Link href="/evaluate" className="text-body-sm font-semibold text-navy hover:underline">
          Compare shortlist
        </Link>
      </div>
      {error && <p className="mt-3 text-body-sm text-danger">{error}</p>}
    </Section>
  );
}

function PrivacySection({
  trackActivity,
  recentViews,
  totalViews,
}: {
  trackActivity: boolean;
  recentViews: RecentView[];
  totalViews: number;
}) {
  const [enabled, setEnabled] = useState(trackActivity);
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleViews = cleared ? [] : recentViews;
  const total = cleared ? 0 : totalViews;

  return (
    <Section
      Icon={ShieldCheck}
      title="Activity & privacy"
      description="What Dwellingly records about your browsing, and how to erase it."
    >
      <label className="flex cursor-pointer items-start gap-3 rounded-soft border border-outline-variant p-4 transition hover:bg-surface-container">
        <input
          type="checkbox"
          checked={enabled}
          disabled={isPending}
          onChange={(e) => {
            const next = e.target.checked;
            setEnabled(next);
            setError(null);
            startTransition(async () => {
              const result = await setActivityTrackingAction(next);
              // Snap the switch back if the write failed, rather than showing a
              // state the server does not agree with.
              if (!result.success) {
                setEnabled(!next);
                setError(result.error);
              }
            });
          }}
          className="mt-0.5 h-4 w-4 accent-navy"
        />
        <span>
          <span className="block text-body-md font-semibold text-ink">
            Use my viewing history for recommendations
          </span>
          <span className="mt-1 block text-body-sm text-ink-muted">
            Records which listings you open, and nothing else — no searches, no scroll or dwell
            time. Only you can see it, and it is only ever used to rank listings for you. Switching
            this off stops recording and stops existing history affecting your recommendations
            immediately.
          </span>
        </span>
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5">
        <p className="text-body-sm text-ink-muted">
          {total === 0
            ? 'No viewing history recorded.'
            : `${total} ${total === 1 ? 'listing' : 'listings'} in your history.`}
        </p>
        {total > 0 && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await clearBrowsingHistoryAction();
                if (result.success) setCleared(true);
                else setError(result.error);
              })
            }
            className="flex items-center gap-2 rounded-soft border border-outline-variant px-3 py-2 text-body-sm font-semibold text-danger transition hover:bg-danger-container disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear history
          </button>
        )}
      </div>

      {visibleViews.length > 0 && (
        <>
          <p className="mt-5 flex items-center gap-1.5 text-label-md uppercase text-ink-muted">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Recently viewed
          </p>
          <ul className="mt-2 divide-y divide-hairline">
            {visibleViews.map((view) => (
              <li key={view.propertyId} className="flex items-center justify-between gap-3 py-2.5">
                <Link
                  href={`/properties/${view.propertyId}`}
                  className="min-w-0 truncate text-body-sm text-ink hover:text-navy hover:underline"
                >
                  {view.address}
                  {view.city && `, ${view.city}, ${view.state}`}
                </Link>
                <span className="shrink-0 text-label-md text-ink-muted">
                  {view.viewCount > 1 ? `${view.viewCount} visits` : '1 visit'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <p className="mt-3 text-body-sm text-danger">{error}</p>}
    </Section>
  );
}
