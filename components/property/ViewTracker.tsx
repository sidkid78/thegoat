'use client';

import { useEffect, useRef } from 'react';
import { recordPropertyViewAction } from '@/app/actions/activity';

/**
 * Renders nothing; records that this property page was opened.
 *
 * The ref guard matters: React StrictMode runs effects twice in development,
 * and without it every local page load would count as two views and quietly
 * skew the signal a developer is trying to reason about.
 */
export function ViewTracker({ propertyId }: { propertyId: number }) {
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    void recordPropertyViewAction(propertyId);
  }, [propertyId]);

  return null;
}
