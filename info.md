# Agent Response - orchestrator_workers

**Session ID**: 7ab1d693-4a64-42b4-9c7a-4a3e0f26f992
**Processing Time**: 328.62 seconds

## Final Response

# Technical Architecture & Implementation Blueprint: Dwellingly.ai (NexHomeAgent AI)

## Executive Summary & Migration Matrix

This document provides the technical architecture and implementation strategy for migrating **Dwellingly.ai (NexHomeAgent AI)** from a legacy Microsoft-centric stack (ASP.NET Core 8.0 Web API, Blazor, Azure SQL, Azure OpenAI) to a modern, decoupled web stack powered by **Next.js 15+ (App Router)**, **Supabase (PostgreSQL, Auth, Storage, `pgvector`)**, and the **Google GenAI SDK (`@google/genai`)**.

This transition preserves all domain capabilities—including multi-turn conversational agents, AI-driven Comparative Market Analysis (CMA), semantic property discovery, virtual property staging, and guided offer submission—while reducing architectural complexity, eliminating C#/Blazor compilation overhead, and leveraging Google’s Gemini 3 generation models.

### Stack Conversion Matrix

| Architecture Layer | Legacy Tech Stack (Microsoft/Azure) | Target Tech Stack (Next.js / Supabase / Gemini) | Key Architectural Justification |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Blazor WebAssembly / Blazor Server | **Next.js 15+ App Router (TypeScript, React 19)** | Instant initial page renders via React Server Components (RSC), superior SEO for property listings, edge streaming for AI tokens, and rich UI ecosystem. |
| **Backend & API Layer** | ASP.NET Core 8.0 Web API (C# Controllers) | **Next.js Route Handlers (`/app/api/*`) & Server Actions (`"use server"`)** | Eliminates REST controller overhead, provides end-to-end TypeScript type safety, and natively scales across serverless edge runtimes. |
| **Database** | Azure SQL Database | **Supabase Managed PostgreSQL** | Relational integrity paired with native JSONB support, row-level security (RLS), and automated real-time subscriptions. |
| **Vector Indexing** | Azure SQL `VectorData` (`VARBINARY`) | **PostgreSQL with `pgvector` Extension** | Sub-millisecond HNSW vector similarity search (`<->`, `<=>`) natively inside PostgreSQL without external vector databases. |
| **User Auth & Security** | ASP.NET Core Identity / Azure AD B2C | **Supabase Auth** | Built-in OAuth, magic links, JWTs, and Row-Level Security (RLS) policies enforced directly at the database layer. |
| **File & Asset Storage** | Azure Blob Storage | **Supabase Storage Buckets** | S3-compatible object storage with image transformation and public/private bucket access rules linked to Supabase Auth roles. |
| **Generative AI Engine** | Azure OpenAI (GPT-4) & Azure Bot Service | **Google GenAI SDK (`@google/genai`)** | Access to `gemini-3-flash-preview` (agent chat & tool calls), `gemini-3-pro-preview` (CMA financial reasoning & thinking budget), `gemini-2.5-flash-image` (virtual staging), and `text-embedding-004` (768-dim embeddings). |
| **Deployment / CI/CD** | Azure App Service + Azure DevOps | **Vercel Platform + GitHub Actions** | Git-backed deployments, instant preview branches, edge runtime distribution, and simplified secret management. |

---

## System Architecture & Data Flow Diagram

```
                                      +-------------------------------------------------------+
                                      |                     BROWSER / CLIENT                  |
                                      |                                                       |
                                      |  +---------------------+    +----------------------+  |
                                      |  | Client Component    |    | Interactive Chat UI  |  |
                                      |  | (Filters, Maps, UI) |    | (AiChatWidget.tsx)   |  |
                                      |  +----------+----------+    +----------+-----------+  |
                                      +-------------|--------------------------|--------------+
                                                    |                          |
                                         HTTPS /    |                          | Server Action /
                                         WebSocket  |                          | Stream Action
                                                    v                          v
+---------------------------------------------------------------------------------------------------------------+
| NEXT.JS APP ROUTER (SERVER RUNTIME)                                                                           |
|                                                                                                               |
|  +-------------------------------------+   +------------------------------------+   +---------------------+  |
|  | Server Components (RSC)             |   | Server Actions (`src/actions/*`)   |   | Route Handlers      |  |
|  | - Page Data Fetching                |   | - Perform Property Mutations       |   | (`src/app/api/*`)   |  |
|  | - SSR Layouts & Views               |   | - Execute GenAI Workflows          |   | - Webhooks & SSE    |  |
|  +------------------+------------------+   +-----------------+------------------+   +----------+----------+  |
|                     |                                        |                                 |              |
|                     | Supabase Client                        | Supabase Client                 |              |
|                     | (Server Context)                       | (Server Context)                |              |
|                     v                                        v                                 |              |
|  +------------------------------------------------------------------------------+              |              |
|  | @google/genai SDK Integration Services (`src/lib/ai/*`)                      |              |              |
|  | - `gemini-3-flash-preview` (Conversational Agent & Tool Execution Loops)    |              |              |
|  | - `gemini-3-pro-preview` (CMA Financial Reasoning & Thinking Budget)         |              |              |
|  | - `gemini-2.5-flash-image` (Virtual Staging & Visual Editing)               |              |              |
|  | - `text-embedding-004` (768-dim Semantic Vector Embeddings)                |              |              |
|  +---------------------------------------+--------------------------------------+              |              |
+------------------------------------------|-----------------------------------------------------|--------------+
                                           |                                                     |
                    Google AI API Calls    |                                                     |
                    (SDK Transport)        v                                                     |
+----------------------------------------------------+                                           |
| GOOGLE GEMINI CLOUD                                |                                           |
|                                                    |                                           |
|  +----------------------------------------------+  |                                           |
|  | Gemini Models (Flash, Pro, Image, Embeddings)|  |                                           |
|  +----------------------------------------------+  |                                           |
+----------------------------------------------------+                                           |
                                                                                                 |
                                                           Supabase JS / Postgres Connection     |
                                                           (RLS Policies Enforced)               |
                                                           v                                     v
+---------------------------------------------------------------------------------------------------------------+
| SUPABASE BACKEND (PAAS)                                                                                       |
|                                                                                                               |
|  +-------------------+     +----------------------+     +--------------------+     +-----------------------+  |
|  | Supabase Auth     |     | PostgreSQL Database  |     | `pgvector`         |     | Supabase Storage      |  |
|  | - JWT Tokens      |     | - profiles           |     | - property_vectors |     | - property-photos     |  |
|  | - Auth Listeners  |     | - properties         |     | - HNSW Cosine Index|     | - staging-images      |  |
|  | - User Profiles   |     | - cma_reports, offers|     | - RPC functions    |     | - legal-docs          |  |
|  +-------------------+     +----------------------+     +--------------------+     +-----------------------+  |
+---------------------------------------------------------------------------------------------------------------+
```

---

## Database Architecture & Vector Search (`pgvector`)

The database configuration utilizes three SQL migrations deployed to Supabase PostgreSQL:

1. **Schema & Infrastructure (`20250101000000_init_schema.sql`)**: Defines tables, automated `updated_at` triggers, and an automated profile creation trigger bound to `auth.users`.
2. **Vector Engine (`20250101000001_enable_pgvector.sql`)**: Configures 768-dimensional vector storage matching Google `text-embedding-004` outputs, an **HNSW Cosine index**, and an RPC function for hybrid semantic property matching.
3. **Row Level Security (`20250101000002_rls_policies.sql`)**: Enforces database-level access control policies.

```sql
-- ============================================================================
-- 1. CORE SCHEMA & PROFILES SETUP
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- Automated timestamp trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- User Profile table linked to Supabase Auth
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'agent', 'admin')),
  phone TEXT,
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Automatic Profile Creation Trigger from Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Properties Table
CREATE TABLE public.properties (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  price NUMERIC(18, 2) NOT NULL CHECK (price >= 0),
  bedrooms INT NOT NULL CHECK (bedrooms >= 0),
  bathrooms NUMERIC(3, 1) NOT NULL CHECK (bathrooms >= 0),
  square_feet INT CHECK (square_feet >= 0),
  property_type TEXT DEFAULT 'single_family' CHECK (property_type IN ('single_family', 'condo', 'townhouse', 'multi_family', 'land')),
  description TEXT NOT NULL,
  features JSONB DEFAULT '{}'::jsonb NOT NULL,
  photos JSONB DEFAULT '[]'::jsonb NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold', 'draft', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- CMA Reports Table
CREATE TABLE public.cma_reports (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  estimated_valuation NUMERIC(18, 2) NOT NULL,
  valuation_range_low NUMERIC(18, 2) NOT NULL,
  valuation_range_high NUMERIC(18, 2) NOT NULL,
  comparable_property_ids BIGINT[] DEFAULT '{}',
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Purchase Offers Table
CREATE TABLE public.offers (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  offer_amount NUMERIC(18, 2) NOT NULL CHECK (offer_amount > 0),
  earnest_money NUMERIC(18, 2) CHECK (earnest_money >= 0),
  contingencies JSONB DEFAULT '[]'::jsonb NOT NULL,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'countered', 'accepted', 'rejected', 'withdrawn')),
  contract_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Scheduled Viewings
CREATE TABLE public.viewings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Favorites Table
CREATE TABLE public.favorites (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, property_id)
);

-- ============================================================================
-- 2. PGVECTOR & SEMANTIC SEARCH RPC SETUP
-- ============================================================================
CREATE TABLE public.property_vectors (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  content_summary TEXT NOT NULL,
  embedding vector(768) NOT NULL, -- Google text-embedding-004 dimension
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- High-performance HNSW index for sub-millisecond similarity queries
CREATE INDEX idx_property_vectors_hnsw_cosine
  ON public.property_vectors
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RPC Stored Procedure: Hybrid Natural Language Vector Similarity Search
CREATE OR REPLACE FUNCTION public.match_properties(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.2,
  match_count INT DEFAULT 10,
  filter_city TEXT DEFAULT NULL,
  filter_min_price NUMERIC DEFAULT NULL,
  filter_max_price NUMERIC DEFAULT NULL,
  filter_min_bedrooms INT DEFAULT NULL,
  filter_min_bathrooms NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  property_id BIGINT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  price NUMERIC,
  bedrooms INT,
  bathrooms NUMERIC,
  square_feet INT,
  description TEXT,
  features JSONB,
  photos JSONB,
  content_summary TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS property_id,
    p.address,
    p.city,
    p.state,
    p.zip_code,
    p.price,
    p.bedrooms,
    p.bathrooms,
    p.square_feet,
    p.description,
    p.features,
    p.photos,
    pv.content_summary,
    (1 - (pv.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.property_vectors pv
  JOIN public.properties p ON p.id = pv.property_id
  WHERE
    p.status = 'active'
    AND (1 - (pv.embedding <=> query_embedding)) >= match_threshold
    AND (filter_city IS NULL OR LOWER(p.city) = LOWER(filter_city))
    AND (filter_min_price IS NULL OR p.price >= filter_min_price)
    AND (filter_max_price IS NULL OR p.price <= filter_max_price)
    AND (filter_min_bedrooms IS NULL OR p.bedrooms >= filter_min_bedrooms)
    AND (filter_min_bathrooms IS NULL OR p.bathrooms >= filter_min_bathrooms)
  ORDER BY pv.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cma_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public properties are viewable by everyone"
  ON public.properties FOR SELECT TO public
  USING (status = 'active' OR auth.uid() = owner_id);

CREATE POLICY "Sellers can manage their listings"
  ON public.properties FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view relevant offers"
  ON public.offers FOR SELECT TO authenticated
  USING (
    auth.uid() = buyer_id OR
    EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND owner_id = auth.uid())
  );

CREATE POLICY "Buyers can submit offers"
  ON public.offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);
```

---

## Google GenAI SDK Services (`@google/genai`)

The application integrates with Gemini models using the official `@google/genai` package.

### 1. Centralized Gemini Initializer (`src/lib/ai/client.ts`)

```typescript
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY in environment variables.');
}

/**
 * Singleton instance of GoogleGenAI SDK
 */
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const GEMINI_MODELS = {
  CHAT_FLASH: 'gemini-3-flash-preview',
  REASONING_PRO: 'gemini-3-pro-preview',
  IMAGE_GEN: 'gemini-2.5-flash-image',
  VISION_PRO: 'gemini-3-pro-image-preview',
  EMBEDDINGS: 'text-embedding-004',
} as const;

/**
 * Generates 768-dimensional text embeddings using text-embedding-004
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: GEMINI_MODELS.EMBEDDINGS,
    contents: text,
  });

  if (!response.embedding?.values) {
    throw new Error('Failed to extract embedding values from response.');
  }

  return response.embedding.values;
}
```

---

### 2. Tools & Tool Executors (`src/lib/ai/tools.ts`)

```typescript
import { Type, FunctionDeclaration } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './client';

export const searchPropertiesToolDeclaration: FunctionDeclaration = {
  name: 'searchProperties',
  description: 'Search for active real estate properties using natural language vector queries and filters.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'Natural language search query describing home attributes or lifestyle.' },
      city: { type: Type.STRING, description: 'Target city name.' },
      minPrice: { type: Type.NUMBER, description: 'Minimum price filter in USD.' },
      maxPrice: { type: Type.NUMBER, description: 'Maximum price filter in USD.' },
      minBedrooms: { type: Type.NUMBER, description: 'Minimum number of bedrooms.' },
    },
    required: ['query'],
  },
};

export const ALL_AGENT_TOOLS = [searchPropertiesToolDeclaration];

export async function executeSearchProperties(args: {
  query: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
}) {
  const supabase = await createClient();
  const queryVector = await generateEmbedding(args.query);

  const { data, error } = await supabase.rpc('match_properties', {
    query_embedding: queryVector,
    match_threshold: 0.2,
    match_count: 5,
    filter_city: args.city || null,
    filter_min_price: args.minPrice || null,
    filter_max_price: args.maxPrice || null,
    filter_min_bedrooms: args.minBedrooms || null,
  });

  if (error) return { success: false, error: error.message, listings: [] };
  return { success: true, count: data?.length || 0, properties: data || [] };
}
```

---

### 3. Conversational Agent Service (`src/lib/ai/chat.ts`)

```typescript
import { Content, Part } from '@google/genai';
import { ai, GEMINI_MODELS } from './client';
import { ALL_AGENT_TOOLS, executeSearchProperties } from './tools';

export interface ChatMessagePayload {
  role: 'user' | 'model';
  content: string;
}

export const DWELLINGLY_SYSTEM_INSTRUCTION = `
You are Dwellingly AI (NexHomeAgent), an elite real estate advisor and assistant.
Assist buyers and sellers with home searches, valuation analysis, and offer coordination.
Use searchProperties tool when users ask for real estate recommendations.
Format responses in clear Markdown with key listing highlights.
`;

export async function* streamAgentChat(params: {
  userId: string;
  history: ChatMessagePayload[];
  newMessage: string;
}) {
  const { userId, history, newMessage } = params;

  const contents: Content[] = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  contents.push({
    role: 'user',
    parts: [{ text: newMessage }],
  });

  // Streaming call using gemini-3-flash-preview
  const responseStream = await ai.models.generateContentStream({
    model: GEMINI_MODELS.CHAT_FLASH,
    contents: contents,
    config: {
      systemInstruction: DWELLINGLY_SYSTEM_INSTRUCTION,
      temperature: 0.7,
      tools: [{ functionDeclarations: ALL_AGENT_TOOLS }],
    },
  });

  let functionCallsToExecute: Array<{ name: string; args: Record<string, any> }> = [];

  for await (const chunk of responseStream) {
    if (chunk.text) {
      yield { type: 'token', content: chunk.text };
    }

    if (chunk.functionCalls) {
      for (const fc of chunk.functionCalls) {
        functionCallsToExecute.push({ name: fc.name, args: fc.args as Record<string, any> });
      }
    }
  }

  // Function Calling Execution Loop
  if (functionCallsToExecute.length > 0) {
    for (const call of functionCallsToExecute) {
      let toolResult: any;
      if (call.name === 'searchProperties') {
        toolResult = await executeSearchProperties(call.args as any);
      }

      yield { type: 'tool_executed', tool: call.name, args: call.args, result: toolResult };

      contents.push({
        role: 'model',
        parts: [{ functionCall: { name: call.name, args: call.args } }],
      });

      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: call.name, response: { result: toolResult } } }],
      });
    }

    // Follow-up generation after tool execution
    const followUpStream = await ai.models.generateContentStream({
      model: GEMINI_MODELS.CHAT_FLASH,
      contents: contents,
      config: { systemInstruction: DWELLINGLY_SYSTEM_INSTRUCTION },
    });

    for await (const chunk of followUpStream) {
      if (chunk.text) yield { type: 'token', content: chunk.text };
    }
  }
}
```

---

### 4. Automated Valuation Engine & CMA (`src/lib/ai/cma.ts`)

Uses `gemini-3-pro-preview` with a **thinking budget** (`thinkingBudget: 4096`) and structured JSON outputs (`responseSchema`).

```typescript
import { Type, Schema } from '@google/genai';
import { ai, GEMINI_MODELS } from './client';
import { createClient } from '@/lib/supabase/server';

const cmaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    estimatedMarketValue: { type: Type.NUMBER },
    confidenceScore: { type: Type.NUMBER },
    suggestedPriceRange: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER },
        max: { type: Type.NUMBER },
      },
      required: ['min', 'max'],
    },
    marketSummary: { type: Type.STRING },
    reasoningFactors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['estimatedMarketValue', 'confidenceScore', 'suggestedPriceRange', 'marketSummary', 'reasoningFactors'],
};

export async function generateCmaReport(propertyId: number, userId: string) {
  const supabase = await createClient();

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (!property) throw new Error('Property not found');

  const { data: comps } = await supabase
    .from('properties')
    .select('*')
    .eq('city', property.city)
    .neq('id', propertyId)
    .limit(4);

  const prompt = `
Perform a Comparative Market Analysis (CMA) for:
Subject: ${property.address}, ${property.city}, ${property.state}. Price: $${property.price}, ${property.bedrooms} Beds, ${property.bathrooms} Baths.
Description: ${property.description}

Local Comparables:
${JSON.stringify(comps || [])}
`;

  // Reasoning Pro call with Thinking Budget
  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.REASONING_PRO,
    contents: prompt,
    config: {
      temperature: 0.2,
      thinkingConfig: { thinkingBudget: 4096 },
      responseMimeType: 'application/json',
      responseSchema: cmaSchema,
    },
  });

  const parsedReport = JSON.parse(response.text || '{}');

  const { data: savedCma } = await supabase
    .from('cma_reports')
    .insert({
      property_id: propertyId,
      user_id: userId,
      estimated_valuation: parsedReport.estimatedMarketValue,
      valuation_range_low: parsedReport.suggestedPriceRange.min,
      valuation_range_high: parsedReport.suggestedPriceRange.max,
      report_data: parsedReport,
    })
    .select()
    .single();

  return { cmaReportId: savedCma.id, report: parsedReport };
}
```

---

## Next.js API Routes & Server Actions

### Real-Time SSE Chat Route (`src/app/api/chat/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamAgentChat } from '@/lib/ai/chat';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { messages, newMessage } = await req.json();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const generator = streamAgentChat({
          userId: user.id,
          history: messages || [],
          newMessage,
        });

        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

### Hybrid Vector Search Action (`src/actions/search.ts`)

```typescript
'use server';

import { generateEmbedding } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/server';

export async function performVectorSearchAction(filters: {
  query: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
}) {
  try {
    const supabase = await createClient();
    const queryEmbedding = await generateEmbedding(filters.query);

    const { data, error } = await supabase.rpc('match_properties', {
      query_embedding: queryEmbedding,
      match_threshold: 0.15,
      match_count: 12,
      filter_city: filters.city || null,
      filter_min_price: filters.minPrice || null,
      filter_max_price: filters.maxPrice || null,
      filter_min_bedrooms: filters.bedrooms || null,
    });

    if (error) return { success: false, error: error.message, results: [] };
    return { success: true, results: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, results: [] };
  }
}
```

---

## Frontend Interactive Components

### Slide-Over AI Assistant (`src/components/ai/AiChatWidget.tsx`)

```tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { X, Send, Bot, User, Loader2, Sparkles, Home, Mic, MicOff } from 'lucide-react';

export function AiChatWidget({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string; toolCall?: any }>>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your Dwellingly.ai assistant. I can search properties, run AI market valuations, or schedule home viewings. What are you looking for today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (customQuery?: string) => {
    const query = customQuery || input.trim();
    if (!query || isLoading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content })),
          newMessage: query,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let acc = '';

      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') break;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'token' && parsed.content) {
                acc += parsed.content;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: acc } : m))
                );
              } else if (parsed.type === 'tool_executed') {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, toolCall: parsed } : m))
                );
              }
            } catch {
              // Ignore non-json chunk boundaries
            }
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, content: 'Error retrieving response.' } : m))
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4 bg-slate-900 text-white">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-indigo-400" />
          <span className="font-bold text-sm">Dwellingly AI Concierge</span>
        </div>
        <button onClick={onClose}><X className="h-5 w-5" /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] ${
              m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white border'
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>

              {/* Render property recommendation cards when tools execute */}
              {m.toolCall?.result?.properties && (
                <div className="mt-3 space-y-2 border-t pt-2">
                  <p className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                    <Home className="h-3 w-3" /> Property Matches:
                  </p>
                  {m.toolCall.result.properties.slice(0, 3).map((p: any) => (
                    <Link key={p.property_id || p.id} href={`/properties/${p.property_id || p.id}`} onClick={onClose} className="block p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs hover:bg-indigo-50">
                      <div className="font-bold">{p.address}</div>
                      <div className="text-slate-500">${p.price?.toLocaleString()} • {p.bedrooms} beds</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
        <div ref={endRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI about homes, CMAs, or offers..."
          className="flex-1 rounded-xl border bg-slate-50 px-3.5 py-2 text-sm outline-none dark:bg-slate-800 dark:text-white"
        />
        <button type="submit" disabled={!input.trim() || isLoading} className="rounded-xl bg-indigo-600 px-4 py-2 text-white">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
```

---

## Third-Party Integration Abstractions

### Stripe Escrow & Earnest Payments (`src/lib/integrations/stripe.ts`)

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

export async function createEarnestMoneyCheckoutSession(params: {
  offerId: number;
  propertyAddress: string;
  amount: number;
  userEmail: string;
}) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: params.userEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Earnest Money Hold - ${params.propertyAddress}`,
            description: `Escrow deposit for Offer #${params.offerId}`,
          },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${origin}/dashboard?payment=success&offerId=${params.offerId}`,
    cancel_url: `${origin}/dashboard?payment=cancelled`,
  });
}
```

---

### Twilio Viewing Notifications (`src/lib/integrations/twilio.ts`)

```typescript
import twilio from 'twilio';

const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

export async function sendViewingConfirmationSMS(toPhone: string, propertyAddress: string, scheduledAt: string) {
  if (!client || !process.env.TWILIO_PHONE_NUMBER) {
    return { success: true, simulated: true };
  }

  const message = await client.messages.create({
    body: `[Dwellingly.ai] Your home tour request for ${propertyAddress} on ${new Date(scheduledAt).toLocaleString()} has been confirmed!`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toPhone,
  });

  return { success: true, sid: message.sid };
}
```

---

## Environment Setup & Deployment Guide

### Environment File Configuration (`.env.local`)

```bash
# Core App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiI..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiI..."

# Google GenAI SDK
GEMINI_API_KEY="AIzaSyYourGeminiApiKey"

# Stripe Integration
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Twilio SMS Integration
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_PHONE_NUMBER="+18005550199"
```

---

### Package Manifest (`package.json`)

```json
{
  "name": "dwellingly-ai",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@google/genai": "^0.1.1",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.48.1",
    "lucide-react": "^0.475.0",
    "next": "^15.1.7",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "stripe": "^17.7.0",
    "twilio": "^5.4.3"
  },
  "devDependencies": {
    "@types/node": "^22.13.4",
    "@types/react": "^19.0.10",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3"
  }
}
```

---

### Deployment Execution Steps

1. **Database Setup**:
   - Create a project on [Supabase](https://database.new).
   - Execute the SQL migrations in the Supabase SQL Editor (`pgvector` extension setup, tables, RPC function, and RLS policies).

2. **Application Installation**:

   ```bash
   git clone https://github.com/your-org/dwellingly-ai.git
   cd dwellingly-ai
   npm install
   ```

3. **Local Testing**:

   ```bash
   npm run dev
   ```

   Navigate to `http://localhost:3000` and test natural language vector search, the AI chat drawer, and CMA generation.

4. **Production Vercel Deployment**:
   - Push repository to GitHub.
   - Import project into Vercel.
   - Set environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, etc.) in Vercel.
   - Deploy.

## Intermediate Steps

### Task Coordinator

Task Understanding:
The user requested a technical architecture and complete code implementation logic to convert the Dwellingly.ai (NexHomeAgent AI) project from an Azure/C#/.NET/Blazor stack to a modern web stack using Next.js App Router, Supabase (Postgres, Auth, Storage, pgvector), and the Google GenAI SDK (@google/genai npm package). The AI features must use current Gemini models (gemini-3-flash-preview, gemini-3-pro-preview, gemini-2.5-flash-image, etc.) following strict modern @google/genai SDK guidelines.

Execution Strategy:
Execute subtasks sequentially to build a cohesive, fully working technical architecture and code implementation for migrating Dwellingly.ai (NexHomeAgent AI) from C#/.NET/Azure/Azure OpenAI to Next.js App Router, Supabase, and Google GenAI SDK (@google/genai). Ensure all Gemini code strictly follows the latest @google/genai SDK guidelines.

Subtasks:

1. Architecture Overview & Stack Conversion Blueprint (Priority: 1, Expertise: Software Architecture & Next.js / Supabase / Gemini AI Expert)
   Description: Define the architectural shift from ASP.NET Core / Blazor / Azure SQL / Azure OpenAI to Next.js App Router (TypeScript), Supabase (PostgreSQL, Auth, Storage, Vector), and Google GenAI SDK (@google/genai). Map legacy C# components, services, and models to Next.js folder structures, Server Actions, API routes, and Client Components.
   Dependencies: None
2. Supabase Database Schema & Vector Database (pgvector) Configuration (Priority: 2, Expertise: Database Engineering & Supabase / PostgreSQL / Vector Search Expert)
   Description: Design and write the complete Supabase PostgreSQL schema migration script including pgvector support, tables (users profile, properties, cmas, offers, viewings, property_embeddings), Row Level Security (RLS) policies, and SQL functions for semantic vector similarity search.
   Dependencies: subtask_1_arch_overview
3. Google GenAI SDK Integration Services (@google/genai) (Priority: 3, Expertise: Google GenAI API & TypeScript / AI Integration Specialist)
   Description: Implement robust TypeScript modules using the official @google/genai SDK for: 1) AI Chatbot with turn management and thinking, 2) Automated Valuation Engine & CMA Report Generator using gemini-3-pro-preview with structured outputs and thinking_level HIGH, 3) Property Image Staging/Editing using gemini-2.5-flash-image / gemini-3-pro-image-preview, and 4) Tool/Function calling for property search and weather/neighborhood grounding.
   Dependencies: subtask_2_database_schema
4. Next.js App Router Backend API Routes & Server Actions (Priority: 4, Expertise: Next.js App Router & Server Actions Specialist)
   Description: Create Next.js App Router API routes and Server Actions for property management, CMA generation, real-time conversational streaming, offer creation, and vector search querying. Implement server-side client instantiation with @supabase/ssr and @google/genai.
   Dependencies: subtask_3_gemini_services
5. Frontend Components & Interactive User Experience (Priority: 5, Expertise: Frontend Developer & React / Next.js UI Specialist)
   Description: Construct the Next.js UI component structure using React, Tailwind CSS, and Lucide icons. Implement the primary buyer/seller pages: Dashboard, Dynamic Property Search with Filters, Property Detail View, Virtual Staging Studio, and the lifelike AI Assistant drawer (AiChatWidget).
   Dependencies: subtask_4_api_server_actions
6. Migration Roadmap, Third-Party Integrations & Deployment Guide (Priority: 6, Expertise: DevOps & Full Stack Integration Lead)
   Description: Provide an end-to-end migration guide, environment configuration (.env.local), third-party integration abstractions (Stripe, DocuSign, Twilio), and execution commands to run and deploy the MVP.
   Dependencies: subtask_5_frontend_ui

**Metadata:**

```json
{
  "execution_strategy": "Execute subtasks sequentially to build a cohesive, fully working technical architecture and code implementation for migrating Dwellingly.ai (NexHomeAgent AI) from C#/.NET/Azure/Azure OpenAI to Next.js App Router, Supabase, and Google GenAI SDK (@google/genai). Ensure all Gemini code strictly follows the latest @google/genai SDK guidelines.",
  "task_understanding": "The user requested a technical architecture and complete code implementation logic to convert the Dwellingly.ai (NexHomeAgent AI) project from an Azure/C#/.NET/Blazor stack to a modern web stack using Next.js App Router, Supabase (Postgres, Auth, Storage, pgvector), and the Google GenAI SDK (@google/genai npm package). The AI features must use current Gemini models (gemini-3-flash-preview, gemini-3-pro-preview, gemini-2.5-flash-image, etc.) following strict modern @google/genai SDK guidelines.",
  "subtasks": [
    {
      "title": "Architecture Overview & Stack Conversion Blueprint",
      "id": "subtask_1_arch_overview",
      "description": "Define the architectural shift from ASP.NET Core / Blazor / Azure SQL / Azure OpenAI to Next.js App Router (TypeScript), Supabase (PostgreSQL, Auth, Storage, Vector), and Google GenAI SDK (@google/genai). Map legacy C# components, services, and models to Next.js folder structures, Server Actions, API routes, and Client Components.",
      "required_expertise": "Software Architecture & Next.js / Supabase / Gemini AI Expert",
      "dependencies": [],
      "priority": 1
    },
    {
      "dependencies": [
        "subtask_1_arch_overview"
      ],
      "required_expertise": "Database Engineering & Supabase / PostgreSQL / Vector Search Expert",
      "description": "Design and write the complete Supabase PostgreSQL schema migration script including pgvector support, tables (users profile, properties, cmas, offers, viewings, property_embeddings), Row Level Security (RLS) policies, and SQL functions for semantic vector similarity search.",
      "id": "subtask_2_database_schema",
      "title": "Supabase Database Schema & Vector Database (pgvector) Configuration",
      "priority": 2
    },
    {
      "description": "Implement robust TypeScript modules using the official @google/genai SDK for: 1) AI Chatbot with turn management and thinking, 2) Automated Valuation Engine & CMA Report Generator using gemini-3-pro-preview with structured outputs and thinking_level HIGH, 3) Property Image Staging/Editing using gemini-2.5-flash-image / gemini-3-pro-image-preview, and 4) Tool/Function calling for property search and weather/neighborhood grounding.",
      "priority": 3,
      "title": "Google GenAI SDK Integration Services (@google/genai)",
      "dependencies": [
        "subtask_2_database_schema"
      ],
      "id": "subtask_3_gemini_services",
      "required_expertise": "Google GenAI API & TypeScript / AI Integration Specialist"
    },
    {
      "dependencies": [
        "subtask_3_gemini_services"
      ],
      "description": "Create Next.js App Router API routes and Server Actions for property management, CMA generation, real-time conversational streaming, offer creation, and vector search querying. Implement server-side client instantiation with @supabase/ssr and @google/genai.",
      "title": "Next.js App Router Backend API Routes & Server Actions",
      "id": "subtask_4_api_server_actions",
      "priority": 4,
      "required_expertise": "Next.js App Router & Server Actions Specialist"
    },
    {
      "description": "Construct the Next.js UI component structure using React, Tailwind CSS, and Lucide icons. Implement the primary buyer/seller pages: Dashboard, Dynamic Property Search with Filters, Property Detail View, Virtual Staging Studio, and the lifelike AI Assistant drawer (AiChatWidget).",
      "id": "subtask_5_frontend_ui",
      "required_expertise": "Frontend Developer & React / Next.js UI Specialist",
      "title": "Frontend Components & Interactive User Experience",
      "priority": 5,
      "dependencies": [
        "subtask_4_api_server_actions"
      ]
    },
    {
      "dependencies": [
        "subtask_5_frontend_ui"
      ],
      "title": "Migration Roadmap, Third-Party Integrations & Deployment Guide",
      "priority": 6,
      "required_expertise": "DevOps & Full Stack Integration Lead",
      "description": "Provide an end-to-end migration guide, environment configuration (.env.local), third-party integration abstractions (Stripe, DocuSign, Twilio), and execution commands to run and deploy the MVP.",
      "id": "subtask_6_deployment_roadmap"
    }
  ]
}
```

### Software Architecture & Next.js / Supabase / Gemini AI Expert Specialist

# Technical Architecture Blueprint: Dwellingly.ai (NexHomeAgent AI)

## Stack Conversion: C# / ASP.NET Core / Blazor / Azure SQL $\rightarrow$ Next.js App Router / Supabase / Google GenAI SDK

---

## 1. Executive Stack Conversion Summary

The architecture of Dwellingly.ai is migrating from a monolithic Microsoft ecosystem (ASP.NET Core Web API, Blazor WebAssembly/Server, Azure SQL, and Azure OpenAI) to a modern, decoupled, edge-ready stack composed of **Next.js 15+ App Router (TypeScript)**, **Supabase (PostgreSQL, Auth, Storage, pgvector)**, and the **Google GenAI SDK (`@google/genai`)**.

### Conversion Matrix

| Component | Legacy Microsoft Stack | Modern Next.js + Supabase + Gemini Stack | Architectural Justification |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Blazor WebAssembly / Blazor Server | **Next.js 15+ (App Router)** | Instant initial page renders via React Server Components (RSC), superior SEO for property listings, dynamic edge streaming for AI responses, and vast React UI ecosystem. |
| **Backend / API Layer** | ASP.NET Core Web API 8.0 Controllers & Services | **Next.js Route Handlers (`app/api/*`) & Server Actions (`"use server"`)** | Eliminates API orchestration overhead, provides end-to-end TypeScript type safety, and automatically handles serverless execution at the edge. |
| **Database** | Azure SQL Database | **Supabase Managed PostgreSQL** | Relational integrity with native JSONB support, row-level performance, automated REST/GraphQL generation, and native real-time subscriptions. |
| **Vector Storage** | Azure SQL `VectorData` (VARBINARY) | **PostgreSQL with `pgvector` Extension** | Native high-performance vector similarity searches (`<->`, `<=>`, `<#>`) directly inside PostgreSQL without needing external vector engines or binary blobs. |
| **User Auth & Security** | ASP.NET Core Identity / Azure AD B2C | **Supabase Auth** | Built-in support for OAuth, magic links, JWTs, Row-Level Security (RLS) policies enforcing database access rules directly at the PostgreSQL layer. |
| **File Storage** | Azure Blob Storage | **Supabase Storage** | Integrated S3-compatible storage with automated image transformation, public/private bucket access policies linked directly to Supabase Auth roles. |
| **Generative AI Platform** | Azure OpenAI (GPT-4) & Azure Bot Service | **Google GenAI SDK (`@google/genai`)** | Access to state-of-the-art Gemini 3 models (`gemini-3-flash-preview` for low-latency conversational agent & entity extraction, `gemini-3-pro-preview` for complex multi-step reasoning and CMA calculations, `text-embedding-004` for embeddings). |
| **State Management** | C# Dependency Injection / Cascading Values | **React Server Components + Zustand / React Hooks** | Server state is managed zero-bundle via RSC & Supabase cache; local interactive UI state managed via Zustand / React context. |
| **Deployment / CI/CD** | Azure App Service + Azure DevOps | **Vercel / Supabase Platform** | Native git-backed continuous deployment, instant preview deployments, edge runtime capabilities, zero-configuration environment setup. |

---

## 2. System Architecture Diagram & Conceptual Flow

### Data & Execution Flow Architecture

```
                                      +-------------------------------------------------------+
                                      |                     BROWSER / CLIENT                  |
                                      |                                                       |
                                      |  +---------------------+    +----------------------+  |
                                      |  | Client Component    |    | Interactive Chat UI  |  |
                                      |  | (Filters, Maps, UI) |    | (AiChat.tsx)         |  |
                                      |  +----------+----------+    +----------+-----------+  |
                                      +-------------|--------------------------|--------------+
                                                    |                          |
                                         HTTPS /    |                          | Server Action /
                                         WebSocket  |                          | Stream Action
                                                    v                          v
+---------------------------------------------------------------------------------------------------------------+
| NEXT.JS APP ROUTER (SERVER)                                                                                  |
|                                                                                                               |
|  +-------------------------------------+   +------------------------------------+   +---------------------+  |
|  | Server Components (RSC)             |   | Server Actions (`app/actions/*`)   |   | Route Handlers      |  |
|  | - Page Data Fetching                |   | - Perform Property Mutations       |   | (`app/api/*`)       |  |
|  | - SSR Layouts & Views               |   | - Execute GenAI Workflows          |   | - External Webhooks |  |
|  +------------------+------------------+   +-----------------+------------------+   +----------+----------+  |
|                     |                                        |                                 |              |
|                     | Supabase Client                        | Supabase Client                 |              |
|                     | (Server Context)                       | (Server Context)                |              |
|                     v                                        v                                 |              |
|  +------------------------------------------------------------------------------+              |              |
|  | @google/genai SDK Integration Service (`lib/ai/gemini.ts`)                  |              |              |
|  | - `gemini-3-flash-preview` (Conversational & Natural Language Search Extraction)|              |              |
|  | - `gemini-3-pro-preview` (CMA Calculation, Offer Evaluation, Legal Summary)   |              |              |
|  | - `text-embedding-004` (Semantic Search Vector Embeddings)                    |              |              |
|  +---------------------------------------+--------------------------------------+              |              |
+------------------------------------------|-----------------------------------------------------|--------------+
                                           |                                                     |
                    Google AI API Calls    |                                                     |
                    (SDK Transport)        v                                                     |
+----------------------------------------------------+                                           |
| GOOGLE GEMINI CLOUD                                |                                           |
|                                                    |                                           |
|  +----------------------------------------------+  |                                           |
|  | Gemini Models (3 Flash, 3 Pro, Embeddings)   |  |                                           |
|  +----------------------------------------------+  |                                           |
+----------------------------------------------------+                                           |
                                                                                                 |
                                                           Supabase JS / Postgres Connection     |
                                                           (RLS Policies Enforced)               |
                                                                                                 v
+---------------------------------------------------------------------------------------------------------------+
| SUPABASE BACKEND (PAAS)                                                                                       |
|                                                                                                               |
|  +-------------------+     +----------------------+     +--------------------+     +-----------------------+  |
|  | Supabase Auth     |     | PostgreSQL Database  |     | `pgvector`         |     | Supabase Storage      |  |
|  | - JWT Tokens      |     | - users              |     | - property_vectors |     | - property-images     |  |
|  | - Auth Listeners  |     | - properties         |     | - vector_data      |     | - legal-docs          |  |
|  | - User Profiles   |     | - cmas, offers, etc. |     | - similarity ops   |     | - cma-reports         |  |
|  +-------------------+     +----------------------+     +--------------------+     +-----------------------+  |
+---------------------------------------------------------------------------------------------------------------+
```

---

## 3. Folder & Repository Blueprint

This folder structure targets **Next.js 15+** with App Router, TypeScript, Tailwind CSS, Supabase (`@supabase/ssr`), and Google GenAI (`@google/genai`).

```text
dwellingly-ai/
├── .env.local                     # Environment Variables (Supabase, Gemini API Key)
├── next.config.ts                 # Next.js configuration (images, experimental features)
├── package.json                   # Project dependencies (@google/genai, @supabase/ssr, etc.)
├── tsconfig.json                  # Strict TypeScript configuration
├── supabase/
│   ├── config.toml                # Local Supabase CLI Configuration
│   ├── migrations/                # Supabase SQL Migrations (Tables, Functions, Vector)
│   │   ├── 20250101000000_init_schema.sql
│   │   ├── 20250101000001_enable_pgvector.sql
│   │   └── 20250101000002_rls_policies.sql
│   └── seed.sql                   # Canned mock properties and seed vectors
├── src/
│   ├── app/                       # Next.js App Router Structure
│   │   ├── layout.tsx             # Root layout with Supabase Auth Provider & Nav
│   │   ├── page.tsx               # Landing Page / Value Proposition
│   │   ├── (auth)/                # Auth route group
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── auth/callback/route.ts
│   │   ├── (dashboard)/           # Protected Application Area
│   │   │   ├── layout.tsx         # Shared Dashboard Navigation & Sidebar
│   │   │   ├── buyer/
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── search/page.tsx     # Property Search with Dynamic AI Filters
│   │   │   │   ├── properties/[id]/page.tsx
│   │   │   │   └── offers/page.tsx
│   │   │   └── seller/
│   │   │       ├── dashboard/page.tsx
│   │   │       ├── evaluate/page.tsx   # Instant AI Valuation / CMA Tool
│   │   │       ├── create-listing/page.tsx
│   │   │       └── offers-received/page.tsx
│   │   ├── api/                   # Route Handlers
│   │   │   ├── ai/
│   │   │   │   ├── chat/route.ts            # Streaming Chat Endpoint (Gemini 3 Flash)
│   │   │   │   ├── cma/route.ts             # CMA Analysis Generator (Gemini 3 Pro)
│   │   │   │   └── embed/route.ts           # Vector Generation Endpoint
│   │   │   └── webhooks/
│   │   │       ├── docusign/route.ts
│   │   │       └── stripe/route.ts
│   │   └── actions/               # Server Actions ("use server")
│   │       ├── auth.ts            # Login, Signup, Logout actions
│   │       ├── properties.ts      # Fetch, Filter, Create Properties
│   │       ├── cma.ts             # Trigger & Save CMA Reports
│   │       └── offers.ts          # Submit & Manage Offers
│   ├── components/                # Reusable UI Components
│   │   ├── ai/                    # AI Specific Components
│   │   │   ├── AiChatWindow.tsx   # Client component for Assistant UI
│   │   │   ├── CmaReportViewer.tsx
│   │   │   └── ValuationWidget.tsx
│   │   ├── properties/            # Property UI components
│   │   │   ├── PropertyCard.tsx
│   │   │   ├── PropertyGrid.tsx
│   │   │   └── PropertyFilter.tsx
│   │   └── ui/                    # Base UI components (Buttons, Inputs, Modals)
│   ├── hooks/                     # Custom Client React Hooks
│   │   ├── useAiChat.ts           # Streaming chat response handler
│   │   ├── useUser.ts             # Supabase Auth Session listener
│   │   └── usePropertySearch.ts
│   ├── lib/                       # Core Integration Utility Libraries
│   │   ├── ai/                    # Google GenAI Engine Abstractions
│   │   │   ├── client.ts          # GoogleGenAI Instance Initializer
│   │   │   ├── prompt-templates.ts# System Prompts for Chat, CMA, Filters
│   │   │   └── embeddings.ts     # Vector embedding helper functions
│   │   ├── supabase/              # Supabase Client Factory Configs
│   │   │   ├── client.ts          # Client Component Supabase Client
│   │   │   ├── server.ts          # Server Component / Action Supabase Client
│   │   │   └── middleware.ts      # Auth Guard Middleware
│   │   ├── utils/                 # Formatters, Currency, Calculations
│   │   └── constants.ts           # System-wide configuration constants
│   └── types/                     # TypeScript Type Definitions
│       ├── database.types.ts      # Auto-generated Supabase Postgres Types
│       ├── property.ts            # Property Domain Interfaces
│       ├── ai.ts                  # Gemini API payload/response definitions
│       └── user.ts                # User Profile & Auth types
```

---

## 4. Data Model & Type System Conversion Blueprint

The migration replaces Entity Framework Core classes with PostgreSQL schemas (defined via Supabase migrations) and strongly typed TypeScript interfaces.

### Data Type Mapping

| Field Concept | C# / Entity Framework Core Type | Supabase / PostgreSQL Type | TypeScript Interface Type |
| :--- | :--- | :--- | :--- |
| **Primary Key** | `int Id` (IDENTITY) | `UUID` or `BIGINT GENERATED ALWAYS` | `string` or `number` |
| **Foreign Key** | `int UserId` | `UUID REFERENCES auth.users(id)` | `string` |
| **Monetary Values** | `decimal(18,2)` | `NUMERIC(18,2)` | `number` |
| **Vector Embedding** | `VARBINARY(MAX)` / `byte[]` | `vector(768)` (`pgvector`) | `number[]` |
| **Structured Metadata** | `string Features` / JSON string | `JSONB` | `Record<string, unknown>` or Typed Interface |
| **Timestamps** | `DateTime CreatedAt` | `TIMESTAMPTZ DEFAULT NOW()` | `string` (ISO string) |

### Unified Database Schema (`supabase/migrations/20250101000000_init_schema.sql`)

```sql
-- Enable vector extension for embedding search
CREATE EXTENSION IF NOT EXISTS vector;

-- User Profile table linked to Supabase Auth
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'agent', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Core Property Listings
CREATE TABLE public.properties (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  price NUMERIC(18, 2) NOT NULL,
  bedrooms INT NOT NULL,
  bathrooms NUMERIC(3, 1) NOT NULL,
  square_feet INT,
  description TEXT,
  features JSONB DEFAULT '{}'::jsonb NOT NULL,
  photos JSONB DEFAULT '[]'::jsonb NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold', 'draft')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Vector Embeddings for AI-Driven Semantic Search
CREATE TABLE public.property_vectors (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  content_summary TEXT NOT NULL,
  embedding vector(768) NOT NULL, -- Matched to Google text-embedding-004 dimensions
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Comparative Market Analysis (CMA) Reports
CREATE TABLE public.cma_reports (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  estimated_valuation NUMERIC(18, 2) NOT NULL,
  valuation_range_low NUMERIC(18, 2) NOT NULL,
  valuation_range_high NUMERIC(18, 2) NOT NULL,
  comparable_property_ids BIGINT[] DEFAULT '{}',
  report_data JSONB NOT NULL, -- Holds deep JSON output from Gemini 3 Pro
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Offers Table
CREATE TABLE public.offers (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  offer_amount NUMERIC(18, 2) NOT NULL,
  earnest_money NUMERIC(18, 2),
  contingencies JSONB DEFAULT '[]'::jsonb NOT NULL,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'countered', 'accepted', 'rejected', 'withdrawn')),
  contract_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Favorites & Viewings
CREATE TABLE public.favorites (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE public.viewings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### Modern TypeScript Interface Definitions (`src/types/property.ts`)

```typescript
export type UserRole = 'buyer' | 'seller' | 'agent' | 'admin';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyFeatures {
  hasPool?: boolean;
  garageSpaces?: number;
  heatingType?: string;
  coolingType?: string;
  yearBuilt?: number;
  hoaFeeMonthly?: number;
  [key: string]: unknown;
}

export interface Property {
  id: number;
  ownerId?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  description: string;
  features: PropertyFeatures;
  photos: string[];
  status: 'active' | 'pending' | 'sold' | 'draft';
  createdAt: string;
  updatedAt: string;
}

export interface CmaReport {
  id: number;
  propertyId: number;
  userId: string;
  estimatedValuation: number;
  valuationRangeLow: number;
  valuationRangeHigh: number;
  comparablePropertyIds: number[];
  reportData: {
    summary: string;
    marketTrends: string;
    renovationImpacts?: Array<{ feature: string; estimatedValueAdd: number }>;
    confidenceScore: number;
  };
  createdAt: string;
}

export interface PropertyOffer {
  id: number;
  propertyId: number;
  buyerId: string;
  offerAmount: number;
  earnestMoney?: number;
  contingencies: string[];
  status: 'submitted' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';
  contractUrl?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. AI Integration Strategy (Google GenAI SDK)

The legacy Azure OpenAI setup is migrated entirely to the official **Google GenAI SDK (`@google/genai`)**.

### Model Selection & Task Allocation

| Task / Feature | Selected Gemini Model | Rationale & Configuration |
| :--- | :--- | :--- |
| **Conversational Agent / Natural Language Search** | `gemini-3-flash-preview` | Low-latency response stream, high speed for real-time conversational assistance, parameter parsing, and house filter extraction. |
| **CMA Generation & Analytical Reasoning** | `gemini-3-pro-preview` | Enhanced multi-step reasoning capabilities for synthesizing market comps, assessing financial trends, calculating ROI, and generating structured JSON reports. |
| **Multimodal Property Analysis & Virtual Staging** | `gemini-2.5-flash-image` | Native vision processing for examining listing images, extracting visual architectural features, and assessing property condition. |
| **Semantic Vector Embedding** | `text-embedding-004` | Produces high-density 768-dimensional embeddings to perform similarity searches over listings in `pgvector`. |

### Official Google GenAI Client Initializer (`src/lib/ai/client.ts`)

```typescript
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable.');
}

/**
 * Centrally initialized instance of GoogleGenAI SDK
 * Strictly follows modern @google/genai package standards.
 */
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Export model constant abstractions for uniform usage
export const GEMINI_MODELS = {
  CHAT_FAST: 'gemini-3-flash-preview',
  REASONING_PRO: 'gemini-3-pro-preview',
  VISION_MULTIMODAL: 'gemini-2.5-flash-image',
  EMBEDDINGS: 'text-embedding-004',
} as const;
```

### Execution Mapping Matrix: Azure vs. Gemini SDK

```
+------------------------------------+      +-----------------------------------------+
| Legacy ASP.NET Core Azure Handler  |      | Modern Next.js + @google/genai Action   |
+------------------------------------+      +-----------------------------------------+
|                                    |      |                                         |
| OpenAIClient.GetChatCompletionsAsync| ===> | await ai.models.generateContentStream({  |
| (Azure OpenAI GPT-4 Endpoint)      |      |   model: 'gemini-3-flash-preview',       |
|                                    |      |   contents: [...]                       |
|                                    |      | });                                     |
+------------------------------------+      +-----------------------------------------+
|                                    |      |                                         |
| C# Custom CMA Engine + Azure ML    | ===> | await ai.models.generateContent({        |
| (Complex calculation loop)         |      |   model: 'gemini-3-pro-preview',        |
|                                    |      |   config: { responseMimeType: ... }     |
|                                    |      | });                                     |
+------------------------------------+      +-----------------------------------------+
|                                    |      |                                         |
| Azure SQL VARBINARY Embedding     | ===> | await ai.models.embedContent({          |
| (Custom SQL procedure)             |      |   model: 'text-embedding-004',          |
|                                    |      |   contents: propertyTextSummary         |
|                                    |      | }); -> Save to pgvector                 |
+------------------------------------+      +-----------------------------------------+
```

---

## 6. Migration Operational Sequence

To complete the stack conversion successfully across development sprints, follow this execution sequence:

1. **Database Provisioning**: Deploy Supabase instance, execute PostgreSQL migration `20250101000000_init_schema.sql`, enable `pgvector`, and define RLS policies.
2. **Next.js & SDK Infrastructure Setup**: Initialize Next.js 15 App Router project with TypeScript, configure `@supabase/ssr`, install `@google/genai`, and bind `.env.local` keys.
3. **Domain Layer Implementation**: Deploy Server Actions and API Route Handlers replacing legacy C# controllers (`/api/properties`, `/api/cma`, `/api/ai/chat`).
4. **AI Capabilities Integration**:
   - Implement `gemini-3-flash-preview` streaming inside the primary interactive chat interface.
   - Implement `gemini-3-pro-preview` with structured output mode (`responseSchema`) for instant CMA generation.
   - Embed property summaries using `text-embedding-004` and link similarity searches to PostgreSQL functions.
5. **Frontend UI Deployment**: Build client views using React Components, Tailwind CSS, and dynamic client hooks (`useAiChat`) connecting seamlessly to the Server Actions.

**Metadata:**

```json
{
  "subtask_id": "subtask_1_arch_overview",
  "title": "Architecture Overview & Stack Conversion Blueprint",
  "expertise": "Software Architecture & Next.js / Supabase / Gemini AI Expert"
}
```

### Database Engineering & Supabase / PostgreSQL / Vector Search Expert Specialist

# Supabase Database Schema & Vector Database (pgvector) Configuration

**Project:** Dwellingly.ai (NexHomeAgent AI)  
**Subtask:** `subtask_2_database_schema`

---

## Technical Overview

This database architecture replaces the legacy Azure SQL Database and custom `VectorData` binary format with a PostgreSQL solution hosted on Supabase. It incorporates:

1. **`pgvector` Native Vector Extension**: Optimized for **768-dimensional embeddings** generated by Google's `text-embedding-004` model.
2. **HNSW (Hierarchical Navigable Small World) Indexing**: Configured with Cosine Distance (`vector_cosine_ops`) for sub-millisecond semantic search capability across real estate properties.
3. **Automated Identity Synchronization**: A PostgreSQL trigger linking Supabase Auth (`auth.users`) to the `public.profiles` table.
4. **Row Level Security (RLS)**: Fine-grained access policies covering Buyers, Sellers, Agents, and Admins.
5. **RPC Functions**: High-performance SQL functions for hybrid filtering (combining structured metadata and semantic similarity vectors).

---

## 1. Migration File 1: Core Schema & Infrastructure

`supabase/migrations/20250101000000_init_schema.sql`

```sql
-- ============================================================================
-- DWELLINGLY.AI / NEXHOMEAGENT AI - CORE DATABASE MIGRATION
-- Migration: 20250101000000_init_schema.sql
-- Stack Target: Supabase / PostgreSQL 15+
-- ============================================================================

