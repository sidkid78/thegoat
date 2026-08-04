import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Headline face — see DESIGN.md "Typography".
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dwellingly.ai - NexHomeAgent AI',
  description: 'AI-driven real estate platform powered by Next.js, Supabase, and Google Gemini',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved here rather than in the navbar so the identity is read once per
  // request from the cookie-backed server client -- AppShell and Navbar are
  // client components and have no way to reach Supabase themselves.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let account = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', user.id)
      .single();

    account = {
      fullName: profile?.full_name ?? user.email ?? 'Account',
      email: profile?.email ?? user.email ?? '',
      role: profile?.role ?? 'buyer',
    };
  }

  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="bg-surface font-sans text-ink antialiased">
        <AppShell account={account}>{children}</AppShell>
      </body>
    </html>
  );
}
