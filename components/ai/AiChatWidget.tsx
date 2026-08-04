'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  Mic,
  MicOff,
  Home,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import type { PropertyLocationContext } from '@/lib/ai/chat';

interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'assistant';
  content: string;
  timestamp: Date;
  toolCall?: {
    name: string;
    args: any;
    result?: any;
  };
  citations?: { name: string; url: string }[];
}

interface AiChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  propertyContext?: PropertyLocationContext;
}

/**
 * The agent replies in Markdown (its system instruction asks for it), so render
 * the small subset it actually emits — headings, bullets, bold — instead of
 * showing raw ** and ### to the user. Deliberately not a full parser.
 */
function MessageBody({ content, isUser }: { content: string; isUser: boolean }) {
  if (!content) return null;

  const inline = (text: string) =>
    text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code key={i} className={`rounded px-1 py-0.5 text-[0.9em] ${isUser ? 'bg-white/20' : 'bg-surface-container'}`}>
            {part.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });

  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
          return <hr key={i} className={isUser ? 'border-white/25' : 'border-hairline'} />;
        }
        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
          return (
            <p key={i} className="pt-1 font-display text-sm font-bold">
              {inline(heading[2])}
            </p>
          );
        }
        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        if (bullet) {
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span aria-hidden="true">•</span>
              <span>{inline(bullet[1])}</span>
            </p>
          );
        }
        const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (numbered) {
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span aria-hidden="true">{numbered[1]}.</span>
              <span>{inline(numbered[2])}</span>
            </p>
          );
        }
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

export function AiChatWidget({ isOpen, onClose, propertyContext }: AiChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: "Hello! I'm your Dwellingly.ai Real Estate Assistant. I can help you search properties using natural language, calculate estimated market valuations (CMAs), or schedule home viewings. How can I assist your real estate journey today?",
      timestamp: new Date(),
    }
  ]);
  const [interactionId, setInteractionId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input.trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, initialAssistantMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactionId: interactionId,
          newMessage: query,
          propertyContext,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to connect to AI service');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.slice(6).trim();
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'interaction_id') {
                setInteractionId(parsed.content);
              } else if (parsed.type === 'token' && parsed.content) {
                accumulatedContent = accumulatedContent + parsed.content;
                const updatedContent = accumulatedContent;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: updatedContent }
                      : msg
                  )
                );
              } else if (parsed.type === 'tool_executed') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          toolCall: {
                            name: parsed.tool,
                            args: parsed.args,
                            result: parsed.result,
                          },
                        }
                      : msg
                  )
                );
              } else if (parsed.type === 'citations' && parsed.content?.length) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, citations: parsed.content } : msg
                  )
                );
              }
            } catch {
              // Ignore partial JSON parse errors
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: 'Sorry, I encountered an issue fulfilling your request. Please try again.' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      handleSendMessage(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const quickPrompts = [
    'Find 3-bedroom homes in Seattle under $900k',
    'What is the estimated market value for property #1?',
    'Show me market trends for Austin, TX',
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-hairline bg-surface-lowest shadow-overlay">

      {/* Header */}
      <div className="flex items-center justify-between bg-linear-to-r from-navy-deep to-teal px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-soft bg-white/15 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold leading-tight text-white">
              Dwellingly AI Assistant
              <Sparkles className="h-3.5 w-3.5" />
            </h3>
            <p className="text-label-md uppercase text-white/80">Powered by Gemini</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close assistant"
          className="rounded-soft p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-surface p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-start gap-2 max-w-[85%]">
              {msg.role !== 'user' && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs text-white">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`rounded-card px-4 py-3 text-sm shadow-card ${
                  msg.role === 'user'
                    ? 'bg-navy text-white'
                    : 'border border-hairline bg-surface-lowest text-ink'
                }`}
              >
                <MessageBody content={msg.content} isUser={msg.role === 'user'} />

                {/* Dynamic Tool Executed Visual Cards */}
                {msg.toolCall?.result?.properties && (
                  <div className="mt-3 space-y-2 border-t border-hairline pt-2">
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-1 text-label-md uppercase text-navy">
                        <Home className="h-3.5 w-3.5" /> Found Properties
                      </p>
                      <button className="text-outline transition hover:text-navy" title="Refresh results">
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {msg.toolCall.result.properties.slice(0, 3).map((prop: any) => {
                        const propId = prop.id ?? prop.property_id;
                        return (
                          <Link
                            key={propId}
                            href={`/properties/${propId}`}
                            onClick={onClose}
                            className="group block overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-card transition hover:border-navy"
                          >
                          <div className="relative h-24 w-full bg-surface-container">
                            <Image 
                              src={prop.imageUrl || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=400&h=200'} 
                              alt={prop.address || 'Property Image'} 
                              fill 
                              className="object-cover" 
                            />
                          </div>
                          <div className="p-2.5 space-y-1">
                            <div className="flex items-start justify-between">
                              <div className="truncate text-xs font-semibold text-navy-deep">
                                {prop.address}
                              </div>
                              <ExternalLink className="ml-1 h-3 w-3 shrink-0 text-outline transition group-hover:text-navy" />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-ink-muted">
                              <span>${prop.price?.toLocaleString()} • {prop.bedrooms} bed, {prop.bathrooms} bath</span>
                              <ChevronRight className="h-3.5 w-3.5 text-outline transition-all group-hover:translate-x-0.5 group-hover:text-navy" />
                            </div>
                            {typeof prop.similarity === 'number' && (
                              <div className="flex items-center gap-1 pt-1 text-[10px] font-semibold text-success">
                                <TrendingUp className="h-3 w-3" />
                                <span>{Math.round(prop.similarity * 100)}% semantic match</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                    </div>
                  </div>
                )}

                {/* Maps-grounded citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-hairline pt-2">
                    <p className="flex items-center gap-1 text-label-md uppercase text-navy">
                      <MapPin className="h-3.5 w-3.5" /> Sources
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((c) => (
                        <a
                          key={c.url}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-outline-variant bg-surface-lowest px-2.5 py-1 text-[11px] font-medium text-ink-muted transition hover:border-navy hover:text-navy"
                        >
                          {c.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white text-xs mt-1">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
            <span className="mt-1 px-9 text-[10px] text-outline">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex w-fit items-center gap-2 rounded-full bg-navy-tint px-3 py-2 text-xs font-medium text-navy">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Analyzing property data…</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Action Chips */}
      <div className="border-t border-hairline bg-surface-lowest px-3 py-2.5">
        <p className="mb-2 text-label-md uppercase text-ink-muted">Suggested Queries</p>
        <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="whitespace-nowrap rounded-full border border-outline-variant bg-surface-lowest px-3 py-1.5 text-xs text-ink-muted transition hover:border-navy hover:bg-navy-tint hover:text-navy"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Controls */}
      <div className="border-t border-hairline bg-surface-lowest p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-soft border transition ${
              isListening
                ? 'animate-pulse border-danger bg-danger text-white'
                : 'border-outline-variant bg-surface-lowest text-ink-muted hover:border-navy hover:text-navy'
            }`}
            title="Voice Input"
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about properties, valuations, or offers..."
            className="h-11 flex-1 rounded-soft border border-outline-variant bg-surface-lowest px-3.5 text-sm text-ink outline-none transition placeholder:text-outline focus:border-navy focus:border-b-2"
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-soft bg-navy text-white transition hover:bg-navy-deep disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

    </div>
  );
}