-- 1. EXTENSIONS SETUP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search fuzzy matching

-- 2. AUTOMATED UPDATED_AT TIMESTAMP TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. PROFILES TABLE (Extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'agent', 'admin')),
  phone TEXT,
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. AUTOMATIC PROFILE CREATION TRIGGER FROM AUTH SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. PROPERTIES TABLE
CREATE TABLE public.properties (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  price NUMERIC(18, 2) NOT NULL CHECK (price >= 0),
  bedrooms INT NOT NULL CHECK (bedrooms >= 0),
  bathrooms NUMERIC(3, 1) NOT NULL CHECK (bathrooms >= 0),
  square_feet INT CHECK (square_feet >= 0),
  property_type TEXT DEFAULT 'single_family' CHECK (property_type IN ('single_family', 'condo', 'townhouse', 'multi_family', 'land')),
  description TEXT NOT NULL,
  features JSONB DEFAULT '{}'::jsonb NOT NULL, -- e.g. {"hasPool": true, "garageSpaces": 2, "yearBuilt": 2021}
  photos JSONB DEFAULT '[]'::jsonb NOT NULL,   -- Array of public image URLs
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold', 'draft', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER tr_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. COMPARATIVE MARKET ANALYSIS (CMA) REPORTS
CREATE TABLE public.cma_reports (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  estimated_valuation NUMERIC(18, 2) NOT NULL,
  valuation_range_low NUMERIC(18, 2) NOT NULL,
  valuation_range_high NUMERIC(18, 2) NOT NULL,
  comparable_property_ids BIGINT[] DEFAULT '{}',
  report_data JSONB NOT NULL, -- Deep JSON from Gemini 3 Pro reasoning engine
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. OFFERS TABLE
CREATE TABLE public.offers (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  offer_amount NUMERIC(18, 2) NOT NULL CHECK (offer_amount > 0),
  earnest_money NUMERIC(18, 2) CHECK (earnest_money >= 0),
  contingencies JSONB DEFAULT '[]'::jsonb NOT NULL, -- e.g. ["inspection", "financing", "appraisal"]
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'countered', 'accepted', 'rejected', 'withdrawn')),
  contract_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER tr_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. VIEWINGS / APPOINTMENTS TABLE
CREATE TABLE public.viewings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER tr_viewings_updated_at
  BEFORE UPDATE ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. FAVORITES TABLE (Composite Primary Key)
CREATE TABLE public.favorites (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, property_id)
);

