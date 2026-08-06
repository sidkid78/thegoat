'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, MailCheck } from 'lucide-react';
import { signInAction, signUpAction } from '@/app/actions/auth';

type Mode = 'signin' | 'signup';

const COPY = {
  signin: {
    heading: 'Welcome back',
    subheading: 'Sign in to pick up where you left off.',
    submit: 'Sign in',
    altPrompt: 'New to Dwellingly?',
    altLabel: 'Create an account',
    altHref: '/signup',
  },
  signup: {
    heading: 'Create your account',
    subheading: 'Search listings, save favourites, and make offers.',
    submit: 'Create account',
    altPrompt: 'Already have an account?',
    altLabel: 'Sign in',
    altHref: '/login',
  },
} as const;

const ROLES = [
  { value: 'buyer', label: 'Buying', hint: 'Search homes, shortlist, and make offers' },
  { value: 'seller', label: 'Selling', hint: 'List a property and review incoming offers' },
] as const;

const FIELD =
  'h-11 w-full rounded-soft border border-outline-variant bg-surface-lowest px-3 text-body-md text-ink outline-none transition placeholder:text-outline focus:border-navy focus:ring-1 focus:ring-navy';

export function AuthForm({
  mode,
  next,
  initialError = null,
}: {
  mode: Mode;
  next: string;
  /** Surfaced from `?error=`, e.g. an expired confirmation link. */
  initialError?: string | null;
}) {
  const copy = COPY[mode];
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [role, setRole] = useState<string>('buyer');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result =
        mode === 'signin' ? await signInAction(formData) : await signUpAction(formData);

      if (result.status === 'error') {
        setError(result.error);
        return;
      }

      if (result.status === 'confirm-email') {
        setPendingEmail(result.email);
        return;
      }

      // `refresh()` before `push()` so the root layout re-runs and the navbar
      // shows the new identity -- the action revalidated the cache, but this
      // router instance is still holding the signed-out render.
      router.refresh();
      router.push(next);
    });
  };

  // Terminal state: the account exists but needs the emailed link clicked.
  // Replaces the form rather than sitting beside it -- there is nothing useful
  // left to do here, and leaving the fields live invites a confused re-submit.
  if (pendingEmail) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-card bg-navy-tint text-navy">
            <MailCheck className="h-6 w-6" />
          </span>
          <h1 className="font-display text-headline-lg text-ink">Confirm your email</h1>
          <p className="mt-2 text-body-md text-ink-muted">
            We sent a link to <span className="font-semibold text-ink">{pendingEmail}</span>. Click
            it to finish setting up your account.
          </p>
          <p className="mt-6 text-body-sm text-ink-muted">
            Wrong address?{' '}
            <Link href="/signup" className="font-semibold text-navy hover:underline">
              Start over
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-card bg-navy text-white">
            <Building2 className="h-6 w-6" />
          </span>
          <h1 className="font-display text-headline-lg text-ink">{copy.heading}</h1>
          <p className="mt-1 text-body-md text-ink-muted">{copy.subheading}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-card border border-hairline bg-surface-lowest p-6 shadow-card"
        >
          {/* Carried into the action so the confirmation email can send the user
              back where they started. */}
          <input type="hidden" name="next" value={next} />

          {mode === 'signup' && (
            <>
              <label htmlFor="fullName" className="mb-1.5 block text-label-md uppercase text-ink-muted">
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                placeholder="Alex Vance"
                className={FIELD}
              />

              <fieldset className="mt-5">
                <legend className="mb-1.5 text-label-md uppercase text-ink-muted">
                  I&rsquo;m here for
                </legend>
                {/* Sets `role` in the auth metadata the profile trigger reads.
                    It decides whether the account can list properties at all --
                    the properties INSERT policy checks it -- so it's asked up
                    front rather than buried in settings. */}
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-soft border p-3 transition ${
                        role === option.value
                          ? 'border-navy bg-navy-tint'
                          : 'border-outline-variant hover:bg-surface-container'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={role === option.value}
                        onChange={(e) => setRole(e.target.value)}
                        className="sr-only"
                      />
                      <span className="block text-body-md font-semibold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-label-md font-normal normal-case tracking-normal text-ink-muted">
                        {option.hint}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          <label
            htmlFor="email"
            className={`mb-1.5 block text-label-md uppercase text-ink-muted ${mode === 'signup' ? 'mt-5' : ''}`}
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className={FIELD}
          />

          <label htmlFor="password" className="mb-1.5 mt-5 block text-label-md uppercase text-ink-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'signup' ? 6 : undefined}
            placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
            className={FIELD}
          />

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-soft bg-danger-container px-3 py-2 text-body-sm text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-soft bg-navy text-body-md font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {copy.submit}
          </button>
        </form>

        <p className="mt-6 text-center text-body-sm text-ink-muted">
          {copy.altPrompt}{' '}
          <Link
            href={`${copy.altHref}${next !== '/search' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-semibold text-navy hover:underline"
          >
            {copy.altLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
