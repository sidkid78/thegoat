'use client';

import React, { useRef, useState } from 'react';
import {
  Wand2,
  Upload,
  Sparkles,
  Loader2,
  Download,
  TrendingUp,
  Lightbulb,
  ArrowLeftRight,
  CheckCircle2,
} from 'lucide-react';

interface Analysis {
  detectedRoomType: string;
  perceivedCondition: string;
  stagingSuggestions: string[];
  keyFeaturesIdentified: string[];
  estimatedRenovationRoiTips: string[];
}

const ROOM_TABS = [
  { id: 'living_room', label: 'Living Room' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bedroom', label: 'Primary Bed' },
  { id: 'patio', label: 'Patio' },
];

const STYLES = [
  { id: 'modern_minimalist', label: 'Modern Minimalist' },
  { id: 'scandinavian', label: 'Scandinavian' },
  { id: 'luxury_contemporary', label: 'Luxury Contemporary' },
  { id: 'coastal_boho', label: 'Coastal Boho' },
  { id: 'industrial', label: 'Industrial' },
];

export function VirtualStagingStudio() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  const [roomType, setRoomType] = useState('living_room');
  const [designStyle, setDesignStyle] = useState('modern_minimalist');
  const [isStaging, setIsStaging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setOriginalImage(reader.result as string);
      setStagedImage(null);
      setAnalysis(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const callStagingApi = async (action: 'stage' | 'analyze') => {
    if (!originalImage) return null;
    const base64Data = originalImage.split(',')[1];
    const res = await fetch('/api/staging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, imageBase64: base64Data, roomType, designStyle }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Staging request failed (${res.status})`);
    return data;
  };

  const handleStageImage = async () => {
    setIsStaging(true);
    setError(null);
    try {
      const data = await callStagingApi('stage');
      if (data?.stagedImage) {
        setStagedImage(`data:${data.stagedImage.mimeType};base64,${data.stagedImage.imageBase64}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Staging failed.');
    } finally {
      setIsStaging(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = await callStagingApi('analyze');
      if (data?.analysis) setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      {/* Command centre header */}
      <div className="rounded-card border border-hairline bg-surface-lowest p-7 shadow-card">
        <span className="inline-flex items-center gap-2 rounded-full bg-navy-deep px-3 py-1.5 text-label-md uppercase text-teal">
          Staging Phase
        </span>
        <h1 className="mt-4 font-display text-headline-xl text-navy-deep">
          Pre-Market Preparation
        </h1>
        <p className="mt-2 max-w-2xl text-body-md leading-7 text-ink-muted">
          Stage a vacant room with AI and get an improvement roadmap before the listing goes live.
        </p>
      </div>

      {error && (
        <p className="mt-6 rounded-card bg-danger-container px-5 py-4 text-body-sm text-ink">
          {error}
        </p>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Visual Staging AI                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6 overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline px-7 py-5">
          <h2 className="flex items-center gap-2 font-display text-headline-md text-navy-deep">
            <Sparkles className="h-5 w-5 text-navy" />
            Visual Staging AI
          </h2>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Room type">
            {ROOM_TABS.map((tab) => {
              const active = roomType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRoomType(tab.id)}
                  className={`rounded-soft border px-4 py-2 text-sm font-medium transition ${
                    active
                      ? 'border-navy bg-navy text-white'
                      : 'border-outline-variant text-ink hover:border-navy hover:text-navy'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-7">
          <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
            {/* Current state */}
            <div className="relative aspect-4/3 overflow-hidden rounded-card border border-hairline bg-surface-container">
              {originalImage ? (
                // Data URL from a local file — next/image can't optimise these.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={originalImage}
                  alt="Current room"
                  className="h-full w-full object-cover"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-outline-variant text-ink-muted transition hover:border-navy hover:text-navy"
                >
                  <Upload className="h-8 w-8" />
                  <span className="text-body-md font-semibold">Upload a room photo</span>
                  <span className="text-body-sm">JPG or PNG</span>
                </button>
              )}
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-label-md uppercase text-ink shadow-card backdrop-blur-sm">
                Current State
              </span>
            </div>

            <div className="flex items-center justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface-lowest text-ink-muted shadow-card">
                <ArrowLeftRight className="h-4 w-4" />
              </span>
            </div>

            {/* AI augmented */}
            <div
              className={`relative aspect-4/3 overflow-hidden rounded-card bg-surface-container ${
                stagedImage ? 'ring-2 ring-teal' : 'border border-hairline'
              }`}
            >
              {stagedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stagedImage} alt="AI staged room" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-muted">
                  {isStaging ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-navy" />
                      <span className="text-body-sm">Generating staged room…</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-8 w-8" />
                      <span className="text-body-sm">Staged result appears here</span>
                    </>
                  )}
                </div>
              )}
              {stagedImage && (
                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 text-label-md uppercase text-white">
                  <Sparkles className="h-3 w-3" />
                  AI Augmented
                </span>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Controls */}
          <div className="mt-6 flex flex-wrap items-end gap-4 rounded-card bg-surface-low p-5">
            <div className="min-w-52 flex-1">
              <label htmlFor="design-style" className="block text-label-md uppercase text-ink-muted">
                Interior style
              </label>
              <select
                id="design-style"
                value={designStyle}
                onChange={(e) => setDesignStyle(e.target.value)}
                className="mt-2 h-11 w-full rounded-soft border border-outline-variant bg-surface-lowest px-3 text-sm text-ink outline-none transition focus:border-navy"
              >
                {STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-11 rounded-soft border border-outline-variant px-5 text-sm font-semibold text-ink transition hover:border-navy hover:text-navy"
            >
              {originalImage ? 'Replace photo' : 'Upload photo'}
            </button>

            <button
              type="button"
              onClick={handleStageImage}
              disabled={!originalImage || isStaging}
              className="flex h-11 items-center gap-2 rounded-soft bg-navy px-6 text-sm font-semibold text-white transition hover:bg-navy-deep disabled:opacity-60"
            >
              {isStaging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Generate Staging
            </button>

            {stagedImage && (
              <a
                href={stagedImage}
                download={`staged-${roomType}.jpg`}
                className="flex h-11 items-center gap-2 rounded-soft bg-teal px-6 text-sm font-bold text-navy-deep transition hover:bg-teal-dim"
              >
                <Download className="h-4 w-4" />
                Export Asset
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* ROI roadmap — from the real vision analysis                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6 overflow-hidden rounded-card border border-hairline bg-surface-lowest shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline px-7 py-5">
          <h2 className="flex items-center gap-2 font-display text-headline-md text-navy-deep">
            <TrendingUp className="h-5 w-5 text-navy" />
            ROI Improvement Roadmap
          </h2>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-label-md uppercase text-ink-muted">
              <Sparkles className="h-3 w-3" />
              AI Data Driven
            </span>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!originalImage || isAnalyzing}
              className="flex h-10 items-center gap-2 rounded-soft bg-teal px-5 text-sm font-bold text-navy-deep transition hover:bg-teal-dim disabled:opacity-60"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="h-4 w-4" />
              )}
              {analysis ? 'Re-analyze' : 'Analyze Room'}
            </button>
          </div>
        </div>

        <div className="p-7">
          {analysis ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4">
                <div className="rounded-card border border-hairline bg-surface-low px-5 py-4">
                  <p className="text-label-md uppercase text-ink-muted">Detected room</p>
                  <p className="mt-1.5 text-body-md font-semibold text-ink">
                    {analysis.detectedRoomType}
                  </p>
                </div>
                <div className="rounded-card border border-hairline bg-surface-low px-5 py-4">
                  <p className="text-label-md uppercase text-ink-muted">Condition</p>
                  <p className="mt-1.5 text-body-md font-semibold text-ink">
                    {analysis.perceivedCondition}
                  </p>
                </div>
              </div>

              {analysis.keyFeaturesIdentified?.length > 0 && (
                <div>
                  <h3 className="text-label-md uppercase text-ink-muted">Features identified</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {analysis.keyFeaturesIdentified.map((f) => (
                      <li
                        key={f}
                        className="rounded-full border border-outline-variant px-3 py-1.5 text-body-sm text-ink"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {[
                { heading: 'Staging suggestions', items: analysis.stagingSuggestions },
                { heading: 'Renovation ROI tips', items: analysis.estimatedRenovationRoiTips },
              ].map(
                ({ heading, items }) =>
                  items?.length > 0 && (
                    <div key={heading}>
                      <h3 className="text-label-md uppercase text-ink-muted">{heading}</h3>
                      <ul className="mt-3 space-y-3">
                        {items.map((item) => (
                          <li
                            key={item}
                            className="flex gap-3 rounded-card border-l-2 border-teal bg-surface-low px-5 py-4"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                            <span className="text-body-md leading-6 text-ink">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
              )}
            </div>
          ) : (
            <p className="text-body-md text-ink-muted">
              {originalImage
                ? 'Analyze the uploaded room to get condition, identified features, staging suggestions, and renovation ROI tips.'
                : 'Upload a room photo above, then analyze it to build an improvement roadmap.'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
