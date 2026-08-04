'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, LogOut, UserCircle2 } from 'lucide-react';
import { signOutAction } from '@/app/actions/auth';

export interface Account {
  fullName: string;
  email: string;
  role: string;
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
  { as: 'seller', label: 'Seller (Sarah Jenkins)', role: 'seller' },
  { as: 'buyer', label: 'Buyer (Alex Vance)', role: 'buyer' },
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
                const current = account?.role === option.role;
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

          {/* There is no sign-in route in this app yet -- the dev switcher above
              is the only way in -- so signed-out users get no dead "Sign in"
              link here. */}
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
