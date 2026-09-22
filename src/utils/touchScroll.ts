import React from 'react';

/**
 * Modern hardware-accelerated momentum touch scrolling hook.
 * Uses native GPU compositing and iOS/Android momentum scrolling
 * without triggering React component re-renders during active touch gestures.
 */
export function useElasticScroll(enabled = true) {
  if (!enabled) {
    return {
      touchHandlers: {},
      style: {}
    };
  }

  return {
    touchHandlers: {},
    style: {
      WebkitOverflowScrolling: 'touch' as const,
      overscrollBehaviorY: 'contain' as const,
      touchAction: 'pan-y' as const,
    }
  };
}