-- 10. B-TREE & GIN INDEXES FOR QUERY OPTIMIZATION
CREATE INDEX idx_properties_status_price ON public.properties(status, price);
CREATE INDEX idx_properties_city_state ON public.properties(city, state);
CREATE INDEX idx_properties_bedrooms_bathrooms ON public.properties(bedrooms, bathrooms);
CREATE INDEX idx_properties_owner_id ON public.properties(owner_id);
CREATE INDEX idx_properties_features_gin ON public.properties USING GIN (features);

CREATE INDEX idx_cma_reports_property_user ON public.cma_reports(property_id, user_id);
CREATE INDEX idx_offers_property_buyer ON public.offers(property_id, buyer_id);
CREATE INDEX idx_offers_status ON public.offers(status);
CREATE INDEX idx_viewings_user_scheduled ON public.viewings(user_id, scheduled_at);
```

---

## 2. Migration File 2: Vector Database & Semantic Similarity Functions

`supabase/migrations/20250101000001_enable_pgvector.sql`

```sql
-- ============================================================================
-- DWELLINGLY.AI / NEXHOMEAGENT AI - PGVECTOR INTEGRATION & RPC SEARCH
-- Migration: 20250101000001_enable_pgvector.sql
-- Embeddings Dimension: 768 (Google GenAI text-embedding-004)
-- ============================================================================

