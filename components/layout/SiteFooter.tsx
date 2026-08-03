import React from 'react';
import Link from 'next/link';

const columns = [
  {
    heading: 'Company',
    links: [
      { label: 'About Us', href: '/' },
      { label: 'Contact Support', href: '/' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/' },
      { label: 'Terms of Service', href: '/' },
    ],
  },
  {
    heading: 'Portals',
    links: [{ label: 'Agent Portal', href: '/dashboard' }],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-surface-high">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-10">
        <div>
          <p className="font-display text-lg font-extrabold tracking-tight text-navy-deep">
            Dwellingly
          </p>
          <p className="mt-3 max-w-xs text-sm leading-6 text-ink-muted">
            © {new Date().getFullYear()} Dwellingly AI. Empowering Real Estate Professionals.
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.heading}>
            <h2 className="text-label-md uppercase text-ink-muted">{column.heading}</h2>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink underline-offset-4 transition hover:text-navy hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
