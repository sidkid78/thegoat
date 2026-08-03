'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bell, UserCircle2, Menu, X } from 'lucide-react';

interface NavbarProps {
  onToggleAiChat: () => void;
  isAiChatOpen: boolean;
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/search', label: 'Search' },
  { href: '/staging', label: 'Deals' },
  { href: '/dashboard', label: 'Portfolio' },
];

export function Navbar({}: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  return (
    <header className="mica sticky top-0 z-40 w-full border-b border-hairline">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6 lg:px-10">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-display text-xl font-extrabold tracking-tight text-navy-deep transition hover:opacity-80"
        >
          Dwellingly
        </Link>

        {/* Primary navigation — active item carries a navy underline. */}
        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`relative py-1 text-sm transition ${
                  active
                    ? 'font-semibold text-navy-deep after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-navy-deep after:content-[""]'
                    : 'font-medium text-ink-muted hover:text-navy'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {/* Quick search */}
          <div className="relative hidden lg:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input
              type="text"
              placeholder="Quick search properties..."
              aria-label="Quick search properties"
              className="h-9 w-72 rounded-soft border border-transparent bg-surface-container pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-outline focus:border-navy focus:bg-white"
            />
          </div>

          <button
            type="button"
            aria-label="Notifications"
            className="flex h-9 w-9 items-center justify-center rounded-soft text-ink-muted transition hover:bg-surface-container hover:text-navy"
          >
            <Bell className="h-5 w-5" />
          </button>

          <button
            type="button"
            aria-label="Account"
            className="flex h-9 w-9 items-center justify-center rounded-soft text-ink-muted transition hover:bg-surface-container hover:text-navy"
          >
            <UserCircle2 className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-soft text-ink-muted hover:bg-surface-container md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="border-t border-hairline bg-white px-6 py-3 md:hidden">
          <div className="flex flex-col">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-soft px-2 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-surface-container hover:text-navy"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