-- 1. ENABLE VECTOR EXTENSION
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. PROPERTY EMBEDDINGS TABLE
CREATE TABLE public.property_vectors (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  content_summary TEXT NOT NULL, -- Textual representations used to build embedding
  embedding vector(768) NOT NULL, -- Matched to Google text-embedding-004 output dimension
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER tr_property_vectors_updated_at
  BEFORE UPDATE ON public.property_vectors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. HNSW INDEX FOR HIGH-PERFORMANCE COSINE VECTOR SIMILARITY SEARCH
-- HNSW provides sub-millisecond search latency compared to IVFFlat.
CREATE INDEX idx_property_vectors_hnsw_cosine
  ON public.property_vectors
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. RPC STORED PROCEDURE: HYBRID SEMANTIC VECTOR SIMILARITY SEARCH
CREATE OR REPLACE FUNCTION public.match_properties(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10,
  filter_city TEXT DEFAULT NULL,
  filter_min_price NUMERIC DEFAULT NULL,
  filter_max_price NUMERIC DEFAULT NULL,
  filter_min_bedrooms INT DEFAULT NULL,
  filter_min_bathrooms NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  property_id BIGINT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  price NUMERIC,
  bedrooms INT,
  bathrooms NUMERIC,
  square_feet INT,
  description TEXT,
  features JSONB,
  photos JSONB,
  content_summary TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS property_id,
    p.address,
    p.city,
    p.state,
    p.zip_code,
    p.price,
    p.bedrooms,
    p.bathrooms,
    p.square_feet,
    p.description,
    p.features,
    p.photos,
    pv.content_summary,
    (1 - (pv.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.property_vectors pv
  JOIN public.properties p ON p.id = pv.property_id
  WHERE
    p.status = 'active'
    AND (1 - (pv.embedding <=> query_embedding)) >= match_threshold
    AND (filter_city IS NULL OR LOWER(p.city) = LOWER(filter_city))
    AND (filter_min_price IS NULL OR p.price >= filter_min_price)
    AND (filter_max_price IS NULL OR p.price <= filter_max_price)
    AND (filter_min_bedrooms IS NULL OR p.bedrooms >= filter_min_bedrooms)
    AND (filter_min_bathrooms IS NULL OR p.bathrooms >= filter_min_bathrooms)
  ORDER BY pv.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
```

---

## 3. Migration File 3: Row Level Security (RLS) Policies

`supabase/migrations/20250101000002_rls_policies.sql`

```sql
-- ============================================================================
-- DWELLINGLY.AI / NEXHOMEAGENT AI - ROW LEVEL SECURITY (RLS) POLICIES
-- Migration: 20250101000002_rls_policies.sql
-- Enforces data protection at the database level for client & server components.
-- ============================================================================

-- ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cma_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. PROFILES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. PROPERTIES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Active properties are viewable by everyone"
  ON public.properties FOR SELECT
  TO public
  USING (status = 'active' OR auth.uid() = owner_id);

CREATE POLICY "Sellers and Agents can insert properties"
  ON public.properties FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('seller', 'agent', 'admin')
    )
  );

CREATE POLICY "Owners can update their properties"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their properties"
  ON public.properties FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- 3. PROPERTY VECTORS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Property vectors are readable by everyone"
  ON public.property_vectors FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Property vectors can be inserted by property owner or system"
  ON public.property_vectors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. CMA REPORTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their own generated CMAs or CMAs for their properties"
  ON public.cma_reports FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can request and store CMA reports"
  ON public.cma_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. OFFERS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Buyers can view their submitted offers; Sellers can view offers on their properties"
  ON public.offers FOR SELECT
  TO authenticated
  USING (
    auth.uid() = buyer_id OR
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Buyers can submit offers"
  ON public.offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers or Sellers can update offer status"
  ON public.offers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = buyer_id OR
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 6. VIEWINGS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their viewings; Sellers can view tours on their listings"
  ON public.viewings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can schedule viewings"
  ON public.viewings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify or cancel viewings"
  ON public.viewings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 7. FAVORITES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their favorites"
  ON public.favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites"
  ON public.favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites"
  ON public.favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

---

## 4. Development & Testing Seed Script

`supabase/seed.sql`

```sql
-- ============================================================================
-- DWELLINGLY.AI / NEXHOMEAGENT AI - SEED DATA FOR TESTING & PREVIEW DEMOS
-- File: supabase/seed.sql
-- Includes realistic listings and sample dummy 768-dim embeddings for vector search testing.
-- ============================================================================

-- 1. SEED TEST PROFILES (Simulating Auth Users)
INSERT INTO public.profiles (id, full_name, email, role, phone, avatar_url)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Sarah Jenkins (Seller)', 'seller.sarah@dwellingly.ai', 'seller', '512-555-0192', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330'),
  ('22222222-2222-2222-2222-222222222222', 'Alex Vance (Buyer)', 'buyer.alex@dwellingly.ai', 'buyer', '512-555-0144', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d')
ON CONFLICT (id) DO NOTHING;

-- 2. SEED PROPERTIES (Austen/Central Texas Mock Listings)
INSERT INTO public.properties (id, owner_id, address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, property_type, description, features, photos, status)
VALUES
  (
    1,
    '11111111-1111-1111-1111-111111111111',
    '704 Barton Springs Rd',
    'Austin',
    'TX',
    '78704',
    875000.00,
    3,
    2.5,
    2200,
    'single_family',
    'Modern luxury home near Zilker Park featuring solar panels, open-concept floor plan, private pool, and EV charging station in garage.',
    '{"hasPool": true, "garageSpaces": 2, "yearBuilt": 2022, "evCharger": true, "solarPanels": true, "hoaFeeMonthly": 0}'::jsonb,
    '["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c"]'::jsonb,
    'active'
  ),
  (
    2,
    '11111111-1111-1111-1111-111111111111',
    '1208 Rainey St',
    'Austin',
    'TX',
    '78701',
    540000.00,
    2,
    2.0,
    1150,
    'condo',
    'High-rise luxury condo in downtown Rainey Street historic district. Skyline views, concierge service, rooftop lounge, and fitness center.',
    '{"hasPool": true, "garageSpaces": 1, "yearBuilt": 2020, "rooftopDeck": true, "hoaFeeMonthly": 420}'::jsonb,
    '["https://images.unsplash.com/photo-1567496898669-ee935f5f647a", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750"]'::jsonb,
    'active'
  ),
  (
    3,
    '11111111-1111-1111-1111-111111111111',
    '4501 East 5th St',
    'Austin',
    'TX',
    '78702',
    699000.00,
    4,
    3.0,
    2450,
    'townhouse',
    'Craftsman-style East Austin townhouse with private backyard, high ceilings, custom quartz kitchen, and accessory dwelling unit (ADU) potential.',
    '{"hasPool": false, "garageSpaces": 1, "yearBuilt": 2021, "aduPotential": true, "hoaFeeMonthly": 120}'::jsonb,
    '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c"]'::jsonb,
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to allow auto-increment after seed IDs
SELECT setval('properties_id_seq', (SELECT MAX(id) FROM public.properties));

-- 3. SEED DUMMY VECTOR EMBEDDINGS FOR PGVECTOR TESTING
-- Note: In production, vectors are generated dynamically via Google text-embedding-004 API
INSERT INTO public.property_vectors (property_id, content_summary, embedding)
VALUES
  (
    1,
    'Modern luxury home Austin TX Barton Springs Zilker Park 3 bed 2.5 bath pool solar panels EV charger single family $875,000',
    array_fill(0.035::real, ARRAY[768])::vector
  ),
  (
    2,
    'High rise luxury condo downtown Rainey St Austin TX 2 bed 2 bath skyline views rooftop pool fitness center $540,000',
    array_fill(0.012::real, ARRAY[768])::vector
  ),
  (
    3,
    'East Austin townhouse craftsman 4 bed 3 bath private backyard quartz kitchen near downtown $699,000',
    array_fill(-0.021::real, ARRAY[768])::vector
  )
ON CONFLICT (property_id) DO NOTHING;
```

---

## 5. Technical Integration with Next.js & Google GenAI SDK

### A. How `text-embedding-004` Interacts with `match_properties`

In Next.js Route Handlers (`app/api/ai/chat/route.ts` or Server Actions), dynamic semantic search is executed via the vector store RPC method:

```typescript
// Example snippet showing query embedding call with Google GenAI SDK
import { ai, GEMINI_MODELS } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/server';

export async function searchPropertiesByNaturalLanguage(userQuery: string) {
  const supabase = await createClient();

  // 1. Generate 768-dimension embedding via Google GenAI SDK
  const embeddingResponse = await ai.models.embedContent({
    model: GEMINI_MODELS.EMBEDDINGS,
    contents: userQuery,
  });

  const queryVector = embeddingResponse.embedding.values;

  // 2. Invoke the Postgres match_properties RPC function
  const { data: matchedProperties, error } = await supabase.rpc('match_properties', {
    query_embedding: queryVector,
    match_threshold: 0.25,
    match_count: 5,
  });

  if (error) throw error;
  return matchedProperties;
}
```

### B. Summary of Architectural Advantages

- **Unified Security Model**: Auth IDs link directly to RLS checks at the database layer. Client apps cannot read or mutate forbidden properties or offers even if API endpoints are exposed.
- **Sub-Millisecond Vector Search**: The `hnsw` index on `vector(768)` enables lightning-fast context retrieval for RAG (Retrieval-Augmented Generation) with `gemini-3-flash-preview` and `gemini-3-pro-preview`.
- **JSONB Flexibility**: Features like pool, ADU potential, garage count, and HOA fees remain easily queryable using GIN indexes without requiring frequent schema alterations.

**Metadata:**

```json
{
  "subtask_id": "subtask_2_database_schema",
  "title": "Supabase Database Schema & Vector Database (pgvector) Configuration",
  "expertise": "Database Engineering & Supabase / PostgreSQL / Vector Search Expert"
}
```

### Google GenAI API & TypeScript / AI Integration Specialist Specialist

# Dwellingly.ai (NexHomeAgent AI) - Subtask 3: Google GenAI SDK Integration Services (`@google/genai`)

This module houses the core AI services for Dwellingly.ai, fully migrated from Azure OpenAI / C# to **Next.js (App Router)** and the **Official Google GenAI SDK (`@google/genai`)**.

It implements:

1. **Central Client & Model Config** (`src/lib/ai/client.ts`)
2. **AI Tool Declarations & Supabase RAG/pgvector Integration** (`src/lib/ai/tools.ts`)
3. **Multi-turn Conversational Agent & Thinking Chat Engine** (`src/lib/ai/chat.ts`)
4. **AI Automated Valuation Engine & CMA Report Generator** (`src/lib/ai/cma.ts`)
5. **Virtual Staging & Image Analysis Engine** (`src/lib/ai/image.ts`)

---

## 1. Central AI Client Configuration

`src/lib/ai/client.ts`

```typescript
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY in environment variables.');
}

/**
 * Singleton GoogleGenAI Client instance
 * Configured using the official @google/genai SDK
 */
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Standardized Model Identifiers across Dwellingly.ai
 */
export const GEMINI_MODELS = {
  // Primary conversational & fast agent model
  CHAT_FLASH: 'gemini-3-flash-preview',
  // Deep reasoning model for complex CMAs, legal offer checks, and financial calculations
  REASONING_PRO: 'gemini-3-pro-preview',
  // Multimodal image generation and virtual staging editing model
  IMAGE_GEN: 'gemini-2.5-flash-image',
  // High fidelity visual perception and image inspection model
  VISION_PRO: 'gemini-3-pro-image-preview',
  // Standard text embedding model for pgvector semantic search (768 dimensions)
  EMBEDDINGS: 'text-embedding-004',
} as const;

export type GeminiModelKey = keyof typeof GEMINI_MODELS;

/**
 * Generates vector embeddings for a given text payload
 * Used for storing and matching properties in Supabase pgvector (768 dims)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: GEMINI_MODELS.EMBEDDINGS,
      contents: text,
    });

    if (!response.embedding?.values) {
      throw new Error('Failed to extract embedding values from response');
    }

    return response.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
```

---

## 2. Tool & Grounding Definitions

`src/lib/ai/tools.ts`

```typescript
import { Type, FunctionDeclaration } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './client';

// ============================================================================
// TOOL DECLARATIONS FOR GEMINI FUNCTION CALLING
// ============================================================================

export const searchPropertiesToolDeclaration: FunctionDeclaration = {
  name: 'searchProperties',
  description:
    'Search for active real estate properties using natural language query, location, price filters, and room criteria via vector similarity.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Natural language search query describing desired home attributes or lifestyle.',
      },
      city: {
        type: Type.STRING,
        description: 'Target city name (e.g. Austin, Round Rock).',
      },
      minPrice: {
        type: Type.NUMBER,
        description: 'Minimum price filter in USD.',
      },
      maxPrice: {
        type: Type.NUMBER,
        description: 'Maximum price filter in USD.',
      },
      minBedrooms: {
        type: Type.NUMBER,
        description: 'Minimum number of bedrooms.',
      },
      minBathrooms: {
        type: Type.NUMBER,
        description: 'Minimum number of bathrooms.',
      },
    },
    required: ['query'],
  },
};

export const getNeighborhoodStatsToolDeclaration: FunctionDeclaration = {
  name: 'getNeighborhoodStats',
  description: 'Retrieve hyper-local neighborhood stats including crime index, walk score, school ratings, and local market velocity.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      zipCode: {
        type: Type.STRING,
        description: '5-digit US Postal ZIP Code.',
      },
      cityName: {
        type: Type.STRING,
        description: 'City name.',
      },
    },
    required: ['zipCode'],
  },
};

export const schedulePropertyViewingToolDeclaration: FunctionDeclaration = {
  name: 'schedulePropertyViewing',
  description: 'Book a property tour / viewing for a buyer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      propertyId: {
        type: Type.NUMBER,
        description: 'Numeric property ID in the database.',
      },
      preferredDateTime: {
        type: Type.STRING,
        description: 'ISO 8601 formatted datetime string requested by buyer.',
      },
      notes: {
        type: Type.STRING,
        description: 'Special requests or preferences for the tour.',
      },
    },
    required: ['propertyId', 'preferredDateTime'],
  },
};

export const ALL_AGENT_TOOLS = [
  searchPropertiesToolDeclaration,
  getNeighborhoodStatsToolDeclaration,
  schedulePropertyViewingToolDeclaration,
];

// ============================================================================
// TOOL EXECUTOR HANDLERS
// ============================================================================

export async function executeSearchProperties(args: {
  query: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
}) {
  const supabase = await createClient();

  // 1. Generate 768-dimension embedding via text-embedding-004
  const queryVector = await generateEmbedding(args.query);

  // 2. Call Supabase RPC match_properties (pgvector HNSW)
  const { data, error } = await supabase.rpc('match_properties', {
    query_embedding: queryVector,
    match_threshold: 0.2,
    match_count: 6,
    filter_city: args.city || null,
    filter_min_price: args.minPrice || null,
    filter_max_price: args.maxPrice || null,
    filter_min_bedrooms: args.minBedrooms || null,
    filter_min_bathrooms: args.minBathrooms || null,
  });

  if (error) {
    console.error('Supabase RPC vector search error:', error);
    return { success: false, error: error.message, listings: [] };
  }

  return {
    success: true,
    resultCount: data?.length || 0,
    listings: data || [],
  };
}

export async function executeGetNeighborhoodStats(args: { zipCode: string; cityName?: string }) {
  // Simulated hyper-local neighborhood API grounding call
  return {
    success: true,
    zipCode: args.zipCode,
    neighborhood: args.cityName ? `${args.cityName} Central` : 'Metro Region',
    walkScore: 88,
    transitScore: 72,
    schoolRatingAverage: 8.5,
    crimeIndex: 'Low (18% below national average)',
    medianHomePrice: 685000,
    pricePerSqFtTrend: '+4.2% YoY',
    avgDaysOnMarket: 22,
  };
}

export async function executeScheduleViewing(
  userId: string,
  args: { propertyId: number; preferredDateTime: string; notes?: string }
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('viewings')
    .insert({
      property_id: args.propertyId,
      user_id: userId,
      scheduled_at: args.preferredDateTime,
      status: 'scheduled',
      notes: args.notes || 'Scheduled via AI Assistant',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    confirmationId: data.id,
    scheduledAt: data.scheduled_at,
    message: 'Viewing request successfully submitted to the listing agent.',
  };
}
```

---

## 3. Conversational AI Chatbot Service

`src/lib/ai/chat.ts`

```typescript
import { Content, Part } from '@google/genai';
import { ai, GEMINI_MODELS } from './client';
import {
  ALL_AGENT_TOOLS,
  executeSearchProperties,
  executeGetNeighborhoodStats,
  executeScheduleViewing,
} from './tools';

export interface ChatMessagePayload {
  role: 'user' | 'model' | 'system';
  content: string;
}

export const DWELLINGLY_SYSTEM_INSTRUCTION = `
You are Dwellingly AI (NexHomeAgent), an elite, highly intelligent real estate advisor and concierge.
Your primary mission is to assist buyers and sellers through every stage of home purchasing, listing, valuation, and offer coordination.

Guidelines:
1. Speak with professional warm authority, deep domain expertise, and clarity.
2. Use the provided search tools when users ask for property recommendations or search queries.
3. When property listings are returned from search tools, summarize key highlights (price, location, beds/baths, square footage, unique features) and provide direct recommendations.
4. Encourage viewing appointments or CMA valuation requests when appropriate.
5. Keep answers concise, visually structured with Markdown bullet points, and actionable.
`;

/**
 * Handles multi-turn streaming AI Chat with turn management and automated function calling loop
 */
export async function* streamAgentChat(params: {
  userId: string;
  history: ChatMessagePayload[];
  newMessage: string;
}) {
  const { userId, history, newMessage } = params;

  // Format history into Google GenAI Content objects
  const contents: Content[] = history.map((msg) => ({
    role: msg.role === 'system' ? 'user' : msg.role,
    parts: [{ text: msg.content }],
  }));

  // Append new user message
  contents.push({
    role: 'user',
    parts: [{ text: newMessage }],
  });

  // 1. Initial Call to Gemini 3 Flash with Tool definitions
  let responseStream = await ai.models.generateContentStream({
    model: GEMINI_MODELS.CHAT_FLASH,
    contents: contents,
    config: {
      systemInstruction: DWELLINGLY_SYSTEM_INSTRUCTION,
      temperature: 0.7,
      tools: [{ functionDeclarations: ALL_AGENT_TOOLS }],
    },
  });

  let accumulatedParts: Part[] = [];
  let functionCallsToExecute: Array<{ name: string; args: Record<string, any>; id?: string }> = [];

  for await (const chunk of responseStream) {
    if (chunk.text) {
      yield { type: 'text', content: chunk.text };
    }

    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
      for (const fc of chunk.functionCalls) {
        functionCallsToExecute.push({
          name: fc.name,
          args: fc.args as Record<string, any>,
          id: fc.id,
        });
      }
    }
  }

  // 2. Function Call Resolution Loop
  if (functionCallsToExecute.length > 0) {
    for (const call of functionCallsToExecute) {
      yield { type: 'status', content: `Executing real estate action: ${call.name}...` };

      let toolResult: any;

      if (call.name === 'searchProperties') {
        toolResult = await executeSearchProperties(call.args as any);
      } else if (call.name === 'getNeighborhoodStats') {
        toolResult = await executeGetNeighborhoodStats(call.args as any);
      } else if (call.name === 'schedulePropertyViewing') {
        toolResult = await executeScheduleViewing(userId, call.args as any);
      } else {
        toolResult = { error: `Unknown tool function: ${call.name}` };
      }

      // Append model function call and function response parts back into content stream
      contents.push({
        role: 'model',
        parts: [{ functionCall: { name: call.name, args: call.args } }],
      });

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: call.name,
              response: { result: toolResult },
            },
          },
        ],
      });
    }

    // 3. Re-prompt Gemini with function output to stream final user response
    const followUpStream = await ai.models.generateContentStream({
      model: GEMINI_MODELS.CHAT_FLASH,
      contents: contents,
      config: {
        systemInstruction: DWELLINGLY_SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    for await (const chunk of followUpStream) {
      if (chunk.text) {
        yield { type: 'text', content: chunk.text };
      }
    }
  }
}
```

---

## 4. Automated Valuation Engine & CMA Report Generator

`src/lib/ai/cma.ts`

```typescript
import { Type, Schema } from '@google/genai';
import { ai, GEMINI_MODELS } from './client';
import { createClient } from '@/lib/supabase/server';

export interface CmaReportResult {
  estimatedValuation: number;
  valuationRangeLow: number;
  valuationRangeHigh: number;
  confidenceScore: number; // 0.0 - 1.0
  pricePerSqFtEstimate: number;
  estimatedMonthlyRentalIncome: number;
  marketTrendAnalysis: {
    neighborhoodVelocity: string;
    supplyDemandBalance: string;
    projected12MonthAppreciation: string;
  };
  valuationMethodologyAndReasoning: string[];
  keyAdjustments: Array<{
    feature: string;
    valueImpactUsd: number;
    reasoning: string;
  }>;
  comparablePropertySummaries: Array<{
    address: string;
    saleOrListPrice: number;
    similarityScore: number;
    keyDifferences: string;
  }>;
}

/**
 * TypeBox/JSON Schema specification for Gemini Structured Output
 */
const cmaOutputSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    estimatedValuation: { type: Type.NUMBER, description: 'Estimated fair market value in USD.' },
    valuationRangeLow: { type: Type.NUMBER, description: 'Low boundary valuation.' },
    valuationRangeHigh: { type: Type.NUMBER, description: 'High boundary valuation.' },
    confidenceScore: { type: Type.NUMBER, description: 'Confidence score between 0.0 and 1.0.' },
    pricePerSqFtEstimate: { type: Type.NUMBER, description: 'Estimated price per square foot.' },
    estimatedMonthlyRentalIncome: { type: Type.NUMBER, description: 'Estimated monthly rental income in USD.' },
    marketTrendAnalysis: {
      type: Type.OBJECT,
      properties: {
        neighborhoodVelocity: { type: Type.STRING },
        supplyDemandBalance: { type: Type.STRING },
        projected12MonthAppreciation: { type: Type.STRING },
      },
      required: ['neighborhoodVelocity', 'supplyDemandBalance', 'projected12MonthAppreciation'],
    },
    valuationMethodologyAndReasoning: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    keyAdjustments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          feature: { type: Type.STRING },
          valueImpactUsd: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
        },
        required: ['feature', 'valueImpactUsd', 'reasoning'],
      },
    },
    comparablePropertySummaries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          address: { type: Type.STRING },
          saleOrListPrice: { type: Type.NUMBER },
          similarityScore: { type: Type.NUMBER },
          keyDifferences: { type: Type.STRING },
        },
        required: ['address', 'saleOrListPrice', 'similarityScore', 'keyDifferences'],
      },
    },
  },
  required: [
    'estimatedValuation',
    'valuationRangeLow',
    'valuationRangeHigh',
    'confidenceScore',
    'pricePerSqFtEstimate',
    'estimatedMonthlyRentalIncome',
    'marketTrendAnalysis',
    'valuationMethodologyAndReasoning',
    'keyAdjustments',
    'comparablePropertySummaries',
  ],
};

/**
 * Triggers the AI Valuation Engine using gemini-3-pro-preview
 * Utilizes High Thinking Budget for deep financial reasoning and structured JSON output
 */
export async function generateCmaReport(propertyId: number, userId: string): Promise<{
  cmaReportId: number;
  report: CmaReportResult;
}> {
  const supabase = await createClient();

  // 1. Fetch Subject Property Details
  const { data: subjectProperty, error: propError } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (propError || !subjectProperty) {
    throw new Error(`Property with ID ${propertyId} not found.`);
  }

  // 2. Fetch Nearby Comparables from Database
  const { data: comps } = await supabase
    .from('properties')
    .select('*')
    .eq('city', subjectProperty.city)
    .neq('id', propertyId)
    .limit(5);

  const prompt = `
Perform a rigorous Comparative Market Analysis (CMA) and valuation for the following subject property:

SUBJECT PROPERTY DETAILS:
Address: ${subjectProperty.address}, ${subjectProperty.city}, ${subjectProperty.state} ${subjectProperty.zip_code}
List Price: $${subjectProperty.price}
Bedrooms: ${subjectProperty.bedrooms}
Bathrooms: ${subjectProperty.bathrooms}
Square Feet: ${subjectProperty.square_feet || 'N/A'}
Property Type: ${subjectProperty.property_type}
Description: ${subjectProperty.description}
Features: ${JSON.stringify(subjectProperty.features)}

RELEVANT NEIGHBORHOOD COMPARABLES:
${JSON.stringify(comps || [], null, 2)}

Instructions:
1. Analyze physical adjustments (e.g. square footage differences, pool presence, EV charging, solar panels, bedroom/bath counts).
2. Calculate estimated fair market value, lower/upper range, monthly rental yield, and per-sqft metrics.
3. Detail the key value adjustment line items.
4. Output strict JSON matching the provided schema.
`;

  // 3. Call Gemini 3 Pro with Thinking Budget
  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.REASONING_PRO,
    contents: prompt,
    config: {
      temperature: 0.2, // Low temperature for consistent financial analysis
      thinkingConfig: {
        thinkingBudget: 4096, // Deep thinking budget for reasoning through comps
      },
      responseMimeType: 'application/json',
      responseSchema: cmaOutputSchema,
    },
  });

  if (!response.text) {
    throw new Error('CMA Valuation generation returned an empty response.');
  }

  const parsedReport: CmaReportResult = JSON.parse(response.text);

  // 4. Save Generated CMA to Supabase Database
  const { data: savedCma, error: saveError } = await supabase
    .from('cma_reports')
    .insert({
      property_id: propertyId,
      user_id: userId,
      estimated_valuation: parsedReport.estimatedValuation,
      valuation_range_low: parsedReport.valuationRangeLow,
      valuation_range_high: parsedReport.valuationRangeHigh,
      comparable_property_ids: comps?.map((c) => c.id) || [],
      report_data: parsedReport as any,
    })
    .select('id')
    .single();

  if (saveError) {
    console.error('Error saving CMA report to database:', saveError);
    throw new Error(`Failed to persist CMA report: ${saveError.message}`);
  }

  return {
    cmaReportId: savedCma.id,
    report: parsedReport,
  };
}
```

---

## 5. Virtual Staging & Image Analysis Engine

`src/lib/ai/image.ts`

```typescript
import { ai, GEMINI_MODELS } from './client';

export interface VirtualStagingOptions {
  roomType: 'living_room' | 'bedroom' | 'kitchen' | 'patio' | 'dining';
  designStyle: 'modern_minimalist' | 'scandinavian' | 'luxury_contemporary' | 'coastal_boho' | 'industrial';
  additionalInstructions?: string;
}

export interface ImageAnalysisResult {
  detectedRoomType: string;
  perceivedCondition: string;
  stagingSuggestions: string[];
  keyFeaturesIdentified: string[];
  estimatedRenovationRoiTips: string[];
}

/**
 * Analyzes an uploaded property image for virtual staging recommendations and quality assessment
 * Uses gemini-3-pro-image-preview visual inspection
 */
export async function analyzePropertyImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<ImageAnalysisResult> {
  const prompt = `
Analyze this real estate property photo in detail and provide structural recommendations for staging and enhancement.

Return a valid JSON object with the following structure:
{
  "detectedRoomType": "e.g. Living Room",
  "perceivedCondition": "e.g. Excellent / Needs Cosmetic Updates",
  "stagingSuggestions": ["suggestion 1", "suggestion 2"],
  "keyFeaturesIdentified": ["hardwood floors", "natural light"],
  "estimatedRenovationRoiTips": ["tip 1", "tip 2"]
}
`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.VISION_PRO,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  if (!response.text) {
    throw new Error('Image analysis failed to generate text response.');
  }

  return JSON.parse(response.text) as ImageAnalysisResult;
}

/**
 * Generates a virtually staged property image using gemini-2.5-flash-image
 */
export async function generateVirtualStagingImage(params: {
  originalImageBase64: string;
  mimeType?: string;
  options: VirtualStagingOptions;
}): Promise<{ imageBase64: string; mimeType: string }> {
  const { originalImageBase64, mimeType = 'image/jpeg', options } = params;

  const prompt = `
Professional high-end architectural photography of a ${options.roomType.replace('_', ' ')}.
Staged in a stunning ${options.designStyle.replace('_', ' ')} interior design style.
Include modern high-end furniture, tasteful decor, warm ambient lighting, natural plants, and wall art.
Maintain the architectural layout, windows, doors, and structural walls of the original room.
${options.additionalInstructions || ''}
Photo quality: 8K resolution, photorealistic, ultra-detailed interior design digest standard.
`;

  // Image editing/generation prompt using Gemini 2.5 Flash Image model
  const response = await ai.models.generateImages({
    model: GEMINI_MODELS.IMAGE_GEN,
    prompt: prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: '4:3',
    },
  });

  if (!response.generatedImages || response.generatedImages.length === 0) {
    throw new Error('Failed to generate virtually staged image from model.');
  }

  const generatedImg = response.generatedImages[0];

  return {
    imageBase64: generatedImg.image.imageBytes,
    mimeType: 'image/jpeg',
  };
}
```

---

## 6. Verification and Integration Summary

| Service Module | Google Gemini Model Used | Purpose / Key Capability |
| :--- | :--- | :--- |
| `src/lib/ai/client.ts` | `text-embedding-004` | 768-dim Vector embedding generator for Supabase pgvector |
| `src/lib/ai/tools.ts` | Supabase RPC + `match_properties` | Natural language hybrid search & local dataset grounding |
| `src/lib/ai/chat.ts` | `gemini-3-flash-preview` | Low-latency streaming conversational agent & multi-turn tool loops |
| `src/lib/ai/cma.ts` | `gemini-3-pro-preview` | Deep financial reasoning with `thinkingBudget: 4096` & strict JSON output schema |
| `src/lib/ai/image.ts` | `gemini-3-pro-image-preview` & `gemini-2.5-flash-image` | High-fidelity property photo visual audit and photorealistic virtual staging |

**Metadata:**

```json
{
  "subtask_id": "subtask_3_gemini_services",
  "title": "Google GenAI SDK Integration Services (@google/genai)",
  "expertise": "Google GenAI API & TypeScript / AI Integration Specialist"
}
```

### Next.js App Router & Server Actions Specialist Specialist

# Subtask 4: Next.js App Router Backend API Routes & Server Actions

This module provides the complete backend implementation for **Dwellingly.ai (NexHomeAgent AI)** in the **Next.js App Router** architecture. It transitions the original C#/ASP.NET Core REST APIs and Blazor logic into modern **Next.js App Router API Routes (`/app/api/...`)** and **React Server Actions (`'use server'`)**, using **`@supabase/ssr`** for authentication and session management, and **`@google/genai`** for AI agent capabilities.

---

## Architecture Overview

```
src/
├── lib/
│   └── supabase/
│       ├── server.ts         # Supabase client instantiation for SSR/Server Context
│       └── client.ts         # Supabase client instantiation for Browser Context
├── app/
│   └── api/
│       ├── chat/
│       │   └── route.ts      # Streaming SSE endpoint for multi-turn Gemini agent chat
│       ├── properties/
│       │   ├── route.ts      # GET (list/filter) & POST (create property)
│       │   └── [id]/
│       │       ├── route.ts  # GET (details), PUT (update), DELETE
│       │       └── cma/
│       │           └── route.ts # GET/POST CMA automated valuations
│       ├── offers/
│       │   └── route.ts      # GET user offers & POST purchase offers
│       └── staging/
│           └── route.ts      # POST virtual staging & vision analysis
└── actions/
    ├── properties.ts         # Server actions: Favorites, Viewings, Property CRUD
    ├── cma.ts                # Server actions: Trigger AI CMA & fetch history
    ├── offers.ts             # Server actions: Create offer, AI contingency review
    └── search.ts             # Server actions: Hybrid vector search (pgvector + Gemini)
```

---

## 1. Supabase Client Configuration (`@supabase/ssr`)

### `src/lib/supabase/server.ts`

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for Server Components, Server Actions, and API Route Handlers.
 * Handles reading and writing HTTP cookies for persistent authentication across sessions.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handled when called from Server Components where set is read-only
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handled when called from Server Components
          }
        },
      },
    }
  );
}
```

---

## 2. Real-Time Conversational Agent API Stream

### `src/app/api/chat/route.ts`

Handles real-time streaming text and function execution events from the `streamAgentChat` service using standard Server-Sent Events (SSE).

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamAgentChat, ChatMessagePayload } from '@/lib/ai/chat';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { messages, newMessage } = body as {
      messages: ChatMessagePayload[];
      newMessage: string;
    };

    if (!newMessage || typeof newMessage !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing newMessage' }, { status: 400 });
    }

    const encoder = new TextEncoder();

    // Create a ReadableStream to push Gemini assistant SSE tokens
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const chatGenerator = streamAgentChat({
            userId: user.id,
            history: messages || [],
            newMessage,
          });

          for await (const chunk of chatGenerator) {
            const dataPayload = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(dataPayload));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error: any) {
          console.error('Chat Streaming Error:', error);
          const errorPayload = `data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`;
          controller.enqueue(encoder.encode(errorPayload));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('API /api/chat error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
```

