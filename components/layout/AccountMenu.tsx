'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, Check, LogOut, MessageSquare, Settings, UserCircle2 } from 'lucide-react';
import { signOutAction, updateNotificationPhoneAction } from '@/app/actions/auth';

export interface Account {
  fullName: string;
  email: string;
  role: string;
  /** E.164 number SMS alerts go to, or null when notifications are off. */
  phone: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  agent: 'Agent',
  admin: 'Admin',
};

/**
 * The seeded buyer and seller accounts, for the dev-only role switcher.
 * `/api/dev/login` 403s outside development, so the switch is hidden there --
 * `process.env.NODE_ENV` is inlined into the client bundle at build time, so
 * this check works client-side.
 */
const DEV_ACCOUNTS = [
  { as: 'seller', label: 'Seller (Sarah Jenkins)', email: 'seller.sarah@dwellingly.ai' },
  { as: 'buyer', label: 'Buyer (Alex Vance)', email: 'buyer.alex@dwellingly.ai' },
];

export function AccountMenu({ account }: { account: Account | null }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Dismiss on outside click or Escape, the way a Fluent flyout behaves.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const isDev = process.env.NODE_ENV === 'development';
  const returnTo = encodeURIComponent(pathname || '/');

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={account ? `Account: ${account.fullName}` : 'Account'}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-soft text-ink-muted transition hover:bg-surface-container hover:text-navy"
      >
        <UserCircle2 className="h-6 w-6" />
      </button>

      {open && (
        /* Solid rather than the .acrylic treatment: at 0.7 alpha the buttons
           underneath read straight through the menu text. */
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-overlay"
        >
          {account ? (
            <div className="border-b border-hairline px-4 py-3">
              <p className="truncate text-body-md font-semibold text-ink">{account.fullName}</p>
              <p className="truncate text-body-sm text-ink-muted">{account.email}</p>
              <span className="mt-2 inline-block rounded-full bg-navy-tint px-2.5 py-1 text-label-md uppercase text-navy-deep">
                {ROLE_LABELS[account.role] ?? account.role}
              </span>
            </div>
          ) : (
            <p className="border-b border-hairline px-4 py-3 text-body-sm text-ink-muted">
              Not signed in
            </p>
          )}

          {isDev && (
            <div className="border-b border-hairline py-1">
              <p className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-label-md uppercase text-ink-muted">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Switch account
              </p>
              {DEV_ACCOUNTS.map((option) => {
                // Matched on email, not role: now that anyone can sign up, a
                // self-registered seller would otherwise light up the Sarah
                // Jenkins row as "Current" despite being a different account.
                const current = account?.email === option.email;
                return (
                  <a
                    key={option.as}
                    href={`/api/dev/login?as=${option.as}&next=${returnTo}`}
                    role="menuitem"
                    aria-current={current}
                    className={`flex items-center justify-between gap-2 px-4 py-2 text-body-sm transition hover:bg-surface-container ${
                      current ? 'font-semibold text-navy' : 'text-ink'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {current && (
                      <span className="shrink-0 text-label-md uppercase text-ink-muted">Current</span>
                    )}
                  </a>
                );
              })}
            </div>
          )}

          {account && (
            <a
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 border-b border-hairline px-4 py-3 text-body-sm text-ink transition hover:bg-surface-container"
            >
              <Settings className="h-4 w-4" aria-hidden="true" /> Settings
            </a>
          )}

          {account && <NotificationPhoneField initialPhone={account.phone} />}

          {!account && (
            <div className="p-2">
              <a
                href={`/login?next=${returnTo}`}
                role="menuitem"
                className="flex h-9 w-full items-center justify-center rounded-soft bg-navy text-body-sm font-semibold text-white transition hover:bg-navy-deep"
              >
                Sign in
              </a>
              <a
                href={`/signup?next=${returnTo}`}
                role="menuitem"
                className="mt-1.5 flex h-9 w-full items-center justify-center rounded-soft border border-outline-variant text-body-sm font-semibold text-ink transition hover:bg-surface-container"
              >
                Create account
              </a>
            </div>
          )}

          {account && (
            <button
              type="button"
              role="menuitem"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await signOutAction();
                  setOpen(false);
                })
              }
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-body-sm text-ink transition hover:bg-surface-container disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Where SMS alerts go. Lives in the account menu because it's a single field
 * tied to identity and the app has no settings page.
 *
 * On a Twilio trial account only numbers verified in the Twilio console can
 * receive messages, so setting a real number here is the difference between
 * the notification path working and silently no-op'ing.
 */
function NotificationPhoneField({ initialPhone }: { initialPhone: string | null }) {
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startSaving(async () => {
      const res = await updateNotificationPhoneAction(phone);
      if (!res.success) {
        setError(res.error);
        return;
      }
      // Echo back the normalised E.164 value so it's clear what was stored.
      setPhone(res.phone ?? '');
      setSaved(true);
    });
  };

  return (
    <div className="border-b border-hairline px-4 py-3">
      <label
        htmlFor="notify-phone"
        className="flex items-center gap-1.5 text-label-md uppercase text-ink-muted"
      >
        <MessageSquare className="h-3.5 w-3.5" /> SMS alerts
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="notify-phone"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setSaved(false);
          }}
          placeholder="(512) 555-0192"
          className="h-9 min-w-0 flex-1 rounded-soft border border-outline-variant bg-surface-lowest px-2.5 text-body-sm text-ink outline-none transition placeholder:text-outline focus:border-navy"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="shrink-0 rounded-soft bg-navy px-3 py-2 text-label-md uppercase text-white transition hover:bg-navy-deep disabled:opacity-60"
        >
          Save
        </button>
      </div>
      {saved && (
        <p className="mt-1.5 flex items-center gap-1 text-label-md text-success">
          <Check className="h-3.5 w-3.5" /> Saved
        </p>
      )}
      {error && <p className="mt-1.5 text-label-md text-danger">{error}</p>}
      {!phone && !error && (
        <p className="mt-1.5 text-label-md text-ink-muted">
          Add a number to get offer and tour alerts.
        </p>
      )}
    </div>
  );
}
