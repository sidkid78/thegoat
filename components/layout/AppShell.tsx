"use client";

import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { AiChatWidget } from '@/components/ai/AiChatWidget';
import { SiteFooter } from '@/components/layout/SiteFooter';
import type { PropertyLocationContext } from '@/lib/ai/chat';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiPropertyContext, setAiPropertyContext] = useState<PropertyLocationContext | undefined>(undefined);

  // Lets deep content (e.g. the search AI banner, or a property page's
  // "Ask about this neighborhood" button) raise the assistant without
  // threading state down through every page. An optional `detail` payload
  // carries the property location so Maps grounding can bias to it.
  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<PropertyLocationContext>).detail;
      setAiPropertyContext(detail);
      setIsAiChatOpen(true);
    };
    window.addEventListener('dwellingly:open-ai', open);
    return () => window.removeEventListener('dwellingly:open-ai', open);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Navbar
        isAiChatOpen={isAiChatOpen}
        onToggleAiChat={() => setIsAiChatOpen(!isAiChatOpen)}
      />

      <main className="flex-1">{children}</main>

      <SiteFooter />

      {/* Layer 3 — the AI assistant sits above everything on a deep ambient
          shadow, pill-shaped to read as high-velocity rather than structural. */}
      <button
        type="button"
        onClick={() => setIsAiChatOpen(!isAiChatOpen)}
        aria-label={isAiChatOpen ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={isAiChatOpen}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-navy to-teal text-white shadow-fab transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        {isAiChatOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Sparkles className="h-6 w-6" />
        )}
      </button>

      <AiChatWidget
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        propertyContext={aiPropertyContext}
      />
    </div>
  );
}