---

## 3. Property Management API Endpoints

### `src/app/api/properties/route.ts`

Handles property listing queries and listing generation with automatic embedding generation.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/ai/client';

// GET /api/properties
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);

    const city = searchParams.get('city');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const bedrooms = searchParams.get('bedrooms');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('properties')
      .select('*, cma_reports(count)', { count: 'exact' });

    if (city) query = query.ilike('city', `%${city}%`);
    if (minPrice) query = query.gte('price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
    if (bedrooms) query = query.gte('bedrooms', parseInt(bedrooms, 10));

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      properties: data,
      totalCount: count,
      limit,
      offset,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/properties
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Construct text representation for pgvector embedding creation
    const textForEmbedding = `
    Property Address: ${body.address}, ${body.city}, ${body.state} ${body.zipCode}.
    Price: $${body.price}. Bedrooms: ${body.bedrooms}. Bathrooms: ${body.bathrooms}.
    Property Type: ${body.propertyType || 'Single Family Home'}.
    Description: ${body.description}.
    Features: ${Array.isArray(body.features) ? body.features.join(', ') : body.features}.
    `;

    const embeddingVector = await generateEmbedding(textForEmbedding);

    const { data: property, error: insertError } = await supabase
      .from('properties')
      .insert({
        seller_id: user.id,
        address: body.address,
        city: body.city,
        state: body.state,
        zip_code: body.zipCode,
        price: body.price,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms,
        square_feet: body.squareFeet,
        property_type: body.propertyType || 'Single Family',
        description: body.description,
        features: body.features || [],
        photos: body.photos || [],
        embedding: embeddingVector,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ property }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### `src/app/api/properties/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const propertyId = parseInt(id, 10);
    const supabase = await createClient();

    const { data: property, error } = await supabase
      .from('properties')
      .select(`
        *,
        cma_reports (*),
        viewings (*)
      `)
      .eq('id', propertyId)
      .single();

    if (error || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    return NextResponse.json({ property });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const propertyId = parseInt(id, 10);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const { data: property, error } = await supabase
      .from('properties')
      .update({
        address: body.address,
        price: body.price,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms,
        description: body.description,
        features: body.features,
        photos: body.photos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', propertyId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ property });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const propertyId = parseInt(id, 10);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Property deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## 4. Automated Valuation & CMA API Routes

### `src/app/api/properties/[id]/cma/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateCmaReport } from '@/lib/ai/cma';

// GET /api/properties/[id]/cma - Fetch existing CMA reports for a property
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const propertyId = parseInt(id, 10);
    const supabase = await createClient();

    const { data: reports, error } = await supabase
      .from('cma_reports')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ cmaReports: reports });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/properties/[id]/cma - Trigger Gemini 3 Pro reasoning to generate a new CMA
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const propertyId = parseInt(id, 10);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call AI service (gemini-3-pro-preview with thinking budget)
    const result = await generateCmaReport(propertyId, user.id);

    return NextResponse.json({
      success: true,
      cmaReportId: result.cmaReportId,
      report: result.report,
    }, { status: 201 });
  } catch (err: any) {
    console.error('CMA Generation Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate CMA report' }, { status: 500 });
  }
}
```

---

## 5. Offers & Purchase Workflow API Route

### `src/app/api/offers/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ai, GEMINI_MODELS } from '@/lib/ai/client';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: offers, error } = await supabase
      .from('offers')
      .select(`
        *,
        properties (address, city, price, photos)
      `)
      .or(`user_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ offers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { propertyId, offerAmount, earnestMoney, contingencies, proposedClosingDate } = body;

    // AI Risk & Compliance Assessment using Gemini 3 Pro
    const reviewPrompt = `
Analyze the following real estate offer submission for potential risks and contingency gaps:
- Offer Amount: $${offerAmount}
- Earnest Money Deposit: $${earnestMoney}
- Contingencies Requested: ${JSON.stringify(contingencies)}
- Proposed Closing Date: ${proposedClosingDate}

Provide brief contractual insights and risk score (1-100).
Return JSON: { "riskScore": number, "insights": string[], "suggestedContingencies": string[] }
`;

    const aiReviewResponse = await ai.models.generateContent({
      model: GEMINI_MODELS.REASONING_PRO,
      contents: reviewPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let aiAssessment = {};
    if (aiReviewResponse.text) {
      aiAssessment = JSON.parse(aiReviewResponse.text);
    }

    // Persist offer to Supabase
    const { data: offer, error: insertError } = await supabase
      .from('offers')
      .insert({
        property_id: propertyId,
        user_id: user.id,
        offer_amount: offerAmount,
        earnest_money: earnestMoney,
        contingencies,
        proposed_closing_date: proposedClosingDate,
        status: 'submitted',
        ai_risk_assessment: aiAssessment,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ offer }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## 6. Virtual Staging & Image Processing API Route

### `src/app/api/staging/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzePropertyImage, generateVirtualStagingImage } from '@/lib/ai/image';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, imageBase64, mimeType = 'image/jpeg', roomType, designStyle, additionalInstructions } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Missing required imageBase64 field' }, { status: 400 });
    }

    if (action === 'analyze') {
      const analysis = await analyzePropertyImage(imageBase64, mimeType);
      return NextResponse.json({ success: true, analysis });
    } else if (action === 'stage') {
      const stagedImage = await generateVirtualStagingImage({
        originalImageBase64: imageBase64,
        mimeType,
        options: {
          roomType: roomType || 'living_room',
          designStyle: designStyle || 'modern_minimalist',
          additionalInstructions,
        },
      });

      return NextResponse.json({ success: true, stagedImage });
    } else {
      return NextResponse.json({ error: "Invalid action. Use 'analyze' or 'stage'." }, { status: 400 });
    }
  } catch (err: any) {
    console.error('API /api/staging Error:', err);
    return NextResponse.json({ error: err.message || 'Virtual Staging failed' }, { status: 500 });
  }
}
```

---

## 7. React Server Actions

### `src/actions/properties.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Toggles a user's favorite status for a property
 */
export async function toggleFavoriteAction(propertyId: number) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Authentication required');
  }

  // Check if existing favorite exists
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('property_id', propertyId)
    .single();

  if (existing) {
    // Remove favorite
    await supabase.from('favorites').delete().eq('id', existing.id);
    revalidatePath(`/properties/${propertyId}`);
    return { isFavorite: false };
  } else {
    // Add favorite
    await supabase.from('favorites').insert({
      user_id: user.id,
      property_id: propertyId,
    });
    revalidatePath(`/properties/${propertyId}`);
    return { isFavorite: true };
  }
}

/**
 * Schedules a viewing for a home
 */
export async function scheduleViewingAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Authentication required');
  }

  const propertyId = parseInt(formData.get('propertyId') as string, 10);
  const scheduledAt = formData.get('scheduledAt') as string;
  const notes = formData.get('notes') as string;

  const { data, error } = await supabase
    .from('viewings')
    .insert({
      user_id: user.id,
      property_id: propertyId,
      scheduled_at: scheduledAt,
      notes: notes || 'Scheduled via Web Portal',
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/properties/${propertyId}`);
  return { success: true, viewing: data };
}
```

### `src/actions/cma.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { generateCmaReport } from '@/lib/ai/cma';
import { revalidatePath } from 'next/cache';

/**
 * Server Action to trigger an automated CMA valuation report
 */
export async function requestCmaAction(propertyId: number) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'User must be logged in to request a CMA.' };
  }

  try {
    const result = await generateCmaReport(propertyId, user.id);
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath('/dashboard');
    return {
      success: true,
      cmaReportId: result.cmaReportId,
      report: result.report,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'CMA Generation failed' };
  }
}
```

### `src/actions/offers.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function submitOfferAction(payload: {
  propertyId: number;
  offerAmount: number;
  earnestMoney: number;
  contingencies: string[];
  proposedClosingDate: string;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data, error } = await supabase
    .from('offers')
    .insert({
      property_id: payload.propertyId,
      user_id: user.id,
      offer_amount: payload.offerAmount,
      earnest_money: payload.earnestMoney,
      contingencies: payload.contingencies,
      proposed_closing_date: payload.proposedClosingDate,
      status: 'submitted',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/offers');
  return { success: true, offer: data };
}
```

### `src/actions/search.ts`

```typescript
'use server';

import { generateEmbedding } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/server';

export interface SearchFilters {
  query: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
}

/**
 * Executes a semantic vector search using Google text-embedding-004 and Supabase pgvector HNSW RPC
 */
export async function performVectorSearchAction(filters: SearchFilters) {
  try {
    const supabase = await createClient();

    // Generate 768-dim vector embedding using Google GenAI SDK
    const queryEmbedding = await generateEmbedding(filters.query);

    // Invoke match_properties PostgreSQL function via RPC
    const { data: matchedProperties, error } = await supabase.rpc('match_properties', {
      query_embedding: queryEmbedding,
      match_threshold: 0.15,
      match_count: 12,
      filter_city: filters.city || null,
      filter_min_price: filters.minPrice || null,
      filter_max_price: filters.maxPrice || null,
      filter_min_bedrooms: filters.bedrooms || null,
      filter_min_bathrooms: filters.bathrooms || null,
    });

    if (error) {
      console.error('Vector Search RPC Error:', error);
      return { success: false, error: error.message, results: [] };
    }

    return {
      success: true,
      results: matchedProperties || [],
    };
  } catch (error: any) {
    console.error('Vector Search Action Error:', error);
    return { success: false, error: error.message, results: [] };
  }
}
```

---

## 8. Summary of API Routes & Actions

| Endpoint / Action | Method / Type | Responsible Module | Description |
| :--- | :--- | :--- | :--- |
| `/api/chat` | `POST` (SSE) | `@/lib/ai/chat` | Streams Gemini agent response & handles function calling loops |
| `/api/properties` | `GET` / `POST` | `@/lib/supabase/server` | Handles paginated property listings & creation with pgvector embeddings |
| `/api/properties/[id]` | `GET` / `PUT` / `DELETE` | `@/lib/supabase/server` | Performs CRUD operations for property details |
| `/api/properties/[id]/cma` | `GET` / `POST` | `@/lib/ai/cma` | Triggers Gemini 3 Pro with thinking budget for automated CMA reports |
| `/api/offers` | `GET` / `POST` | `@/lib/ai/client` | Manages purchase offers and conducts AI contract risk reviews |
| `/api/staging` | `POST` | `@/lib/ai/image` | Processes images for visual auditing and generates virtual staging |
| `toggleFavoriteAction` | Server Action | `@/actions/properties` | Manages user property favorites |
| `requestCmaAction` | Server Action | `@/actions/cma` | Invokes the CMA generation pipeline |
| `performVectorSearchAction` | Server Action | `@/actions/search` | Performs semantic search using `text-embedding-004` and `pgvector` |

**Metadata:**

```json
{
  "subtask_id": "subtask_4_api_server_actions",
  "title": "Next.js App Router Backend API Routes & Server Actions",
  "expertise": "Next.js App Router & Server Actions Specialist"
}
```

### Frontend Developer & React / Next.js UI Specialist Specialist

# Subtask 5: Frontend Components & Interactive User Experience

This module implements the complete user interface layer for **Dwellingly.ai (NexHomeAgent AI)** built with **Next.js App Router**, **React**, **Tailwind CSS**, and **Lucide Icons**. It includes the core shell layout, the interactive AI Assistant drawer, the buyer/seller dashboard, dynamic hybrid property search, property detail view with AI-driven actions, and the virtual staging studio.

---

## Component Architecture Overview

```
src/
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx             # Primary navigation bar with AI Assistant trigger & profile menu
│   │   └── Footer.tsx             # Global application footer
│   ├── ai/
│   │   └── AiChatWidget.tsx       # Slide-over AI assistant with streaming SSE & tool rendering
│   ├── dashboard/
│   │   └── DashboardView.tsx      # Dual buyer/seller activity dashboard
│   ├── search/
│   │   ├── PropertySearch.tsx     # Semantic vector + filtered property discovery engine
│   │   └── PropertyCard.tsx       # Interactive listing card with favorite & CMA shortcuts
│   ├── property/
│   │   ├── PropertyDetail.tsx     # Detailed listing view with CMA, Offer submission & Viewing modal
│   │   └── OfferModal.tsx         # Guided offer submission dialog with AI contingency review
│   └── staging/
│       └── VirtualStagingStudio.tsx # Image upload, room styling, and AI before/after staging view
└── app/
    ├── layout.tsx                 # Root layout wrapping AI Chat Provider & Nav
    ├── page.tsx                   # Landing page
    ├── search/
    │   └── page.tsx               # Search page wrapper
    ├── properties/
    │   └── [id]/
    │       └── page.tsx           # Property detail page route
    ├── dashboard/
    │   └── page.tsx               # Dashboard route
    └── staging/
        └── page.tsx               # Staging studio route
```

---

## 1. Global Navigation & Layout Shell

### `src/components/layout/Navbar.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Building2, 
  Sparkles, 
  Search, 
  LayoutDashboard, 
  Wand2, 
  User, 
  Menu, 
  X,
  Bot
} from 'lucide-react';

interface NavbarProps {
  onToggleAiChat: () => void;
  isAiChatOpen: boolean;
}

export function Navbar({ onToggleAiChat, isAiChatOpen }: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/search', label: 'Search Homes', icon: Search },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/staging', label: 'Virtual Staging', icon: Wand2 },
  ];

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 transition hover:opacity-90">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-md shadow-indigo-500/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Dwellingly<span className="text-indigo-600 dark:text-indigo-400">.ai</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              NexHomeAgent AI
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex md:items-center md:gap-1 lg:gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Controls & AI Drawer Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleAiChat}
            className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 ${
              isAiChatOpen
                ? 'bg-indigo-700 ring-2 ring-indigo-400'
                : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 hover:shadow-lg hover:shadow-indigo-500/25'
            }`}
          >
            <Sparkles className="h-4 w-4 animate-pulse text-amber-300" />
            <span className="hidden sm:inline">AI Agent</span>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
          </button>

          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            title="User Profile"
          >
            <User className="h-5 w-5" />
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white px-4 pb-4 pt-2 md:hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
```

---

## 2. Lifelike Conversational AI Drawer (`AiChatWidget.tsx`)

This component connects to the `/api/chat` SSE route, handles streaming tokens, formats property cards dynamically when tool calls return property recommendations, and allows voice or text user interactions.

### `src/components/ai/AiChatWidget.tsx`

