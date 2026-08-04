'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Loader2, RefreshCw, Send, Sparkles } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  sendDealMessageAction,
  counterOfferAction,
  negotiationStrategyAction,
} from '@/app/actions/deals';
import type { NegotiationStrategy } from '@/lib/ai/negotiation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

interface Message {
  id: number;
  body: string;
  sender_id: string;
  created_at: string;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Active Negotiation', className: 'bg-teal/25 text-navy-deep' },
  countered: { label: 'Counter Sent', className: 'bg-teal/25 text-navy-deep' },
  accepted: { label: 'Accepted', className: 'bg-success/15 text-success' },
  rejected: { label: 'Rejected', className: 'bg-danger-container text-danger' },
  withdrawn: { label: 'Withdrawn', className: 'bg-surface-container text-ink-muted' },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function CollaborationHub({
  offer,
  property,
  messages: initialMessages,
  offerIndex,
  viewerId,
  viewerName,
  isSeller,
}: {
  offer: Row;
  property: Row;
  messages: Message[];
  offerIndex: number;
  viewerId: string;
  viewerName: string;
  isSeller: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [isSending, startSending] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const buyerName = offer.profiles?.full_name ?? 'the buyer';
  const counterpartName = isSeller ? buyerName : 'the seller';

  // --- Realtime: the app's only live surface. RLS applies to the subscription,
  // so this channel only ever receives rows for deals the viewer is party to.
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;
    let cancelled = false;

    (async () => {
      // The socket must carry the user's access token BEFORE subscribing.
      // `postgres_changes` is filtered by RLS on the server side, so an
      // unauthenticated socket silently matches zero rows -- the subscription
      // succeeds and simply never fires, which looks exactly like a broken
      // feature. The session is hydrated from cookies asynchronously, hence
      // the await.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`offer-messages-${offer.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'offer_messages',
            filter: `offer_id=eq.${offer.id}`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const incoming = payload.new as Message;
            setMessages((prev) =>
              // The sender appends its own message from the action result, and
              // the broadcast reaches both parties, so dedupe on id.
              prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
            );
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [offer.id]);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    setSendError(null);
    setDraft('');

    startSending(async () => {
      const res = await sendDealMessageAction(offer.id, body);
      if (!res.success) {
        setSendError(res.error);
        // Put the text back so a failed send doesn't silently eat it.
        setDraft(body);
        return;
      }
      if (res.message) {
        const sent = res.message as Message;
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
    });
  };

  const status = STATUS_LABELS[offer.status] ?? {
    label: offer.status,
    className: 'bg-surface-container text-ink-muted',
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      {/* --- Header --- */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <Link
            href={`/properties/${property.id}`}
            className="font-display text-headline-xl text-navy-deep hover:underline"
          >
            {property.address}
          </Link>
          <p className="mt-1 text-body-md text-ink-muted">
            {property.city}, {property.state} {property.zip_code} • Listed at{' '}
            {usd(Number(property.price))}
          </p>
        </div>
        <span
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-label-md uppercase ${status.className}`}
        >
          <RefreshCw className="h-4 w-4" /> {status.label}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* --- Thread --- */}
        <section className="flex flex-col overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-card">
          <header className="border-b border-hairline bg-surface-low px-7 py-5">
            <h2 className="font-display text-headline-md text-navy-deep">Strategy Discussion</h2>
            <p className="mt-0.5 text-body-sm text-ink-muted">With {counterpartName}</p>
          </header>

          <div ref={threadRef} className="custom-scrollbar min-h-[320px] flex-1 space-y-5 overflow-y-auto p-7">
            {messages.length === 0 ? (
              <p className="py-12 text-center text-body-sm text-ink-muted">
                No messages yet. Open the conversation — everything here is visible to both
                parties on this offer.
              </p>
            ) : (
              messages.map((message) => {
                const mine = message.sender_id === viewerId;
                return (
                  <div key={message.id} className={mine ? 'text-right' : 'text-left'}>
                    <div
                      className={`inline-block max-w-[80%] rounded-card px-5 py-3.5 text-left text-body-md ${
                        mine ? 'bg-navy-deep text-white' : 'bg-surface-low text-ink'
                      }`}
                    >
                      {message.body}
                    </div>
                    <p className="mt-1.5 text-body-sm text-ink-muted">
                      {mine ? viewerName : counterpartName} • {formatTime(message.created_at)}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <footer className="border-t border-hairline p-5">
            {sendError && <p className="mb-3 text-body-sm text-danger">{sendError}</p>}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type your message..."
                aria-label="Message"
                className="h-12 flex-1 rounded-soft border border-outline-variant bg-surface-low px-4 text-body-md text-ink outline-none transition placeholder:text-outline focus:border-navy focus:border-b-2 focus:bg-surface-lowest"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || !draft.trim()}
                className="flex h-12 items-center gap-2 rounded-soft bg-navy-deep px-6 text-sm font-semibold text-white transition hover:bg-navy disabled:opacity-50"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>
          </footer>
        </section>

        {/* --- Right rail --- */}
        <div className="space-y-6">
          <CurrentOfferPanel
            offer={offer}
            property={property}
            offerIndex={offerIndex}
            isSeller={isSeller}
          />
          {isSeller && <StrategyPanel offer={offer} onCountered={() => router.refresh()} />}
        </div>
      </div>
    </div>
  );
}

function CurrentOfferPanel({
  offer,
  property,
  offerIndex,
  isSeller,
}: {
  offer: Row;
  property: Row;
  offerIndex: number;
  isSeller: boolean;
}) {
  const contingencies: string[] = Array.isArray(offer.contingencies) ? offer.contingencies : [];
  const listPrice = Number(property.price) || 0;
  const amount = Number(offer.offer_amount);
  const delta = listPrice ? ((amount - listPrice) / listPrice) * 100 : 0;

  return (
    <section className="rounded-card border border-hairline bg-surface-lowest p-7 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-headline-md text-navy-deep">Current Offer</h2>
        {offerIndex > 0 && (
          <span className="rounded-full bg-surface-container px-3 py-1 text-label-md text-ink-muted">
            Offer #{offerIndex}
          </span>
        )}
      </div>

      <dl className="mt-6 space-y-3">
        <Row2 label="Purchase Price" value={usd(amount)} note={`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs list`} />
        <Row2
          label="Earnest Money"
          value={offer.earnest_money ? usd(Number(offer.earnest_money)) : '—'}
        />
        <Row2
          label="Closing Date"
          value={
            offer.proposed_closing_date
              ? new Date(offer.proposed_closing_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'
          }
        />
        <Row2 label="Financing" value={offer.financing_type ?? 'Not specified'} capitalize />
      </dl>

      <p className="mt-6 text-label-md uppercase text-ink-muted">Conditions</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {contingencies.length > 0 ? (
          contingencies.map((c) => (
            <span
              key={c}
              className="rounded-soft bg-danger-container px-2.5 py-1 text-label-md text-danger"
            >
              {c} contingency
            </span>
          ))
        ) : (
          <span className="rounded-soft bg-success/15 px-2.5 py-1 text-label-md text-success">
            All contingencies waived
          </span>
        )}
      </div>

      {offer.counter_amount && (
        <div className="mt-6 rounded-card bg-surface-low p-4">
          <p className="text-label-md uppercase text-ink-muted">
            {isSeller ? 'Your counter' : "Seller's counter"}
          </p>
          <p className="mt-1 text-body-lg font-semibold text-ink">
            {usd(Number(offer.counter_amount))}
            {Number(offer.counter_concession) > 0 && (
              <span className="ml-1.5 text-body-sm text-danger">
                −{usd(Number(offer.counter_concession))} credit
              </span>
            )}
          </p>
          {offer.counter_notes && (
            <p className="mt-1.5 text-body-sm text-ink-muted">{offer.counter_notes}</p>
          )}
        </div>
      )}
    </section>
  );
}

function Row2({
  label,
  value,
  note,
  capitalize,
}: {
  label: string;
  value: string;
  note?: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline pb-3 last:border-0">
      <dt className="text-body-sm text-ink-muted">{label}</dt>
      <dd className={`text-body-lg font-semibold text-ink ${capitalize ? 'capitalize' : ''}`}>
        {value}
        {note && <span className="ml-1.5 text-body-sm font-normal text-ink-muted">{note}</span>}
      </dd>
    </div>
  );
}

/**
 * Seller-only. The AI proposal is a starting point, not a commitment -- the
 * amounts stay editable before sending, because the model doesn't know
 * everything the seller does.
 */
function StrategyPanel({ offer, onCountered }: { offer: Row; onCountered: () => void }) {
  const [strategy, setStrategy] = useState<NegotiationStrategy | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [concession, setConcession] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isThinking, startThinking] = useTransition();
  const [isSending, startSending] = useTransition();

  const canCounter = offer.status === 'submitted' || offer.status === 'countered';

  const handleGenerate = () => {
    setError(null);
    startThinking(async () => {
      const res = await negotiationStrategyAction(offer.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setStrategy(res.strategy);
      setCounterAmount(String(Math.round(res.strategy.counterAmount)));
      setConcession(String(Math.round(res.strategy.concession)));
    });
  };

  const handleCounter = () => {
    setError(null);
    startSending(async () => {
      const res = await counterOfferAction(offer.id, {
        counterAmount: Number(counterAmount) || 0,
        concession: Number(concession) || 0,
        notes: strategy?.concessionReason ?? '',
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      onCountered();
    });
  };

  const net = (Number(counterAmount) || 0) - (Number(concession) || 0);

  return (
    <section className="rounded-card border border-teal bg-teal/5 p-7">
      <h2 className="flex items-center gap-2 font-display text-headline-md text-navy-deep">
        <Bot className="h-6 w-6 text-navy" /> AI Strategy
      </h2>

      {!strategy ? (
        <>
          <p className="mt-2 text-body-sm text-ink-muted">
            Recommends counter terms from this deal&apos;s own numbers — the offer, the listing,
            the latest valuation and what you and the buyer have said.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isThinking}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-soft bg-teal py-3 text-label-md uppercase text-navy-deep transition hover:bg-teal-dim disabled:opacity-60"
          >
            {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isThinking ? 'Analysing the deal…' : 'Recommend counter terms'}
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-body-md text-ink">{strategy.rationale}</p>

          <div className="mt-5 rounded-card border border-hairline bg-surface-lowest p-5">
            <p className="text-label-md uppercase text-ink-muted">Proposed counter terms</p>

            <label htmlFor="counter-price" className="mt-4 block text-body-sm text-ink-muted">
              Price
            </label>
            <input
              id="counter-price"
              type="number"
              value={counterAmount}
              onChange={(e) => setCounterAmount(e.target.value)}
              className="mt-1 h-11 w-full rounded-soft border border-outline-variant bg-surface-lowest px-3 text-body-md font-semibold text-ink outline-none transition focus:border-navy focus:border-b-2"
            />

            <label htmlFor="counter-concession" className="mt-3 block text-body-sm text-ink-muted">
              Concession (credit to buyer)
              {strategy.concessionReason && (
                <span className="ml-1 text-ink-muted">— {strategy.concessionReason}</span>
              )}
            </label>
            <input
              id="counter-concession"
              type="number"
              value={concession}
              onChange={(e) => setConcession(e.target.value)}
              className="mt-1 h-11 w-full rounded-soft border border-outline-variant bg-surface-lowest px-3 text-body-md font-semibold text-ink outline-none transition focus:border-navy focus:border-b-2"
            />

            <div className="mt-4 flex items-baseline justify-between border-t border-hairline pt-3">
              <span className="text-body-md font-semibold text-ink">Net to seller</span>
              <span className="font-display text-headline-md text-success">{usd(net)}</span>
            </div>
            <p className="mt-1 text-body-sm text-ink-muted">
              Price less the credit. Before agent commission, taxes and closing costs.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCounter}
            disabled={isSending || !canCounter}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-soft bg-teal py-3 text-label-md uppercase text-navy-deep transition hover:bg-teal-dim disabled:opacity-60"
          >
            {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send counter-offer
          </button>
          {!canCounter && (
            <p className="mt-2 text-center text-body-sm text-ink-muted">
              This offer is {offer.status} — it can no longer be countered.
            </p>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isThinking}
            className="mt-2 w-full rounded-soft py-2 text-label-md uppercase text-ink-muted transition hover:text-navy disabled:opacity-60"
          >
            {isThinking ? 'Re-analysing…' : 'Re-analyse'}
          </button>
        </>
      )}

      {error && <p className="mt-4 text-body-sm text-danger">{error}</p>}
    </section>
  );
}