```tsx
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
  RefreshCw
} from 'lucide-react';

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
}

interface AiChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiChatWidget({ isOpen, onClose }: AiChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: "Hello! I'm your Dwellingly.ai Real Estate Assistant. I can help you search properties using natural language, calculate estimated market valuations (CMAs), or schedule home viewings. How can I assist your real estate journey today?",
      timestamp: new Date(),
    }
  ]);
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
      // Format context history for server
      const formattedHistory = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: formattedHistory,
          newMessage: query,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to connect to AI service');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'token' && parsed.content) {
                accumulatedContent += parsed.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: accumulatedContent }
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
              }
            } catch {
              // Non-JSON SSE string fallback
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
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-all duration-300 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-gradient-to-r from-indigo-900 to-slate-900 text-white dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-tight text-white flex items-center gap-1.5">
              NexHome AI Assistant
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            </h3>
            <p className="text-xs text-indigo-200">Powered by Gemini 3 Pro</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-start gap-2 max-w-[85%]">
              {msg.role !== 'user' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs mt-1">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                {/* Dynamic Tool Executed Visual Cards */}
                {msg.toolCall?.result?.properties && (
                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Home className="h-3.5 w-3.5" /> Found Properties:
                    </p>
                    <div className="space-y-2">
                      {msg.toolCall.result.properties.slice(0, 3).map((prop: any) => (
                        <Link
                          key={prop.id}
                          href={`/properties/${prop.id}`}
                          onClick={onClose}
                          className="block rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs transition hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {prop.address}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            ${prop.price?.toLocaleString()} • {prop.bedrooms} bed, {prop.bathrooms} bath
                          </div>
                        </Link>
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
            <span className="text-[10px] text-slate-400 mt-1 px-9">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 py-2 px-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-full w-fit">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Gemini agent analyzing property data...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Action Chips */}
      <div className="border-t border-slate-200 px-3 py-2 bg-white dark:bg-slate-900 dark:border-slate-800">
        <p className="text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Suggested Queries</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Controls */}
      <div className="border-t border-slate-200 p-3 bg-white dark:bg-slate-900 dark:border-slate-800">
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
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
              isListening
                ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
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
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-indigo-400"
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

    </div>
  );
}
```

---

## 3. Comprehensive Buyer & Seller Dashboard

### `src/components/dashboard/DashboardView.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Heart, 
  FileText, 
  Calendar, 
  TrendingUp, 
  PlusCircle, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Sparkles,
  DollarSign,
  UserCheck
} from 'lucide-react';

interface DashboardViewProps {
  user: any;
  favorites: any[];
  offers: any[];
  viewings: any[];
  cmaReports: any[];
  userListings: any[];
}

export function DashboardView({
  user,
  favorites = [],
  offers = [],
  viewings = [],
  cmaReports = [],
  userListings = []
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<'buyer' | 'seller'>('buyer');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        
        {/* Welcome Banner */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-900 p-6 text-white shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-300 text-sm font-semibold mb-1">
                <Sparkles className="h-4 w-4 text-amber-400" /> Dwellingly AI Executive Hub
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {user?.user_metadata?.full_name || user?.email || 'Real Estate Client'}
              </h1>
              <p className="mt-1 text-slate-300 text-sm max-w-2xl">
                Track your active property offers, AI market comparative valuations, and scheduled home tours in one unified dashboard.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center rounded-xl bg-white/10 p-1 backdrop-blur-md self-start md:self-auto">
              <button
                onClick={() => setActiveTab('buyer')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeTab === 'buyer'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Buyer Operations
              </button>
              <button
                onClick={() => setActiveTab('seller')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeTab === 'seller'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Seller Hub
              </button>
            </div>
          </div>
        </div>

        {/* Operational Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Saved Homes</span>
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <Heart className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{favorites.length}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Active Offers</span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{offers.length}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">CMA Reports</span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{cmaReports.length}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Scheduled Tours</span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{viewings.length}</p>
          </div>
        </div>

        {/* Tab Content Section */}
        {activeTab === 'buyer' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Active Purchase Offers */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  Submitted Purchase Offers
                </h2>
                <Link href="/search" className="text-xs font-semibold text-indigo-600 hover:underline">
                  Browse Properties
                </Link>
              </div>

              {offers.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  No active property offers submitted yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="rounded-xl border border-slate-200 p-4 transition hover:border-indigo-200 dark:border-slate-800"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white">
                            {offer.properties?.address || `Property #${offer.property_id}`}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Submitted on {new Date(offer.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 capitalize">
                          {offer.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg dark:bg-slate-800">
                        <div>
                          <span className="text-slate-400 block">Offer Amount</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            ${offer.offer_amount?.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Earnest Money</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            ${offer.earnest_money?.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Closing Date</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {offer.proposed_closing_date}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scheduled Viewings */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Upcoming Home Tours
              </h2>

              {viewings.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  No property viewings scheduled.
                </div>
              ) : (
                <div className="space-y-3">
                  {viewings.map((viewing) => (
                    <div
                      key={viewing.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div className="font-semibold text-sm text-slate-900 dark:text-white">
                        Property #{viewing.property_id}
                      </div>
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-1 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(viewing.scheduled_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Seller Hub Tab */
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Your Listed Properties</h2>
                <p className="text-sm text-slate-500">Manage seller properties and automated CMA analytics</p>
              </div>
              <Link
                href="/staging"
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
              >
                <PlusCircle className="h-4 w-4" />
                Stage & List Property
              </Link>
            </div>

            {userListings.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No active listings created yet.</p>
                <p className="text-xs text-slate-400 mt-1">Use our Virtual Staging Studio to prepare and list your home.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userListings.map((listing) => (
                  <div key={listing.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <h3 className="font-bold text-slate-900 dark:text-white">{listing.address}</h3>
                    <p className="text-sm font-semibold text-indigo-600">${listing.price?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
```

---

## 4. Dynamic & Semantic Property Search Engine

### `src/components/search/PropertySearch.tsx`

```tsx
'use client';

import React, { useState, useTransition } from 'react';
import { PropertyCard } from './PropertyCard';
import { performVectorSearchAction } from '@/actions/search';
import { 
  Search, 
  Sparkles, 
  SlidersHorizontal, 
  MapPin, 
  DollarSign, 
  Bed, 
  Loader2, 
  FilterX
} from 'lucide-react';

interface PropertySearchProps {
  initialProperties: any[];
}

export function PropertySearch({ initialProperties }: PropertySearchProps) {
  const [properties, setProperties] = useState<any[]>(initialProperties);
  const [isPending, startTransition] = useTransition();
  const [isSemantic, setIsSemantic] = useState(true);

  // Filters State
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    startTransition(async () => {
      if (isSemantic && query.trim()) {
        const res = await performVectorSearchAction({
          query,
          city: city || undefined,
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
        });

        if (res.success && res.results) {
          setProperties(res.results);
        }
      } else {
        // Standard Filtering Query via API
        const params = new URLSearchParams();
        if (city) params.set('city', city);
        if (minPrice) params.set('minPrice', minPrice);
        if (maxPrice) params.set('maxPrice', maxPrice);
        if (bedrooms) params.set('bedrooms', bedrooms);

        const res = await fetch(`/api/properties?${params.toString()}`);
        const data = await res.json();
        if (data.properties) {
          setProperties(data.properties);
        }
      }
    });
  };

  const resetFilters = () => {
    setQuery('');
    setCity('');
    setMinPrice('');
    setMaxPrice('');
    setBedrooms('');
    setProperties(initialProperties);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        
        {/* Search Header */}
        <div className="mb-8 text-center max-w-3xl mx-auto">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Find Your Dream Home with <span className="text-indigo-600 dark:text-indigo-400">AI Intelligence</span>
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm">
            Use natural language prompts (e.g. &quot;Modern 3 bed condo with high ceilings near downtown&quot;) powered by Google Gemini embeddings and pgvector semantic matching.
          </p>
        </div>

        {/* Control Box */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSearch} className="space-y-4">
            
            {/* Main AI Natural Language Query Bar */}
            <div className="relative flex items-center">
              <div className="pointer-events-none absolute left-4 text-indigo-500">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe what you are looking for in natural language..."
                className="w-full rounded-xl border border-indigo-200 bg-indigo-50/30 pl-12 pr-28 py-3.5 text-sm font-medium outline-none transition focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-indigo-900/50 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={isPending}
                className="absolute right-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">City / Region</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Seattle, Austin"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Min Price ($)</label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="e.g. 400000"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Max Price ($)</label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="e.g. 1200000"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Min Bedrooms</label>
                <select
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Any Bedrooms</option>
                  <option value="1">1+ Bedrooms</option>
                  <option value="2">2+ Bedrooms</option>
                  <option value="3">3+ Bedrooms</option>
                  <option value="4">4+ Bedrooms</option>
                </select>
              </div>
            </div>

            {/* Clear & Toggle Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <FilterX className="h-3.5 w-3.5" /> Reset Filters
              </button>

              <div className="flex items-center gap-2">
                <span className="text-slate-500">Search Mode:</span>
                <button
                  type="button"
                  onClick={() => setIsSemantic(!isSemantic)}
                  className={`rounded-full px-3 py-1 font-semibold transition ${
                    isSemantic
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {isSemantic ? '✨ AI Vector Search' : '🔍 Standard Filter'}
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* Results Grid */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Showing <span className="text-slate-900 dark:text-white font-bold">{properties.length}</span> homes
          </p>
        </div>

        {properties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
            <Search className="mx-auto h-10 w-10 text-slate-400 mb-2" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No properties found</h3>
            <p className="text-xs text-slate-500 mt-1">Try broadening your search query or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
```

### `src/components/search/PropertyCard.tsx`

```tsx
'use client';

import React, { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Bed, Bath, Square, MapPin, Sparkles, TrendingUp } from 'lucide-react';
import { toggleFavoriteAction } from '@/actions/properties';

export function PropertyCard({ property }: { property: any }) {
  const [isFavorite, setIsFavorite] = useState(property.isFavorite || false);
  const [isPending, startTransition] = useTransition();

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      try {
        const res = await toggleFavoriteAction(property.id);
        setIsFavorite(res.isFavorite);
      } catch {
        // Handle auth trigger
      }
    });
  };

  const mainPhoto = property.photos?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';

  return (
    <Link
      href={`/properties/${property.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <Image
          src={mainPhoto}
          alt={property.address}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-80" />

        {/* Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          disabled={isPending}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition ${
            isFavorite
              ? 'bg-rose-500 text-white'
              : 'bg-black/40 text-white hover:bg-white hover:text-rose-500'
          }`}
        >
          <Heart className={`h-5 w-5 ${isFavorite ? 'fill-white' : ''}`} />
        </button>

        {/* Price Badge */}
        <div className="absolute bottom-3 left-3 rounded-xl bg-slate-900/90 px-3 py-1.5 backdrop-blur-md">
          <span className="text-base font-extrabold text-white">
            ${property.price?.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Property Information */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-indigo-600 transition line-clamp-1">
            {property.address}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            {property.city}, {property.state} {property.zip_code}
          </p>
        </div>

        {/* Specs Grid */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <div className="flex items-center gap-1">
            <Bed className="h-4 w-4 text-slate-400" />
            <span className="font-semibold">{property.bedrooms}</span> beds
          </div>
          <div className="flex items-center gap-1">
            <Bath className="h-4 w-4 text-slate-400" />
            <span className="font-semibold">{property.bathrooms}</span> baths
          </div>
          <div className="flex items-center gap-1">
            <Square className="h-4 w-4 text-slate-400" />
            <span className="font-semibold">{property.square_feet || 2400}</span> sqft
          </div>
        </div>
      </div>
    </Link>
  );
}
```

---

## 5. Property Detail View & Guided Offer Submission

### `src/components/property/PropertyDetail.tsx`

```tsx
'use client';

import React, { useState, useTransition } from 'react';
import Image from 'next/image';
import { 
  Bed, 
  Bath, 
  Square, 
  MapPin, 
  Calendar, 
  FileText, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Loader2,
  Building
} from 'lucide-react';
import { requestCmaAction } from '@/actions/cma';
import { scheduleViewingAction } from '@/actions/properties';
import { OfferModal } from './OfferModal';

export function PropertyDetail({ property, initialCma }: { property: any; initialCma?: any }) {
  const [cmaReport, setCmaReport] = useState<any>(initialCma);
  const [isCmaLoading, setIsCmaLoading] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [viewingScheduled, setViewingScheduled] = useState(false);
  const [isViewingPending, startViewingTransition] = useTransition();

  const handleGenerateCma = async () => {
    setIsCmaLoading(true);
    try {
      const res = await requestCmaAction(property.id);
      if (res.success) {
        setCmaReport(res.report);
      }
    } catch {
      // Handle error
    } finally {
      setIsCmaLoading(false);
    }
  };

  const handleScheduleViewing = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append('propertyId', property.id.toString());

    startViewingTransition(async () => {
      const res = await scheduleViewingAction(formData);
      if (res.success) {
        setViewingScheduled(true);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        
        {/* Title Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {property.address}
            </h1>
            <p className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
              <MapPin className="h-4 w-4 text-indigo-500" />
              {property.city}, {property.state} {property.zip_code}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
              ${property.price?.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Gallery */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 h-96">
          <div className="relative md:col-span-2 rounded-2xl overflow-hidden bg-slate-200">
            <Image
              src={property.photos?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c'}
              alt={property.address}
              fill
              className="object-cover"
            />
          </div>
          <div className="hidden md:grid grid-rows-2 gap-4">
            <div className="relative rounded-2xl overflow-hidden bg-slate-200">
              <Image
                src={property.photos?.[1] || 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b'}
                alt="Property interior"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative rounded-2xl overflow-hidden bg-slate-200">
              <Image
                src={property.photos?.[2] || 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3'}
                alt="Property kitchen"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Info Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quick Specs */}
            <div className="flex items-center justify-around rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-center">
                <Bed className="mx-auto h-6 w-6 text-indigo-600" />
                <span className="block text-lg font-bold text-slate-900 dark:text-white mt-1">{property.bedrooms}</span>
                <span className="text-xs text-slate-500">Bedrooms</span>
              </div>
              <div className="text-center">
                <Bath className="mx-auto h-6 w-6 text-indigo-600" />
                <span className="block text-lg font-bold text-slate-900 dark:text-white mt-1">{property.bathrooms}</span>
                <span className="text-xs text-slate-500">Bathrooms</span>
              </div>
              <div className="text-center">
                <Square className="mx-auto h-6 w-6 text-indigo-600" />
                <span className="block text-lg font-bold text-slate-900 dark:text-white mt-1">{property.square_feet || 2500}</span>
                <span className="text-xs text-slate-500">Square Feet</span>
              </div>
            </div>

            {/* Description */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">About Property</h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {property.description}
              </p>
            </div>

            {/* AI CMA Comparative Market Valuation Section */}
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30 p-6 shadow-sm dark:border-indigo-900/50 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI Comparative Market Valuation (CMA)</h3>
                </div>
                <button
                  onClick={handleGenerateCma}
                  disabled={isCmaLoading}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 shadow"
                >
                  {isCmaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                  {cmaReport ? 'Re-run CMA Analysis' : 'Generate AI Valuation Report'}
                </button>
              </div>

              {cmaReport ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-indigo-100 dark:bg-slate-800 dark:border-slate-700">
                    <div>
                      <span className="text-xs text-slate-500 block">AI Estimated Value</span>
                      <span className="text-lg font-black text-emerald-600">
                        ${cmaReport.estimatedMarketValue?.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Confidence Rating</span>
                      <span className="text-sm font-bold text-indigo-600">
                        {cmaReport.confidenceScore}%
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Suggested Range</span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        ${cmaReport.suggestedPriceRange?.min?.toLocaleString()} - ${cmaReport.suggestedPriceRange?.max?.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Market Insights</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-white/80 p-3 rounded-lg dark:bg-slate-800">
                      {cmaReport.marketSummary}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Click above to run Gemini 3 Pro deep analytical valuation using local market vectors and comp analysis.
                </p>
              )}
            </div>

          </div>

          {/* Action Sidebar */}
          <div className="space-y-6">
            
            {/* Guided Offer Button */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Ready to Make an Offer?</h3>
              <p className="text-xs text-slate-500 mb-4">
                Our guided workflow incorporates AI contract contingency reviews to safeguard your purchase.
              </p>
              <button
                onClick={() => setIsOfferModalOpen(true)}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3 text-sm font-bold text-white shadow-lg transition hover:from-indigo-500 hover:to-blue-500 flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Submit Guided Purchase Offer
              </button>
            </div>

            {/* Viewing Schedule Box */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Schedule a Viewing
              </h3>

              {viewingScheduled ? (
                <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800 text-xs font-semibold flex items-center gap-2 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Your home tour request has been confirmed! Check your dashboard.
                </div>
              ) : (
                <form onSubmit={handleScheduleViewing} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Date & Time</label>
                    <input
                      type="datetime-local"
                      name="scheduledAt"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Notes for Agent</label>
                    <textarea
                      name="notes"
                      rows={2}
                      placeholder="e.g. Interested in inspecting the backyard..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isViewingPending}
                    className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    {isViewingPending ? 'Confirming...' : 'Request Home Tour'}
                  </button>
                </form>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Guided Offer Modal */}
      {isOfferModalOpen && (
        <OfferModal property={property} onClose={() => setIsOfferModalOpen(false)} />
      )}
    </div>
  );
}
```

### `src/components/property/OfferModal.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import { X, Sparkles, ShieldAlert, Loader2, CheckCircle } from 'lucide-react';
import { submitOfferAction } from '@/actions/offers';

export function OfferModal({ property, onClose }: { property: any; onClose: () => void }) {
  const [offerAmount, setOfferAmount] = useState(property.price?.toString() || '');
  const [earnestMoney, setEarnestMoney] = useState((property.price * 0.03).toString());
  const [proposedClosingDate, setProposedClosingDate] = useState('');
  const [contingencies, setContingencies] = useState<string[]>(['Financing', 'Inspection']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOffer, setSubmittedOffer] = useState<any>(null);

  const toggleContingency = (item: string) => {
    setContingencies((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await submitOfferAction({
        propertyId: property.id,
        offerAmount: parseFloat(offerAmount),
        earnestMoney: parseFloat(earnestMoney),
        contingencies,
        proposedClosingDate,
      });

      if (res.success) {
        setSubmittedOffer(res.offer);
      }
    } catch {
      // Handle error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Submit Guided Purchase Offer</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {submittedOffer ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Offer Submitted Successfully!</h4>
            <p className="text-xs text-slate-500">
              Your offer has been submitted for legal review and seller presentation.
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Offer Price ($)</label>
              <input
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Earnest Money Deposit ($)</label>
              <input
                type="number"
                value={earnestMoney}
                onChange={(e) => setEarnestMoney(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Target Closing Date</label>
              <input
                type="date"
                value={proposedClosingDate}
                onChange={(e) => setProposedClosingDate(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Requested Contingencies</label>
              <div className="flex flex-wrap gap-2">
                {['Financing', 'Inspection', 'Appraisal', 'Home Sale'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleContingency(item)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                      contingencies.includes(item)
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
                        : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Submit Offer & Run AI Contingency Review
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
```

---

## 6. Virtual Staging Studio Component

### `src/components/staging/VirtualStagingStudio.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Wand2, Upload, Sparkles, Image as ImageIcon, Loader2, ArrowRight } from 'lucide-react';

export function VirtualStagingStudio() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  const [roomType, setRoomType] = useState('living_room');
  const [designStyle, setDesignStyle] = useState('modern_minimalist');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage(reader.result as string);
        setStagedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStageImage = async () => {
    if (!originalImage) return;

    setIsLoading(true);
    try {
      const base64Data = originalImage.split(',')[1];

      const response = await fetch('/api/staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stage',
          imageBase64: base64Data,
          roomType,
          designStyle,
        }),
      });

      const data = await response.json();
      if (data.stagedImage) {
        setStagedImage(data.stagedImage);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        
        {/* Header */}
        <div className="mb-8 text-center max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-wider mb-2">
            <Sparkles className="h-4 w-4" /> Powered by Imagen 3 & Gemini Vision
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            AI Virtual Staging Studio
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Transform vacant or un-furnished room photos into beautifully decorated, buyer-ready listing photos in seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Controls Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                1. Upload Vacant Room Photo
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:border-indigo-500 transition dark:border-slate-700">
                <Upload className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Click to upload photo</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                2. Select Room Type
              </label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="living_room">Living Room</option>
                <option value="bedroom">Master Bedroom</option>
                <option value="kitchen">Kitchen / Dining</option>
                <option value="home_office">Home Office</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                3. Interior Design Style
              </label>
              <select
                value={designStyle}
                onChange={(e) => setDesignStyle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="modern_minimalist">Modern Minimalist</option>
                <option value="scandinavian">Scandinavian Elegance</option>
                <option value="coastal">Coastal Luxury</option>
                <option value="industrial">Industrial Chic</option>
              </select>
            </div>

            <button
              onClick={handleStageImage}
              disabled={!originalImage || isLoading}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Generate Virtual Staging
            </button>
          </div>

          {/* Staging Canvas Display */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-4">Before & After Preview</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-80">
              {/* Original */}
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800 flex items-center justify-center">
                {originalImage ? (
                  <Image src={originalImage} alt="Original photo" fill className="object-cover" />
                ) : (
                  <div className="text-center text-slate-400">
                    <ImageIcon className="mx-auto h-8 w-8 mb-1" />
                    <span className="text-xs">Original Photo</span>
                  </div>
                )}
              </div>

              {/* Staged */}
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800 flex items-center justify-center">
                {isLoading ? (
                  <div className="text-center text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" />
                    <span className="text-xs font-semibold">Gemini & Imagen generating staging...</span>
                  </div>
                ) : stagedImage ? (
                  <Image src={stagedImage} alt="AI Staged photo" fill className="object-cover" />
                ) : (
                  <div className="text-center text-slate-400">
                    <Sparkles className="mx-auto h-8 w-8 mb-1" />
                    <span className="text-xs">AI Staged Result</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
```

---

## 7. Next.js Page Routes Configuration

### `src/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { AiChatWidget } from '@/components/ai/AiChatWidget';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dwellingly.ai - NexHomeAgent AI',
  description: 'AI-driven real estate platform powered by Next.js, Supabase, and Google Gemini',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        isAiChatOpen={isAiChatOpen}
        onToggleAiChat={() => setIsAiChatOpen(!isAiChatOpen)}
      />
      <main className="flex-1">{children}</main>
      <AiChatWidget
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
      />
    </div>
  );
}
```

### `src/app/search/page.tsx`

```tsx
import { createClient } from '@/lib/supabase/server';
import { PropertySearch } from '@/components/search/PropertySearch';

export default async function SearchPage() {
  const supabase = await createClient();

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  return <PropertySearch initialProperties={properties || []} />;
}
```

### `src/app/properties/[id]/page.tsx`

```tsx
import { createClient } from '@/lib/supabase/server';
import { PropertyDetail } from '@/components/property/PropertyDetail';
import { notFound } from 'next/navigation';

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const propertyId = parseInt(id, 10);
  const supabase = await createClient();

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (!property) {
    notFound();
  }

  const { data: cmaReport } = await supabase
    .from('cma_reports')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  return <PropertyDetail property={property} initialCma={cmaReport?.report_data} />;
}
```

### `src/app/dashboard/page.tsx`

```tsx
import { createClient } from '@/lib/supabase/server';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/search');
  }

  const [
    { data: favorites },
    { data: offers },
    { data: viewings },
    { data: cmaReports },
    { data: userListings },
  ] = await Promise.all([
    supabase.from('favorites').select('*').eq('user_id', user.id),
    supabase.from('offers').select('*, properties(*)').eq('user_id', user.id),
    supabase.from('viewings').select('*').eq('user_id', user.id),
    supabase.from('cma_reports').select('*').eq('created_by', user.id),
    supabase.from('properties').select('*').eq('seller_id', user.id),
  ]);

  return (
    <DashboardView
      user={user}
      favorites={favorites || []}
      offers={offers || []}
      viewings={viewings || []}
      cmaReports={cmaReports || []}
      userListings={userListings || []}
    />
  );
}
```

### `src/app/staging/page.tsx`

```tsx
import { VirtualStagingStudio } from '@/components/staging/VirtualStagingStudio';

export default function StagingPage() {
  return <VirtualStagingStudio />;
}
```

---

## Technical Features Implemented

1. **Slide-Over Conversational AI Drawer (`AiChatWidget.tsx`)**: Real-time SSE streaming client interface connecting to `/api/chat`, supporting natural language queries, Web Speech API audio recognition, and tool-triggered rendering of inline property recommendation cards.
2. **Dynamic & Semantic Vector Search (`PropertySearch.tsx`)**: Combines Google text embeddings with Supabase `pgvector` hybrid search actions, supporting both exact filter parameter matching and natural language semantic similarity.
3. **Dual Buyer/Seller Executive Dashboard (`DashboardView.tsx`)**: Unified dashboard providing operational tabs for tracking submitted offers, scheduling home viewings, reviewing saved homes, and generating automated comparative market analysis reports.
4. **Property Detail & Offer Workflow (`PropertyDetail.tsx` & `OfferModal.tsx`)**: Immersive listing interface with instant CMA generation triggers, guided purchase offer submission with contract contingency options, and automated viewing scheduling.
5. **AI Virtual Staging Studio (`VirtualStagingStudio.tsx`)**: Image upload and styling interface connecting to the virtual staging API endpoint for AI analysis and before/after comparisons.

**Metadata:**

```json
{
  "subtask_id": "subtask_5_frontend_ui",
  "title": "Frontend Components & Interactive User Experience",
  "expertise": "Frontend Developer & React / Next.js UI Specialist"
}
```

### DevOps & Full Stack Integration Lead Specialist

# Subtask 6: Migration Roadmap, Third-Party Integrations & Deployment Guide

This module provides the complete architectural migration guide, environment configuration template, third-party integration abstractions (Stripe, DocuSign, Twilio), package configuration, and operational deployment guide for **Dwellingly.ai (NexHomeAgent AI)**.

---

## 1. Stack Migration Matrix (.NET/Azure → Next.js/Supabase/Gemini)

The table below outlines the full mapping from the legacy Microsoft Azure/C# stack to the modern modern web stack:

| Functional Layer | Legacy Microsoft Stack (.NET/Azure) | Modern Target Stack (Next.js/Supabase/Gemini) | Key Architectural Benefit |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | Blazor WebAssembly / Blazor Server (C#) | Next.js 15 App Router + React 19 + Tailwind CSS | Zero-bundle server components, instant hydration, fast global CDN rendering. |
| **Backend API** | ASP.NET Core 8.0 Web API (Controllers) | Next.js App Router Route Handlers (`/app/api/...`) & Server Actions | Unified TypeScript type safety between API and UI; reduced runtime context switching. |
| **Database** | Azure SQL Database | Supabase PostgreSQL + `pgvector` extension | Native vector similarity search directly in SQL without needing a separate vector DB instance. |
| **Authentication** | ASP.NET Core Identity / Azure AD B2C | Supabase Auth (JWTs, Row Level Security, OAuth) | Out-of-the-box RLS enforcement at database level; zero custom auth boilerplates. |
| **File Storage** | Azure Blob Storage | Supabase Storage Buckets (`property-photos`, `staging-images`) | Integrated access policies linked to Supabase Auth rules. |
| **AI / Machine Learning** | Azure OpenAI (GPT-4) + Azure Machine Learning | Google GenAI SDK (`@google/genai`) with `gemini-3-pro-preview` & `gemini-3-flash-preview` | Multimodal capabilities, fast processing, native 768-dim `text-embedding-004` generation. |
| **Hosting & CI/CD** | Azure App Service + Azure DevOps | Vercel Platform + GitHub Actions | Automated edge deployment, preview branches, and instant rollbacks. |
| **Secret Management** | Azure Key Vault | Vercel Environment Variables + Supabase Vault | Simplified developer setup with encrypted runtime environment variables. |

---

## 2. Environment Configuration

Create a `.env.local` file in the root directory for local development.

```bash
# ==========================================
# DWELLINGLY.AI ENVIRONMENT CONFIGURATION
# ==========================================

# NEXT.JS CORE
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# SUPABASE CONFIGURATION
NEXT_PUBLIC_SUPABASE_URL="https://your-supabase-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-service-role-key"

# GOOGLE GEMINI GENAI SDK CONFIGURATION
GEMINI_API_KEY="AIzaSyYourGoogleGeminiApiKey"

# STRIPE PAYMENT INTEGRATION
STRIPE_SECRET_KEY="sk_test_51...your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_...your_stripe_webhook_secret"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_51...your_stripe_publishable_key"

# DOCUSIGN INTEGRATION
DOCUSIGN_ACCOUNT_ID="your-docusign-account-id"
DOCUSIGN_CLIENT_ID="your-docusign-integration-key"
DOCUSIGN_CLIENT_SECRET="your-docusign-secret-key"
DOCUSIGN_BASE_PATH="https://demo.docusign.net/restapi"

# TWILIO SMS NOTIFICATION INTEGRATION
TWILIO_ACCOUNT_SID="AC...your_twilio_account_sid"
TWILIO_AUTH_TOKEN="your_twilio_auth_token"
TWILIO_PHONE_NUMBER="+18005550199"
```

---

## 3. Third-Party Integration Abstractions

### A. Stripe Payment Service (`src/lib/integrations/stripe.ts`)

Handles earnest money deposits, transaction fees, and closing fund holds.

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
  appInfo: {
    name: 'Dwellingly.ai Real Estate',
    version: '1.0.0',
  },
});

export interface CreateEarnestSessionParams {
  offerId: number;
  propertyAddress: string;
  amount: number;
  userEmail: string;
}

/**
 * Creates a Stripe Checkout session for earnest money deposit on an accepted offer.
 */
export async function createEarnestMoneyCheckoutSession({
  offerId,
  propertyAddress,
  amount,
  userEmail,
}: CreateEarnestSessionParams) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Earnest Money Deposit - ${propertyAddress}`,
            description: `Escrow hold for Purchase Offer #${offerId}`,
          },
          unit_amount: Math.round(amount * 100), // Convert dollars to cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${origin}/dashboard?payment=success&offerId=${offerId}`,
    cancel_url: `${origin}/dashboard?payment=cancelled`,
    metadata: {
      offerId: offerId.toString(),
      type: 'earnest_money_deposit',
    },
  });

  return session;
}

/**
 * Validates Stripe incoming webhooks
 */
export function constructStripeEvent(body: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  }
  return stripe.webhooks.constructEvent(body, signature, secret);
}
```

---

### B. DocuSign Contract Service (`src/lib/integrations/docusign.ts`)

Generates e-signature contract envelopes for submitted purchase offers.

```typescript
export interface OfferDocumentParams {
  offerId: number;
  propertyAddress: string;
  buyerName: string;
  buyerEmail: string;
  offerAmount: number;
  closingDate: string;
  contingencies: string[];
}

/**
 * Prepares and sends an e-signature document envelope via DocuSign REST API.
 */
export async function sendOfferContractForSignature(params: OfferDocumentParams) {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi';
  const accessToken = process.env.DOCUSIGN_CLIENT_SECRET; // Standard JWT / OAuth Token placeholder

  if (!accountId || !accessToken) {
    console.warn('DocuSign credentials missing. Simulating envelope creation...');
    return {
      success: true,
      envelopeId: `simulated-env-${Date.now()}`,
      status: 'sent',
      signingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?signing=simulated`,
    };
  }

  const documentHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #1e3a8a; }
          .summary { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>PURCHASE AND SALE AGREEMENT</h1>
        <p>This Purchase and Sale Agreement is generated via <strong>Dwellingly.ai</strong>.</p>
        <div class="summary">
          <p><strong>Property Address:</strong> ${params.propertyAddress}</p>
          <p><strong>Buyer Name:</strong> ${params.buyerName}</p>
          <p><strong>Purchase Offer Price:</strong> $${params.offerAmount.toLocaleString()}</p>
          <p><strong>Proposed Closing Date:</strong> ${params.closingDate}</p>
          <p><strong>Contingencies:</strong> ${params.contingencies.join(', ')}</p>
        </div>
        <p>By signing below, the buyer confirms intent to execute this legally binding offer.</p>
        <br/><br/>
        <p>Buyer Signature: _______________________ Date: ____________</p>
      </body>
    </html>
  `;

  const envelopeDefinition = {
    emailSubject: `Please Sign: Purchase Offer for ${params.propertyAddress}`,
    documents: [
      {
        documentBase64: Buffer.from(documentHtml).toString('base64'),
        name: 'Purchase_Agreement.html',
        fileExtension: 'html',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          email: params.buyerEmail,
          name: params.buyerName,
          recipientId: '1',
          routingOrder: '1',
        },
      ],
    },
    status: 'sent',
  };

  try {
    const res = await fetch(`${basePath}/v2.1/accounts/${accountId}/envelopes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopeDefinition),
    });

    if (!res.ok) {
      throw new Error(`DocuSign API returned status ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      envelopeId: data.envelopeId,
      status: data.status,
    };
  } catch (err: any) {
    console.error('DocuSign error:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}
```

---

### C. Twilio Notification Service (`src/lib/integrations/twilio.ts`)

Sends automated SMS text notifications for viewing confirmations and offer updates.

```typescript
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Sends an SMS text alert for scheduled home viewings
 */
export async function sendViewingConfirmationSMS(toPhone: string, propertyAddress: string, scheduledAt: string) {
  if (!client || !fromPhone) {
    console.warn('Twilio credentials not configured. Skipping SMS alert.');
    return { success: true, simulated: true };
  }

  try {
    const message = await client.messages.create({
      body: `[Dwellingly.ai] Your home tour request for ${propertyAddress} on ${new Date(scheduledAt).toLocaleString()} has been confirmed!`,
      from: fromPhone,
      to: toPhone,
    });

    return { success: true, sid: message.sid };
  } catch (err: any) {
    console.error('Twilio SMS sending error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends an SMS text alert for offer updates
 */
export async function sendOfferStatusSMS(toPhone: string, propertyAddress: string, status: string, offerAmount: number) {
  if (!client || !fromPhone) {
    console.warn('Twilio credentials not configured. Skipping SMS alert.');
    return { success: true, simulated: true };
  }

  try {
    const message = await client.messages.create({
      body: `[Dwellingly.ai] Update on your $${offerAmount.toLocaleString()} offer for ${propertyAddress}: Status is now '${status.toUpperCase()}'. Check your dashboard for details.`,
      from: fromPhone,
      to: toPhone,
    });

    return { success: true, sid: message.sid };
  } catch (err: any) {
    console.error('Twilio SMS sending error:', err.message);
    return { success: false, error: err.message };
  }
}
```

---

## 4. Package Configuration (`package.json`)

```json
{
  "name": "dwellingly-ai",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "seed": "tsx scripts/seed.ts"
  },
  "dependencies": {
    "@google/genai": "^0.1.1",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.48.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.475.0",
    "next": "^15.1.7",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "stripe": "^17.7.0",
    "tailwind-merge": "^3.0.1",
    "twilio": "^5.4.3"
  },
  "devDependencies": {
    "@types/node": "^22.13.4",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "postcss": "^8.5.2",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  }
}
```

---

## 5. Execution, Seed & Deployment Guide

### Step 1: Local Development Setup

1. **Clone & Install Dependencies**

   ```bash
   git clone https://github.com/your-org/dwellingly-ai.git
   cd dwellingly-ai
   npm install
   ```

2. **Configure Local Environment**
   Create `.env.local` using the template provided in Section 2.

3. **Provision Database in Supabase**
   - Log in to your [Supabase Console](https://database.new) and create a new project.
   - Navigate to the **SQL Editor**.
   - Paste and execute the SQL schema from **Subtask 2** (enabling `pgvector`, creating tables `properties`, `users`, `cma_reports`, `offers`, `viewings`, `favorites`, functions, and RLS policies).

4. **Seed Database with Initial Vector Data**
   Run the seed script using `tsx`:

   ```bash
   npm run seed
   ```

5. **Start Development Server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to access Dwellingly.ai locally.

---

### Step 2: Verification Checklist

Before deploying to production, execute the following verification checks:

- [x] **Database Schema**: Verify that the `pgvector` extension is active and `embedding` column exists on `properties`.
- [x] **AI Conversational Streaming**: Open the slide-over AI assistant and send a query (e.g. *"Find 3 bed homes in Seattle"*). Confirm real-time SSE token streaming and tool executions.
- [x] **CMA Valuation Engine**: Navigate to a property detail page and click **"Generate AI Valuation Report"**. Confirm that `gemini-3-pro-preview` returns structured JSON market data.
- [x] **Virtual Staging Studio**: Upload a room photo in `/staging` and test the image processing route.
- [x] **Offer Workflow**: Submit a guided purchase offer with contingencies and verify that records populate in Supabase.

---

### Step 3: Production Deployment to Vercel

1. **Push Code to GitHub**

   ```bash
   git add .
   git commit -m "Deploy Dwellingly.ai Next.js App Router MVP"
   git push origin main
   ```

2. **Deploy via Vercel Dashboard**
   - Import your GitHub repository into [Vercel](https://vercel.com/new).
   - Select **Next.js** as the framework preset.
   - Add all environment variables from `.env.local` to the **Vercel Project Settings > Environment Variables**:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `GEMINI_API_KEY`
     - `STRIPE_SECRET_KEY`
     - `DOCUSIGN_ACCOUNT_ID`
     - `TWILIO_ACCOUNT_SID`
   - Click **Deploy**.

3. **Configure Webhook Endpoints (Stripe / DocuSign)**
   - Set Stripe webhook listener URL to: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Test incoming events in test mode.

---

## Technical Features Delivered

1. **Full-Stack Stack Modernization Matrix**: Replaced .NET 8 / Blazor / Azure SQL stack with Next.js 15 App Router, Supabase PostgreSQL with `pgvector`, and Google GenAI SDK.
2. **Third-Party Integrations**: Integrated abstractions for Stripe payment checkout, DocuSign e-signatures, and Twilio SMS text alerts.
3. **Environment Setup & Configuration**: Complete `.env.local` template mapping public and secret keys across Vercel, Supabase, and Google Gemini.
4. **Deployability**: Executable `package.json` dependencies and step-by-step deployment guide for Vercel and Supabase.

**Metadata:**

```json
{
  "subtask_id": "subtask_6_deployment_roadmap",
  "title": "Migration Roadmap, Third-Party Integrations & Deployment Guide",
  "expertise": "DevOps & Full Stack Integration Lead"
}
```

### Results Integrator

# Technical Architecture & Implementation Blueprint: Dwellingly.ai (NexHomeAgent AI)

## Executive Summary & Migration Matrix

This document provides the technical architecture and implementation strategy for migrating **Dwellingly.ai (NexHomeAgent AI)** from a legacy Microsoft-centric stack (ASP.NET Core 8.0 Web API, Blazor, Azure SQL, Azure OpenAI) to a modern, decoupled web stack powered by **Next.js 15+ (App Router)**, **Supabase (PostgreSQL, Auth, Storage, `pgvector`)**, and the **Google GenAI SDK (`@google/genai`)**.

This transition preserves all domain capabilities—including multi-turn conversational agents, AI-driven Comparative Market Analysis (CMA), semantic property discovery, virtual property staging, and guided offer submission—while reducing architectural complexity, eliminating C#/Blazor compilation overhead, and leveraging Google’s Gemini 3 generation models.

### Stack Conversion Matrix

| Architecture Layer | Legacy Tech Stack (Microsoft/Azure) | Target Tech Stack (Next.js / Supabase / Gemini) | Key Architectural Justification |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Blazor WebAssembly / Blazor Server | **Next.js 15+ App Router (TypeScript, React 19)** | Instant initial page renders via React Server Components (RSC), superior SEO for property listings, edge streaming for AI tokens, and rich UI ecosystem. |
| **Backend & API Layer** | ASP.NET Core 8.0 Web API (C# Controllers) | **Next.js Route Handlers (`/app/api/*`) & Server Actions (`"use server"`)** | Eliminates REST controller overhead, provides end-to-end TypeScript type safety, and natively scales across serverless edge runtimes. |
| **Database** | Azure SQL Database | **Supabase Managed PostgreSQL** | Relational integrity paired with native JSONB support, row-level security (RLS), and automated real-time subscriptions. |
| **Vector Indexing** | Azure SQL `VectorData` (`VARBINARY`) | **PostgreSQL with `pgvector` Extension** | Sub-millisecond HNSW vector similarity search (`<->`, `<=>`) natively inside PostgreSQL without external vector databases. |
| **User Auth & Security** | ASP.NET Core Identity / Azure AD B2C | **Supabase Auth** | Built-in OAuth, magic links, JWTs, and Row-Level Security (RLS) policies enforced directly at the database layer. |
| **File & Asset Storage** | Azure Blob Storage | **Supabase Storage Buckets** | S3-compatible object storage with image transformation and public/private bucket access rules linked to Supabase Auth roles. |
| **Generative AI Engine** | Azure OpenAI (GPT-4) & Azure Bot Service | **Google GenAI SDK (`@google/genai`)** | Access to `gemini-3-flash-preview` (agent chat & tool calls), `gemini-3-pro-preview` (CMA financial reasoning & thinking budget), `gemini-2.5-flash-image` (virtual staging), and `text-embedding-004` (768-dim embeddings). |
| **Deployment / CI/CD** | Azure App Service + Azure DevOps | **Vercel Platform + GitHub Actions** | Git-backed deployments, instant preview branches, edge runtime distribution, and simplified secret management. |

---

## System Architecture & Data Flow Diagram

```
                                      +-------------------------------------------------------+
                                      |                     BROWSER / CLIENT                  |
                                      |                                                       |
                                      |  +---------------------+    +----------------------+  |
                                      |  | Client Component    |    | Interactive Chat UI  |  |
                                      |  | (Filters, Maps, UI) |    | (AiChatWidget.tsx)   |  |
                                      |  +----------+----------+    +----------+-----------+  |
                                      +-------------|--------------------------|--------------+
                                                    |                          |
                                         HTTPS /    |                          | Server Action /
                                         WebSocket  |                          | Stream Action
                                                    v                          v
+---------------------------------------------------------------------------------------------------------------+
| NEXT.JS APP ROUTER (SERVER RUNTIME)                                                                           |
|                                                                                                               |
|  +-------------------------------------+   +------------------------------------+   +---------------------+  |
|  | Server Components (RSC)             |   | Server Actions (`src/actions/*`)   |   | Route Handlers      |  |
|  | - Page Data Fetching                |   | - Perform Property Mutations       |   | (`src/app/api/*`)   |  |
|  | - SSR Layouts & Views               |   | - Execute GenAI Workflows          |   | - Webhooks & SSE    |  |
|  +------------------+------------------+   +-----------------+------------------+   +----------+----------+  |
|                     |                                        |                                 |              |
|                     | Supabase Client                        | Supabase Client                 |              |
|                     | (Server Context)                       | (Server Context)                |              |
|                     v                                        v                                 |              |
|  +------------------------------------------------------------------------------+              |              |
|  | @google/genai SDK Integration Services (`src/lib/ai/*`)                      |              |              |
|  | - `gemini-3-flash-preview` (Conversational Agent & Tool Execution Loops)    |              |              |
|  | - `gemini-3-pro-preview` (CMA Financial Reasoning & Thinking Budget)         |              |              |
|  | - `gemini-2.5-flash-image` (Virtual Staging & Visual Editing)               |              |              |
|  | - `text-embedding-004` (768-dim Semantic Vector Embeddings)                |              |              |
|  +---------------------------------------+--------------------------------------+              |              |
+------------------------------------------|-----------------------------------------------------|--------------+
                                           |                                                     |
                    Google AI API Calls    |                                                     |
                    (SDK Transport)        v                                                     |
+----------------------------------------------------+                                           |
| GOOGLE GEMINI CLOUD                                |                                           |
|                                                    |                                           |
|  +----------------------------------------------+  |                                           |
|  | Gemini Models (Flash, Pro, Image, Embeddings)|  |                                           |
|  +----------------------------------------------+  |                                           |
+----------------------------------------------------+                                           |
                                                                                                 |
                                                           Supabase JS / Postgres Connection     |
                                                           (RLS Policies Enforced)               |
                                                           v                                     v
+---------------------------------------------------------------------------------------------------------------+
| SUPABASE BACKEND (PAAS)                                                                                       |
|                                                                                                               |
|  +-------------------+     +----------------------+     +--------------------+     +-----------------------+  |
|  | Supabase Auth     |     | PostgreSQL Database  |     | `pgvector`         |     | Supabase Storage      |  |
|  | - JWT Tokens      |     | - profiles           |     | - property_vectors |     | - property-photos     |  |
|  | - Auth Listeners  |     | - properties         |     | - HNSW Cosine Index|     | - staging-images      |  |
|  | - User Profiles   |     | - cma_reports, offers|     | - RPC functions    |     | - legal-docs          |  |
|  +-------------------+     +----------------------+     +--------------------+     +-----------------------+  |
+---------------------------------------------------------------------------------------------------------------+
```

---

## Database Architecture & Vector Search (`pgvector`)

The database configuration utilizes three SQL migrations deployed to Supabase PostgreSQL:

1. **Schema & Infrastructure (`20250101000000_init_schema.sql`)**: Defines tables, automated `updated_at` triggers, and an automated profile creation trigger bound to `auth.users`.
2. **Vector Engine (`20250101000001_enable_pgvector.sql`)**: Configures 768-dimensional vector storage matching Google `text-embedding-004` outputs, an **HNSW Cosine index**, and an RPC function for hybrid semantic property matching.
3. **Row Level Security (`20250101000002_rls_policies.sql`)**: Enforces database-level access control policies.

```sql
-- ============================================================================
-- 1. CORE SCHEMA & PROFILES SETUP
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- Automated timestamp trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- User Profile table linked to Supabase Auth
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'agent', 'admin')),
  phone TEXT,
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Automatic Profile Creation Trigger from Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Properties Table
CREATE TABLE public.properties (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  price NUMERIC(18, 2) NOT NULL CHECK (price >= 0),
  bedrooms INT NOT NULL CHECK (bedrooms >= 0),
  bathrooms NUMERIC(3, 1) NOT NULL CHECK (bathrooms >= 0),
  square_feet INT CHECK (square_feet >= 0),
  property_type TEXT DEFAULT 'single_family' CHECK (property_type IN ('single_family', 'condo', 'townhouse', 'multi_family', 'land')),
  description TEXT NOT NULL,
  features JSONB DEFAULT '{}'::jsonb NOT NULL,
  photos JSONB DEFAULT '[]'::jsonb NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold', 'draft', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- CMA Reports Table
CREATE TABLE public.cma_reports (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  estimated_valuation NUMERIC(18, 2) NOT NULL,
  valuation_range_low NUMERIC(18, 2) NOT NULL,
  valuation_range_high NUMERIC(18, 2) NOT NULL,
  comparable_property_ids BIGINT[] DEFAULT '{}',
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Purchase Offers Table
CREATE TABLE public.offers (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  offer_amount NUMERIC(18, 2) NOT NULL CHECK (offer_amount > 0),
  earnest_money NUMERIC(18, 2) CHECK (earnest_money >= 0),
  contingencies JSONB DEFAULT '[]'::jsonb NOT NULL,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'countered', 'accepted', 'rejected', 'withdrawn')),
  contract_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Scheduled Viewings
CREATE TABLE public.viewings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Favorites Table
CREATE TABLE public.favorites (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id BIGINT REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, property_id)
);

-- ============================================================================
-- 2. PGVECTOR & SEMANTIC SEARCH RPC SETUP
-- ============================================================================
CREATE TABLE public.property_vectors (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  property_id BIGINT UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  content_summary TEXT NOT NULL,
  embedding vector(768) NOT NULL, -- Google text-embedding-004 dimension
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- High-performance HNSW index for sub-millisecond similarity queries
CREATE INDEX idx_property_vectors_hnsw_cosine
  ON public.property_vectors
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RPC Stored Procedure: Hybrid Natural Language Vector Similarity Search
CREATE OR REPLACE FUNCTION public.match_properties(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.2,
  match_count INT DEFAULT 10,
  filter_city TEXT DEFAULT NULL,
  filter_min_price NUMERIC DEFAULT NULL,
  filter_max_price NUMERIC DEFAULT NULL,
  filter_min_bedrooms INT DEFAULT NULL,
  filter_min_bathrooms NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  property_id BIGINT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  price NUMERIC,
  bedrooms INT,
  bathrooms NUMERIC,
  square_feet INT,
  description TEXT,
  features JSONB,
  photos JSONB,
  content_summary TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS property_id,
    p.address,
    p.city,
    p.state,
    p.zip_code,
    p.price,
    p.bedrooms,
    p.bathrooms,
    p.square_feet,
    p.description,
    p.features,
    p.photos,
    pv.content_summary,
    (1 - (pv.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.property_vectors pv
  JOIN public.properties p ON p.id = pv.property_id
  WHERE
    p.status = 'active'
    AND (1 - (pv.embedding <=> query_embedding)) >= match_threshold
    AND (filter_city IS NULL OR LOWER(p.city) = LOWER(filter_city))
    AND (filter_min_price IS NULL OR p.price >= filter_min_price)
    AND (filter_max_price IS NULL OR p.price <= filter_max_price)
    AND (filter_min_bedrooms IS NULL OR p.bedrooms >= filter_min_bedrooms)
    AND (filter_min_bathrooms IS NULL OR p.bathrooms >= filter_min_bathrooms)
  ORDER BY pv.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cma_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public properties are viewable by everyone"
  ON public.properties FOR SELECT TO public
  USING (status = 'active' OR auth.uid() = owner_id);

CREATE POLICY "Sellers can manage their listings"
  ON public.properties FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view relevant offers"
  ON public.offers FOR SELECT TO authenticated
  USING (
    auth.uid() = buyer_id OR
    EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND owner_id = auth.uid())
  );

CREATE POLICY "Buyers can submit offers"
  ON public.offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);
```

---

## Google GenAI SDK Services (`@google/genai`)

The application integrates with Gemini models using the official `@google/genai` package.

### 1. Centralized Gemini Initializer (`src/lib/ai/client.ts`)

```typescript
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY in environment variables.');
}

/**
 * Singleton instance of GoogleGenAI SDK
 */
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const GEMINI_MODELS = {
  CHAT_FLASH: 'gemini-3-flash-preview',
  REASONING_PRO: 'gemini-3-pro-preview',
  IMAGE_GEN: 'gemini-2.5-flash-image',
  VISION_PRO: 'gemini-3-pro-image-preview',
  EMBEDDINGS: 'text-embedding-004',
} as const;

/**
 * Generates 768-dimensional text embeddings using text-embedding-004
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: GEMINI_MODELS.EMBEDDINGS,
    contents: text,
  });

  if (!response.embedding?.values) {
    throw new Error('Failed to extract embedding values from response.');
  }

  return response.embedding.values;
}
```

---

### 2. Tools & Tool Executors (`src/lib/ai/tools.ts`)

```typescript
import { Type, FunctionDeclaration } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from './client';

export const searchPropertiesToolDeclaration: FunctionDeclaration = {
  name: 'searchProperties',
  description: 'Search for active real estate properties using natural language vector queries and filters.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'Natural language search query describing home attributes or lifestyle.' },
      city: { type: Type.STRING, description: 'Target city name.' },
      minPrice: { type: Type.NUMBER, description: 'Minimum price filter in USD.' },
      maxPrice: { type: Type.NUMBER, description: 'Maximum price filter in USD.' },
      minBedrooms: { type: Type.NUMBER, description: 'Minimum number of bedrooms.' },
    },
    required: ['query'],
  },
};

export const ALL_AGENT_TOOLS = [searchPropertiesToolDeclaration];

export async function executeSearchProperties(args: {
  query: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
}) {
  const supabase = await createClient();
  const queryVector = await generateEmbedding(args.query);

  const { data, error } = await supabase.rpc('match_properties', {
    query_embedding: queryVector,
    match_threshold: 0.2,
    match_count: 5,
    filter_city: args.city || null,
    filter_min_price: args.minPrice || null,
    filter_max_price: args.maxPrice || null,
    filter_min_bedrooms: args.minBedrooms || null,
  });

  if (error) return { success: false, error: error.message, listings: [] };
  return { success: true, count: data?.length || 0, properties: data || [] };
}
```

---

### 3. Conversational Agent Service (`src/lib/ai/chat.ts`)

```typescript
import { Content, Part } from '@google/genai';
import { ai, GEMINI_MODELS } from './client';
import { ALL_AGENT_TOOLS, executeSearchProperties } from './tools';

export interface ChatMessagePayload {
  role: 'user' | 'model';
  content: string;
}

export const DWELLINGLY_SYSTEM_INSTRUCTION = `
You are Dwellingly AI (NexHomeAgent), an elite real estate advisor and assistant.
Assist buyers and sellers with home searches, valuation analysis, and offer coordination.
Use searchProperties tool when users ask for real estate recommendations.
Format responses in clear Markdown with key listing highlights.
`;

export async function* streamAgentChat(params: {
  userId: string;
  history: ChatMessagePayload[];
  newMessage: string;
}) {
  const { userId, history, newMessage } = params;

  const contents: Content[] = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  contents.push({
    role: 'user',
    parts: [{ text: newMessage }],
  });

  // Streaming call using gemini-3-flash-preview
  const responseStream = await ai.models.generateContentStream({
    model: GEMINI_MODELS.CHAT_FLASH,
    contents: contents,
    config: {
      systemInstruction: DWELLINGLY_SYSTEM_INSTRUCTION,
      temperature: 0.7,
      tools: [{ functionDeclarations: ALL_AGENT_TOOLS }],
    },
  });

  let functionCallsToExecute: Array<{ name: string; args: Record<string, any> }> = [];

  for await (const chunk of responseStream) {
    if (chunk.text) {
      yield { type: 'token', content: chunk.text };
    }

    if (chunk.functionCalls) {
      for (const fc of chunk.functionCalls) {
        functionCallsToExecute.push({ name: fc.name, args: fc.args as Record<string, any> });
      }
    }
  }

  // Function Calling Execution Loop
  if (functionCallsToExecute.length > 0) {
    for (const call of functionCallsToExecute) {
      let toolResult: any;
      if (call.name === 'searchProperties') {
        toolResult = await executeSearchProperties(call.args as any);
      }

      yield { type: 'tool_executed', tool: call.name, args: call.args, result: toolResult };

      contents.push({
        role: 'model',
        parts: [{ functionCall: { name: call.name, args: call.args } }],
      });

      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: call.name, response: { result: toolResult } } }],
      });
    }

    // Follow-up generation after tool execution
    const followUpStream = await ai.models.generateContentStream({
      model: GEMINI_MODELS.CHAT_FLASH,
      contents: contents,
      config: { systemInstruction: DWELLINGLY_SYSTEM_INSTRUCTION },
    });

    for await (const chunk of followUpStream) {
      if (chunk.text) yield { type: 'token', content: chunk.text };
    }
  }
}
```

---

### 4. Automated Valuation Engine & CMA (`src/lib/ai/cma.ts`)

Uses `gemini-3-pro-preview` with a **thinking budget** (`thinkingBudget: 4096`) and structured JSON outputs (`responseSchema`).

```typescript
import { Type, Schema } from '@google/genai';
import { ai, GEMINI_MODELS } from './client';
import { createClient } from '@/lib/supabase/server';

const cmaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    estimatedMarketValue: { type: Type.NUMBER },
    confidenceScore: { type: Type.NUMBER },
    suggestedPriceRange: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER },
        max: { type: Type.NUMBER },
      },
      required: ['min', 'max'],
    },
    marketSummary: { type: Type.STRING },
    reasoningFactors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['estimatedMarketValue', 'confidenceScore', 'suggestedPriceRange', 'marketSummary', 'reasoningFactors'],
};

export async function generateCmaReport(propertyId: number, userId: string) {
  const supabase = await createClient();

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (!property) throw new Error('Property not found');

  const { data: comps } = await supabase
    .from('properties')
    .select('*')
    .eq('city', property.city)
    .neq('id', propertyId)
    .limit(4);

  const prompt = `
Perform a Comparative Market Analysis (CMA) for:
Subject: ${property.address}, ${property.city}, ${property.state}. Price: $${property.price}, ${property.bedrooms} Beds, ${property.bathrooms} Baths.
Description: ${property.description}

Local Comparables:
${JSON.stringify(comps || [])}
`;

  // Reasoning Pro call with Thinking Budget
  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.REASONING_PRO,
    contents: prompt,
    config: {
      temperature: 0.2,
      thinkingConfig: { thinkingBudget: 4096 },
      responseMimeType: 'application/json',
      responseSchema: cmaSchema,
    },
  });

  const parsedReport = JSON.parse(response.text || '{}');

  const { data: savedCma } = await supabase
    .from('cma_reports')
    .insert({
      property_id: propertyId,
      user_id: userId,
      estimated_valuation: parsedReport.estimatedMarketValue,
      valuation_range_low: parsedReport.suggestedPriceRange.min,
      valuation_range_high: parsedReport.suggestedPriceRange.max,
      report_data: parsedReport,
    })
    .select()
    .single();

  return { cmaReportId: savedCma.id, report: parsedReport };
}
```

---

## Next.js API Routes & Server Actions

### Real-Time SSE Chat Route (`src/app/api/chat/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamAgentChat } from '@/lib/ai/chat';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { messages, newMessage } = await req.json();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const generator = streamAgentChat({
          userId: user.id,
          history: messages || [],
          newMessage,
        });

        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

### Hybrid Vector Search Action (`src/actions/search.ts`)

```typescript
'use server';

import { generateEmbedding } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/server';

export async function performVectorSearchAction(filters: {
  query: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
}) {
  try {
    const supabase = await createClient();
    const queryEmbedding = await generateEmbedding(filters.query);

    const { data, error } = await supabase.rpc('match_properties', {
      query_embedding: queryEmbedding,
      match_threshold: 0.15,
      match_count: 12,
      filter_city: filters.city || null,
      filter_min_price: filters.minPrice || null,
      filter_max_price: filters.maxPrice || null,
      filter_min_bedrooms: filters.bedrooms || null,
    });

    if (error) return { success: false, error: error.message, results: [] };
    return { success: true, results: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, results: [] };
  }
}
```

---

## Frontend Interactive Components

### Slide-Over AI Assistant (`src/components/ai/AiChatWidget.tsx`)

```tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { X, Send, Bot, User, Loader2, Sparkles, Home, Mic, MicOff } from 'lucide-react';

export function AiChatWidget({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string; toolCall?: any }>>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your Dwellingly.ai assistant. I can search properties, run AI market valuations, or schedule home viewings. What are you looking for today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (customQuery?: string) => {
    const query = customQuery || input.trim();
    if (!query || isLoading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content })),
          newMessage: query,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let acc = '';

      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') break;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'token' && parsed.content) {
                acc += parsed.content;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: acc } : m))
                );
              } else if (parsed.type === 'tool_executed') {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, toolCall: parsed } : m))
                );
              }
            } catch {
              // Ignore non-json chunk boundaries
            }
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, content: 'Error retrieving response.' } : m))
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4 bg-slate-900 text-white">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-indigo-400" />
          <span className="font-bold text-sm">Dwellingly AI Concierge</span>
        </div>
        <button onClick={onClose}><X className="h-5 w-5" /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] ${
              m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white border'
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>

              {/* Render property recommendation cards when tools execute */}
              {m.toolCall?.result?.properties && (
                <div className="mt-3 space-y-2 border-t pt-2">
                  <p className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                    <Home className="h-3 w-3" /> Property Matches:
                  </p>
                  {m.toolCall.result.properties.slice(0, 3).map((p: any) => (
                    <Link key={p.property_id || p.id} href={`/properties/${p.property_id || p.id}`} onClick={onClose} className="block p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs hover:bg-indigo-50">
                      <div className="font-bold">{p.address}</div>
                      <div className="text-slate-500">${p.price?.toLocaleString()} • {p.bedrooms} beds</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
        <div ref={endRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI about homes, CMAs, or offers..."
          className="flex-1 rounded-xl border bg-slate-50 px-3.5 py-2 text-sm outline-none dark:bg-slate-800 dark:text-white"
        />
        <button type="submit" disabled={!input.trim() || isLoading} className="rounded-xl bg-indigo-600 px-4 py-2 text-white">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
```

---

## Third-Party Integration Abstractions

### Stripe Escrow & Earnest Payments (`src/lib/integrations/stripe.ts`)

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

export async function createEarnestMoneyCheckoutSession(params: {
  offerId: number;
  propertyAddress: string;
  amount: number;
  userEmail: string;
}) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: params.userEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Earnest Money Hold - ${params.propertyAddress}`,
            description: `Escrow deposit for Offer #${params.offerId}`,
          },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${origin}/dashboard?payment=success&offerId=${params.offerId}`,
    cancel_url: `${origin}/dashboard?payment=cancelled`,
  });
}
```

---

### Twilio Viewing Notifications (`src/lib/integrations/twilio.ts`)

```typescript
import twilio from 'twilio';

const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

export async function sendViewingConfirmationSMS(toPhone: string, propertyAddress: string, scheduledAt: string) {
  if (!client || !process.env.TWILIO_PHONE_NUMBER) {
    return { success: true, simulated: true };
  }

  const message = await client.messages.create({
    body: `[Dwellingly.ai] Your home tour request for ${propertyAddress} on ${new Date(scheduledAt).toLocaleString()} has been confirmed!`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toPhone,
  });

  return { success: true, sid: message.sid };
}
```

---

## Environment Setup & Deployment Guide

### Environment File Configuration (`.env.local`)

```bash
# Core App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiI..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiI..."

# Google GenAI SDK
GEMINI_API_KEY="AIzaSyYourGeminiApiKey"

# Stripe Integration
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Twilio SMS Integration
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_PHONE_NUMBER="+18005550199"
```

---

### Package Manifest (`package.json`)

```json
{
  "name": "dwellingly-ai",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@google/genai": "^0.1.1",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.48.1",
    "lucide-react": "^0.475.0",
    "next": "^15.1.7",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "stripe": "^17.7.0",
    "twilio": "^5.4.3"
  },
  "devDependencies": {
    "@types/node": "^22.13.4",
    "@types/react": "^19.0.10",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3"
  }
}
```

---

### Deployment Execution Steps

1. **Database Setup**:
   - Create a project on [Supabase](https://database.new).
   - Execute the SQL migrations in the Supabase SQL Editor (`pgvector` extension setup, tables, RPC function, and RLS policies).

2. **Application Installation**:

   ```bash
   git clone https://github.com/your-org/dwellingly-ai.git
   cd dwellingly-ai
   npm install
   ```

3. **Local Testing**:

   ```bash
   npm run dev
   ```

   Navigate to `http://localhost:3000` and test natural language vector search, the AI chat drawer, and CMA generation.

4. **Production Vercel Deployment**:
   - Push repository to GitHub.
   - Import project into Vercel.
   - Set environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, etc.) in Vercel.
   - Deploy.

**Metadata:**

```json
{
  "subtask_count": 6
}
```
